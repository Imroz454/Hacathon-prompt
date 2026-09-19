import { useState, useEffect } from 'react';
import {
  Mic,
  MousePointerClick,
  FileText,
  Sun,
  Zap,
  ListOrdered,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  AdaptivePreferences,
  InteractionPreference,
  PrimaryGoal,
  ExplanationPacing,
  ThemeMode,
} from '../types/companion';
import { AdaptiveStateManager } from '../utils/adaptiveState';
import { SoundEffects, TextToSpeech } from '../utils/speech';

interface AdaptiveIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (prefs: AdaptivePreferences) => void;
  themeMode: ThemeMode;
}

export function AdaptiveIntakeModal({
  isOpen,
  onClose,
  onComplete,
  themeMode,
}: AdaptiveIntakeModalProps) {
  const isHighContrast = themeMode === 'high-contrast';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [interaction, setInteraction] = useState<'buttons' | 'voice'>('buttons');
  const [goal, setGoal] = useState<'understand_notes' | 'organize_day'>('understand_notes');
  const [pacing, setPacing] = useState<ExplanationPacing>('step_by_step');

  // Load existing preferences when opened
  useEffect(() => {
    if (isOpen) {
      const current = AdaptiveStateManager.getPreferences();
      setInteraction(
        current.interactionPreference === 'voice' || current.interactionPreference === 'voice_commands'
          ? 'voice'
          : 'buttons'
      );
      setGoal(current.primaryGoal === 'organize_day' ? 'organize_day' : 'understand_notes');
      setPacing(current.explanationPacing);
      setStep(1);
    }
  }, [isOpen]);

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectInteraction = (val: 'buttons' | 'voice') => {
    SoundEffects.playSoftChime();
    setInteraction(val);
  };

  const handleSelectGoal = (val: 'understand_notes' | 'organize_day') => {
    SoundEffects.playSoftChime();
    setGoal(val);
  };

  const handleSelectPacing = (val: ExplanationPacing) => {
    SoundEffects.playSoftChime();
    setPacing(val);
  };

  const handleNext = () => {
    SoundEffects.playSoftChime();
    if (step < 3) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    SoundEffects.playSoftChime();
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  const handleFinalSubmit = () => {
    SoundEffects.playSuccessChime();
    const isVoice = interaction === 'voice';
    const updated = AdaptiveStateManager.savePreferences({
      interactionPreference: isVoice ? 'voice' : 'buttons',
      primaryGoal: goal,
      explanationPacing: pacing,
      hasCompletedIntake: true,
      isCalmVoiceModeActive: isVoice,
    });

    if (isVoice) {
      TextToSpeech.speak(
        'Preferences saved. Voice mode is active, and the microphone button is expanded across the app.',
        'intake-announcement'
      );
    }

    if (onComplete) {
      onComplete(updated);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intake-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/85 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`w-full max-w-2xl rounded-3xl border-4 shadow-2xl transition-all overflow-hidden flex flex-col my-auto ${
          isHighContrast
            ? 'bg-[#060D17] border-amber-400 text-white'
            : 'bg-white border-[#0A192F] text-[#0F172A]'
        }`}
      >
        {/* Modal Top Header Bar */}
        <div
          className={`px-6 py-5 border-b-2 flex items-center justify-between gap-4 ${
            isHighContrast
              ? 'bg-slate-900 border-slate-700'
              : 'bg-[#F8FAFC] border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-2xl border-2 shrink-0 ${
                isHighContrast
                  ? 'bg-amber-400 text-slate-950 border-white'
                  : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
              }`}
            >
              <Sparkles className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300">
                Personalized Setup
              </span>
              <h2
                id="intake-modal-title"
                className="text-xl sm:text-2xl font-black font-serif text-[#0A192F] dark:text-white"
              >
                Welcome to Lumina
              </h2>
            </div>
          </div>

          <button
            type="button"
            id="btn-close-intake"
            onClick={onClose}
            className={`p-2.5 rounded-xl border-2 transition-all text-[#475569] dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer ${
              isHighContrast
                ? 'bg-slate-800 border-slate-600 hover:border-amber-400'
                : 'bg-white border-[#CBD5E1] hover:border-[#0A192F]'
            }`}
            aria-label="Close setup modal"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div
          className={`px-6 py-3 border-b flex items-center justify-between text-sm font-extrabold ${
            isHighContrast
              ? 'bg-slate-950 border-slate-800 text-slate-300'
              : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>Step {step} of 3</span>
            <span className="opacity-40">•</span>
            <span className="font-bold text-xs sm:text-sm">
              {step === 1 && "Q1: 'How do you prefer to interact?'"}
              {step === 2 && "Q2: 'What is your main goal today?'"}
              {step === 3 && "Q3: 'How should I explain things?'"}
            </span>
          </div>

          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-2.5 rounded-full transition-all ${
                  s === step
                    ? 'w-8 bg-[#D97706] dark:bg-amber-400'
                    : s < step
                    ? 'w-3 bg-emerald-500'
                    : 'w-3 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Question Content Area */}
        <div className="p-6 sm:p-8 space-y-6 flex-1">
          {/* ============================================================== */}
          {/* QUESTION 1: HOW DO YOU PREFER TO INTERACT? (Buttons / Voice) */}
          {/* ============================================================== */}
          {step === 1 && (
            <section className="space-y-4 animate-fadeIn" aria-labelledby="q1-heading">
              <div>
                <span className="text-sm font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300">
                  Question 1
                </span>
                <h3
                  id="q1-heading"
                  className="text-2xl sm:text-3xl font-black text-[#0A192F] dark:text-white mt-1"
                >
                  How do you prefer to interact?
                </h3>
                <p className="text-base sm:text-lg font-bold text-[#334155] dark:text-slate-300 mt-1">
                  Choose how you want to input information and navigate Lumina.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option: Buttons */}
                <button
                  type="button"
                  id="intake-opt-buttons"
                  onClick={() => handleSelectInteraction('buttons')}
                  className={`p-5 sm:p-6 rounded-2xl border-4 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                    interaction === 'buttons'
                      ? isHighContrast
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-xl'
                        : 'bg-[#EFF6FF] border-[#1E3A8A] ring-4 ring-blue-500/20 text-[#0A192F] shadow-lumina-md'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`p-3 rounded-2xl border-2 ${
                        interaction === 'buttons'
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-[#0A192F] text-white border-[#1E3A8A]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <MousePointerClick className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    {interaction === 'buttons' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black">Buttons</h4>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      Touch-friendly buttons, clear text boxes, keyboard navigation, and tactile click chimes.
                    </p>
                  </div>
                </button>

                {/* Option: Voice */}
                <button
                  type="button"
                  id="intake-opt-voice"
                  onClick={() => handleSelectInteraction('voice')}
                  className={`p-5 sm:p-6 rounded-2xl border-4 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                    interaction === 'voice'
                      ? isHighContrast
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-xl'
                        : 'bg-[#FEF3C7] border-[#D97706] ring-4 ring-amber-400/30 text-[#0A192F] shadow-lumina-md'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`p-3 rounded-2xl border-2 ${
                        interaction === 'voice'
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-[#D97706] text-white border-[#B45309]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <Mic className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    {interaction === 'voice' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-2xl font-black">Voice</h4>
                      <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-md bg-[#D97706] text-white">
                        Expands Mic
                      </span>
                    </div>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      Defaults the UI to expand the microphone button for quick, one-tap dictation and speech assistance.
                    </p>
                  </div>
                </button>
              </div>

              {interaction === 'voice' && (
                <div
                  className={`p-3 rounded-xl border-2 text-sm font-black flex items-center gap-2 ${
                    isHighContrast
                      ? 'bg-amber-950/60 border-amber-400 text-amber-200'
                      : 'bg-amber-50 border-amber-400 text-amber-900'
                  }`}
                >
                  <Mic className="w-4 h-4 shrink-0 text-[#D97706] animate-pulse" />
                  <span>Voice selected: The microphone button will default to expanded across all tools.</span>
                </div>
              )}
            </section>
          )}

          {/* ============================================================== */}
          {/* QUESTION 2: WHAT IS YOUR MAIN GOAL TODAY? (Understand Notes / Organize Day) */}
          {/* ============================================================== */}
          {step === 2 && (
            <section className="space-y-4 animate-fadeIn" aria-labelledby="q2-heading">
              <div>
                <span className="text-sm font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300">
                  Question 2
                </span>
                <h3
                  id="q2-heading"
                  className="text-2xl sm:text-3xl font-black text-[#0A192F] dark:text-white mt-1"
                >
                  What is your main goal today?
                </h3>
                <p className="text-base sm:text-lg font-bold text-[#334155] dark:text-slate-300 mt-1">
                  Lumina will tailor the starting workspace around your primary objective.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option: Understand Notes */}
                <button
                  type="button"
                  id="intake-opt-understand-notes"
                  onClick={() => handleSelectGoal('understand_notes')}
                  className={`p-5 sm:p-6 rounded-2xl border-4 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                    goal === 'understand_notes'
                      ? isHighContrast
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-xl'
                        : 'bg-[#EFF6FF] border-[#1E3A8A] ring-4 ring-blue-500/20 text-[#0A192F] shadow-lumina-md'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`p-3 rounded-2xl border-2 ${
                        goal === 'understand_notes'
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-[#0A192F] text-white border-[#1E3A8A]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <FileText className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    {goal === 'understand_notes' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black">Understand Notes</h4>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      Translate medical bills, doctor summaries, lab results, prescriptions, or official letters into plain English.
                    </p>
                  </div>
                </button>

                {/* Option: Organize Day */}
                <button
                  type="button"
                  id="intake-opt-organize-day"
                  onClick={() => handleSelectGoal('organize_day')}
                  className={`p-5 sm:p-6 rounded-2xl border-4 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                    goal === 'organize_day'
                      ? isHighContrast
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-xl'
                        : 'bg-[#FEF3C7] border-[#D97706] ring-4 ring-amber-400/30 text-[#0A192F] shadow-lumina-md'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`p-3 rounded-2xl border-2 ${
                        goal === 'organize_day'
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-[#D97706] text-white border-[#B45309]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <Sun className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    {goal === 'organize_day' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black">Organize Day</h4>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      Gentle daily rhythms, medication reminders, hydration, and peaceful routine checkpoints without hurry.
                    </p>
                  </div>
                </button>
              </div>
            </section>
          )}

          {/* ============================================================== */}
          {/* QUESTION 3: HOW SHOULD I EXPLAIN THINGS? (Quick summary / Step-by-step) */}
          {/* ============================================================== */}
          {step === 3 && (
            <section className="space-y-4 animate-fadeIn" aria-labelledby="q3-heading">
              <div>
                <span className="text-sm font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300">
                  Question 3
                </span>
                <h3
                  id="q3-heading"
                  className="text-2xl sm:text-3xl font-black text-[#0A192F] dark:text-white mt-1"
                >
                  How should I explain things?
                </h3>
                <p className="text-base sm:text-lg font-bold text-[#334155] dark:text-slate-300 mt-1">
                  Dynamically appended to AI instructions so all future responses match your cognitive pacing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option: Quick summary */}
                <button
                  type="button"
                  id="intake-opt-quick-summary"
                  onClick={() => handleSelectPacing('quick_summary')}
                  className={`p-5 sm:p-6 rounded-2xl border-4 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                    pacing === 'quick_summary'
                      ? isHighContrast
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-xl'
                        : 'bg-[#EFF6FF] border-[#1E3A8A] ring-4 ring-blue-500/20 text-[#0A192F] shadow-lumina-md'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`p-3 rounded-2xl border-2 ${
                        pacing === 'quick_summary'
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-[#0A192F] text-white border-[#1E3A8A]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <Zap className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    {pacing === 'quick_summary' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black">Quick summary</h4>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      Direct, high-impact key takeaways. Zero filler or complex preambles so you can absorb it in 30 seconds.
                    </p>
                  </div>
                </button>

                {/* Option: Step-by-step */}
                <button
                  type="button"
                  id="intake-opt-step-by-step"
                  onClick={() => handleSelectPacing('step_by_step')}
                  className={`p-5 sm:p-6 rounded-2xl border-4 text-left transition-all flex flex-col justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                    pacing === 'step_by_step'
                      ? isHighContrast
                        ? 'bg-slate-900 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-xl'
                        : 'bg-[#FEF3C7] border-[#D97706] ring-4 ring-amber-400/30 text-[#0A192F] shadow-lumina-md'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`p-3 rounded-2xl border-2 ${
                        pacing === 'step_by_step'
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-[#D97706] text-white border-[#B45309]'
                          : 'bg-white text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      <ListOrdered className="w-8 h-8 stroke-[2.5]" />
                    </div>
                    {pacing === 'step_by_step' && (
                      <span className="p-1 rounded-full bg-emerald-500 text-white">
                        <Check className="w-5 h-5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black">Step-by-step</h4>
                    <p className="text-sm font-bold opacity-80 mt-1">
                      Gentle, sequential breakdown with checkpoint tips at every stage so you are always confident and unhurried.
                    </p>
                  </div>
                </button>
              </div>

              <div
                className={`p-3 rounded-xl border-2 text-sm font-black flex items-center gap-2 ${
                  isHighContrast
                    ? 'bg-slate-900 border-amber-400 text-amber-200'
                    : 'bg-blue-50 border-blue-400 text-blue-900'
                }`}
              >
                <Zap className="w-4 h-4 shrink-0 text-[#D97706]" />
                <span>
                  Active Cognitive Pacing rule: &quot;
                  {pacing === 'quick_summary' ? 'Quick summary' : 'Step-by-step'}
                  &quot; will be appended to all future Gemini AI calls.
                </span>
              </div>
            </section>
          )}

          {/* Transparent Digital Consultant Notice */}
          <div
            className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 text-xs sm:text-sm font-bold ${
              isHighContrast
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-[#F1F5F9] border-[#CBD5E1] text-[#334155]'
            }`}
          >
            <HelpCircle className="w-5 h-5 text-[#D97706] shrink-0 stroke-[2.5]" />
            <span>
              <strong>Transparent Digital Teacher:</strong> Lumina provides objective, respectful digital guidance without fabricated personas or artificial relationships.
            </span>
          </div>
        </div>

        {/* Modal Navigation Footer Controls */}
        <div
          className={`px-6 py-4 border-t-2 flex items-center justify-between gap-4 ${
            isHighContrast
              ? 'bg-slate-900 border-slate-700'
              : 'bg-[#F8FAFC] border-[#CBD5E1]'
          }`}
        >
          {step > 1 ? (
            <button
              type="button"
              id="btn-intake-prev"
              onClick={handleBack}
              className={`px-5 py-3 rounded-xl text-base font-black border-2 transition-all flex items-center gap-2 cursor-pointer ${
                isHighContrast
                  ? 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                  : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-slate-100'
              }`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              <span>Previous</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-intake-skip"
              onClick={onClose}
              className="text-sm font-extrabold text-[#64748B] hover:text-[#0F172A] dark:hover:text-white px-2 py-1 cursor-pointer"
            >
              Keep Standard Settings
            </button>
          )}

          <button
            type="button"
            id="btn-intake-next"
            onClick={handleNext}
            className={`px-7 py-3.5 rounded-2xl text-lg font-black border-2 transition-all shadow-lumina-sm flex items-center gap-2.5 cursor-pointer focus:outline-none focus:ring-4 focus:ring-amber-400 ${
              isHighContrast
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-white'
                : 'bg-[#0A192F] text-white hover:bg-[#1E3A8A] border-[#D97706]'
            }`}
          >
            <span>{step === 3 ? 'Save Preferences & Begin' : 'Next Question'}</span>
            <ChevronRight className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
}
