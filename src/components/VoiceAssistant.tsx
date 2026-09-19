import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { ThemeMode } from '../types/companion';
import { SoundEffects } from '../utils/speech';
import { adaptiveConsult } from '../services/api';

/**
 * Configurable Wake Word Constant.
 * Easily change the assistant's name or wake phrase here.
 */
export const DEFAULT_WAKE_WORD = 'Hey Lumina';

interface VoiceAssistantProps {
  /**
   * Configurable wake word. Defaults to 'Hey Lumina'.
   */
  wakeWord?: string;
  /**
   * Theme mode for accessible high-contrast rendering.
   */
  themeMode?: ThemeMode;
  /**
   * Current active tab in the app so the assistant knows what the user is seeing.
   */
  activeTab?: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion';
  /**
   * Function to navigate between application tabs via voice.
   */
  onNavigateTab?: (tab: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion') => void;
  /**
   * Function to change text size via voice.
   */
  onChangeFontSize?: (size: 'normal' | 'large' | 'huge') => void;
  /**
   * Optional callback when a valid voice command is triggered.
   */
  onCommandTriggered?: (command: string) => void;
  /**
   * Optional callback when Gemini returns a response.
   */
  onResponseReceived?: (command: string, response: string) => void;
  /**
   * Optional CSS class overrides.
   */
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

export function VoiceAssistant({
  wakeWord = DEFAULT_WAKE_WORD,
  themeMode = 'warm',
  activeTab = 'jargon',
  onNavigateTab,
  onChangeFontSize,
  onCommandTriggered,
  onResponseReceived,
  className = '',
}: VoiceAssistantProps) {
  const isHighContrast = themeMode === 'high-contrast';

  // Hands-Free Assistant Toggle State
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [status, setStatus] = useState<AssistantState>('disabled');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Transcript & Content States
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [extractedCommand, setExtractedCommand] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References to manage speech lifecycle, silence timeouts, and deduplication
  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef<boolean>(isEnabled);
  const statusRef = useRef<AssistantState>(status);
  const isSpeakingRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

  // Active command buffer and debounce timer
  const accumulatedCommandRef = useRef<string>('');
  const wakeWordTriggeredRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const restartTimerRef = useRef<any>(null);
  const waitTimeoutRef = useRef<any>(null);

  // Deduplication tracking
  const lastProcessedCommandRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);

  // Sync refs with state
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /**
   * Cleanly stop all active speech synthesis (TTS)
   */
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    if (statusRef.current === 'speaking' || statusRef.current === 'processing') {
      setStatus('idle_listening');
    }
  }, []);

  /**
   * Helper to safely stop recognition without triggering accidental restart
   */
  const safeStopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  /**
   * Synthesizes text aloud using window.speechSynthesis with calm senior-friendly pacing.
   * Pitch = 1.0, Rate = 0.85
   */
  const speakAloud = useCallback(
    (text: string, onDone?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        if (onDone) onDone();
        return;
      }

      // 1. Immediately halt speech recognition so the microphone NEVER listens to its own voice
      safeStopRecognition();
      window.speechSynthesis.cancel();

      isSpeakingRef.current = true;
      setStatus('speaking');

      // Strip markdown symbols and excessive punctuation for natural acoustic readout
      const cleanText = text
        .replace(/[*#_`~[\]]/g, '')
        .replace(/\n+/g, '. ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.85; // Calm, steady pacing for seniors
      utterance.pitch = 1.0; // Natural, clear pitch
      utterance.lang = 'en-US';

      // Pick a natural English voice if available
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

      utterance.onend = () => {
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        wakeWordTriggeredRef.current = false;
        accumulatedCommandRef.current = '';

        if (isEnabledRef.current) {
          setStatus('idle_listening');
          // Wait 400ms cooldown after speech ends before unmuting mic
          setTimeout(() => {
            safeStartRecognition();
          }, 400);
        } else {
          setStatus('disabled');
        }
        if (onDone) onDone();
      };

      utterance.onerror = (e) => {
        console.warn('VoiceAssistant TTS error:', e);
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        wakeWordTriggeredRef.current = false;
        accumulatedCommandRef.current = '';

        if (isEnabledRef.current) {
          setStatus('idle_listening');
          setTimeout(() => {
            safeStartRecognition();
          }, 400);
        }
        if (onDone) onDone();
      };

      window.speechSynthesis.speak(utterance);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeStopRecognition]
  );

  /**
   * Checks if user command is a direct verbal request to navigate tabs
   */
  const handleVoiceNavigation = useCallback(
    (cmd: string): boolean => {
      const lower = cmd.toLowerCase();
      if (!onNavigateTab) return false;

      if (
        lower.includes('doctor note') ||
        lower.includes('medical note') ||
        lower.includes('explain note') ||
        lower.includes('translate') ||
        lower.includes('prescription') ||
        lower.includes('medical bill') ||
        lower.includes('explain it simply')
      ) {
        onNavigateTab('jargon');
        const reply = 'Switching to Medical and Document Translator.';
        setAssistantResponse(reply);
        speakAloud(reply);
        return true;
      }

      if (
        lower.includes('scam') ||
        lower.includes('fraud') ||
        lower.includes('suspicious') ||
        lower.includes('check a message') ||
        lower.includes('check text')
      ) {
        onNavigateTab('scam');
        const reply = 'Switching to Scam and Safety Guardian.';
        setAssistantResponse(reply);
        speakAloud(reply);
        return true;
      }

      if (
        lower.includes('daily rhythm') ||
        lower.includes('routine') ||
        lower.includes('schedule') ||
        lower.includes('hydration') ||
        lower.includes('morning check')
      ) {
        onNavigateTab('rhythm');
        const reply = 'Switching to My Daily Rhythm and Routines.';
        setAssistantResponse(reply);
        speakAloud(reply);
        return true;
      }

      if (
        lower.includes('task guide') ||
        lower.includes('how to') ||
        lower.includes('step by step') ||
        lower.includes('instructions')
      ) {
        onNavigateTab('task');
        const reply = 'Switching to Step-by-Step Task Guide.';
        setAssistantResponse(reply);
        speakAloud(reply);
        return true;
      }

      if (
        lower.includes('companion chat') ||
        lower.includes('talk to me') ||
        lower.includes('friendly chat')
      ) {
        onNavigateTab('companion');
        const reply = 'Switching to Companion Chat.';
        setAssistantResponse(reply);
        speakAloud(reply);
        return true;
      }

      if (onChangeFontSize) {
        if (
          lower.includes('make text huge') ||
          lower.includes('maximum size') ||
          lower.includes('biggest size') ||
          lower.includes('extra large') ||
          lower.includes('size huge') ||
          lower.includes('size a plus plus') ||
          lower.includes('a++')
        ) {
          onChangeFontSize('huge');
          const reply = 'Text size changed to Extra Large A plus plus.';
          setAssistantResponse(reply);
          speakAloud(reply);
          return true;
        }

        if (
          lower.includes('make text bigger') ||
          lower.includes('make text large') ||
          lower.includes('larger text') ||
          lower.includes('increase font') ||
          lower.includes('size large') ||
          lower.includes('size a plus') ||
          lower.includes('a+')
        ) {
          onChangeFontSize('large');
          const reply = 'Text size changed to Large A plus.';
          setAssistantResponse(reply);
          speakAloud(reply);
          return true;
        }

        if (
          lower.includes('standard size') ||
          lower.includes('normal size') ||
          lower.includes('reset size') ||
          lower.includes('default size') ||
          lower.includes('smaller text') ||
          lower.includes('standard text')
        ) {
          onChangeFontSize('normal');
          const reply = 'Text size reset to Standard.';
          setAssistantResponse(reply);
          speakAloud(reply);
          return true;
        }
      }

      return false;
    },
    [onNavigateTab, onChangeFontSize, speakAloud]
  );

  /**
   * Sends the FULL, extracted command into Gemini API, adapting to the user's active tab.
   * Prevents premature execution and identical repeat triggers.
   */
  const executeFullCommand = useCallback(
    async (rawCommand: string) => {
      const cleanCommand = rawCommand
        .replace(/^[\s,.:;!?-]+/, '')
        .replace(/[\s,.:;!?-]+$/, '')
        .trim();

      if (!cleanCommand || cleanCommand.length < 3) {
        wakeWordTriggeredRef.current = false;
        setStatus('idle_listening');
        return;
      }

      const now = Date.now();
      // Strict Deduplication: Do not re-run identical command within 8 seconds
      if (
        cleanCommand.toLowerCase() === lastProcessedCommandRef.current.toLowerCase() &&
        now - lastProcessedTimeRef.current < 8000
      ) {
        console.log('VoiceAssistant: Suppressing duplicate trigger for command:', cleanCommand);
        wakeWordTriggeredRef.current = false;
        setStatus('idle_listening');
        return;
      }

      // Check re-entrancy lock
      if (isProcessingRef.current || isSpeakingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      lastProcessedCommandRef.current = cleanCommand;
      lastProcessedTimeRef.current = now;

      setExtractedCommand(cleanCommand);
      setStatus('processing');
      safeStopRecognition();

      if (onCommandTriggered) {
        onCommandTriggered(cleanCommand);
      }

      // Check if user requested voice navigation first
      if (handleVoiceNavigation(cleanCommand)) {
        return;
      }

      try {
        // Tab Context Injection: inform Gemini what view the user is looking at
        const tabContextMap: Record<string, string> = {
          jargon: 'The user is on the "Explain It Simply" screen, looking at medical notes, lab results, prescriptions, or bills.',
          scam: 'The user is on the "Check A Message" screen, reviewing a suspicious text, call, or email.',
          rhythm: 'The user is on the "My Daily Rhythm" screen, managing daily routines, medications, hydration, and gentle check-ins.',
          task: 'The user is on the "Step-by-Step Task Guide" screen, learning how to do an everyday digital or household task.',
          companion: 'The user is on the "Companion Chat" screen, having a warm, friendly conversation.',
        };

        const activeContext = tabContextMap[activeTab] || '';
        const contextualQuery = activeContext
          ? `[Context: ${activeContext}] Spoken Voice Command: "${cleanCommand}"`
          : cleanCommand;

        // Query Gemini API with user-calibrated pacing
        const result = await adaptiveConsult({
          query: contextualQuery,
        });

        let answerText = result.headline || '';
        if (result.primaryPoints && result.primaryPoints.length > 0) {
          answerText += '. ' + result.primaryPoints.join('. ');
        }
        if (result.detailedContent) {
          answerText += '. ' + result.detailedContent;
        }

        setAssistantResponse(answerText);

        if (onResponseReceived) {
          onResponseReceived(cleanCommand, answerText);
        }

        // Multimodal Feedback: Read answer aloud with calm rate
        speakAloud(answerText);
      } catch (err: any) {
        console.error('VoiceAssistant Gemini API error:', err);
        const fallbackError = 'I am having a moment reaching the consultation service. Please try again.';
        setErrorMessage(fallbackError);
        setStatus('error');
        speakAloud(fallbackError);
      }
    },
    [activeTab, handleVoiceNavigation, onCommandTriggered, onResponseReceived, safeStopRecognition, speakAloud]
  );

  /**
   * Initializes native speech recognition engine with continuous listening
   */
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Use Chrome, Edge, or Safari.');
      setStatus('error');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setErrorMessage(null);
      if (!isSpeakingRef.current && !isProcessingRef.current) {
        setStatus('idle_listening');
      }
    };

    recognition.onresult = (event: any) => {
      // Discard all inputs while processing or speaking to prevent self-trigger and echoes
      if (isSpeakingRef.current || isProcessingRef.current) {
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
      setLiveTranscript(activeText);

      const normalizedTranscript = activeText.toLowerCase();
      const normalizedWakeWord = wakeWord.toLowerCase().trim();

      // 1. Check if wake word is present in the current speech buffer
      const wakeWordIndex = normalizedTranscript.indexOf(normalizedWakeWord);

      if (wakeWordIndex !== -1) {
        // First time seeing wake word in this session
        if (!wakeWordTriggeredRef.current) {
          wakeWordTriggeredRef.current = true;
          SoundEffects.playSoftChime(); // Gentle non-verbal chime confirmation
          setStatus('listening_full_command');
        }

        // Extract everything after the wake word
        const afterWakeWord = activeText.slice(wakeWordIndex + wakeWord.length).trim();
        accumulatedCommandRef.current = afterWakeWord;

        // Clear existing silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // If user spoke a command after the wake word, wait for 1200ms of silence before finalizing!
        // This ensures the user can finish speaking their full sentence without getting cut off!
        if (afterWakeWord.length > 2) {
          silenceTimerRef.current = setTimeout(() => {
            if (wakeWordTriggeredRef.current && accumulatedCommandRef.current.length > 2) {
              const fullCmd = accumulatedCommandRef.current;
              wakeWordTriggeredRef.current = false;
              accumulatedCommandRef.current = '';
              executeFullCommand(fullCmd);
            }
          }, 1200);
        } else {
          // User just said "Hey Lumina" and paused.
          // Wait 3 seconds. If still no command, gently ask "I am listening".
          if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
          waitTimeoutRef.current = setTimeout(() => {
            if (wakeWordTriggeredRef.current && accumulatedCommandRef.current.length === 0) {
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                const promptUtterance = new SpeechSynthesisUtterance('I am listening. What can I help you with?');
                promptUtterance.rate = 0.9;
                window.speechSynthesis.speak(promptUtterance);
              }
            }
          }, 3000);
        }
      } else if (wakeWordTriggeredRef.current) {
        // Wake word was triggered earlier, user is currently speaking their command
        accumulatedCommandRef.current = activeText;
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        silenceTimerRef.current = setTimeout(() => {
          if (wakeWordTriggeredRef.current && accumulatedCommandRef.current.length > 2) {
            const fullCmd = accumulatedCommandRef.current;
            wakeWordTriggeredRef.current = false;
            accumulatedCommandRef.current = '';
            executeFullCommand(fullCmd);
          }
        }, 1200);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;

      // 'no-speech' is a standard silent pause event in continuous mode; ignore without disruption
      if (err === 'no-speech') {
        return;
      }

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
        setIsEnabled(false);
        setStatus('disabled');
        return;
      }

      if (err === 'network') {
        setErrorMessage('Voice recognition encountered a temporary network glitch. Retrying...');
      }
    };

    recognition.onend = () => {
      // If continuous listening is enabled and we are not speaking or processing, revive listening cleanly!
      if (isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          safeStartRecognition();
        }, 300);
      }
    };

    return recognition;
  }, [wakeWord, executeFullCommand]);

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
        // Recognition is already active, ignore safely
      }
    }
  }, [initRecognition]);

  /**
   * Prominent Toggle to Enable / Disable Hands-Free Assistant with explicit permission request
   */
  const handleToggleAssistant = async () => {
    SoundEffects.playSoftChime();
    const nextState = !isEnabled;

    if (nextState) {
      // Explicitly request browser microphone permission first to avoid silent drops
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Release test stream so speech recognition has unobstructed hardware access
          stream.getTracks().forEach((track) => track.stop());
        } catch (permErr: any) {
          console.warn('Microphone permission denied:', permErr);
          setErrorMessage('Microphone access was denied. Please click the lock/camera icon in your address bar to allow audio.');
          setIsEnabled(false);
          setStatus('disabled');
          return;
        }
      }

      setIsEnabled(true);
      setErrorMessage(null);
      setStatus('idle_listening');
      wakeWordTriggeredRef.current = false;
      accumulatedCommandRef.current = '';
      safeStartRecognition();
    } else {
      setIsEnabled(false);
      safeStopRecognition();
      stopSpeaking();
      setStatus('disabled');
      setLiveTranscript('');
      wakeWordTriggeredRef.current = false;
      accumulatedCommandRef.current = '';
    }
  };

  // Cross-Tab Visibility / Focus Recovery:
  // When user switches browser tabs or returns to the window, revive recognition if it went dormant
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
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
      if (waitTimeoutRef.current) clearTimeout(waitTimeoutRef.current);
      safeStopRecognition();
      stopSpeaking();
    };
  }, [safeStopRecognition, stopSpeaking]);

  return (
    <aside
      id="voice-assistant-floating-root"
      aria-label="Hands-free voice assistant"
      className={`fixed bottom-5 right-4 sm:right-6 z-40 max-w-[94vw] sm:max-w-md transition-all duration-300 ${className}`}
    >
      {/* Outer Floating Card */}
      <div
        className={`rounded-3xl border-4 shadow-2xl transition-all overflow-hidden ${
          isHighContrast
            ? 'bg-[#060D17] border-amber-400 text-white ring-4 ring-amber-400/20'
            : 'bg-white border-[#0A192F] text-[#0A192F] ring-4 ring-blue-900/10'
        }`}
      >
        {/* Main Status Header Bar */}
        <div
          className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b-2 ${
            isHighContrast
              ? 'bg-slate-900 border-slate-800'
              : isEnabled
              ? 'bg-[#EFF6FF] border-[#BFDBFE]'
              : 'bg-[#F8FAFC] border-[#E2E8F0]'
          }`}
        >
          {/* Status Indicator & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl border-2 shrink-0 transition-all ${
                status === 'speaking'
                  ? 'bg-emerald-500 text-white border-emerald-300 animate-pulse'
                  : status === 'processing'
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : status === 'listening_full_command' || status === 'wake_word_detected'
                  ? 'bg-rose-600 text-white border-white animate-pulse'
                  : status === 'idle_listening'
                  ? 'bg-[#0A192F] text-amber-400 border-[#1E3A8A]'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
              }`}
            >
              {status === 'speaking' ? (
                <Volume2 className="w-5 h-5 stroke-[2.5]" />
              ) : status === 'processing' ? (
                <Loader2 className="w-5 h-5 stroke-[2.5] animate-spin" />
              ) : isEnabled ? (
                <Mic className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <MicOff className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300">
                  Hands-Free Voice
                </span>
                {isEnabled && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              {/* Status Badge Label */}
              <p
                id="voice-assistant-status-text"
                className="text-sm sm:text-base font-black truncate text-[#0A192F] dark:text-white"
              >
                {!isEnabled && 'Voice Assistant Off'}
                {isEnabled && status === 'idle_listening' && `Listening for "${wakeWord}"...`}
                {isEnabled &&
                  (status === 'listening_full_command' || status === 'wake_word_detected') &&
                  'Heard wake word! Listening to your full sentence...'}
                {isEnabled && status === 'processing' && 'Thinking & Consulting Lumina...'}
                {isEnabled && status === 'speaking' && 'Speaking answer aloud...'}
                {status === 'error' && 'Microphone Notice'}
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {status === 'speaking' && (
              <button
                type="button"
                id="btn-voice-assistant-stop-speaking"
                onClick={stopSpeaking}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                title="Stop speaking"
                aria-label="Stop speaking"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Stop</span>
              </button>
            )}

            <button
              type="button"
              id="btn-voice-assistant-toggle-expand"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse voice assistant details' : 'Expand voice assistant details'}
              title={isExpanded ? 'Collapse' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <ChevronUp className="w-5 h-5 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>

        {/* Prominent Enable / Disable Toggle Bar */}
        <div
          className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${
            isHighContrast
              ? 'bg-slate-950 border-slate-800'
              : 'bg-white border-[#E2E8F0]'
          }`}
        >
          <div className="text-xs sm:text-sm font-bold opacity-90 truncate">
            <span>Wake word: </span>
            <code className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-[#D97706] dark:text-amber-300 font-mono font-black">
              &quot;{wakeWord}&quot;
            </code>
          </div>

          <button
            type="button"
            id="btn-toggle-handsfree-assistant"
            onClick={handleToggleAssistant}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs sm:text-sm border-2 transition-all flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-400 shrink-0 ${
              isEnabled
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 shadow-sm'
                : isHighContrast
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-white'
                : 'bg-[#0A192F] hover:bg-[#1E3A8A] text-white border-[#0A192F]'
            }`}
          >
            {isEnabled ? (
              <>
                <MicOff className="w-4 h-4 stroke-[2.5]" />
                <span>Disable</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 stroke-[2.5]" />
                <span>Enable Hands-Free</span>
              </>
            )}
          </button>
        </div>

        {/* Expandable Conversation & Diagnostics Drawer */}
        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-4 max-h-[320px] overflow-y-auto animate-fadeIn">
            {/* Active Tab Badge */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <Compass className="w-3.5 h-3.5 text-[#D97706]" />
              <span>
                Active Screen: <strong className="capitalize text-[#0A192F] dark:text-white">{activeTab}</strong> (Voice navigation supported)
              </span>
            </div>

            {/* Live Audio & Speech Monitor */}
            {isEnabled && (
              <div
                className={`p-3 rounded-2xl border-2 text-xs font-bold space-y-1 ${
                  isHighContrast
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#334155]'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 uppercase text-[10px] font-black">
                  <span>Live Voice Transcript</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Radio className="w-3 h-3 animate-pulse" /> Active (Silence paused)
                  </span>
                </div>
                <p className="font-mono text-xs italic min-h-[24px] text-[#0A192F] dark:text-white">
                  {liveTranscript || '(Listening quietly in the background... say "Hey Lumina")'}
                </p>
              </div>
            )}

            {/* Last Recognized Command */}
            {extractedCommand && (
              <div
                className={`p-3 rounded-2xl border-2 text-sm space-y-1 ${
                  isHighContrast
                    ? 'bg-amber-950/40 border-amber-400 text-white'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="text-[11px] font-black uppercase tracking-wider text-[#D97706]">
                  Processed Spoken Command
                </div>
                <p className="font-extrabold">&quot;{extractedCommand}&quot;</p>
              </div>
            )}

            {/* Assistant AI Generated Response */}
            {assistantResponse && (
              <div
                className={`p-3 rounded-2xl border-2 text-sm space-y-1 ${
                  isHighContrast
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Lumina Response
                  </span>
                  {status === 'speaking' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                      Playing Audio (0.85x rate)
                    </span>
                  )}
                </div>
                <p className="font-medium text-xs sm:text-sm leading-relaxed text-[#0F172A] dark:text-white line-clamp-6">
                  {assistantResponse}
                </p>
              </div>
            )}

            {/* Privacy & Permission Notice */}
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-start gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Audio Leakage:</strong> Speech is parsed on your local device. Non-wake audio is immediately discarded.
              </span>
            </div>
          </div>
        )}

        {/* Error Alert Display */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border-t-2 border-rose-400 text-rose-900 dark:text-rose-200 text-xs font-black flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 dark:text-rose-300 hover:text-rose-900"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
