import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  ShieldCheck,
  Radio,
  Square,
  Compass,
  Activity,
  RotateCcw,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { ThemeMode } from '../types/companion';
import {
  adaptiveConsultStream,
  routeVoiceIntent,
  VoiceIntentResult,
  getClientGeminiApiKey,
  checkServerGeminiStatus,
} from '../services/api';

/**
 * Configurable Wake Word Constant.
 */
export const DEFAULT_WAKE_WORD = 'Hey Lumina';

/**
 * Exact Gemini System Instructions for the JSON Intent Router.
 * Exported so engineers and runtime callers can verify or inspect the prompt.
 */
export const INTENT_ROUTER_SYSTEM_INSTRUCTION = `You are Lumina's Voice Intent Router for an accessible web application.
Your job is to analyze the user's spoken voice command, determine their intent, and return a strict JSON object matching this schema:

1. ACTION: "CHANGE_FONT"
- Triggered by: Requests to make text larger or smaller, increase or decrease font size, make text huge, or reset to normal.
- Value rules:
  - If the user wants larger text: "A+"
  - If the user wants extra large, maximum, or huge text: "A++"
  - If the user wants smaller, normal, standard, or reset text: "DEFAULT"
  - Example: {"action": "CHANGE_FONT", "value": "A+"}

2. ACTION: "CHANGE_TAB"
- Triggered by: Requests to switch screens, change views, open a tool, or go somewhere else.
- Available tab values (use exact title):
  - "Explain It Simply" (for medical notes, prescriptions, doctor notes, bills, jargon translation)
  - "Check A Message" (for scam check, suspicious text, fraud verification)
  - "My Daily Rhythm" (for daily schedule, routines, medication checks, hydration)
  - "Walk Me Through It" (for step-by-step guides, how-to tutorials)
  - "Friendly Companion" (for friendly chat, conversation)
  - Example: {"action": "CHANGE_TAB", "value": "My Daily Rhythm"}

3. ACTION: "ASSISTANT_QUERY"
- Triggered by: General questions, medical note explanations, translation queries, safety questions, or conversational requests.
- Value: The user's query text with extraneous wake words stripped.
  - Example: {"action": "ASSISTANT_QUERY", "value": "<user_text>"}

Output MUST be a single valid JSON object with keys "action" and "value". No extra commentary.`;

/**
 * Type signature for the main Gemini API streaming function.
 */
