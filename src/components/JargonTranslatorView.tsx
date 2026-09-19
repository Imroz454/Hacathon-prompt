import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Stethoscope,
  Pill,
  CreditCard,
  RotateCcw,
  Volume2,
  Pause,
  Play,
  Square,
  Radio,
} from 'lucide-react';
import { JargonTranslationResult, ThemeMode } from '../types/companion';
import { translateJargon, translateJargonStream } from '../services/api';
import { parseJargonMarkdown, ParsedJargonResult } from '../utils/jargonParser';
import { TextToSpeech, SoundEffects } from '../utils/speech';
import { VoiceInputButton } from './VoiceInputButton';

interface JargonTranslatorViewProps {
  themeMode: ThemeMode;
}

const SAMPLE_PRESETS = [
  {
    id: 'cardiology',
    label: 'Cardiology',
    subtitle: 'Hospital Discharge Note',
    icon: Stethoscope,
    type: 'doctor_notes' as const,
    text: `Discharge Summary - Inpatient Cardiology Service
Patient: 74-year-old presenting status-post acute Non-ST-Elevation Myocardial Infarction (NSTEMI). Transthoracic echocardiogram demonstrates left ventricular apical hypokinesis with preserved LVEF 50-55%, mild concentric LV hypertrophy, and trace mitral regurgitation. Coronary angiogram showed 75% proximal LAD stenosis; successful percutaneous coronary intervention (PCI) with drug-eluting stent (DES) deployed.

Discharge Medications:
1. Dual Antiplatelet Therapy (DAPT): Aspirin 81 mg PO daily indefinitely + Ticagrelor (Brilinta) 90 mg PO BID for 12 months. Mandatory compliance: do not hold without consulting interventional cardiology due to acute stent thrombosis risk.
2. Atorvastatin 80 mg PO QHS (high-intensity statin therapy).
3. Metoprolol succinate ER 25 mg PO daily; monitor for bradycardia and orthostatic hypotension.
4. Lisinopril 5 mg PO daily.
5. Sublingual Nitroglycerin 0.4 mg PRN chest pain (take 1 dose every 5 min up to 3 doses; call 911 if unresolved).

Dietary & Activity Restrictions:
Strict low-sodium (<1,500 mg/day) cardiac DASH diet. Absolute contraindication: Avoid all systemic NSAIDs (ibuprofen, naproxen) and PDE5 inhibitors. Enroll in Phase II Outpatient Cardiac Rehabilitation within 14 days.

Follow-up Appointments & Urgent Red Flags:
Post-discharge cardiology clinic visit in 14 days; metabolic renal panel and fasting lipid panel in 4 weeks. Instructed to seek emergency medical evaluation immediately for recurrent retrosternal angina, diaphoresis, resting dyspnea, syncope, or sudden weight gain >3 lbs in 24 hours.`,
  },
  {
    id: 'lab-results',
    label: 'Lab Results',
    subtitle: 'Blood Chemistry & Kidney Panel',
    icon: BookOpen,
    type: 'lab_results' as const,
    text: `Diagnostic Laboratory Services - Outpatient Serum Chemistry Report
Specimen: Fasting Venous Blood | Reference Range Status: Flagged Abnormalities Noted

Metabolic Panel:
- Glucose, Fasting: 154 mg/dL [Reference: 70-99 mg/dL] - HIGH (Critical finding for physician review)
- Hemoglobin A1c (HbA1c): 7.6% [Reference: 4.0-5.6%] - ABNORMAL / ELEVATED (Indicates suboptimal glycemic control over prior 90 days)
- eGFR (CKD-EPI equation): 54 mL/min/1.73m² [Reference: >60 mL/min/1.73m²] - LOW (Stage 3a chronic renal insufficiency; caution with nephrotoxic agents)
- Serum Creatinine: 1.34 mg/dL [Reference: 0.60-1.10 mg/dL] - HIGH
- Blood Urea Nitrogen (BUN): 26 mg/dL [Reference: 7-20 mg/dL] - HIGH
- Serum Potassium: 4.8 mEq/L [Reference: 3.5-5.0 mEq/L] - NORMAL
- Serum Sodium: 139 mEq/L [Reference: 135-145 mEq/L] - NORMAL

Lipid Profile:
- Total Cholesterol: 236 mg/dL - HIGH
- LDL-Cholesterol (Calculated): 148 mg/dL - HIGH (Above target threshold)
- Triglycerides: 215 mg/dL - HIGH
- HDL-Cholesterol: 45 mg/dL - NORMAL

Clinical Impressions & Action Required:
1. Moderate hyperglycemia and uncontrolled type 2 diabetes mellitus. Titrate Metformin from 500 mg daily to 500 mg BID with meals as tolerated; monitor for GI distress and lactic acidosis risk given reduced eGFR.
2. Repeat BMP and microalbumin-to-creatinine ratio in 60 days to reassess renal clearance.
3. Urgent red flags: Report immediate severe nausea, persistent emesis, confusion, or extreme thirst/polyuria.`,
  },
  {
    id: 'warning-label',
    label: 'Warning Label',
    subtitle: 'Prescription Black-Box Warning',
    icon: Pill,
    type: 'prescription' as const,
    text: `RX WARNING & MEDICATION GUIDE - DISPENSE TO PATIENT
Medication: Alendronate Sodium 70 mg Tablets (Bisphosphonate / Osteoporosis Regimen)
Rx #: 8472910-4 | Quantity: 4 Tablets (1-Month Supply)

MANDATORY ADMINISTRATION INSTRUCTIONS:
- Take exactly ONE tablet ONCE WEEKLY immediately upon arising for the day.
- Swallow tablet whole with a full 8-ounce glass (240 mL) of PLAIN TAP WATER ONLY. Do not take with mineral water, coffee, juice, tea, milk, or breakfast.
- DO NOT CHEW, CRUSH, OR SUCK THE TABLET: Chemical ulceration of the mouth or throat may occur.
- STRICT UPRIGHT POSTURE: You MUST remain standing, walking, or sitting fully upright for AT LEAST 30 MINUTES after swallowing and until after your first food of the day. DO NOT LIE DOWN OR RECLINE: Failure to follow this instruction significantly increases the risk of severe esophageal irritation, erosive esophagitis, esophageal ulcers, and perforation.
- Wait at least 30 to 60 minutes after taking Alendronate before consuming food, beverages, or other medications (especially calcium, antacids, or vitamins, which block absorption).

CRITICAL RED FLAGS & STOPPING CRITERIA:
- STOP TAKING THIS MEDICATION AND CALL YOUR DOCTOR IMMEDIATELY if you experience difficulty swallowing (dysphagia), pain when swallowing (odynophagia), retrosternal chest pain, new or worsening heartburn, or severe jaw pain / numbness (osteonecrosis of the jaw).`,
  },
  {
    id: 'medicare',
    label: 'Medicare',
    subtitle: 'Summary Notice & Denial Appeal',
    icon: CreditCard,
    type: 'bill_insurance' as const,
    text: `MEDICARE SUMMARY NOTICE (MSN) & EXPLANATION OF BENEFITS (EOB)
Part B Medical Insurance Claims Statement | Notice Date: September 12, 2026
Beneficiary Medicare ID: 1EG4-TE9-MK22 | Claim Reference Number: 2026-0883-9182

PROVIDER SERVICES BILLED:
1. Date: 08/14/2026 | Provider: Metro Health Specialists | Procedure: 99215 (Complex Office Visit)
   - Amount Billed: $410.00 | Medicare Approved: $182.50 | Medicare Paid Provider: $146.00
   - Patient 20% Coinsurance: $36.50
2. Date: 08/14/2026 | Provider: Advanced Diagnostics LLC | Procedure: 78452 (Myocardial Perfusion SPECT)
   - Amount Billed: $1,440.00 | Medicare Approved: $425.00 | Medicare Paid: $0.00
   - Denial Remark Code N-115: "Service denied as non-covered under local coverage determination (LCD L33580) due to missing prior authorization and secondary clinical documentation from referring provider."

FINANCIAL SUMMARY & ACTION REQUIRED:
- Total Provider Charges: $1,850.00
- Total Medicare Paid: $146.00
- Maximum Patient Responsibility Pending: $461.50 (Deductible $240.00 + Coinsurance $36.50 + Disputed Denial $185.00)
- Action: DO NOT PAY full billed amount of $1,440.00. Contact Metro Health billing office to submit medical necessity records under claim #2026-0883-9182.

MANDATORY STATUTORY DEADLINES & APPEAL RIGHTS:
- 60-DAY APPEAL DEADLINE: You have the legal right to appeal this Medicare denial under Section 1869 of the Social Security Act. Your formal Redetermination Appeal (Form CMS-20027) MUST BE POSTMARKED NO LATER THAN November 11, 2026 (strictly 60 days from this notice). Missing this statutory deadline forfeits your right to Medicare coverage for this claim.`,
  },
];

