import { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Sliders,
  Play,
  Square,
  Check,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';
import { TextToSpeech, SoundEffects, SpeechSettings } from '../utils/speech';
import { ThemeMode } from '../types/companion';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
}

export function SoundSettingsModal({
  isOpen,
  onClose,
  themeMode,
}: SoundSettingsModalProps) {
  const [settings, setSettings] = useState<SpeechSettings>(TextToSpeech.getSettings());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testPlaying, setTestPlaying] = useState(false);

  const isHighContrast = themeMode === 'high-contrast';

  useEffect(() => {
    const unsub = TextToSpeech.subscribeSettings((s) => setSettings(s));
    const voices = TextToSpeech.getVoices();
    // Filter voices to English or standard available voices for clarity
    const enVoices = voices.filter((v) => v.lang.startsWith('en'));
    setAvailableVoices(enVoices.length > 0 ? enVoices : voices);

    return () => {
      unsub();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRateChange = (rate: number) => {
    TextToSpeech.updateSettings({ rate });
    SoundEffects.playSoftChime();
  };

  const handleVolumeChange = (volume: number) => {
    TextToSpeech.updateSettings({ volume });
    SoundEffects.playSoftChime();
  };

  const handleVoiceChange = (voiceURI: string) => {
    TextToSpeech.updateSettings({ voiceURI: voiceURI || null });
    SoundEffects.playSoftChime();
  };

  const handleToggleSoundEffects = () => {
    const newVal = !settings.soundEffectsEnabled;
    TextToSpeech.updateSettings({ soundEffectsEnabled: newVal });
    if (newVal) {
      setTimeout(() => SoundEffects.playSuccessChime(), 50);
    }
  };

  const handleTestVoice = () => {
    if (testPlaying) {
      TextToSpeech.stop();
      setTestPlaying(false);
    } else {
      setTestPlaying(true);
      TextToSpeech.speak(
        'Hello! This is how your Lumina companion sounds. I will speak at a calm, comfortable pace whenever you tap Read Aloud.',
        'voice-test-sample',
        () => setTestPlaying(true),
        () => setTestPlaying(false),
        () => setTestPlaying(false)
      );
    }
  };

  const handleResetDefaults = () => {
    TextToSpeech.updateSettings({
      rate: 0.85,
      pitch: 1.0,
      volume: 1.0,
      voiceURI: null,
      soundEffectsEnabled: true,
    });
    SoundEffects.playSuccessChime();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sound-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border-2 p-6 sm:p-7 shadow-2xl space-y-6 ${
          isHighContrast
            ? 'bg-slate-950 border-amber-400 text-white'
            : 'bg-white border-amber-300 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isHighContrast ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
              }`}
            >
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <h3 id="sound-settings-title" className="text-2xl font-bold font-serif">
                Sound & Voice Controls
              </h3>
              <p className="text-sm opacity-80 mt-0.5">
                Adjust speech speed, volume, and voice clarity to your liking.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-black/5"
            aria-label="Close sound settings"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Master Sound Mute Toggle */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            settings.muted
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : isHighContrast
              ? 'bg-slate-900 border-slate-700'
              : 'bg-emerald-50/70 border-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                settings.muted ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-950'
              }`}
            >
              {settings.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-base font-bold">
                {settings.muted ? 'Sound is Currently Muted' : 'All Sound & Voice Enabled'}
              </div>
              <p className="text-sm opacity-80">
                {settings.muted
                  ? 'All speech readouts and sound chimes are silenced.'
                  : 'Speech read aloud and tactile chimes will play normally.'}
              </p>
            </div>
          </div>
          <button
            id="btn-modal-toggle-mute"
            type="button"
            onClick={() => {
              const nextMuted = !settings.muted;
              TextToSpeech.setMuted(nextMuted);
              if (!nextMuted) {
                setTimeout(() => SoundEffects.playSoftChime(), 50);
              }
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm border-2 transition-all shadow-xs ${
              settings.muted
                ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                : 'bg-white text-emerald-900 border-emerald-400 hover:bg-emerald-50'
            }`}
          >
            {settings.muted ? 'Unmute Sound' : 'Mute All'}
          </button>
        </div>

        {/* Reading Speed Setting */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-base font-bold">
              Speaking Pace:
            </label>
            <span className="text-sm font-semibold opacity-75">
              {settings.rate <= 0.75
                ? 'Calm & Slow (0.75x)'
                : settings.rate <= 0.88
                ? 'Gentle (Recommended for Seniors)'
                : 'Standard (1.0x)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '🐢 Slow & Calm', value: 0.75, sub: '0.75x' },
              { label: '🌸 Gentle Pace', value: 0.85, sub: '0.85x' },
              { label: '⚡ Standard', value: 1.0, sub: '1.0x' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleRateChange(item.value)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  Math.abs(settings.rate - item.value) < 0.05
                    ? isHighContrast
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-md'
                      : 'bg-amber-600 text-white border-amber-600 font-bold shadow-md'
                    : isHighContrast
                    ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    : 'bg-amber-50 text-slate-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <div className="text-sm font-bold">{item.label}</div>
                <div className="text-xs opacity-75 mt-0.5">{item.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Volume Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="volume-slider" className="text-base font-bold">
              Voice Volume:
            </label>
            <span className="text-sm font-bold">
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            id="volume-slider"
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={settings.volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-full h-3 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
          />
        </div>

        {/* Voice Selection */}
        {availableVoices.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="voice-selector" className="text-base font-bold block">
              Narrator Voice:
            </label>
            <select
              id="voice-selector"
              value={settings.voiceURI || ''}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className={`w-full p-3 rounded-xl border-2 text-base font-medium transition-all ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-amber-50/50 border-amber-200 text-slate-900'
              }`}
            >
              <option value="">✨ Automatic Best Warm English Voice</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Gentle UI Chimes Toggle */}
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            isHighContrast ? 'bg-slate-900 border-slate-700' : 'bg-amber-50/60 border-amber-200'
          }`}
        >
          <div>
            <div className="text-base font-bold">Pleasant Audio Feedback Chimes</div>
            <p className="text-sm opacity-80 mt-0.5">
              Soft harmonic chimes when actions, routines, and tests complete.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleSoundEffects}
            className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
              settings.soundEffectsEnabled
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {settings.soundEffectsEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {/* Test Voice & Action Footer */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestVoice}
            className={`px-5 py-3 rounded-xl font-bold text-base border-2 transition-all flex items-center gap-2 shadow-xs ${
              testPlaying
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                : isHighContrast
                ? 'bg-slate-800 text-amber-300 border-amber-400 hover:bg-slate-700'
                : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
            }`}
          >
            {testPlaying ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                <span>Stop Sample</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current text-amber-600" />
                <span>Test Voice Sample</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2.5 rounded-xl text-sm font-semibold opacity-75 hover:opacity-100 flex items-center gap-1.5"
              title="Reset to recommended senior defaults"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Defaults</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-6 py-3 rounded-xl font-bold text-base transition-all shadow-md ${
                isHighContrast
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
