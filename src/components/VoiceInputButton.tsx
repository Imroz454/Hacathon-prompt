import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles } from 'lucide-react';
import { createSpeechRecognizer, SoundEffects, TextToSpeech } from '../utils/speech';
import { AdaptiveStateManager } from '../utils/adaptiveState';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onStartListening?: () => void;
  onListeningChange?: (isListening: boolean) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  expanded?: boolean;
}

export function VoiceInputButton({
  onTranscript,
  onStartListening,
  onListeningChange,
  className = '',
  size = 'md',
  expanded,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognizerRef = useRef<any>(null);

  // Default UI to expanded if the user selected 'Voice' for Q1 in onboarding
  const [voicePreferred, setVoicePreferred] = useState(() => {
    const prefs = AdaptiveStateManager.getPreferences();
    return (
      prefs.interactionPreference === 'voice' ||
      prefs.interactionPreference === 'voice_commands' ||
      prefs.isCalmVoiceModeActive
    );
  });

  useEffect(() => {
    const unsub = AdaptiveStateManager.subscribe((prefs) => {
      setVoicePreferred(
        prefs.interactionPreference === 'voice' ||
        prefs.interactionPreference === 'voice_commands' ||
        prefs.isCalmVoiceModeActive
      );
    });
    return () => unsub();
  }, []);

  const isExpanded = expanded !== undefined ? expanded : voicePreferred;

  useEffect(() => {
    recognizerRef.current = createSpeechRecognizer(
      (text) => onTranscript(text),
      (listening) => {
        setIsListening(listening);
        if (onListeningChange) {
          onListeningChange(listening);
        }
        if (!listening) {
          SoundEffects.playSoftChime();
        }
      },
      (err) => {
        SoundEffects.playAlertChime();
        setErrorMsg(err);
      }
    );

    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, [onTranscript, onListeningChange]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setErrorMsg(null);

    // If text-to-speech is currently playing, stop it so it doesn't feed back into mic
    TextToSpeech.stop();

    if (!recognizerRef.current?.isSupported) {
      setErrorMsg('Voice dictation is not available on this browser. You can type directly.');
      return;
    }

    if (isListening) {
      recognizerRef.current.stop();
    } else {
      if (onStartListening) {
        onStartListening();
      }
      await recognizerRef.current.start();
    }
  };

  const standardSizeClasses = {
    sm: 'px-3.5 py-2 text-sm sm:text-base gap-2 min-h-[42px]',
    md: 'px-5 py-3 text-base sm:text-lg gap-2.5 min-h-[50px]',
    lg: 'px-6 py-3.5 text-lg sm:text-xl gap-3 min-h-[56px]',
  }[size];

  // EXPANDED UI when Voice is selected in Q1
  if (isExpanded) {
    return (
      <div className={`w-full sm:w-auto relative inline-flex flex-col items-stretch ${className}`}>
        <button
          id="btn-tap-to-speak-expanded"
          type="button"
          onClick={handleToggle}
          className={`w-full px-6 py-3.5 sm:px-8 sm:py-4 rounded-2xl border-4 text-left sm:text-center transition-all shadow-lumina-md focus:outline-none focus:ring-4 focus:ring-amber-400 select-none cursor-pointer flex flex-col sm:flex-row items-center justify-between sm:justify-center gap-3 ${
            isListening
              ? 'bg-[#991B1B] text-white hover:bg-[#7F1D1D] border-[#7F1D1D] ring-4 ring-rose-400/60 shadow-xl animate-pulse'
              : 'bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#0A192F] border-[#1E3A8A] ring-4 ring-blue-500/20'
          }`}
          title={isListening ? 'Click to stop listening' : 'Click to speak instead of typing'}
          aria-label={isListening ? 'Listening. Click to stop' : 'Tap to speak with your voice'}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`p-2.5 rounded-xl border-2 shrink-0 ${
                isListening
                  ? 'bg-rose-900/80 text-white border-white animate-bounce'
                  : 'bg-[#0A192F] text-amber-400 border-[#1E3A8A]'
              }`}
            >
              {isListening ? (
                <MicOff className="w-6 h-6 stroke-[3]" />
              ) : (
                <Mic className="w-6 h-6 stroke-[3]" />
              )}
            </div>

            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black">
                  {isListening ? 'Listening... (Tap to Stop)' : 'Tap to Speak'}
                </span>
                <span
                  className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                    isListening
                      ? 'bg-white text-rose-900'
                      : 'bg-[#D97706] text-white'
                  }`}
                >
                  Voice Default
                </span>
              </div>
              <p
                className={`text-xs sm:text-sm font-bold mt-0.5 ${
                  isListening ? 'text-rose-100' : 'text-[#334155]'
                }`}
              >
                {isListening
                  ? 'Transcribing your words directly into the text box...'
                  : 'Speak naturally • Click once to begin dictating'}
              </p>
            </div>
          </div>
        </button>

        {errorMsg && (
          <div className="mt-2 z-20 p-3 bg-[#FFF1EE] text-[#7A1D1D] text-sm font-black rounded-xl border-2 border-[#E11D48] shadow-warm-md">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  // STANDARD COMPACT UI when Buttons is selected
  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <button
        id="btn-tap-to-speak"
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center font-black rounded-2xl transition-all shadow-lumina-xs focus:outline-none focus:ring-4 focus:ring-amber-400 select-none cursor-pointer ${
          isListening
            ? 'bg-[#991B1B] text-white hover:bg-[#7F1D1D] border-2 border-[#7F1D1D] ring-4 ring-rose-400/50 animate-pulse'
            : 'bg-white text-[#0F172A] hover:bg-[#F8FAFC] border-2 border-[#CBD5E1] hover:border-[#D97706]'
        } ${standardSizeClasses}`}
        title={isListening ? 'Click to stop listening' : 'Click to speak instead of typing'}
        aria-label={isListening ? 'Listening. Click to stop' : 'Tap to speak with your voice'}
      >
        {isListening ? (
          <>
            <MicOff className="w-5 h-5 stroke-[2.5] text-white shrink-0 animate-bounce" />
            <span>Listening... (Tap to Stop)</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 text-[#D97706] stroke-[2.5] shrink-0" />
            <span>Tap to Speak</span>
          </>
        )}
      </button>

      {errorMsg && (
        <div className="absolute top-full mt-2 z-20 w-64 p-3 bg-[#FFF1EE] text-[#7A1D1D] text-sm font-black rounded-xl border-2 border-[#E11D48] shadow-warm-md">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