export type GeminiStreamingFn = (
  input: any,
  onChunk: (accumulated: string, latestChunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
) => Promise<(() => void) | void> | (() => void) | void;

export interface VoiceAssistantProps {
  wakeWord?: string;
  themeMode?: ThemeMode;
  activeTab?: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion' | string;
  onNavigateTab?: (tab: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion') => void;
  onChangeFontSize?: (size: 'normal' | 'large' | 'huge') => void;
  onCommandTriggered?: (command: string) => void;
  onResponseReceived?: (command: string, response: string) => void;
  /**
   * Main Gemini API streaming function passed into the VoiceAssistant component as a prop.
   * Defaults to adaptiveConsultStream if not explicitly provided.
   */
  geminiStreamingFn?: GeminiStreamingFn;
  className?: string;
}

export type AssistantState =
  | 'disabled'
  | 'idle_listening'
  | 'wake_word_detected'
  | 'listening_full_command'
  | 'processing'
  | 'speaking'
  | 'error';

/**
 * Normalizes speech input by stripping punctuation, trimming extra whitespace, and converting to lowercase.
 */
function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Regex for fuzzy phonetic wake-word matching.
 * Matches: (hey|hi|hello|ok|okay) (lumina|luminous|lumena|illumina|mina|loumina|aluminer)
 */
export const WAKE_WORD_REGEX = /(?:(hey|hi|hello|ok|okay)\s+)?(lumina|luminous|lumena|illumina|mina|loumina|aluminer)\b/i;

interface ExtractedMatch {
  matched: boolean;
  wakeWord: string;
  command: string;
}

/**
 * Inspects transcript for wake-word trigger and splits the transcript string
 * to extract everything after the wake word.
 */
function extractVoiceCommand(transcript: string, customWakeWord?: string): ExtractedMatch {
  const normalized = normalizeSpeech(transcript);

  // 1. Check custom wake word if provided
  if (customWakeWord) {
    const normCustom = normalizeSpeech(customWakeWord);
    const customIdx = normalized.indexOf(normCustom);
    if (customIdx !== -1) {
      const parts = normalized.split(normCustom);
      const trailing = parts.slice(1).join(normCustom).replace(/^[\s,.:;!?-]+/, '').trim();
      return {
        matched: true,
        wakeWord: normCustom,
        command: trailing,
      };
    }
  }

  // 2. Fuzzy phonetic regex match
  const match = normalized.match(WAKE_WORD_REGEX);
  if (match && typeof match.index === 'number') {
    const matchedPhrase = match[0];
    const parts = normalized.split(new RegExp(matchedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    const trailing = parts.slice(1).join(matchedPhrase).replace(/^[\s,.:;!?-]+/, '').trim();
    return {
      matched: true,
      wakeWord: matchedPhrase,
      command: trailing,
    };
  }

  return {
    matched: false,
    wakeWord: '',
    command: '',
  };
}

/**
 * Plays an instant Web Audio API beep chime (440Hz oscillator for 120ms).
 */
function playWakeChime(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // 440Hz A4 tone

    // Smooth envelope over 120ms to avoid audio clicks
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (err) {
    console.warn('VoiceAssistant Web Audio chime error:', err);
  }
}

/**
 * Voice Assistant Component Inner Implementation
 */
function VoiceAssistantInner({
  wakeWord = DEFAULT_WAKE_WORD,
  themeMode = 'warm',
  activeTab = 'jargon',
  onNavigateTab,
  onChangeFontSize,
  onCommandTriggered,
  onResponseReceived,
  geminiStreamingFn,
  className = '',
}: VoiceAssistantProps) {
  const isHighContrast = themeMode === 'high-contrast';

  // Component UI State
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [status, setStatus] = useState<AssistantState>('disabled');
  const [connectionStatus, setConnectionStatus] = useState<string>('Standby (Click Start Listening)');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Manual Wake-Word Bypass:
  // If the user physically clicks "Start Listening", temporarily disable the 'Hey Lumina' regex
  // requirement for the very next spoken phrase. Treat their immediate input as a direct command.
  const manualBypassRef = useRef<boolean>(false);
  const [isManualBypassActive, setIsManualBypassActive] = useState<boolean>(false);

  // Transcript and Streaming States
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [extractedCommand, setExtractedCommand] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiKeyAlert, setApiKeyAlert] = useState<string | null>(null);
  const [redToast, setRedToast] = useState<string | null>(null);
  const redToastTimerRef = useRef<any>(null);

  const showRedToast = useCallback((msg = 'API Key missing or invalid in server.ts') => {
    setRedToast(msg);
    if (redToastTimerRef.current) clearTimeout(redToastTimerRef.current);
    redToastTimerRef.current = setTimeout(() => {
      setRedToast(null);
    }, 6000);
  }, []);

  // 1. API SDK / Key Verification on mount:
  // Checks environment and server configuration; triggers immediate UI alert if undefined
  useEffect(() => {
    const clientKey = getClientGeminiApiKey();
    checkServerGeminiStatus().then((serverStatus) => {
      if (!serverStatus.configured && !clientKey) {
        const warning = 'API Key missing or invalid in server.ts';
        showRedToast(warning);
        setErrorMessage(warning);
        console.error('[VoiceAssistant API Connection Error]:', warning);
      }
    });
  }, [showRedToast]);

  // References to manage speech lifecycle and echo cancellation
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isEnabledRef = useRef<boolean>(isEnabled);
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

  // Auto-restart & exponential backoff tracking
  const restartTimerRef = useRef<any>(null);
  const backoffCountRef = useRef<number>(0);
  const lastStartTimeRef = useRef<number>(0);

  // Trailing speech accumulation & silence timeouts
  const wakeWordTriggeredRef = useRef<boolean>(false);
  const accumulatedCommandRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Deduplication
  const lastProcessedCommandRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);

  // Safe ref for safeStartRecognition to prevent hoisting / temporal dead-zone errors
  const safeStartRecognitionRef = useRef<() => void>(() => {});

  // Keep refs in sync with state
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  /**
   * Safely stops browser speech recognition without triggering unintended error states
   */
  const safeStopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Safe ignore
      }
    }
  }, []);

  /**
   * Halts active speech synthesis (TTS) and returns to idle listening if enabled
   */
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    if (isEnabledRef.current) {
      setStatus('idle_listening');
      setConnectionStatus("Active - Listening for 'Hey Lumina'");
    } else {
      setStatus('disabled');
      setConnectionStatus('Standby (Click Start Listening)');
    }
  }, []);

  /**
   * Calm senior-friendly text-to-speech with acoustic echo prevention
   */
  const speakAloud = useCallback(
    (text: string, onDone?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (onDone) onDone();
        return;
      }

      // Echo cancellation: abort speech recognition before speaking
      safeStopRecognition();
      window.speechSynthesis.cancel();

      isSpeakingRef.current = true;
      setStatus('speaking');
      setConnectionStatus('Speaking Response...');

      const cleanText = text
        .replace(/[*#_`~[\]]/g, '')
        .replace(/\n+/g, '. ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.85; // Calm, steady pacing
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      // Select gentle natural English voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Karen') ||
            v.name.includes('Google US English') ||
            v.name.includes('Daniel'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Resumes listening strictly AFTER utterance.onend fires
      utterance.onend = () => {
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        wakeWordTriggeredRef.current = false;
        accumulatedCommandRef.current = '';

        if (isEnabledRef.current) {
          setStatus('idle_listening');
          setConnectionStatus("Active - Listening for 'Hey Lumina'");
          // Brief acoustic cooldown (350ms) to allow speaker echo/room reverberation to fade
          setTimeout(() => {
            if (isEnabledRef.current && !isSpeakingRef.current) {
              safeStartRecognitionRef.current();
            }
          }, 350);
        } else {
          setStatus('disabled');
          setConnectionStatus('Standby (Click Start Listening)');
        }
        if (onDone) onDone();
      };

      utterance.onerror = (e) => {
        console.warn('VoiceAssistant speech error:', e);
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        wakeWordTriggeredRef.current = false;
        accumulatedCommandRef.current = '';

        if (isEnabledRef.current) {
          setStatus('idle_listening');
          setConnectionStatus("Active - Listening for 'Hey Lumina'");
          setTimeout(() => {
            if (isEnabledRef.current && !isSpeakingRef.current) {
              safeStartRecognitionRef.current();
            }
          }, 350);
        }
        if (onDone) onDone();
      };

      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        window.speechSynthesis.speak(utterance);
      } catch (speechErr) {
        console.warn('VoiceAssistant speech synthesis error:', speechErr);
        isSpeakingRef.current = false;
        if (onDone) onDone();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeStopRecognition]
  );

  /**
   * Helper to stream standard conversational / consultation queries via Gemini API
   */
  const streamConversationalQuery = useCallback(
    async (
      queryText: string,
      currentTab: string,
      activeStreamingFn: any,
      notifyResponse: any,
      speakFn: any
    ) => {
      // Check active tab context
      const isExplainItSimply =
        currentTab === 'jargon' ||
        currentTab?.toLowerCase().includes('explain') ||
        currentTab?.toLowerCase().includes('jargon');

      let promptContext: string;

      if (isExplainItSimply) {
        promptContext = `[Context: Active Screen is "Explain It Simply" (Medical & Document Translator)]\nUser Spoken Voice Command: "${queryText}"\nPlease translate and explain the document, prescription, lab test, or medical details in senior-friendly, reassuring plain English with clear, practical steps and any urgent red flags.`;
      } else {
        const tabDescriptions: Record<string, string> = {
          scam: 'Active Screen is "Check A Message" (Scam & Safety Guardian)',
          rhythm: 'Active Screen is "My Daily Rhythm" (Routine & Wellness Check)',
          task: 'Active Screen is "Walk Me Through It" (Step-by-Step Task Guide)',
          companion: 'Active Screen is "Friendly Companion" (Voice & Warm Chat)',
        };
        const activeDesc = tabDescriptions[currentTab] || `Active Screen is "${currentTab}"`;
        promptContext = `[Context: ${activeDesc}]\nUser Spoken Voice Command: "${queryText}"\nPlease provide a clear, supportive, and accessible answer.`;
      }

      setAssistantResponse('Consulting Gemini AI...');
      setConnectionStatus('Consulting Lumina knowledge base...');

      if (abortStreamRef.current) {
        abortStreamRef.current();
        abortStreamRef.current = null;
      }

      const streamingService = activeStreamingFn || adaptiveConsultStream;
      const payload: Record<string, any> = { query: promptContext, text: promptContext };

      const streamingPromise = (streamingService as any)(
        payload,
        (accumulated: string) => {
          setAssistantResponse(accumulated);
        },
        (fullText: string) => {
          setAssistantResponse(fullText);
          if (notifyResponse) {
            notifyResponse(queryText, fullText);
          }
          if (speakFn) {
            speakFn(fullText);
          }
        },
        (err: Error) => {
          console.error('[VoiceAssistant API Connection Error]:', err);
          const technicalBadge = 'API Key missing or invalid in server.ts';
          showRedToast(technicalBadge);
          setErrorMessage(technicalBadge);
          setStatus('error');
          setConnectionStatus(technicalBadge);
          isProcessingRef.current = false;
          // Strictly DO NOT speak "trouble reaching service"
        }
      );

      const cancelFn = await Promise.resolve(streamingPromise);
      if (typeof cancelFn === 'function') {
        abortStreamRef.current = cancelFn;
      }
    },
    [showRedToast]
  );

  /**
   * Action Execution & Intent Router:
   * 1. Immediate visual feedback ('Processing...') so user knows command was accepted.
   * 2. Sends transcript to Gemini API with response_mime_type: "application/json" for Intent Classification.
   * 3. Switch statement:
   *    - CHANGE_FONT: dynamically updates the app's CSS font-size state instead of writing text to the screen.
   *    - CHANGE_TAB: switches screen views.
   *    - ASSISTANT_QUERY: routes the text to the standard conversational API flow.
   */
  const executeVoiceCommand = useCallback(
    async (rawCommand: string) => {
      const cleanCommand = rawCommand
        .replace(/^[\s,.:;!?-]+/, '')
        .replace(/[\s,.:;!?-]+$/, '')
        .trim();

      if (!cleanCommand || cleanCommand.length < 2) {
        wakeWordTriggeredRef.current = false;
        setStatus('idle_listening');
        setConnectionStatus("Active - Listening for 'Hey Lumina'");
        return;
      }

      const now = Date.now();
      // Deduplicate: avoid executing identical command twice within 3.5 seconds
      if (
        cleanCommand.toLowerCase() === lastProcessedCommandRef.current.toLowerCase() &&
        now - lastProcessedTimeRef.current < 3500
      ) {
        wakeWordTriggeredRef.current = false;
        setStatus('idle_listening');
        setConnectionStatus("Active - Listening for 'Hey Lumina'");
        return;
      }

      if (isProcessingRef.current || isSpeakingRef.current) {
        return;
      }

      // 1. Immediately provide visual UI feedback so user knows command was accepted
      isProcessingRef.current = true;
      lastProcessedCommandRef.current = cleanCommand;
      lastProcessedTimeRef.current = now;

      setExtractedCommand(cleanCommand);
      setLiveTranscript('');
      setStatus('processing');
      setConnectionStatus('Analyzing intent with Gemini...');
      safeStopRecognition();

      // Read most up-to-date versions from latestActionRef to eliminate stale closure bugs
      const currentTab = latestActionRef.current.activeTab;
      const streamingFn = latestActionRef.current.geminiStreamingFn || adaptiveConsultStream;
      const onCmdTriggered = latestActionRef.current.onCommandTriggered;
      const onRespReceived = latestActionRef.current.onResponseReceived;
      const navFn = latestActionRef.current.onNavigateTab;
      const fontFn = latestActionRef.current.onChangeFontSize;
      const speakFn = latestActionRef.current.speakAloud;

      if (onCmdTriggered) {
        onCmdTriggered(cleanCommand);
      }

      // =========================================================================
      // 2. INSTANT LOCAL ACTION ROUTING (Zero Server Dependency)
      // For basic UI commands, do not make an external network call.
      // Handle them instantly with local client-side regex matching:
      // =========================================================================

      // A. Font size adjustments: if transcript matches /larger|bigger|increase font|huge/i -> trigger font size increase.
      if (/larger|bigger|increase font|huge/i.test(cleanCommand)) {
        const isHuge = /huge|maximum|biggest/i.test(cleanCommand);
        const targetSize: 'large' | 'huge' = isHuge ? 'huge' : 'large';
        if (fontFn) {
          fontFn(targetSize);
        }
        const feedback = targetSize === 'huge' ? 'Text size changed to Extra Large.' : 'Text size changed to Large.';
        setAssistantResponse('');
        setConnectionStatus(feedback);
        setStatus('idle_listening');
        isProcessingRef.current = false;
        if (speakFn) {
          speakFn(feedback, () => {
            if (isEnabledRef.current) {
              safeStartRecognitionRef.current();
            }
          });
        } else if (isEnabledRef.current) {
          safeStartRecognitionRef.current();
        }
        return; // Zero external network call!
      }

      // Also support font size reset/decrease locally
      if (/smaller|decrease font|reset font|normal font|standard font/i.test(cleanCommand)) {
        if (fontFn) {
          fontFn('normal');
        }
        const feedback = 'Text size reset to Standard.';
        setAssistantResponse('');
        setConnectionStatus(feedback);
        setStatus('idle_listening');
        isProcessingRef.current = false;
        if (speakFn) {
          speakFn(feedback, () => {
            if (isEnabledRef.current) {
              safeStartRecognitionRef.current();
            }
          });
        } else if (isEnabledRef.current) {
          safeStartRecognitionRef.current();
        }
        return; // Zero external network call!
      }

      // B. Tab switching: handle direct tab commands or "switch tab" / "next tab"
      if (/(?:switch|change|next)\s+tab/i.test(cleanCommand)) {
        const tabList: Array<'jargon' | 'scam' | 'rhythm' | 'task' | 'companion'> = [
          'jargon',
          'scam',
          'rhythm',
          'task',
          'companion',
        ];
        const tabLabels: Record<string, string> = {
          jargon: 'Explain It Simply',
          scam: 'Check A Message',
          rhythm: 'My Daily Rhythm',
          task: 'Walk Me Through It',
          companion: 'Friendly Companion',
        };
        const currentIdx = tabList.indexOf(currentTab as any);
        const nextTab = tabList[(currentIdx + 1) % tabList.length];
        if (navFn) {
          navFn(nextTab);
        }
        const feedback = `Switching to ${tabLabels[nextTab]}.`;
        setAssistantResponse('');
        setConnectionStatus(feedback);
        setStatus('idle_listening');
        isProcessingRef.current = false;
        if (speakFn) {
          speakFn(feedback, () => {
            if (isEnabledRef.current) {
              safeStartRecognitionRef.current();
            }
          });
        } else if (isEnabledRef.current) {
          safeStartRecognitionRef.current();
        }
        return; // Zero external network call!
      }

      if (/(?:go to|open|switch to|switch|show|view)/i.test(cleanCommand)) {
        let targetTab: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion' | null = null;
        let tabLabel = '';

        if (/scam|check a message|message|fraud|safety/i.test(cleanCommand)) {
          targetTab = 'scam';
          tabLabel = 'Check A Message';
        } else if (/daily rhythm|rhythm|routine|schedule|wellness/i.test(cleanCommand)) {
          targetTab = 'rhythm';
          tabLabel = 'My Daily Rhythm';
        } else if (/walk me through|task|guide|step by step|how to/i.test(cleanCommand)) {
          targetTab = 'task';
          tabLabel = 'Walk Me Through It';
        } else if (/friendly companion|companion|chat|friend|talk/i.test(cleanCommand)) {
          targetTab = 'companion';
          tabLabel = 'Friendly Companion';
        } else if (/explain it simply|explain|jargon|medical|doctor|prescription|bill|notes/i.test(cleanCommand)) {
          targetTab = 'jargon';
          tabLabel = 'Explain It Simply';
        }

        if (targetTab) {
          if (navFn) {
            navFn(targetTab);
          }
          const feedback = `Switching to ${tabLabel}.`;
          setAssistantResponse('');
          setConnectionStatus(feedback);
          setStatus('idle_listening');
          isProcessingRef.current = false;
          if (speakFn) {
            speakFn(feedback, () => {
              if (isEnabledRef.current) {
                safeStartRecognitionRef.current();
              }
            });
          } else if (isEnabledRef.current) {
            safeStartRecognitionRef.current();
          }
          return; // Zero external network call!
        }
      }

      // C. Fallback to Gemini only for free-form conversational or explanatory questions.
      try {
        // AI Intent Router (JSON Action Parsing):
        // Send transcript to Gemini API with response_mime_type: "application/json"
        const intent: VoiceIntentResult = await routeVoiceIntent(cleanCommand);

        // Action Execution Logic:
        // Switch statement intercepting Gemini's JSON response
        switch (intent.action) {
          case 'CHANGE_FONT': {
            // Dynamically update the app's CSS font-size state instead of writing text to the screen!
            const val = (intent.value || '').toUpperCase();
            let targetSize: 'normal' | 'large' | 'huge' = 'large';
            let feedback = 'Text size changed to Large.';

            if (val.includes('A++') || val.includes('HUGE') || val.includes('MAX') || val.includes('EXTRA')) {
              targetSize = 'huge';
              feedback = 'Text size changed to Extra Large.';
            } else if (
              val.includes('DEFAULT') ||
              val.includes('NORMAL') ||
              val.includes('RESET') ||
              val.includes('STANDARD') ||
              val.includes('A-') ||
              val.includes('SMALL')
            ) {
              targetSize = 'normal';
              feedback = 'Text size reset to Standard.';
            } else {
              targetSize = 'large';
              feedback = 'Text size changed to Large.';
            }

            if (fontFn) {
              fontFn(targetSize);
            }

            setAssistantResponse('');
            const statusWithNotice = intent.debugNotice ? `${feedback} (${intent.debugNotice})` : feedback;
            setConnectionStatus(statusWithNotice);

            if (speakFn) {
              speakFn(feedback, () => {
                isProcessingRef.current = false;
                if (isEnabledRef.current) {
                  setStatus('idle_listening');
                  setConnectionStatus(statusWithNotice);
                  safeStartRecognitionRef.current();
                }
              });
            } else {
              isProcessingRef.current = false;
              if (isEnabledRef.current) {
                setStatus('idle_listening');
                setConnectionStatus(statusWithNotice);
                safeStartRecognitionRef.current();
              }
            }
            break;
          }

          case 'CHANGE_TAB': {
            const val = (intent.value || '').toLowerCase();
            let targetTab: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion' = 'jargon';
            let tabLabel = 'Explain It Simply';

            if (val.includes('scam') || val.includes('message') || val.includes('check')) {
              targetTab = 'scam';
              tabLabel = 'Check A Message';
            } else if (val.includes('rhythm') || val.includes('daily') || val.includes('routine') || val.includes('schedule')) {
              targetTab = 'rhythm';
              tabLabel = 'My Daily Rhythm';
            } else if (val.includes('task') || val.includes('walk') || val.includes('step') || val.includes('guide')) {
              targetTab = 'task';
              tabLabel = 'Walk Me Through It';
            } else if (val.includes('companion') || val.includes('chat') || val.includes('friend')) {
              targetTab = 'companion';
              tabLabel = 'Friendly Companion';
            } else {
              targetTab = 'jargon';
              tabLabel = 'Explain It Simply';
            }

            if (navFn) {
              navFn(targetTab);
            }

            const feedback = `Switching to ${tabLabel}.`;
            setAssistantResponse('');
            const statusWithNotice = intent.debugNotice ? `${feedback} (${intent.debugNotice})` : feedback;
            setConnectionStatus(statusWithNotice);

            if (speakFn) {
              speakFn(feedback, () => {
                isProcessingRef.current = false;
                if (isEnabledRef.current) {
                  setStatus('idle_listening');
                  setConnectionStatus(statusWithNotice);
                  safeStartRecognitionRef.current();
                }
              });
            } else {
              isProcessingRef.current = false;
              if (isEnabledRef.current) {
                setStatus('idle_listening');
                setConnectionStatus(statusWithNotice);
                safeStartRecognitionRef.current();
              }
            }
            break;
          }

          case 'ASSISTANT_QUERY':
          default: {
            // Route the text to the standard conversational API flow
            const queryText = intent.value || cleanCommand;
            await streamConversationalQuery(queryText, currentTab, streamingFn, onRespReceived, speakFn);
            break;
          }
        }
      } catch (err: any) {
        console.error('[VoiceAssistant API Connection Error]:', err);
        const technicalBadge = 'API Key missing or invalid in server.ts';
        showRedToast(technicalBadge);
        setErrorMessage(technicalBadge);
        setStatus('error');
        setConnectionStatus(technicalBadge);
        isProcessingRef.current = false;
        // Strictly DO NOT speak "trouble reaching service"
      }
    },
    [safeStopRecognition, streamConversationalQuery, showRedToast]
  );

  // =========================================================================
  // CORE FIX: latestActionRef to eliminate Stale Closure bugs in SpeechRecognition
  // =========================================================================
  interface LatestActionRefState {
    activeTab: string;
    geminiStreamingFn?: GeminiStreamingFn;
    executeVoiceCommand: (command: string) => Promise<void>;
    onCommandTriggered?: (command: string) => void;
    onResponseReceived?: (command: string, response: string) => void;
    onNavigateTab?: (tab: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion') => void;
    onChangeFontSize?: (size: 'normal' | 'large' | 'huge') => void;
    speakAloud: (text: string, onDone?: () => void) => void;
  }

  const latestActionRef = useRef<LatestActionRefState>({} as LatestActionRefState);

  // Update this ref on EVERY render so speech recognition callbacks always access the freshest state
  latestActionRef.current = {
    activeTab,
    geminiStreamingFn,
    executeVoiceCommand,
    onCommandTriggered,
    onResponseReceived,
    onNavigateTab,
    onChangeFontSize,
    speakAloud,
  };

  /**
   * Initializes the native SpeechRecognition engine.
   * Reads from latestActionRef.current inside recognition.onresult to prevent stale closures.
   */
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      setConnectionStatus('Browser Not Supported');
      setStatus('error');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      lastStartTimeRef.current = Date.now();
      setErrorMessage(null);

      if (!isSpeakingRef.current && !isProcessingRef.current) {
        setStatus('idle_listening');
        if (manualBypassRef.current) {
          setConnectionStatus("Direct Listening Active - Speak your command or say 'Hey Lumina'");
        } else {
          setConnectionStatus("Active - Listening for 'Hey Lumina'");
        }
      }
    };

    /**
     * Speech Recognition Result Event:
     * Reads from latestActionRef.current to guarantee current tab state and streaming function.
     */
    recognition.onresult = (event: any) => {
      // Discard inputs while speaking or processing to prevent acoustic feedback / self-triggering
      if (
        isSpeakingRef.current ||
        isProcessingRef.current ||
        (typeof window !== 'undefined' && window.speechSynthesis?.speaking)
      ) {
        return;
      }

      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          final += text + ' ';
        } else {
          interim += text;
        }
      }

      const activeText = (final + interim).trim();
      if (!activeText) return;

      // Update real-time Live Transcript Preview
      setLiveTranscript(activeText);

      // =========================================================================
      // 1. MANUAL WAKE-WORD BYPASS:
      // If the user physically clicked "Start Listening", bypass the 'Hey Lumina' regex
      // requirement for the very next spoken phrase. Treat their immediate input as a direct command!
      // =========================================================================
      if (manualBypassRef.current) {
        // Check if the user also spoke the wake word or not
        const matchResult = extractVoiceCommand(activeText, wakeWord);
        const directCommand = matchResult.matched && matchResult.command ? matchResult.command : activeText;

        wakeWordTriggeredRef.current = true;
        accumulatedCommandRef.current = directCommand;

        setStatus('listening_full_command');
        setConnectionStatus('Direct command active - Listening...');

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        silenceTimerRef.current = setTimeout(() => {
          if (accumulatedCommandRef.current.trim().length > 1) {
            const cmdToExecute = accumulatedCommandRef.current.trim();
            // Disarm manual bypass after the very next command is accepted
            manualBypassRef.current = false;
            setIsManualBypassActive(false);
            wakeWordTriggeredRef.current = false;
            accumulatedCommandRef.current = '';
            // Read from latestActionRef.current to eliminate stale closures
            latestActionRef.current.executeVoiceCommand(cmdToExecute);
          }
        }, 900);
        return;
      }

      // 2. Standard Hands-Free Wake-Word Detection
      if (!wakeWordTriggeredRef.current) {
        const matchResult = extractVoiceCommand(activeText, wakeWord);

        if (matchResult.matched) {
          wakeWordTriggeredRef.current = true;
          // Play instant Web Audio API 440Hz beep chime for 120ms
          playWakeChime(audioCtxRef);

          setStatus('listening_full_command');
          setConnectionStatus('Heard wake word! Listening for your command...');

          const trailingCommand = matchResult.command;
          accumulatedCommandRef.current = trailingCommand;

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }

          // If the user spoke their command in the same breath (e.g. 'Hey Lumina explain this document')
          if (trailingCommand.length > 2) {
            silenceTimerRef.current = setTimeout(() => {
              if (wakeWordTriggeredRef.current && accumulatedCommandRef.current.length > 2) {
                const cmdToExecute = accumulatedCommandRef.current;
                wakeWordTriggeredRef.current = false;
                accumulatedCommandRef.current = '';
                // Read from latestActionRef.current to eliminate stale closures
                latestActionRef.current.executeVoiceCommand(cmdToExecute);
              }
            }, 900);
          }
        }
      } else {
        // Wake word was previously triggered in this session; accumulate trailing command
        const matchResult = extractVoiceCommand(activeText, wakeWord);
        const trailingCommand = matchResult.matched ? matchResult.command : activeText;
        accumulatedCommandRef.current = trailingCommand;

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Wait 900ms after user pauses speaking before finalizing and executing the voice command
        silenceTimerRef.current = setTimeout(() => {
          if (wakeWordTriggeredRef.current && accumulatedCommandRef.current.length > 1) {
            const cmdToExecute = accumulatedCommandRef.current;
            wakeWordTriggeredRef.current = false;
            accumulatedCommandRef.current = '';
            // Read from latestActionRef.current to eliminate stale closures
            latestActionRef.current.executeVoiceCommand(cmdToExecute);
          }
        }, 900);
      }
    };

    /**
     * Strict error recovery without terminating component lifecycle
     */
    recognition.onerror = (event: any) => {
      const err = event.error;

      // 'no-speech' is normal browser silence; ignore without disruption
      if (err === 'no-speech') {
        return;
      }

      // 'aborted' occurs normally during manual toggling, TTS interruption, or tab switching
      if (err === 'aborted') {
        return;
      }

      // 'not-allowed' or permission denied
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setErrorMessage('Microphone access was blocked. Please click the lock or settings icon in your browser address bar to allow audio.');
        setConnectionStatus('Microphone Blocked');
        setIsEnabled(false);
        manualBypassRef.current = false;
        setIsManualBypassActive(false);
        setStatus('error');
        return;
      }

      // Network hiccups: keep component alive and attempt backoff restart
      if (err === 'network') {
        setConnectionStatus('Network Glitch - Reconnecting...');
      } else {
        console.warn('VoiceAssistant recognition notice:', err);
      }
    };

    /**
     * Auto-restart loop with exponential backoff on silence/shutdown
     */
    recognition.onend = () => {
      // If hands-free mode is toggled ON and not speaking/processing, seamlessly restart
      if (isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        const timeSinceStart = Date.now() - lastStartTimeRef.current;

        // If restarting repeatedly within 1200ms, increase backoff to prevent CPU spin
        if (timeSinceStart < 1200) {
          backoffCountRef.current = Math.min(backoffCountRef.current + 1, 5);
        } else {
          backoffCountRef.current = 0;
        }

        const delay = Math.max(150, Math.min(4000, 200 * Math.pow(1.5, backoffCountRef.current)));
        setConnectionStatus('Restarting listener...');

        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
            safeStartRecognition();
          }
        }, delay);
      }
    };

    return recognition;
  }, [wakeWord]);

  /**
   * Safely activates native speech recognition
   */
  const safeStartRecognition = useCallback(() => {
    if (!isEnabledRef.current) return;
    if (isSpeakingRef.current || isProcessingRef.current) return;

    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        // Recognition is already active or transitioning
      }
    }
  }, [initRecognition]);

  safeStartRecognitionRef.current = safeStartRecognition;

  /**
   * Explicit "Start Listening" / Manual Activation Toggle
   * 1. Temporarily arms manual wake-word bypass for the very next spoken phrase.
   * 2. Satisfies browser autoplay and microphone user-activation security policies.
   */
  const handleToggleListening = async () => {
    // Un-suspend AudioContext during direct user click
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
      }
    } catch (e) {
      // safe ignore
    }

    playWakeChime(audioCtxRef);
    const nextState = !isEnabled;

    if (nextState) {
      // Explicitly test and request microphone access via getUserMedia
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Release track immediately so speech recognition has exclusive audio access
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          console.warn('Microphone permission check failed:', permErr);
          setErrorMessage('Microphone access was denied. Please click the lock icon in your address bar to allow audio.');
          setConnectionStatus('Microphone Blocked');
          setIsEnabled(false);
          manualBypassRef.current = false;
          setIsManualBypassActive(false);
          setStatus('error');
          return;
        }
      }

      // Enable manual wake-word bypass for the very next spoken phrase
      manualBypassRef.current = true;
      setIsManualBypassActive(true);

      setIsEnabled(true);
      isEnabledRef.current = true;
      setErrorMessage(null);
      setStatus('idle_listening');
      setConnectionStatus("Direct Listening Active - Speak your command or say 'Hey Lumina'");
      wakeWordTriggeredRef.current = false;
      accumulatedCommandRef.current = '';
      safeStartRecognition();
    } else {
      setIsEnabled(false);
      isEnabledRef.current = false;
      manualBypassRef.current = false;
      setIsManualBypassActive(false);
      safeStopRecognition();
      stopSpeaking();
      if (abortStreamRef.current) {
        abortStreamRef.current();
        abortStreamRef.current = null;
      }
      setStatus('disabled');
      setConnectionStatus('Standby (Click Start Listening)');
      setLiveTranscript('');
      wakeWordTriggeredRef.current = false;
      accumulatedCommandRef.current = '';
    }
  };

  // Cross-Tab Visibility / Focus Recovery
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isEnabledRef.current &&
        !isSpeakingRef.current &&
        !isProcessingRef.current
      ) {
        safeStartRecognition();
      }
    };

    const handleWindowFocus = () => {
      if (isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        safeStartRecognition();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [safeStartRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (abortStreamRef.current) abortStreamRef.current();
      safeStopRecognition();
      stopSpeaking();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [safeStopRecognition, stopSpeaking]);

  return (
    <aside
      id="voice-assistant-floating-root"
      aria-label="Hands-free voice assistant"
      className={`fixed top-3 right-3 sm:right-6 z-40 max-w-[calc(100vw-1.5rem)] sm:max-w-md transition-all duration-300 ${className}`}
    >
      {/* Brief Red Toast Badge */}
      {redToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-1.5 px-3 py-1.5 bg-red-600 border border-red-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-between gap-2 animate-bounce"
        >
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-white fill-red-600 stroke-white stroke-[2.5]" />
            <span className="truncate">{redToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setRedToast(null)}
            className="p-0.5 hover:bg-red-700 rounded transition-colors cursor-pointer text-white"
            aria-label="Dismiss Alert"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Immediate API Key Alert */}
      {apiKeyAlert && (
        <div
          role="alert"
          className="mb-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl border border-amber-600 flex items-center justify-between gap-2 shadow-md"
        >
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 fill-slate-950 text-amber-500" />
            <span className="truncate">{apiKeyAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setApiKeyAlert(null)}
            className="p-0.5 hover:bg-amber-600 rounded transition-colors cursor-pointer"
            aria-label="Dismiss API Key Alert"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Slim Inline Horizontal Bar / Compact Pill */}
      <div
        className={`transition-all duration-200 shadow-md backdrop-blur-md border ${
          isExpanded ? 'rounded-2xl shadow-xl' : 'rounded-full'
        } ${
          isHighContrast
            ? 'bg-slate-950/95 border-amber-400 text-white shadow-amber-400/10'
            : 'bg-white/95 border-slate-300 dark:bg-slate-900/95 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-slate-900/10'
        }`}
      >
        {/* Main Compact Control Strip */}
        <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center justify-between gap-2 sm:gap-2.5">
          {/* Quick Mic Icon & Shrunk Title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              id="btn-voice-assistant-header-mic"
              onClick={handleToggleListening}
              title={isEnabled ? 'Tap to turn off Voice Assistant' : 'Tap to turn on Voice Assistant'}
              aria-label={isEnabled ? 'Turn off Voice Assistant' : 'Turn on Voice Assistant'}
              className={`p-1 rounded-full border transition-all cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                status === 'speaking'
                  ? 'bg-emerald-500 text-white border-emerald-300 animate-pulse'
                  : status === 'processing'
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : status === 'listening_full_command' || status === 'wake_word_detected'
                  ? 'bg-rose-600 text-white border-white animate-pulse'
                  : status === 'idle_listening'
                  ? 'bg-[#0A192F] text-amber-400 border-amber-400/50'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
              }`}
            >
              {status === 'speaking' ? (
                <Volume2 className="w-4 h-4 stroke-[2.2]" />
              ) : status === 'processing' ? (
                <Loader2 className="w-4 h-4 stroke-[2.2] animate-spin" />
              ) : isEnabled ? (
                <Mic className="w-4 h-4 stroke-[2.2]" />
              ) : (
                <MicOff className="w-4 h-4 stroke-[2.2]" />
              )}
            </button>

            {/* Shrunk 'HANDS-FREE ASSISTANT' and compact status */}
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300 truncate">
                  Hands-Free
                </span>
                {isEnabled && (
                  <span className="flex h-1.5 w-1.5 relative shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <p
                id="voice-assistant-status-text"
                className="text-[11px] font-bold truncate max-w-[85px] sm:max-w-[120px] text-slate-700 dark:text-slate-200"
              >
                {!isEnabled && 'Off'}
                {isEnabled && isManualBypassActive && status === 'idle_listening' && 'Direct'}
                {isEnabled && !isManualBypassActive && status === 'idle_listening' && `"${wakeWord}"`}
                {isEnabled &&
                  (status === 'listening_full_command' || status === 'wake_word_detected') &&
                  'Listening...'}
                {isEnabled && status === 'processing' && 'Thinking...'}
                {isEnabled && status === 'speaking' && 'Speaking...'}
                {status === 'error' && 'Error'}
              </p>
            </div>
          </div>

          {/* Action Controls: Shrunk 'Start/Stop' Button, Stop Audio (if speaking), Chevron Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Shrunk Stop Speaking Button */}
            {status === 'speaking' && (
              <button
                type="button"
                id="btn-voice-assistant-stop-speaking"
                onClick={stopSpeaking}
                className="px-2 py-0.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[10px] sm:text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Stop speaking"
                aria-label="Stop speaking"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Stop</span>
              </button>
            )}

            {/* Shrunk 'Start / Stop Listening' Button */}
            <button
              type="button"
              id="btn-toggle-handsfree-assistant"
              onClick={handleToggleListening}
              className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 shrink-0 shadow-xs ${
                isEnabled
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                  : isHighContrast
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-white font-extrabold'
                  : 'bg-[#0A192F] hover:bg-[#1E3A8A] text-white border-[#0A192F]'
              }`}
              title={isEnabled ? 'Stop listening' : 'Start listening'}
            >
              {isEnabled ? (
                <>
                  <MicOff className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                  <span>Start</span>
                </>
              )}
            </button>

            {/* Tiny 'Chevron' Dropdown Button to toggle verbose info */}
            <button
              type="button"
              id="btn-voice-assistant-toggle-expand"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide assistant details' : 'Show assistant details'}
              title={isExpanded ? 'Hide details' : 'Show details'}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.5] transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Dropdown Drawer: Verbose 'Status' and 'Live Mic' hidden behind tiny chevron */}
        {isExpanded && (
          <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 space-y-3 max-h-[300px] overflow-y-auto animate-fadeIn text-xs">
            {/* Status & Live Mic Diagnostics Panel */}
            <div className="space-y-1.5 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate font-semibold">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Status:</span>
                  <span className="font-mono text-[11px] font-bold truncate text-slate-700 dark:text-slate-300">
                    {connectionStatus}
                  </span>
                </div>
                {isEnabled && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Activity className="w-3 h-3 animate-pulse" />
                    <span>Live</span>
                  </span>
                )}
              </div>

              {/* Live Transcript Preview */}
              <div className="flex items-start gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] uppercase font-black text-[#D97706] shrink-0 mt-0.5">Live Mic:</span>
                <p className="font-mono text-[11px] truncate flex-1 text-slate-900 dark:text-slate-100">
                  {liveTranscript ? (
                    <span>&quot;{liveTranscript}&quot;</span>
                  ) : (
                    <span className="italic text-slate-400">Wake word: &quot;{wakeWord}&quot;</span>
                  )}
                </p>
              </div>
            </div>

            {/* Active Screen Badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <Compass className="w-3.5 h-3.5 text-[#D97706]" />
              <span>
                Active Screen: <strong className="capitalize text-[#0A192F] dark:text-white">{activeTab}</strong>
              </span>
            </div>

            {/* Recognized Command */}
            {extractedCommand && (
              <div className="p-2.5 rounded-xl border text-xs space-y-0.5 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-400 text-amber-950 dark:text-amber-100">
                <div className="text-[10px] font-black uppercase tracking-wider text-[#D97706] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Recognized Command</span>
                </div>
                <p className="font-bold">&quot;{extractedCommand}&quot;</p>
              </div>
            )}

            {/* Assistant Streaming Response */}
            {assistantResponse && (
              <div className="p-2.5 rounded-xl border text-xs space-y-1 bg-[#EFF6FF] dark:bg-slate-900 border-[#BFDBFE] dark:border-slate-700 text-[#1E3A8A] dark:text-slate-200">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Lumina Response
                  </span>
                  {status === 'speaking' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                      Playing Audio
                    </span>
                  )}
                </div>
                <p className="font-medium text-xs leading-relaxed text-[#0F172A] dark:text-white line-clamp-4">
                  {assistantResponse}
                </p>
              </div>
            )}

            {/* Privacy Assurance */}
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Local voice processing • Non-wake audio discarded</span>
            </div>
          </div>
        )}

        {/* Error Alert Display */}
        {errorMessage && (
          <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/80 border-t border-rose-300 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 dark:text-rose-300 hover:text-rose-900 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Strict Error Boundary State and Props
 */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Strict Error Boundary wrapping VoiceAssistant to guarantee failure isolation
 */
export class VoiceAssistantErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('VoiceAssistant Error Boundary caught an issue:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <aside
          id="voice-assistant-error-fallback"
          className="fixed top-3 right-3 sm:right-6 z-40 max-w-[calc(100vw-1.5rem)] sm:max-w-md"
        >
          <div className="rounded-2xl border-2 border-rose-400 bg-white dark:bg-slate-900 p-4 shadow-xl text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Voice Assistant Recovered from Unexpected Error</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              The speech engine encountered an exception. Click below to re-initialize cleanly.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold flex items-center gap-1.5 cursor-pointer hover:bg-rose-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Assistant</span>
            </button>
          </div>
        </aside>
      );
    }

    return this.props.children;
  }
}

/**
 * Primary Export: VoiceAssistant wrapped safely in VoiceAssistantErrorBoundary
 */
export function VoiceAssistant(props: VoiceAssistantProps) {
  return (
    <VoiceAssistantErrorBoundary>
      <VoiceAssistantInner {...props} />
    </VoiceAssistantErrorBoundary>
  );
}
