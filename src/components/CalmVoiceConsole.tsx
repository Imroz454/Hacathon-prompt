import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Sliders,
  CheckCircle2,
  HelpCircle,
  LayoutGrid,
  ChevronDown,
} from 'lucide-react';
import {
  AdaptivePreferences,
  ThemeMode,
  AdaptiveConsultResult,
} from '../types/companion';
import { createSpeechRecognizer, SoundEffects, TextToSpeech } from '../utils/speech';
import { adaptiveConsult, adaptiveConsultStream } from '../services/api';

interface CalmVoiceConsoleProps {
  preferences: AdaptivePreferences;
  onUpdatePreferences: (prefs: Partial<AdaptivePreferences>) => void;
  onSwitchToTab: (tabId: 'jargon' | 'scam' | 'rhythm' | 'task' | 'companion') => void;
  activeTab: string;
  themeMode: ThemeMode;
  onOpenIntakeModal: () => void;
}

export function CalmVoiceConsole({
  preferences,
  onUpdatePreferences,
  onSwitchToTab,
  activeTab,
  themeMode,
  onOpenIntakeModal,
}: CalmVoiceConsoleProps) {
  const isHighContrast = themeMode === 'high-contrast';
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [lastResponse, setLastResponse] = useState<AdaptiveConsultResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognizerRef = useRef<any>(null);
  const abortStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, []);

  useEffect(() => {
    recognizerRef.current = createSpeechRecognizer(
      (text) => {
        setTranscript(text);
      },
      (listening) => {
        setIsListening(listening);
        if (!listening) {
          SoundEffects.playSoftChime();
        }
      },
      (err) => {
        SoundEffects.playAlertChime();
        setErrorMsg(err);
      }
    );

    const unsubSpeaking = TextToSpeech.subscribeState((activeId) => {
      setIsSpeaking(activeId !== null);
    });

    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      unsubSpeaking();
    };
  }, []);

  const handleToggleMic = () => {
    setErrorMsg(null);
    TextToSpeech.stop();

    if (!recognizerRef.current?.isSupported) {
      setErrorMsg('Voice dictation is not available on this browser. You can tap the sample questions below.');
      return;
    }

    if (isListening) {
      recognizerRef.current.stop();
      if (transcript.trim()) {
        processVoiceInput(transcript.trim());
      }
    } else {
      setTranscript('');
      recognizerRef.current.start();
    }
  };

  const processVoiceInput = async (query: string) => {
    if (!query) return;
    setIsProcessing(true);
    setIsStreaming(true);
    setStreamingText('');
    setLastResponse(null);
    setErrorMsg(null);
    SoundEffects.playSoftChime();

    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }

    try {
      // Check for navigation shortcuts
      const lower = query.toLowerCase();
      if (lower.includes('note') || lower.includes('doctor') || lower.includes('translate') || lower.includes('jargon') || lower.includes('medical')) {
        onSwitchToTab('jargon');
      } else if (lower.includes('scam') || lower.includes('fraud') || lower.includes('suspicious') || lower.includes('text message')) {
        onSwitchToTab('scam');
      } else if (lower.includes('day') || lower.includes('rhythm') || lower.includes('routine') || lower.includes('morning') || lower.includes('afternoon') || lower.includes('evening')) {
        onSwitchToTab('rhythm');
      } else if (lower.includes('task') || lower.includes('walk me through') || lower.includes('how do i') || lower.includes('step by step') || lower.includes('learn')) {
        onSwitchToTab('task');
      } else if (lower.includes('chat') || lower.includes('friend') || lower.includes('companion') || lower.includes('talk')) {
        onSwitchToTab('companion');
      }

      const cancelFn = await adaptiveConsultStream(
        {
          query,
          primaryGoal: preferences.primaryGoal,
          explanationPacing: preferences.explanationPacing,
          interactionPreference: 'voice_commands',
        },
        (accumulatedText) => {
          // Streaming text chunks appear immediately on screen
          setIsProcessing(false);
          setStreamingText(accumulatedText);
        },
        async () => {
          setIsStreaming(false);
          setIsProcessing(false);
          try {
            const structuredResult = await adaptiveConsult({
              query,
              primaryGoal: preferences.primaryGoal,
              explanationPacing: preferences.explanationPacing,
              interactionPreference: 'voice_commands',
            });
            setLastResponse(structuredResult);
            SoundEffects.playSuccessChime();
            const speechSummary = `${structuredResult.headline}. ${structuredResult.primaryPoints.slice(0, 3).join('. ')}`;
            TextToSpeech.speak(speechSummary, 'calm-consult-reply');
          } catch {
            SoundEffects.playSuccessChime();
          }
        },
        async (streamErr) => {
          console.warn('Consultation stream fallback:', streamErr);
          try {
            const result = await adaptiveConsult({
              query,
              primaryGoal: preferences.primaryGoal,
              explanationPacing: preferences.explanationPacing,
              interactionPreference: 'voice_commands',
            });
            setLastResponse(result);
            SoundEffects.playSuccessChime();
            const speechSummary = `${result.headline}. ${result.primaryPoints.slice(0, 3).join('. ')}`;
            TextToSpeech.speak(speechSummary, 'calm-consult-reply');
          } catch (fallbackErr: any) {
            setErrorMsg(fallbackErr.message || 'Unable to process question. Please try again.');
            SoundEffects.playAlertChime();
          } finally {
            setIsStreaming(false);
            setIsProcessing(false);
          }
        }
      );

      abortStreamRef.current = cancelFn;
    } catch (err: any) {
      console.error('Error processing voice query:', err);
      setErrorMsg(err.message || 'Unable to process question. Please try again.');
      SoundEffects.playAlertChime();
      setIsProcessing(false);
      setIsStreaming(false);
    }
  };

  const handleStopSpeech = () => {
    TextToSpeech.stop();
    setIsSpeaking(false);
  };

  // Sample prompt chips tailored to user's Q2 Primary Goal
  const promptSuggestions = {
    understand_notes: [
      'Explain my lab test results in simple words',
      'What should I ask my doctor about my new prescription?',
      'Help me understand my hospital discharge notice',
    ],
    organize_day: [
      'Plan my morning routine with gentle hydration',
      'What is a safe mobility stretch for this afternoon?',
      'Remind me how to pace my medications today',
    ],
    learn_new: [
      'Walk me through making a video call to my family',
      'How do I take a picture and send it in a text?',
      'How do I adjust the volume on my tablet?',
    ],
  }[preferences.primaryGoal] || [
    'Explain my notes simply',
    'Plan my daily routine',
    'Walk me through a new task',
  ];

  return (
    <section
      aria-label="Calm Design Voice Console"
      className={`rounded-3xl border-4 p-6 sm:p-8 transition-all space-y-6 ${
        isHighContrast
          ? 'bg-[#060D17] border-amber-400 text-white'
          : 'bg-white border-[#1E3A8A] text-[#0F172A] shadow-lumina-md'
      }`}
    >
      {/* Top Banner: Calm Design Mode Status & Quick Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b-2 border-[#E2E8F0] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl border-2 ${
              isHighContrast
                ? 'bg-amber-400 text-slate-950 border-white'
                : 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
            }`}
          >
            <Sparkles className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D97706] text-white">
                Calm Design Active
              </span>
              <span className="text-xs font-bold text-[#64748B] dark:text-slate-400">
                Voice-First Interface
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0A192F] dark:text-white mt-0.5">
              Listening & Consultation Console
            </h2>
          </div>
        </div>

        {/* Action Controls: Switch back to Large Buttons / Standard Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="btn-switch-to-buttons"
            onClick={() => onUpdatePreferences({ isCalmVoiceModeActive: false, interactionPreference: 'large_buttons' })}
            className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all flex items-center gap-2 shadow-lumina-xs ${
              isHighContrast
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#1E3A8A]'
            }`}
            title="Switch from Calm Voice Mode to Standard Tab Menus"
          >
            <LayoutGrid className="w-4 h-4 stroke-[2.5]" />
            <span>Show Full Menu Tabs</span>
          </button>

          <button
            type="button"
            id="btn-reopen-intake"
            onClick={onOpenIntakeModal}
            className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all flex items-center gap-2 shadow-lumina-xs ${
              isHighContrast
                ? 'bg-slate-900 border-amber-400 text-amber-300'
                : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A] hover:bg-[#DBEAFE]'
            }`}
            title="Update your 3 adaptive intake preferences"
          >
            <Sliders className="w-4 h-4 stroke-[2.5]" />
            <span>Pacing & Goals</span>
          </button>
        </div>
      </div>

      {/* Enlarged Microphone Interface (Centerpiece) */}
      <div className="flex flex-col items-center justify-center text-center py-4 sm:py-6 space-y-4">
        {/* Giant Pulsing Tactile Microphone Button */}
        <div className="relative">
          {/* Animated Acoustic Waves when listening */}
          {isListening && (
            <div className="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
          )}

          <button
            id="btn-enlarged-voice-mic"
            type="button"
            onClick={handleToggleMic}
            aria-label={isListening ? 'Stop listening' : 'Tap the microphone to speak to Lumina'}
            className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 flex flex-col items-center justify-center transition-all shadow-2xl focus:outline-none focus:ring-8 select-none ${
              isListening
                ? 'bg-[#BE123C] text-white border-[#881337] ring-8 ring-rose-400/40 animate-pulse scale-105'
                : isHighContrast
                ? 'bg-amber-400 text-slate-950 border-white hover:bg-amber-300 ring-4 ring-amber-400/30'
                : 'bg-gradient-to-b from-[#D97706] to-[#B45309] text-white border-[#78350F] hover:from-[#B45309] hover:to-[#92400E] ring-4 ring-amber-400/30 active:scale-95'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-12 h-12 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-wider mt-1">Tap to Stop</span>
              </>
            ) : (
              <>
                <Mic className="w-12 h-12 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-wider mt-1">Tap to Speak</span>
              </>
            )}
          </button>
        </div>

        {/* State Announcement & Spoken Feedback */}
        <div className="space-y-1 max-w-xl">
          <p className="text-xl sm:text-2xl font-black text-[#0A192F] dark:text-white">
            {isListening
              ? 'Listening to you... Speak naturally.'
              : isProcessing
              ? 'Lumina is organizing your response...'
              : 'Tap the large microphone to speak to Lumina.'}
          </p>
          <p className="text-base font-bold text-[#475569] dark:text-slate-300">
            Current Pacing:{' '}
            <span className="text-[#D97706] dark:text-amber-300 underline underline-offset-2">
              {preferences.explanationPacing === 'quick_summary'
                ? 'Quick Summary (Concise)'
                : 'Step-by-Step (Gentle Walkthrough)'}
            </span>
          </p>
        </div>

        {/* Live Spoken Transcript Display */}
        {transcript && (
          <div
            className={`w-full max-w-2xl p-4 sm:p-5 rounded-2xl border-2 text-left animate-fadeIn ${
              isHighContrast
                ? 'bg-slate-900 border-amber-400 text-white'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300">
                You Spoke:
              </span>
              {!isListening && (
                <button
                  type="button"
                  onClick={() => processVoiceInput(transcript)}
                  className="text-xs font-black text-[#1E3A8A] dark:text-amber-300 hover:underline"
                >
                  Send Again ↵
                </button>
              )}
            </div>
            <p className="text-lg sm:text-xl font-black italic">"{transcript}"</p>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-[#FFF1EE] text-[#7A1D1D] text-base font-black border-2 border-[#E11D48] max-w-md">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Live Streaming Response Card (Words appear immediately) */}
      {isStreaming && streamingText && (
        <div
          className={`p-6 sm:p-8 rounded-2xl border-4 space-y-4 animate-fadeIn ${
            isHighContrast
              ? 'bg-slate-900 border-amber-400 text-white'
              : 'bg-[#EFF6FF] border-[#1E3A8A] text-[#0F172A]'
          }`}
        >
          <div className="flex items-center gap-3 border-b-2 border-[#BFDBFE] dark:border-slate-700 pb-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#D97706] animate-ping" />
            <h3 className="text-xl sm:text-2xl font-black">Lumina is responding live...</h3>
          </div>
          <p className="text-lg sm:text-xl font-medium leading-relaxed whitespace-pre-line">
            {streamingText}
            <span
              aria-hidden="true"
              className="inline-block w-2.5 h-5 ml-1 bg-[#D97706] dark:bg-amber-400 animate-pulse align-middle rounded-sm"
            />
          </p>
        </div>
      )}

      {/* AI Response Card (Rendered when question is answered) */}
      {lastResponse && (
        <div
          className={`p-6 sm:p-8 rounded-2xl border-4 space-y-4 animate-fadeIn ${
            isHighContrast
              ? 'bg-slate-900 border-amber-400 text-white'
              : 'bg-[#EFF6FF] border-[#1E3A8A] text-[#0F172A]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#BFDBFE] dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
              <h3 className="text-xl sm:text-2xl font-black">{lastResponse.headline}</h3>
            </div>
            <div className="flex items-center gap-2">
              {isSpeaking ? (
                <button
                  type="button"
                  onClick={handleStopSpeech}
                  className="px-4 py-2 rounded-xl text-sm font-black bg-[#BE123C] text-white flex items-center gap-2"
                >
                  <VolumeX className="w-4 h-4" /> Stop Voice
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const speechSummary = `${lastResponse.headline}. ${lastResponse.primaryPoints.join('. ')}`;
                    TextToSpeech.speak(speechSummary, 'calm-reply');
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-black bg-[#1E3A8A] text-white flex items-center gap-2"
                >
                  <Volume2 className="w-4 h-4" /> Read Aloud
                </button>
              )}
            </div>
          </div>

          {/* Primary Takeaways Points */}
          <div className="space-y-3">
            {lastResponse.primaryPoints.map((point, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border-2 flex items-start gap-3 ${
                  isHighContrast
                    ? 'bg-slate-950 border-slate-700 text-white'
                    : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-[#D97706] text-white flex items-center justify-center font-black text-sm shrink-0">
                  {idx + 1}
                </span>
                <p className="text-base sm:text-lg font-bold leading-relaxed">{point}</p>
              </div>
            ))}
          </div>

          {lastResponse.detailedContent && (
            <p className="text-base font-semibold opacity-90 leading-relaxed pt-2">
              {lastResponse.detailedContent}
            </p>
          )}
        </div>
      )}

      {/* Suggested Spoken Starters */}
      <div className="pt-2">
        <p className="text-sm font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-3 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#D97706]" />
          Or tap any question to ask Lumina:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {promptSuggestions.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTranscript(prompt);
                processVoiceInput(prompt);
              }}
              className={`p-4 rounded-2xl border-2 text-left text-base font-extrabold transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800 hover:border-amber-400'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0A192F] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
              }`}
            >
              💬 "{prompt}"
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
