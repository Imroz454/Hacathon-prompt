import { useState, useEffect } from 'react';
import {
  Sparkles,
  Sun,
  Moon,
  Type,
  Volume2,
  VolumeX,
  Sliders,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { FontSize, ThemeMode, AdaptivePreferences } from '../types/companion';
import { TextToSpeech, SoundEffects } from '../utils/speech';
import { SoundSettingsModal } from './SoundSettingsModal';
import { SecurityPrivacyModal } from './SecurityPrivacyModal';

interface HeaderProps {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  adaptivePreferences?: AdaptivePreferences;
  onOpenIntakeModal?: () => void;
}

export function Header({
  fontSize,
  setFontSize,
  themeMode,
  setThemeMode,
  adaptivePreferences,
  onOpenIntakeModal,
}: HeaderProps) {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [timeGreeting, setTimeGreeting] = useState('Good Day');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [soundModalOpen, setSoundModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour < 12) {
        setTimeGreeting('Good Morning');
      } else if (hour < 17) {
        setTimeGreeting('Good Afternoon');
      } else {
        setTimeGreeting('Good Evening');
      }

      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      };
      setCurrentDateTime(now.toLocaleDateString('en-US', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);

    // Track active speaking state
    const unsubState = TextToSpeech.subscribeState((activeId) => {
      setIsSpeaking(activeId !== null);
    });

    // Track mute and sound settings state
    const unsubSettings = TextToSpeech.subscribeSettings((settings) => {
      setIsMuted(!!settings.muted);
    });

    return () => {
      clearInterval(interval);
      unsubState();
      unsubSettings();
    };
  }, []);

  const handleToggleMute = () => {
    const nextMuted = TextToSpeech.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleStopAllAudio = () => {
    TextToSpeech.stop();
    SoundEffects.playSoftChime();
  };

  const handleToggleContrast = () => {
    SoundEffects.playSoftChime();
    setThemeMode(isHighContrast ? 'warm' : 'high-contrast');
  };

  const handleSetFontSize = (size: FontSize) => {
    SoundEffects.playSoftChime();
    setFontSize(size);
  };

  const isHighContrast = themeMode === 'high-contrast';

  return (
    <>
      <header
        id="app-header"
        className={`border-b-2 transition-colors ${
          isHighContrast
            ? 'bg-[#060D17] border-slate-700 text-white'
            : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
        }`}
      >
        {/* Top Utility & Senior Accessibility Control Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#334155] dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] font-black dark:bg-amber-400 dark:text-slate-950">
              ✨ Lumina Senior Care
            </span>
            <span className="hidden sm:inline text-slate-400">•</span>
            <span className="hidden sm:inline">{timeGreeting}, Welcome</span>
          </div>

          {/* Accessibility Quick Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Text Size Switcher */}
            <div
              role="radiogroup"
              aria-label="Text size options"
              className={`flex items-center rounded-xl p-1 border-2 shadow-lumina-xs ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700'
                  : 'bg-[#F8FAFC] border-[#CBD5E1]'
              }`}
              title="Adjust text size for easy reading"
            >
              <span className="text-xs font-black px-2 flex items-center gap-1 text-[#0F172A] dark:text-slate-200 select-none">
                <Type className="w-4 h-4 stroke-[2.5]" /> Size:
              </span>
              <button
                id="font-size-normal"
                type="button"
                role="radio"
                aria-checked={fontSize === 'normal'}
                aria-pressed={fontSize === 'normal'}
                onClick={() => handleSetFontSize('normal')}
                className={`px-3 py-1 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  fontSize === 'normal'
                    ? isHighContrast
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black ring-2 ring-white'
                      : 'bg-[#B45309] text-white shadow-lumina-xs font-black ring-2 ring-[#78350F]'
                    : 'text-[#0F172A] hover:bg-[#EDF2F7] dark:text-slate-200'
                }`}
                title="Standard Text Size (18px base)"
              >
                Standard
              </button>
              <button
                id="font-size-large"
                type="button"
                role="radio"
                aria-checked={fontSize === 'large'}
                aria-pressed={fontSize === 'large'}
                onClick={() => handleSetFontSize('large')}
                className={`px-3 py-1 rounded-lg text-base font-extrabold transition-all cursor-pointer ${
                  fontSize === 'large'
                    ? isHighContrast
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black ring-2 ring-white'
                      : 'bg-[#B45309] text-white shadow-lumina-xs font-black ring-2 ring-[#78350F]'
                    : 'text-[#0F172A] hover:bg-[#EDF2F7] dark:text-slate-200'
                }`}
                title="Large Text Size (22px base)"
              >
                A+
              </button>
              <button
                id="font-size-huge"
                type="button"
                role="radio"
                aria-checked={fontSize === 'huge'}
                aria-pressed={fontSize === 'huge'}
                onClick={() => handleSetFontSize('huge')}
                className={`px-3 py-1 rounded-lg text-lg font-black transition-all cursor-pointer ${
                  fontSize === 'huge'
                    ? isHighContrast
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black ring-2 ring-white'
                      : 'bg-[#B45309] text-white shadow-lumina-xs font-black ring-2 ring-[#78350F]'
                    : 'text-[#0F172A] hover:bg-[#EDF2F7] dark:text-slate-200'
                }`}
                title="Extra Large Text Size (26px base)"
              >
                A++
              </button>
            </div>

            {/* High Contrast Mode Switcher */}
            <button
              id="btn-toggle-contrast"
              type="button"
              onClick={handleToggleContrast}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-black border-2 transition-all shadow-lumina-xs ${
                isHighContrast
                  ? 'bg-amber-400 text-slate-950 border-white hover:bg-amber-300'
                  : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#B45309]'
              }`}
              title="Toggle high contrast screen mode"
            >
              {isHighContrast ? (
                <>
                  <Sun className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                  <span>Calm Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#0F172A] stroke-[2.5]" />
                  <span>High Contrast</span>
                </>
              )}
            </button>

            {/* Quick Master Mute Button */}
            <button
              id="btn-quick-mute"
              type="button"
              onClick={handleToggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all shadow-lumina-xs ${
                isMuted
                  ? 'bg-[#FFF1EE] text-[#7A1D1D] border-[#E11D48]'
                  : isHighContrast
                  ? 'bg-slate-900 text-amber-300 border-amber-400'
                  : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#B45309]'
              }`}
              title={isMuted ? 'App sound is muted. Tap to turn on voice.' : 'Tap to mute speech'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-[#7A1D1D] stroke-[2.5]" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-[#B45309] stroke-[2.5]" />
                  <span>Sound On</span>
                </>
              )}
            </button>

            {/* Voice Tuning Button */}
            <button
              id="btn-sound-settings"
              type="button"
              onClick={() => {
                SoundEffects.playSoftChime();
                setSoundModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all shadow-lumina-xs ${
                isHighContrast
                  ? 'bg-slate-900 text-amber-300 border-amber-400'
                  : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#B45309]'
              }`}
              title="Adjust speech pace, volume, and voices"
            >
              <Sliders className="w-4 h-4 text-[#B45309] dark:text-amber-400 stroke-[2.5]" />
              <span>Voice</span>
            </button>

            {/* Security Shield Button */}
            <button
              id="btn-security-privacy"
              type="button"
              onClick={() => {
                SoundEffects.playSoftChime();
                setSecurityModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all shadow-lumina-xs ${
                isHighContrast
                  ? 'bg-slate-900 text-amber-300 border-amber-400'
                  : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#B45309]'
              }`}
              title="View Lumina Security, Privacy Protections & Senior Helplines"
            >
              <ShieldCheck className="w-4 h-4 text-[#B45309] dark:text-amber-400 stroke-[2.5]" />
              <span>Safety</span>
            </button>

            {/* Adaptive Intake & Pacing Button */}
            {onOpenIntakeModal && (
              <button
                id="btn-header-adaptive-pacing"
                type="button"
                onClick={() => {
                  SoundEffects.playSoftChime();
                  onOpenIntakeModal();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black border-2 transition-all shadow-lumina-xs ${
                  isHighContrast
                    ? 'bg-amber-400 text-slate-950 border-white hover:bg-amber-300'
                    : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE] hover:bg-[#DBEAFE]'
                }`}
                title="Adjust your 3 intake questions: interaction method, primary goal, and explanation pacing"
              >
                <Sparkles className="w-4 h-4 text-[#D97706] dark:text-slate-950 stroke-[2.5]" />
                <span>
                  {adaptivePreferences?.interactionPreference === 'voice' ||
                  adaptivePreferences?.interactionPreference === 'voice_commands'
                    ? 'Voice Mode'
                    : 'Buttons'}{' '}
                  •{' '}
                  {adaptivePreferences?.explanationPacing === 'quick_summary'
                    ? 'Summary'
                    : 'Step-by-Step'}
                </span>
              </button>
            )}

            {/* Quick Stop Voice Readout */}
            {isSpeaking && (
              <button
                id="btn-stop-audio-header"
                type="button"
                onClick={handleStopAllAudio}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-black bg-[#881337] text-white border-2 border-[#BE123C] hover:bg-[#70102E] animate-pulse transition-all shadow-lumina-md"
                title="Silence active voice readout immediately"
              >
                <VolumeX className="w-4 h-4 stroke-[2.5]" />
                <span>Stop Voice</span>
              </button>
            )}
          </div>
        </div>

        {/* Hero Header: Lumina Brand & Psychological Trust Hook */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4">
              {/* Glowing Warm Gold Emblem of Clarity & Warmth */}
              <div
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-transform shadow-lumina-md ${
                  isHighContrast
                    ? 'bg-amber-400 text-slate-950 border-white'
                    : 'bg-gradient-to-br from-[#F59E0B] via-[#D97706] to-[#B45309] text-white border-[#78350F]'
                }`}
              >
                <Sparkles className="w-8 h-8 sm:w-9 sm:h-9 fill-current" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#0A192F] dark:text-white">
                    Lumina
                  </h1>
                  <span
                    className={`text-xs sm:text-sm uppercase font-black px-3 py-1 rounded-full border-2 ${
                      isHighContrast
                        ? 'bg-slate-800 text-amber-300 border-amber-300'
                        : 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                    }`}
                  >
                    Your Daily Companion
                  </span>
                </div>

                {/* Hero Sub-Headline */}
                <p className="text-lg sm:text-xl font-bold text-[#1E293B] dark:text-slate-200 mt-1 max-w-2xl leading-snug">
                  Your trusted, private guide for daily clarity and peace of mind.
                </p>
              </div>
            </div>

            {/* Date & Reassurance Timestamp Block */}
            <div
              className={`p-3.5 rounded-2xl border-2 self-start md:self-center shrink-0 ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]'
              }`}
            >
              <div className="text-sm font-black text-[#B45309] dark:text-amber-300 flex items-center gap-1.5">
                <span>📅 {currentDateTime}</span>
              </div>
              <div className="text-xs font-bold text-[#334155] dark:text-slate-300 mt-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Private & Encrypted on your device</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust & Safety Assurance Banner */}
        <button
          id="banner-security-status"
          type="button"
          onClick={() => {
            SoundEffects.playSoftChime();
            setSecurityModalOpen(true);
          }}
          className={`w-full px-4 py-2 text-xs sm:text-sm text-center font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isHighContrast
              ? 'bg-slate-900 text-emerald-300 border-t-2 border-slate-800 hover:bg-slate-850'
              : 'bg-[#EFF6FF] text-[#1E3A8A] border-t-2 border-[#BFDBFE] hover:bg-[#DBEAFE]'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#1D4ED8] dark:text-emerald-400 inline stroke-[2.5]" />
          <span>
            <strong>Lumina Trust Shield Active:</strong> Auto PII Redaction & Scam Guardian • Tap to view privacy protections & senior helplines
          </span>
        </button>
      </header>

      {/* Sound Settings & Voice Tuning Modal */}
      <SoundSettingsModal
        isOpen={soundModalOpen}
        onClose={() => setSoundModalOpen(false)}
        themeMode={themeMode}
      />

      {/* Senior Security & Privacy Safeguards Modal */}
      <SecurityPrivacyModal
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
        themeMode={themeMode}
      />
    </>
  );
}
