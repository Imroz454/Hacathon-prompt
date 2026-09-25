import { useState, useEffect, lazy, Suspense } from 'react';
import {
  FileText,
  ShieldAlert,
  Sun,
  Footprints,
  MessageCircleHeart,
  Phone,
  Info,
  Check,
  Mic,
  MousePointerClick,
  SlidersHorizontal,
  Sparkles,
  Zap,
  ListOrdered,
} from 'lucide-react';
import { FontSize, ThemeMode, AdaptivePreferences } from './types/companion';
import { Header } from './components/Header';
import { CalmVoiceConsole } from './components/CalmVoiceConsole';
import { VoiceAssistant } from './components/VoiceAssistant';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { AdaptiveStateManager } from './utils/adaptiveState';
import { SoundEffects } from './utils/speech';
import { adaptiveConsultStream } from './services/api';

// Performance Optimization: Lazy-load view components for code-splitting
const JargonTranslatorView = lazy(() =>
  import('./components/JargonTranslatorView').then((m) => ({ default: m.JargonTranslatorView }))
);
const ScamGuardianView = lazy(() =>
  import('./components/ScamGuardianView').then((m) => ({ default: m.ScamGuardianView }))
);
const DailyRhythmView = lazy(() =>
  import('./components/DailyRhythmView').then((m) => ({ default: m.DailyRhythmView }))
);
const TaskGuideView = lazy(() =>
  import('./components/TaskGuideView').then((m) => ({ default: m.TaskGuideView }))
);
const CompanionChatView = lazy(() =>
  import('./components/CompanionChatView').then((m) => ({ default: m.CompanionChatView }))
);
const AdaptiveIntakeModal = lazy(() =>
  import('./components/AdaptiveIntakeModal').then((m) => ({ default: m.AdaptiveIntakeModal }))
);

/**
 * Accessible, senior-friendly view loading fallback
 */
function ViewFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 my-6 flex flex-col items-center justify-center gap-3 shadow-lumina-xs"
    >
      <div className="w-8 h-8 border-4 border-[#D97706] border-t-transparent rounded-full animate-spin" />
      <p className="text-base font-bold text-slate-700 dark:text-slate-300">
        Loading view clearly and gently...
      </p>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'jargon' | 'scam' | 'rhythm' | 'task' | 'companion'
  >('jargon');
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lumina_font_size') as FontSize;
      if (saved === 'normal' || saved === 'large' || saved === 'huge') {
        return saved;
      }
    }
    return 'normal';
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lumina_theme_mode') as ThemeMode;
      if (saved === 'warm' || saved === 'high-contrast') {
        return saved;
      }
    }
    return 'warm';
  });
  const [adaptivePreferences, setAdaptivePreferences] = useState<AdaptivePreferences>(
    () => AdaptiveStateManager.getPreferences()
  );
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);

  // Apply root font-size scaling so all rem units, components, and text dynamically scale
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const sizePixelMap: Record<FontSize, string> = {
        normal: '18px',
        large: '22px',
        huge: '26px',
      };
      const rootSize = sizePixelMap[fontSize] || '18px';
      document.documentElement.style.fontSize = rootSize;
      document.documentElement.setAttribute('data-font-size', fontSize);
      try {
        localStorage.setItem('lumina_font_size', fontSize);
      } catch (e) {
        // ignore
      }
    }
  }, [fontSize]);

  // Sync theme mode to document element and storage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (themeMode === 'high-contrast') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'high-contrast');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'warm');
      }
      try {
        localStorage.setItem('lumina_theme_mode', themeMode);
      } catch (e) {
        // ignore
      }
    }
  }, [themeMode]);

  // Subscribe to preferences changes & show intake modal on first load if not completed
  useEffect(() => {
    const initial = AdaptiveStateManager.getPreferences();
    setAdaptivePreferences(initial);

    // If user has never completed the 3-question intake flow, open it automatically
    if (!initial.hasCompletedIntake) {
      setIntakeModalOpen(true);
    }

    const unsub = AdaptiveStateManager.subscribe((updated) => {
      setAdaptivePreferences(updated);
    });

    return () => unsub();
  }, []);

  const isHighContrast = themeMode === 'high-contrast';
  const isVoicePreferred =
    adaptivePreferences.interactionPreference === 'voice' ||
    adaptivePreferences.interactionPreference === 'voice_commands' ||
    adaptivePreferences.isCalmVoiceModeActive;
  const isCalmMode = isVoicePreferred;
  const isLargeButtons =
    adaptivePreferences.interactionPreference === 'buttons' ||
    adaptivePreferences.interactionPreference === 'large_buttons';

  // Compute font scale wrapper class - default base size of at least 18px for senior readability
  const fontScaleClass = {
    normal: 'font-scale-normal text-[1rem] leading-relaxed',
    large: 'font-scale-large text-[1.125rem] leading-relaxed',
    huge: 'font-scale-huge text-[1.25rem] leading-relaxed',
  }[fontSize];

  const handleIntakeComplete = (prefs: AdaptivePreferences) => {
    setAdaptivePreferences(prefs);
    // Route to corresponding primary goal view
    if (prefs.primaryGoal === 'understand_notes') {
      setActiveTab('jargon');
    } else if (prefs.primaryGoal === 'organize_day') {
      setActiveTab('rhythm');
    } else if (prefs.primaryGoal === 'learn_new') {
      setActiveTab('task');
    }
  };

  const handleToggleCalmMode = () => {
    SoundEffects.playSoftChime();
    const nextState = AdaptiveStateManager.toggleCalmVoiceMode();
    setAdaptivePreferences((prev) => ({
      ...prev,
      isCalmVoiceModeActive: nextState,
    }));
  };

  const tabs = [
    {
      id: 'jargon',
      label: 'Explain It Simply',
      description: 'Medical & Document Translator',
      icon: FileText,
    },
    {
      id: 'scam',
      label: 'Check A Message',
      description: 'Scam & Safety Guardian',
      icon: ShieldAlert,
    },
    {
      id: 'rhythm',
      label: 'My Daily Rhythm',
      description: 'Routine & Wellness Check',
      icon: Sun,
    },
    {
      id: 'task',
      label: 'Walk Me Through It',
      description: 'Step-by-Step Task Guide',
      icon: Footprints,
    },
    {
      id: 'companion',
      label: 'Friendly Companion',
      description: 'Voice & Warm Chat',
      icon: MessageCircleHeart,
    },
  ] as const;

  return (
    <GlobalErrorBoundary>
      <div
        className={`min-h-screen transition-colors font-sans ${fontScaleClass} ${
          isHighContrast
            ? 'bg-[#060D17] text-white'
            : 'bg-[#F4F7FB] text-[#0F172A]'
        }`}
      >
      {/* Accessible Header */}
      <Header
        fontSize={fontSize}
        setFontSize={setFontSize}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        adaptivePreferences={adaptivePreferences}
        onOpenIntakeModal={() => {
          SoundEffects.playSoftChime();
          setIntakeModalOpen(true);
        }}
      />

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Adaptive Mode Quick Banner & Switcher */}
        <div
          className={`px-5 py-3 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 transition-colors ${
            isHighContrast
              ? 'bg-slate-900 border-slate-700'
              : 'bg-white border-[#CBD5E1] shadow-lumina-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isCalmMode
                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-400 dark:text-slate-950'
                  : 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              {isCalmMode ? (
                <Mic className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <MousePointerClick className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#D97706] dark:text-amber-300 block">
                Adaptive System Active
              </span>
              <p className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                {isCalmMode ? 'Calm Voice Design Mode' : 'Large Button Touch Mode'} • Pacing:{' '}
                <span className="underline decoration-amber-500">
                  {adaptivePreferences.explanationPacing === 'quick_summary'
                    ? 'Quick Summary'
                    : 'Step-by-Step'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Toggle Button between Calm Voice Mode and Large Buttons */}
            <button
              type="button"
              id="btn-toggle-calm-mode"
              onClick={handleToggleCalmMode}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black border-2 transition-all flex items-center gap-2 ${
                isCalmMode
                  ? isHighContrast
                    ? 'bg-slate-950 border-amber-400 text-amber-300 hover:bg-slate-800'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A] hover:bg-[#DBEAFE]'
                  : isHighContrast
                  ? 'bg-amber-400 border-white text-slate-950 hover:bg-amber-300'
                  : 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] hover:bg-[#FDE68A]'
              }`}
              title={
                isCalmMode
                  ? 'Switch back to the full 5-tab menu and large tactile buttons'
                  : 'Switch to Calm Voice Mode (hides complex menu and enlarges microphone)'
              }
            >
              {isCalmMode ? (
                <>
                  <MousePointerClick className="w-4 h-4 stroke-[2.5]" />
                  <span>Show Full Menu Tabs</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 stroke-[2.5]" />
                  <span>Switch to Calm Voice Mode</span>
                </>
              )}
            </button>

            {/* Quick Pacing Toggle Button */}
            <button
              type="button"
              id="btn-quick-pacing-toggle"
              onClick={() => {
                SoundEffects.playSoftChime();
                const nextPacing =
                  adaptivePreferences.explanationPacing === 'quick_summary'
                    ? 'step_by_step'
                    : 'quick_summary';
                AdaptiveStateManager.setPacing(nextPacing);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black border-2 transition-all flex items-center gap-1.5 ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] hover:border-[#1E3A8A]'
              }`}
              title="Click to toggle between Quick Summary and Step-by-Step explanation pacing"
            >
              {adaptivePreferences.explanationPacing === 'quick_summary' ? (
                <>
                  <Zap className="w-4 h-4 text-[#D97706]" />
                  <span>Summary</span>
                </>
              ) : (
                <>
                  <ListOrdered className="w-4 h-4 text-[#1E3A8A] dark:text-blue-400" />
                  <span>Step-by-Step</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ADAPTIVE UI STATE BRANCH: CALM DESIGN MODE vs STANDARD MENU */}
        {/* If user selected 'Voice Commands', the UI dynamically toggles to Calm Design mode: */}
        {/* - Hiding complex navigation menus */}
        {/* - Enlarging the microphone interface */}
        {/* ============================================================== */}
        {isCalmMode ? (
          /* Calm Design Mode: Hides complex navigation menus and renders the Enlarged Microphone Interface */
          <div className="space-y-8 animate-fadeIn">
            <CalmVoiceConsole
              preferences={adaptivePreferences}
              onUpdatePreferences={(updates) => {
                AdaptiveStateManager.savePreferences(updates);
              }}
              onSwitchToTab={(tabId) => {
                SoundEffects.playSoftChime();
                setActiveTab(tabId);
              }}
              activeTab={activeTab}
              themeMode={themeMode}
              onOpenIntakeModal={() => setIntakeModalOpen(true)}
            />

            {/* In Calm Design Mode, the active tool is displayed below cleanly without distracting menus */}
            <div className="border-t-2 border-[#CBD5E1] dark:border-slate-800 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-[#0A192F] dark:text-white flex items-center gap-2">
                  <span>Selected Screen:</span>
                  <span className="text-[#D97706] dark:text-amber-300 uppercase tracking-wider text-sm px-2.5 py-0.5 rounded-lg bg-[#FEF3C7] dark:bg-slate-800 border border-amber-300">
                    {tabs.find((t) => t.id === activeTab)?.label}
                  </span>
                </h3>

                {/* Minimal Tab Switcher for Calm Mode */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-md">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        SoundEffects.playSoftChime();
                        setActiveTab(tab.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all shrink-0 ${
                        activeTab === tab.id
                          ? isHighContrast
                            ? 'bg-amber-400 text-slate-950 border-white font-black'
                            : 'bg-[#0A192F] text-white border-[#D97706]'
                          : isHighContrast
                          ? 'bg-slate-900 text-slate-300 border-slate-700'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Panel */}
              <section
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`nav-tab-${activeTab}`}
                aria-live="polite"
                className="transition-all"
              >
                <Suspense fallback={<ViewFallback />}>
                  {activeTab === 'jargon' && <JargonTranslatorView themeMode={themeMode} />}
                  {activeTab === 'scam' && <ScamGuardianView themeMode={themeMode} />}
                  {activeTab === 'rhythm' && <DailyRhythmView themeMode={themeMode} />}
                  {activeTab === 'task' && <TaskGuideView themeMode={themeMode} />}
                  {activeTab === 'companion' && <CompanionChatView themeMode={themeMode} />}
                </Suspense>
              </section>
            </div>
          </div>
        ) : (
          /* Standard Large Button Mode: Full Tactile Navigation Bar */
          <>
            <nav
              aria-label="Main Navigation"
              role="tablist"
              className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-wrap lg:flex-nowrap gap-2.5 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-amber-400'
                  : 'bg-white border-[#CBD5E1] shadow-lumina-sm'
              }`}
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    type="button"
                    onClick={() => {
                      SoundEffects.playSoftChime();
                      setActiveTab(tab.id);
                    }}
                    className={`flex-1 min-w-[160px] ${
                      isLargeButtons ? 'p-4 sm:p-5' : 'p-3.5 sm:p-4'
                    } rounded-xl transition-all text-left flex flex-col sm:flex-row items-center sm:items-start gap-3 relative focus:outline-none focus-visible:ring-4 focus-visible:ring-[#D97706] ${
                      isActive
                        ? isHighContrast
                          ? 'bg-amber-400 text-slate-950 border-[3px] border-white shadow-lg font-black -translate-y-0.5'
                          : 'bg-[#0A192F] text-white border-[3px] border-[#D97706] shadow-tab-active -translate-y-0.5'
                        : isHighContrast
                        ? 'bg-slate-950 text-slate-200 border-2 border-slate-700 hover:border-amber-300 hover:text-white'
                        : 'bg-[#F8FAFC] text-[#0F172A] border-2 border-[#CBD5E1] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        isActive
                          ? isHighContrast
                            ? 'bg-slate-950 text-amber-400 border border-slate-800'
                            : 'bg-[#D97706] text-[#0A192F] border border-[#F59E0B]'
                          : isHighContrast
                          ? 'bg-slate-900 text-amber-400 border border-slate-700'
                          : 'bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE]'
                      }`}
                    >
                      <Icon className="w-6 h-6 stroke-[2.5]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="block text-base sm:text-lg font-black leading-tight tracking-tight">
                          {tab.label}
                        </span>
                        {/* Visual Active State Indicator */}
                        {isActive && (
                          <span
                            className={`hidden xl:inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 shadow-xs ${
                              isHighContrast
                                ? 'bg-slate-950 text-amber-300 border border-amber-300'
                                : 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" /> Active
                          </span>
                        )}
                      </div>
                      <span
                        className={`hidden md:block text-xs font-bold mt-1 leading-snug ${
                          isActive
                            ? isHighContrast
                              ? 'text-slate-950 font-black'
                              : 'text-amber-200'
                            : isHighContrast
                            ? 'text-slate-300'
                            : 'text-[#475569]'
                        }`}
                      >
                        {tab.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Active Tab View */}
            <section
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`nav-tab-${activeTab}`}
              aria-live="polite"
              className="transition-all"
            >
              <Suspense fallback={<ViewFallback />}>
                {activeTab === 'jargon' && <JargonTranslatorView themeMode={themeMode} />}
                {activeTab === 'scam' && <ScamGuardianView themeMode={themeMode} />}
                {activeTab === 'rhythm' && <DailyRhythmView themeMode={themeMode} />}
                {activeTab === 'task' && <TaskGuideView themeMode={themeMode} />}
                {activeTab === 'companion' && <CompanionChatView themeMode={themeMode} />}
              </Suspense>
            </section>
          </>
        )}

        {/* Helpful Senior Support & Emergency Notice Footer */}
        <footer
          className={`p-6 sm:p-7 rounded-2xl border-2 text-center space-y-3.5 transition-colors ${
            isHighContrast
              ? 'bg-slate-900 border-slate-700 text-slate-200'
              : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
          }`}
        >
          <div className="flex flex-wrap items-center justify-center gap-4 text-base font-extrabold">
            <span
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${
                isHighContrast
                  ? 'bg-slate-950 border-rose-400 text-rose-300'
                  : 'bg-[#FFF1EE] border-[#BE123C] text-[#9F1239]'
              }`}
            >
              <Phone className="w-5 h-5 stroke-[2.5]" /> Immediate Medical Emergency: Call 911
            </span>
            <span className="opacity-40">•</span>
            <span
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${
                isHighContrast
                  ? 'bg-slate-950 border-amber-400 text-amber-300'
                  : 'bg-[#EFF6FF] border-[#1E3A8A] text-[#1E3A8A]'
              }`}
            >
              <Phone className="w-5 h-5 stroke-[2.5]" /> Suicide & Crisis Lifeline: Call or Text 988
            </span>
          </div>

          <p className="text-sm max-w-3xl mx-auto text-[#334155] dark:text-slate-300 font-semibold leading-relaxed flex items-center justify-center gap-2">
            <Info className="w-5 h-5 shrink-0 inline text-[#D97706] dark:text-amber-300" />
            <span>
              Lumina Companion is a transparent digital consultant and accessibility teacher designed to offer clear explanations, routine pacing, and everyday guidance. It does not replace professional medical or legal advice. Always consult your doctor for medical decisions.
            </span>
          </p>
        </footer>
      </main>

      {/* Adaptive Intake Modal (3-Question Cognitive & Accessibility Flow) */}
      <Suspense fallback={null}>
        <AdaptiveIntakeModal
          isOpen={intakeModalOpen}
          onClose={() => setIntakeModalOpen(false)}
          onComplete={handleIntakeComplete}
          themeMode={themeMode}
        />
      </Suspense>

      {/* Hands-Free Always-On Voice Assistant (Hey Lumina Wake Word) */}
      <VoiceAssistant
        themeMode={themeMode}
        activeTab={activeTab}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onChangeFontSize={(size) => setFontSize(size)}
        geminiStreamingFn={adaptiveConsultStream}
      />
      </div>
    </GlobalErrorBoundary>
  );
}
