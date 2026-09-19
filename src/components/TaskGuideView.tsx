import { useState } from 'react';
import {
  Footprints,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckSquare,
  Clock,
  ThumbsUp,
  AlertCircle
} from 'lucide-react';
import { TaskGuideResult, ThemeMode } from '../types/companion';
import { breakdownTask } from '../services/api';
import { AudioPlayerButton } from './AudioPlayerButton';
import { VoiceInputButton } from './VoiceInputButton';

interface TaskGuideViewProps {
  themeMode: ThemeMode;
}

const TASK_PRESETS = [
  'Join a Zoom family call on an iPad or tablet',
  'Sort medications safely into a 7-day pill organizer',
  'Call the pharmacy automated phone line for a prescription refill',
  'Switch TV from streaming back to regular cable using the remote',
];

export function TaskGuideView({ themeMode }: TaskGuideViewProps) {
  const [taskDescription, setTaskDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<TaskGuideResult | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const isHighContrast = themeMode === 'high-contrast';

  const handleBreakdown = async (taskToUse?: string) => {
    const text = taskToUse !== undefined ? taskToUse : taskDescription;
    if (!text.trim()) {
      setError('Please describe the task you would like help with, or tap one of the common tasks above.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await breakdownTask({ taskDescription: text });
      setGuide(data);
      setActiveStepIndex(0);
    } catch (err: any) {
      console.error('Task breakdown error:', err);
      setError(err.message || 'Unable to break down this task right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    setTaskDescription(preset);
    setError(null);
    handleBreakdown(preset);
  };

  const currentStep = guide?.steps?.[activeStepIndex];
  const isLastStep = guide && activeStepIndex === guide.steps.length - 1;
  const isFirstStep = activeStepIndex === 0;

  const currentStepSpeech = currentStep
    ? `Step ${currentStep.stepNumber}: ${currentStep.title}. ${currentStep.instruction}. Checkpoint tip: ${currentStep.checkpointTip}`
    : '';

  return (
    <div className="space-y-8">
      {/* Intro Header */}
      <div
        className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
          isHighContrast
            ? 'bg-slate-900 border-slate-700 text-white'
            : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl border-2 ${
                isHighContrast
                  ? 'bg-amber-400 text-slate-950 border-white'
                  : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
              }`}
            >
              <Footprints className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-[#0A192F] dark:text-white">
                Walk Me Through It
              </h2>
              <p className="text-lg font-bold text-[#334155] dark:text-slate-200 mt-1">
                Step-by-step guidance for any technology or daily task at your own peaceful pace.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-6">
          <p className="text-sm font-black uppercase tracking-wider mb-2.5 text-[#0A192F] dark:text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
            Common tasks we can guide you through:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {TASK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className={`p-3.5 text-left rounded-xl border-2 text-base font-extrabold transition-all hover:scale-[1.01] focus:ring-4 focus:ring-amber-400 ${
                  isHighContrast
                    ? 'bg-slate-800 border-slate-600 text-amber-300 hover:bg-slate-700'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                }`}
              >
                👉 {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="mt-6">
          <label htmlFor="task-input-field" className="block text-base sm:text-lg font-black text-[#0A192F] dark:text-white mb-2">
            Or tell me what task you would like to do:
          </label>
          <div className="flex items-center gap-2.5">
            <input
              id="task-input-field"
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="e.g. How do I turn on subtitles on Netflix or clear my microwave timer?"
              className={`flex-1 p-3.5 text-lg font-medium rounded-xl border-2 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isHighContrast
                  ? 'bg-slate-950 border-slate-600 text-white placeholder:text-slate-400'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#D97706]'
              }`}
            />
            <VoiceInputButton
              onTranscript={(transcript) => {
                setTaskDescription(transcript);
                handleBreakdown(transcript);
              }}
            />
            {taskDescription && (
              <button
                type="button"
                onClick={() => {
                  setTaskDescription('');
                  setGuide(null);
                }}
                className="px-3.5 py-2 text-sm text-[#334155] hover:text-[#0F172A] font-black flex items-center gap-1 border-2 border-transparent hover:border-[#CBD5E1] rounded-xl"
              >
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              id="btn-breakdown-task-submit"
              type="button"
              disabled={loading || !taskDescription.trim()}
              onClick={() => handleBreakdown()}
              className={`px-8 py-4 sm:px-10 sm:py-4.5 rounded-2xl text-xl sm:text-2xl font-black transition-all flex items-center gap-3 focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                isHighContrast
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-[3px] border-white shadow-lg'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-[3px] border-amber-600 shadow-lumina-md hover:shadow-lumina-lg active:scale-[0.99]'
              }`}
            >
              {loading ? (
                <>
                  <span className="inline-block w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Organizing easy steps...</span>
                </>
              ) : (
                <>
                  <Footprints className="w-7 h-7 shrink-0 fill-current" />
                  <span>Start Step-by-Step Guide</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-[#FFF1EE] border-2 border-[#E11D48] text-[#7A1D1D] text-base font-bold flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-[#7A1D1D] shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Step Navigator */}
      {guide && guide.steps?.length > 0 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Task Overview Card */}
          <div
            className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
              isHighContrast
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-black tracking-widest text-[#475569] dark:text-slate-300 block mb-1">
                  Step-by-Step Guide
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-[#0A192F] dark:text-white">
                  {guide.taskTitle}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-black border ${
                    isHighContrast
                      ? 'bg-slate-800 text-amber-300 border-slate-700'
                      : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
                  }`}
                >
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                  {guide.estimatedTime}
                </span>
                <span
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-black border ${
                    isHighContrast
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
                  }`}
                >
                  {guide.difficulty} Pace
                </span>
              </div>
            </div>

            {/* Things Needed Checklist */}
            {guide.thingsNeeded?.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-[#E2E8F0] dark:border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider block text-[#475569] dark:text-slate-300 mb-2">
                  Have these ready before you begin:
                </span>
                <div className="flex flex-wrap gap-2">
                  {guide.thingsNeeded.map((thing, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-base font-bold border-2 ${
                        isHighContrast
                          ? 'bg-slate-950 border-slate-700 text-slate-200'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4 text-[#D97706] dark:text-amber-400 stroke-[2.5]" />
                      {thing}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Step Card */}
          {currentStep && (
            <div
              className={`p-6 sm:p-8 rounded-2xl border-2 shadow-lumina-xs transition-colors ${
                isHighContrast
                  ? 'bg-slate-950 border-amber-400 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A]'
              }`}
            >
              {/* Step Navigation Dots & Read Aloud */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#E2E8F0] pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black uppercase tracking-wider px-3.5 py-1 rounded-full bg-[#0A192F] text-white border border-[#1E293B]">
                    Step {currentStep.stepNumber} of {guide.steps.length}
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    {guide.steps.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveStepIndex(idx)}
                        className={`w-4 h-4 rounded-full transition-all ${
                          idx === activeStepIndex
                            ? 'bg-[#D97706] scale-125'
                            : idx < activeStepIndex
                            ? 'bg-amber-400'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                        title={`Jump to step ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <AudioPlayerButton textToRead={currentStepSpeech} label="Listen to This Step" size="lg" />
              </div>

              {/* Step Content */}
              <div className="space-y-4">
                <h4 className="text-2xl sm:text-3xl font-black font-serif text-[#0A192F] dark:text-white">
                  {currentStep.title}
                </h4>

                <p className="text-xl sm:text-2xl leading-relaxed font-bold text-[#1E293B] dark:text-slate-100">
                  {currentStep.instruction}
                </p>

                {/* Checkpoint Tip */}
                <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-[#EFF6FF] dark:bg-slate-900 border-2 border-[#BFDBFE] dark:border-slate-700 flex items-start gap-3.5">
                  <ThumbsUp className="w-6 h-6 text-[#1E3A8A] dark:text-amber-400 shrink-0 mt-0.5 stroke-[2.5]" />
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-[#1E3A8A] dark:text-amber-300 block mb-1">
                      How to tell you did it right:
                    </span>
                    <p className="text-lg font-bold text-[#0F172A] dark:text-white">{currentStep.checkpointTip}</p>
                  </div>
                </div>
              </div>

              {/* Step Buttons (Extra Large for Touch Accessibility) */}
              <div className="mt-8 pt-6 border-t-2 border-[#E2E8F0] dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={isFirstStep}
                  onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
                  className={`px-6 py-4 rounded-2xl text-lg font-black border-2 transition-all flex items-center gap-2 min-h-[56px] shadow-lumina-xs ${
                    isFirstStep
                      ? 'opacity-30 cursor-not-allowed border-slate-300'
                      : isHighContrast
                      ? 'bg-slate-900 text-white border-slate-600 hover:bg-slate-800'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <ChevronLeft className="w-6 h-6 stroke-[3]" />
                  <span>Previous Step</span>
                </button>

                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setActiveStepIndex((prev) => Math.min(guide.steps.length - 1, prev + 1))}
                    className={`px-8 py-4 rounded-2xl text-xl font-black transition-all flex items-center gap-2 min-h-[56px] ${
                      isHighContrast
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-[3px] border-white shadow-md'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-600 hover:to-amber-700 border-[3px] border-amber-600 shadow-lumina-md hover:shadow-lumina-lg active:scale-[0.99]'
                    }`}
                  >
                    <span>Next Step</span>
                    <ChevronRight className="w-6 h-6 stroke-[3]" />
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#F0FDF4] text-[#14532D] border-2 border-[#166534] font-black text-lg flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                    <span>All Steps Finished!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Celebration Card when on last step */}
          {isLastStep && (
            <div
              className={`p-6 sm:p-8 rounded-2xl border-2 text-center animate-bounce shadow-lumina-md ${
                isHighContrast
                  ? 'bg-slate-900 border-amber-400 text-white'
                  : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#0F172A]'
              }`}
            >
              <span className="text-4xl block mb-2">🎉</span>
              <h4 className="text-2xl sm:text-3xl font-black font-serif mb-2 text-[#0A192F]">
                Wonderful job! You did it!
              </h4>
              <p className="text-xl font-bold max-w-xl mx-auto text-[#334155] dark:text-slate-200">
                {guide.successCelebration}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