export function JargonTranslatorView({ themeMode }: JargonTranslatorViewProps) {
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState<
    'doctor_notes' | 'lab_results' | 'prescription' | 'bill_insurance' | 'general'
  >('doctor_notes');

  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedJargonResult | JargonTranslationResult | null>(null);

  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [completedActions, setCompletedActions] = useState<Record<number, boolean>>({});

  // Voice Assistant Audio State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeSegmentLabel, setActiveSegmentLabel] = useState<string>('');

  // Native Speech Dictation State (Tap to Speak)
  const baseDictationTextRef = useRef('');
  const [isDictating, setIsDictating] = useState(false);

  const handleStartDictation = () => {
    baseDictationTextRef.current = inputText ? inputText.trim() : '';
  };

  const handleDictationTranscript = (sessionTranscript: string) => {
    if (baseDictationTextRef.current) {
      setInputText(`${baseDictationTextRef.current} ${sessionTranscript}`);
    } else {
      setInputText(sessionTranscript);
    }
  };

  const abortStreamRef = useRef<(() => void) | null>(null);
  const isHighContrast = themeMode === 'high-contrast';

  // Synchronize global speech state
  useEffect(() => {
    const unsubscribe = TextToSpeech.subscribeState((speakingId, paused) => {
      if (!speakingId || !speakingId.includes('summary-voice-assistant')) {
        if (isSpeaking && speakingId === null) {
          setIsSpeaking(false);
          setIsPaused(false);
          setActiveSegmentIndex(-1);
          setActiveSegmentId(null);
          setActiveSegmentLabel('');
        }
      } else {
        setIsPaused(paused);
      }
    });

    return () => {
      unsubscribe();
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
      TextToSpeech.stop();
    };
  }, [isSpeaking]);

  const handleTranslate = async (
    textToUse?: string,
    sourceTypeToUse?: 'doctor_notes' | 'lab_results' | 'prescription' | 'bill_insurance' | 'general'
  ) => {
    const text = textToUse !== undefined ? textToUse : inputText;
    const type = sourceTypeToUse !== undefined ? sourceTypeToUse : sourceType;

    if (!text.trim()) {
      setError('Please type or paste some text first, or click one of the quick samples above.');
      return;
    }

    // Stop any in-progress speech playback
    TextToSpeech.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveSegmentId(null);
    setActiveSegmentIndex(-1);

    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }

    setLoading(true);
    setIsStreaming(true);
    setError(null);
    setStreamText('');
    setResult(null);
    setCompletedActions({});

    try {
      const cancelFn = await translateJargonStream(
        { text, sourceType: type },
        (accumulatedText, _latestChunk) => {
          setStreamText(accumulatedText);
          setLoading(false); // Text is streaming in live
          const partialParsed = parseJargonMarkdown(accumulatedText, false);
          setResult(partialParsed);
        },
        (finalText) => {
          setIsStreaming(false);
          setLoading(false);
          const finalParsed = parseJargonMarkdown(finalText, true);
          setResult(finalParsed);
          SoundEffects.playSuccessChime();
        },
        (streamErr) => {
          console.warn('Streaming interrupted, using fallback:', streamErr);
          // Seamless fallback to JSON endpoint
          translateJargon({ text, sourceType: type })
            .then((data) => {
              setResult(data as any);
              setIsStreaming(false);
              setLoading(false);
              SoundEffects.playSuccessChime();
            })
            .catch((fallbackErr) => {
              setError(fallbackErr.message || 'We could not simplify this document right now. Please try again.');
              setIsStreaming(false);
              setLoading(false);
            });
        }
      );

      abortStreamRef.current = cancelFn;
    } catch (err: any) {
      console.error('Translation error:', err);
      setError(err.message || 'We could not simplify this document right now. Please try again.');
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const handleSelectPreset = (preset: (typeof SAMPLE_PRESETS)[0]) => {
    setInputText(preset.text);
    setSourceType(preset.type);
    setError(null);
    // Immediately triggers the Gemini API translation call with authentic sample text
    handleTranslate(preset.text, preset.type);
  };

  const toggleAction = (idx: number) => {
    setCompletedActions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyQuestions = () => {
    if (!result?.questionsForDoctor) return;
    const text = result.questionsForDoctor.map((q, i) => `${i + 1}. ${q}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedQuestions(true);
    SoundEffects.playSoftChime();
    setTimeout(() => setCopiedQuestions(false), 3000);
  };

  // -------------------------------------------------------------
  // BUILT-IN VOICE ASSISTANT (TTS WITH 3-PART SEGMENT HIGHLIGHTING)
  // -------------------------------------------------------------
  const handleStartReadAloud = () => {
    if (!result) return;

    // Build sequential speech segments covering the strict 3-part layout
    const segments: Array<{ id: string; text: string; label: string }> = [];

    const summaryText =
      result.summary ||
      (isStreaming ? streamText || '' : '');

    if (summaryText) {
      segments.push({
        id: 'summary',
        text: `Part 1, One-Sentence Summary: ${summaryText}`,
        label: 'Reading Part 1: One-Sentence Summary',
      });
    }

    const rawActions: Array<{ title: string; detail: string; timing?: string }> =
      (result as any).actionItems || (result as any).threePoints || [];

    if (rawActions.length > 0) {
      rawActions.forEach((item, idx) => {
        segments.push({
          id: `action-${idx}`,
          text: `Part 2, Action Item ${idx + 1}: ${item.title}. ${item.detail}`,
          label: `Reading Action Item ${idx + 1} of ${rawActions.length}`,
        });
      });
    } else if (result.keyActionItems && result.keyActionItems.length > 0) {
      result.keyActionItems.forEach((item: any, idx: number) => {
        segments.push({
          id: `action-${idx}`,
          text: `Part 2, Action Item ${idx + 1}: ${item.action}`,
          label: `Reading Action Item ${idx + 1}`,
        });
      });
    }

    const rawFlags: Array<{ title: string; detail: string }> =
      (result as any).redFlagsOrDeadlines || (result as any).redFlagsAndDeadlines || [];

    if (rawFlags.length > 0) {
      rawFlags.forEach((flag, idx) => {
        segments.push({
          id: `flag-${idx}`,
          text: `Part 3, Red Flag or Deadline ${idx + 1}: ${flag.title}. ${flag.detail}`,
          label: `Reading Red Flag or Deadline ${idx + 1} of ${rawFlags.length}`,
        });
      });
    }

    if (segments.length === 0) return;

    setIsSpeaking(true);
    setIsPaused(false);
    setActiveSegmentIndex(0);
    setActiveSegmentId(segments[0].id);
    setActiveSegmentLabel(segments[0].label);

    // Call senior-optimized speech engine: rate = 0.85, comforting pitch
    TextToSpeech.speakSegments(
      segments,
      'summary-voice-assistant',
      (idx, segment) => {
        setActiveSegmentIndex(idx);
        setActiveSegmentId(segment.id);
        setActiveSegmentLabel((segment as any).label || `Reading item ${idx + 1}`);
      },
      () => {
        // Finished successfully
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveSegmentIndex(-1);
        setActiveSegmentId(null);
        setActiveSegmentLabel('');
      },
      (err) => {
        console.warn('Voice playback warning:', err);
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveSegmentIndex(-1);
        setActiveSegmentId(null);
        setActiveSegmentLabel('');
      }
    );
  };

  const handleTogglePause = () => {
    if (isPaused) {
      TextToSpeech.resume();
      setIsPaused(false);
    } else {
      TextToSpeech.pause();
      setIsPaused(true);
    }
  };

  const handleStopSpeech = () => {
    TextToSpeech.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveSegmentIndex(-1);
    setActiveSegmentId(null);
    setActiveSegmentLabel('');
  };

  // Strict 3-Part Layout Data Normalization
  const displaySummary =
    result?.summary ||
    (isStreaming ? streamText || 'Simplifying your document into clear everyday English...' : '');

  const actionItemsList: Array<{ title: string; detail: string; timing?: string; priority?: string }> =
    (result as any)?.actionItems?.length > 0
      ? (result as any).actionItems
      : (result as any)?.threePoints?.length > 0
      ? (result as any).threePoints
      : (result?.keyActionItems || []).map((item) => ({
          title: item.action.split(':')[0] || 'Action Step',
          detail: item.action.split(':').slice(1).join(':').trim() || item.action,
          timing: item.timing,
          priority: item.priority,
        }));

  const redFlagsList: Array<{ title: string; detail: string; isUrgent?: boolean }> =
    (result as any)?.redFlagsOrDeadlines?.length > 0
      ? (result as any).redFlagsOrDeadlines
      : (result as any)?.redFlagsAndDeadlines?.length > 0
      ? (result as any).redFlagsAndDeadlines
      : [];

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
              <FileText className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-[#0A192F] dark:text-white">
                Explain It Simply
              </h2>
              <p className="text-lg font-bold text-[#334155] dark:text-slate-200 mt-1">
                Translate doctor notes, lab results, prescriptions, or letters into comforting everyday English.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="mt-6">
          <p className="text-sm font-black uppercase tracking-wider mb-2.5 text-[#0A192F] dark:text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
            Try a real-life example with one click:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SAMPLE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  id={`btn-example-${preset.id}`}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex flex-col items-start gap-1 p-3.5 text-left rounded-xl border-2 transition-all hover:scale-[1.01] focus:ring-4 focus:ring-amber-400 ${
                    isHighContrast
                      ? 'bg-slate-800 border-slate-600 text-amber-300 hover:bg-slate-700'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="w-5 h-5 shrink-0 text-[#D97706] dark:text-amber-400" />
                    <span className="font-extrabold text-base">{preset.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
                    {preset.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Type Selector */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-[#0A192F] dark:text-slate-200 mr-1">Type of document:</span>
          {[
            { id: 'doctor_notes', label: "Doctor's Visit" },
            { id: 'lab_results', label: 'Blood or Lab Test' },
            { id: 'prescription', label: 'Medicine Bottle' },
            { id: 'bill_insurance', label: 'Insurance or Notice' },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setSourceType(type.id as any)}
              className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${
                sourceType === type.id
                  ? isHighContrast
                    ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                    : 'bg-[#0A192F] text-white border-[#D97706] shadow-lumina-xs'
                  : isHighContrast
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500'
                  : 'bg-[#F8FAFC] text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706]'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Text Input Area */}
        <div className="mt-5">
          <label htmlFor="jargon-input-textarea" className="block text-base sm:text-lg font-black text-[#0A192F] dark:text-white mb-2">
            Paste or dictate the words you would like explained:
          </label>
          <div className="relative">
            <textarea
              id="jargon-input-textarea"
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Paste from your patient portal, doctor's note, or read from your medicine bottle..."
              className={`w-full p-4 rounded-xl text-lg font-medium border-2 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isHighContrast
                  ? 'bg-slate-950 border-slate-600 text-white placeholder:text-slate-400'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#D97706]'
              }`}
            />
          </div>

          {/* Active Dictation Live Indicator */}
          {isDictating && (
            <div
              id="active-dictation-banner"
              className={`mt-2.5 p-3 rounded-xl border-2 flex items-center justify-between gap-3 text-sm sm:text-base font-black animate-pulse ${
                isHighContrast
                  ? 'bg-rose-950/80 border-rose-400 text-white'
                  : 'bg-rose-50 border-rose-400 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping shrink-0" />
                <span>Microphone active — speaking is transcribing directly into the box above...</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                webkitSpeechRecognition
              </span>
            </div>
          )}

          {/* Action Row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <VoiceInputButton
                onStartListening={handleStartDictation}
                onTranscript={handleDictationTranscript}
                onListeningChange={setIsDictating}
              />
              {inputText && (
                <button
                  type="button"
                  onClick={() => {
                    setInputText('');
                    setResult(null);
                    setStreamText('');
                    handleStopSpeech();
                  }}
                  className="px-3.5 py-2 text-sm text-[#334155] hover:text-[#0F172A] font-black flex items-center gap-1.5 border-2 border-transparent hover:border-[#CBD5E1] rounded-xl"
                >
                  <RotateCcw className="w-4 h-4 stroke-[2.5]" /> Clear
                </button>
              )}
            </div>

            {/* Warm Gold Primary Explain Button (Warmth, Vitality & Modern Trust) */}
            <button
              id="btn-translate-jargon-submit"
              type="button"
              disabled={loading || isStreaming || !inputText.trim()}
              onClick={() => handleTranslate()}
              className={`px-8 py-4 sm:px-10 sm:py-4.5 rounded-2xl text-xl sm:text-2xl font-black transition-all flex items-center gap-3 focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                isHighContrast
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-[3px] border-white shadow-lg'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-[3px] border-amber-600 shadow-lumina-md hover:shadow-lumina-lg active:scale-[0.99]'
              }`}
            >
              {loading ? (
                <>
                  <span className="inline-block w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Simplifying clearly for you...</span>
                </>
              ) : isStreaming ? (
                <>
                  <Radio className="w-6 h-6 text-amber-200 animate-pulse" />
                  <span>Streaming Plain English...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-7 h-7 shrink-0 fill-current" />
                  <span>Explain In Plain English</span>
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

      {/* Live Stream Status Indicator */}
      {isStreaming && (
        <div
          className={`p-4 px-6 rounded-2xl border-2 flex items-center justify-between gap-3 text-base font-bold animate-pulse ${
            isHighContrast
              ? 'bg-slate-900 border-amber-400 text-amber-300'
              : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A] shadow-lumina-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="inline-block w-3.5 h-3.5 rounded-full bg-[#D97706] animate-ping" />
            <span>Streaming response live from Gemini API — rendering in real time...</span>
          </div>
          <span className="text-xs uppercase tracking-wider font-mono font-black opacity-90">
            Focused 3-Point Structure
          </span>
        </div>
      )}

      {/* Dynamic Results Display */}
      {result && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Plain English Summary Banner */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 shadow-lumina-xs transition-colors ${
              isHighContrast
                ? 'bg-slate-900 border-amber-400 text-white'
                : 'bg-white border-[#CBD5E1] text-[#0F172A]'
            }`}
          >
            {/* -------------------------------------------------------------
                BUILT-IN SPEAKER & VOICE ASSISTANT (HIGH CONTRAST, TOP OF CARD)
               ------------------------------------------------------------- */}
            <div
              id="voice-assistant-top-toolbar"
              className={`p-4 sm:p-5 rounded-2xl border-2 mb-6 transition-all ${
                isSpeaking
                  ? isHighContrast
                    ? 'bg-slate-950 border-amber-400 ring-4 ring-amber-400/40 shadow-lg'
                    : 'bg-[#EFF6FF] border-[#D97706] ring-4 ring-amber-400/30 shadow-lumina-md'
                  : isHighContrast
                  ? 'bg-slate-800/90 border-slate-700'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] shadow-lumina-xs'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Visual Read Aloud / Stop Toggle Button */}
                {!isSpeaking ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      id="btn-voice-read-aloud-prominent"
                      type="button"
                      onClick={handleStartReadAloud}
                      className={`px-7 py-4 sm:px-9 sm:py-4.5 rounded-2xl text-xl sm:text-2xl font-black shadow-lumina-md transition-all flex items-center gap-3.5 focus:outline-none focus:ring-4 cursor-pointer ${
                        isHighContrast
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 focus:ring-amber-300 border-[3px] border-white'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-[3px] border-amber-600 active:scale-[0.99] focus:ring-amber-400'
                      }`}
                      aria-label="Read AI summary aloud at 0.85 rate"
                    >
                      <Volume2 className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 animate-pulse stroke-[2.5]" />
                      <span>🔊 Read Aloud</span>
                      <span className="text-sm font-bold opacity-90 hidden sm:inline ml-1">
                        (0.85x Gentle Pace)
                      </span>
                    </button>
                    <span className="text-sm font-bold text-[#475569] dark:text-slate-300 hidden md:inline">
                      Speech rate calibrated to 0.85 for unhurried comprehension
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Visual Stop Toggle while audio is playing */}
                    <button
                      id="btn-voice-stop-prominent"
                      type="button"
                      onClick={handleStopSpeech}
                      className={`px-7 py-4 sm:px-9 sm:py-4.5 rounded-2xl text-xl sm:text-2xl font-black shadow-lumina-md transition-all flex items-center gap-3.5 focus:outline-none focus:ring-4 cursor-pointer ${
                        isHighContrast
                          ? 'bg-rose-600 text-white hover:bg-rose-500 border-[3px] border-white ring-4 ring-rose-400/40 animate-pulse'
                          : 'bg-[#991B1B] hover:bg-[#7F1D1D] text-white border-[3px] border-[#7F1D1D] ring-4 ring-rose-400/50 shadow-warm-lg animate-pulse active:scale-[0.99]'
                      }`}
                      aria-label="Stop reading aloud"
                    >
                      <Square className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 fill-current" />
                      <span>⏹️ Stop</span>
                      <span className="text-sm font-bold opacity-90 hidden sm:inline ml-1">
                        (Playing • Tap to Stop)
                      </span>
                    </button>

                    {/* Animated Sound Wave (5 pulsing audio bars) */}
                    <div
                      className={`flex items-end gap-1.5 h-10 px-4 py-2 rounded-xl border-2 ${
                        isHighContrast
                          ? 'bg-slate-900 border-amber-400'
                          : 'bg-white border-[#D97706]'
                      }`}
                      aria-label="Sound wave animation"
                    >
                      <span
                        className={`w-2 rounded-full ${
                          isHighContrast ? 'bg-amber-400' : 'bg-[#D97706]'
                        } animate-soundwave-1 ${isPaused ? 'animate-soundwave-paused' : ''}`}
                      />
                      <span
                        className={`w-2 rounded-full ${
                          isHighContrast ? 'bg-amber-400' : 'bg-[#D97706]'
                        } animate-soundwave-2 ${isPaused ? 'animate-soundwave-paused' : ''}`}
                      />
                      <span
                        className={`w-2 rounded-full ${
                          isHighContrast ? 'bg-amber-400' : 'bg-[#D97706]'
                        } animate-soundwave-3 ${isPaused ? 'animate-soundwave-paused' : ''}`}
                      />
                      <span
                        className={`w-2 rounded-full ${
                          isHighContrast ? 'bg-amber-400' : 'bg-[#D97706]'
                        } animate-soundwave-4 ${isPaused ? 'animate-soundwave-paused' : ''}`}
                      />
                      <span
                        className={`w-2 rounded-full ${
                          isHighContrast ? 'bg-amber-400' : 'bg-[#D97706]'
                        } animate-soundwave-5 ${isPaused ? 'animate-soundwave-paused' : ''}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-xl font-black text-[#0A192F] dark:text-white">
                          {isPaused ? '⏸️ Voice Paused' : '🔊 Reading Aloud Clearly'}
                        </span>
                        <span
                          className={`text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                            isHighContrast
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-amber-100 text-amber-950 border-amber-300'
                          }`}
                        >
                          Rate: 0.85x
                        </span>
                      </div>
                      <span className="text-sm font-bold text-[#475569] dark:text-slate-300 block">
                        {activeSegmentLabel || 'Paced slowly and gently for comfort'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Secondary Pause/Resume Control during playback */}
                {isSpeaking && (
                  <div className="flex items-center gap-2.5">
                    <button
                      id="btn-voice-pause-resume"
                      type="button"
                      onClick={handleTogglePause}
                      className={`px-5 py-3 rounded-xl text-lg font-black border-2 transition-all flex items-center gap-2 shadow-lumina-xs cursor-pointer ${
                        isHighContrast
                          ? 'bg-slate-900 text-amber-300 border-amber-400 hover:bg-slate-800'
                          : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-5 h-5 fill-current text-[#D97706]" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-5 h-5 fill-current text-[#D97706]" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* =============================================================
                PART 1: ONE-SENTENCE SUMMARY
               ============================================================= */}
            <div
              id="jargon-part-1-summary"
              className="border-b-2 border-[#E2E8F0] dark:border-slate-800 pb-4 mb-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-lg border-2 border-amber-500 shrink-0">
                    1
                  </span>
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black font-serif text-[#0A192F] dark:text-white">
                      One-Sentence Summary
                    </h3>
                    <p className="text-sm font-bold text-[#475569] dark:text-slate-300">
                      The core takeaway in clear, everyday English.
                    </p>
                  </div>
                </div>
                {isStreaming && (
                  <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-amber-200 text-slate-950 flex items-center gap-1.5 border border-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse" />
                    Generating Live Stream...
                  </span>
                )}
              </div>
            </div>

            {/* Plain English Summary Sentence with Active Sentence Highlighting */}
            <div
              className={`p-5 rounded-2xl transition-all duration-300 border-2 ${
                isSpeaking && activeSegmentId === 'summary'
                  ? isHighContrast
                    ? 'bg-amber-950/80 border-amber-300 ring-4 ring-amber-400/40'
                    : 'bg-[#EFF6FF] border-[#D97706] ring-4 ring-amber-400/30 shadow-lumina-sm'
                  : 'bg-[#F8FAFC] dark:bg-slate-950 border-[#CBD5E1] dark:border-slate-800'
              }`}
            >
              {isSpeaking && activeSegmentId === 'summary' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-300 text-stone-950 mb-3 border border-amber-400">
                  <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Currently Reading This
                </span>
              )}
              <p className="text-xl sm:text-2xl font-bold leading-relaxed text-stone-950 dark:text-white">
                "{displaySummary}"
                {isStreaming && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-2.5 h-5 ml-1 bg-[#D97706] dark:bg-amber-400 animate-pulse align-middle rounded-sm"
                  />
                )}
              </p>
            </div>

            {/* Reassurance Note Banner (if present) */}
            {result.reassuranceNote && (
              <div
                className={`mt-5 p-4 rounded-xl border-2 text-lg flex items-center gap-3 transition-all duration-300 ${
                  isSpeaking && activeSegmentId === 'reassurance'
                    ? isHighContrast
                      ? 'bg-amber-950 border-amber-400 ring-4 ring-amber-400/40 text-amber-200'
                      : 'bg-[#EFF6FF] border-[#3B82F6] ring-4 ring-[#3B82F6]/20 text-[#0F172A] shadow-lumina-xs'
                    : isHighContrast
                    ? 'bg-slate-950 border-slate-700 text-slate-200'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]'
                }`}
              >
                <CheckCircle2 className="w-6 h-6 text-[#D97706] dark:text-amber-400 shrink-0" />
                <span className="font-bold">{result.reassuranceNote}</span>
                {isSpeaking && activeSegmentId === 'reassurance' && (
                  <span className="ml-auto text-xs font-black uppercase px-2.5 py-0.5 rounded-md bg-amber-300 text-slate-950 shrink-0 border border-amber-400">
                    🔊 Reading
                  </span>
                )}
              </div>
            )}
          </div>

          {/* =============================================================
              PART 2: ACTION ITEMS NEEDED
             ============================================================= */}
          {actionItemsList.length > 0 && (
            <div
              id="jargon-part-2-action-items"
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b-2 border-[#E2E8F0] dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-lg border-2 border-blue-700 shrink-0">
                    2
                  </span>
                  <div>
                    <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white">
                      Action Items Needed
                    </h3>
                    <p className="text-sm font-bold text-[#475569] dark:text-slate-300">
                      Concrete steps to take for your health or paperwork. Tap any step to mark done.
                    </p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wider font-black text-[#475569] dark:text-slate-300">
                  Interactive Checklist
                </span>
              </div>

              <div className="space-y-3.5">
                {actionItemsList.map((item, idx) => {
                  const isDone = completedActions[idx];
                  const isCurrentSpeechTarget =
                    isSpeaking && activeSegmentId === `action-${idx}`;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleAction(idx)}
                      className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                        isCurrentSpeechTarget
                          ? isHighContrast
                            ? 'bg-amber-950 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-md'
                            : 'bg-[#EFF6FF] border-[#3B82F6] ring-4 ring-[#3B82F6]/20 text-[#0F172A] shadow-lumina-sm'
                          : isDone
                          ? isHighContrast
                            ? 'bg-slate-800/80 border-slate-600 text-slate-300 opacity-70'
                            : 'bg-[#F1F5F9] border-[#CBD5E1] text-[#64748B] opacity-80'
                          : isHighContrast
                          ? 'bg-slate-950 border-slate-700 hover:border-amber-400'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] hover:border-[#D97706] shadow-lumina-xs'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 font-black text-base mt-0.5 transition-all ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : isCurrentSpeechTarget
                            ? 'bg-amber-400 border-amber-500 text-slate-950'
                            : isHighContrast
                            ? 'border-slate-600 bg-slate-900 text-amber-300'
                            : 'border-[#CBD5E1] bg-[#EFF6FF] text-[#1E3A8A]'
                        }`}
                      >
                        {isDone ? <Check className="w-5 h-5 stroke-[3]" /> : idx + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-lg sm:text-xl font-black ${
                              isDone ? 'line-through text-[#94A3B8]' : 'text-[#0A192F] dark:text-white'
                            }`}
                          >
                            {item.title}
                          </span>
                          {isCurrentSpeechTarget && (
                            <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-amber-300 text-slate-950 flex items-center gap-1 border border-amber-400">
                              <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Reading
                            </span>
                          )}
                          {item.timing && (
                            <span
                              className={`text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                                isHighContrast
                                  ? 'bg-slate-800 text-amber-300 border-slate-700'
                                  : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
                              }`}
                            >
                              ⏰ {item.timing}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-base sm:text-lg mt-1.5 leading-relaxed font-semibold ${
                            isDone ? 'line-through text-[#94A3B8]' : 'text-[#334155] dark:text-slate-200'
                          }`}
                        >
                          {item.detail}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* =============================================================
              PART 3: RED FLAGS OR DEADLINES
             ============================================================= */}
          {redFlagsList.length > 0 && (
            <div
              id="jargon-part-3-red-flags"
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-amber-400/80 text-white'
                  : 'bg-amber-50/60 dark:bg-slate-900 border-amber-300 dark:border-amber-500 text-[#0F172A] shadow-lumina-sm'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b-2 border-amber-200 dark:border-amber-700/60 pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-black flex items-center justify-center text-lg border-2 border-amber-700 shrink-0">
                    3
                  </span>
                  <div>
                    <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white flex items-center gap-2">
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2.5]" />
                      Red Flags or Deadlines
                    </h3>
                    <p className="text-sm font-bold text-[#475569] dark:text-slate-300">
                      Crucial warning signs to watch for or time-sensitive dates that cannot be missed.
                    </p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wider font-black px-3 py-1 rounded-full bg-amber-200 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border border-amber-400">
                  Priority Attention
                </span>
              </div>

              <div className="space-y-3.5">
                {redFlagsList.map((item, idx) => {
                  const isCurrentSpeechTarget =
                    isSpeaking && activeSegmentId === `flag-${idx}`;

                  return (
                    <div
                      key={idx}
                      className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                        isCurrentSpeechTarget
                          ? isHighContrast
                            ? 'bg-amber-950 border-amber-400 ring-4 ring-amber-400/40 text-white shadow-md'
                            : 'bg-[#FEF3C7] border-amber-500 ring-4 ring-amber-400/30 text-[#0F172A] shadow-lumina-sm'
                          : isHighContrast
                          ? 'bg-slate-950 border-amber-500/60'
                          : 'bg-white border-amber-200 dark:border-slate-700 shadow-lumina-xs'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg sm:text-xl font-black text-[#0A192F] dark:text-white">
                            {item.title}
                          </span>
                          {isCurrentSpeechTarget && (
                            <span className="text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-amber-300 text-slate-950 flex items-center gap-1 border border-amber-400">
                              <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Reading
                            </span>
                          )}
                        </div>
                        <p className="text-base sm:text-lg mt-1.5 leading-relaxed font-semibold text-[#334155] dark:text-slate-200">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Words Demystified Glossary */}
          {Boolean(result.simplifiedTerms && result.simplifiedTerms.length > 0) && (
            <div
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <div className="flex items-center gap-3 mb-5">
                <BookOpen className="w-7 h-7 text-[#D97706] dark:text-amber-400" />
                <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white">
                  Difficult Words Made Simple
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(result.simplifiedTerms || []).map((term, idx) => (
                  <div
                    key={idx}
                    className={`p-4 sm:p-5 rounded-xl border-2 ${
                      isHighContrast
                        ? 'bg-slate-950 border-slate-700'
                        : 'bg-[#F8FAFC] border-[#CBD5E1]'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-wider text-[#D97706] dark:text-amber-400 block">
                      Medical Term:
                    </span>
                    <span className="text-xl font-black text-[#0A192F] dark:text-white block mb-2">
                      {term.originalTerm}
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-[#475569] dark:text-slate-300 block">
                      Plain English Meaning:
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[#1E293B] dark:text-slate-100">
                      {term.simpleMeaning}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions For Your Doctor */}
          {Boolean(result.questionsForDoctor && result.questionsForDoctor.length > 0) && (
            <div
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-7 h-7 text-[#D97706] dark:text-amber-400" />
                  <div>
                    <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white">
                      Good Questions To Ask Your Doctor
                    </h3>
                    <p className="text-sm font-bold text-[#475569] dark:text-slate-300">
                      Write these down or take them with you on your next visit.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyQuestions}
                  className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all flex items-center gap-2 shadow-lumina-xs ${
                    isHighContrast
                      ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
                      : 'bg-white border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706]'
                  }`}
                >
                  {copiedQuestions ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3] text-emerald-600" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 stroke-[2.5]" />
                      <span>Copy Questions</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {(result.questionsForDoctor || []).map((q, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border-2 flex items-start gap-3.5 ${
                      isHighContrast
                        ? 'bg-slate-950 border-slate-800 text-slate-200'
                        : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full bg-[#0A192F] text-white dark:bg-amber-400 dark:text-slate-950 text-sm font-black flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-lg font-bold leading-snug">{q}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
