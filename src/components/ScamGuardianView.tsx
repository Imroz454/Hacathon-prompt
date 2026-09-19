import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  PhoneCall,
  Mail,
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { ScamAnalysisResult, ThemeMode } from '../types/companion';
import { checkScam } from '../services/api';
import { AudioPlayerButton } from './AudioPlayerButton';
import { VoiceInputButton } from './VoiceInputButton';

interface ScamGuardianViewProps {
  themeMode: ThemeMode;
}

const SCAM_PRESETS = [
  {
    label: 'Grandkid "Emergency" Bail Scam',
    channel: 'Phone Call / Voicemail',
    icon: PhoneCall,
    text: `Grandma, please don't be mad. I was in a car accident with a friend and they arrested me. I need $2,500 for bail right now or they will transfer me to county jail. Please don't call Mom or Dad, they will kill me. A courier will come to your house to pick up cash or you can buy Apple gift cards at Walmart and read me the numbers. Please hurry!`,
  },
  {
    label: 'Fake Bank Security Fraud Alert',
    channel: 'Text Message',
    icon: MessageSquare,
    text: `CHASE-ALERT: Suspicious transfer of $1,842.00 to Zelle account John Doe. If this was NOT you, immediately click https://chase-security-verify-login.cc/urgent or call 1-800-555-0199 within 15 minutes to prevent account freeze.`,
  },
  {
    label: 'Medicare Card Replacement Notice',
    channel: 'Letter / Email',
    icon: Mail,
    text: `URGENT NOTICE: New chip-enabled Medicare cards are being issued for 2026. Failure to verify your Social Security number and pay the $49 processing fee will result in immediate termination of your Part B medical coverage. Reply immediately with your full date of birth and card numbers.`,
  },
  {
    label: 'Legitimate Pharmacy Refill Notice',
    channel: 'Text Message',
    icon: MessageSquare,
    text: `Walgreens Pharmacy: Rx #489201 for Atorvastatin 40mg is ready for pickup at 120 Main St. Store hours 8am-8pm. Reply READY for contactless drive-thru or STOP to cancel alerts.`,
  },
];

export function ScamGuardianView({ themeMode }: ScamGuardianViewProps) {
  const [messageText, setMessageText] = useState('');
  const [channel, setChannel] = useState('Text Message');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScamAnalysisResult | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const isHighContrast = themeMode === 'high-contrast';

  const handleCheckScam = async (textToUse?: string) => {
    const text = textToUse !== undefined ? textToUse : messageText;
    if (!text.trim()) {
      setError('Please paste the message or voicemail text you received, or try one of the samples below.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await checkScam({ messageText: text, senderOrChannel: channel });
      setResult(data);
    } catch (err: any) {
      console.error('Scam check error:', err);
      setError(err.message || 'Unable to check this message right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (preset: typeof SCAM_PRESETS[0]) => {
    setMessageText(preset.text);
    setChannel(preset.channel);
    setError(null);
    handleCheckScam(preset.text);
  };

  const copyScript = () => {
    if (!result?.safeResponseScript) return;
    navigator.clipboard.writeText(result.safeResponseScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const fullSpeechText = result
    ? `${result.verdictTitle}. ${result.safetySummary}. What to do: ${result.whatToDo.join('. ')}. Safe script to say: ${result.safeResponseScript}`
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
              <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-[#0A192F] dark:text-white">
                Check A Message
              </h2>
              <p className="text-lg font-bold text-[#334155] dark:text-slate-200 mt-1">
                Worried a text, phone call, or letter might be a scam? Let's check it together to keep you safe.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="mt-6">
          <p className="text-sm font-black uppercase tracking-wider mb-2.5 text-[#0A192F] dark:text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
            Try checking a sample message:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SCAM_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex items-center gap-2.5 p-3.5 text-left rounded-xl border-2 text-sm font-extrabold transition-all hover:scale-[1.01] focus:ring-4 focus:ring-amber-400 ${
                    isHighContrast
                      ? 'bg-slate-800 border-slate-600 text-amber-300 hover:bg-slate-700'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0 text-[#D97706] dark:text-amber-400" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel Selector */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-[#0A192F] dark:text-slate-200 mr-1">Where did you receive this?</span>
          {['Text Message', 'Phone Call / Voicemail', 'Email', 'Paper Letter'].map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChannel(ch)}
              className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${
                channel === ch
                  ? isHighContrast
                    ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                    : 'bg-[#0A192F] text-white border-[#D97706] shadow-lumina-xs'
                  : isHighContrast
                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500'
                  : 'bg-[#F8FAFC] text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706]'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="mt-5">
          <label htmlFor="scam-input-textarea" className="block text-base sm:text-lg font-black text-[#0A192F] dark:text-white mb-2">
            Paste or dictate the words from the message:
          </label>
          <div className="relative">
            <textarea
              id="scam-input-textarea"
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="e.g. Paste the text message, or speak what the caller told you on the phone..."
              className={`w-full p-4 rounded-xl text-lg font-medium border-2 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isHighContrast
                  ? 'bg-slate-950 border-slate-600 text-white placeholder:text-slate-400'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#D97706]'
              }`}
            />
          </div>

          {/* Action Row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <VoiceInputButton
                onTranscript={(transcript) =>
                  setMessageText((prev) => (prev ? `${prev} ${transcript}` : transcript))
                }
              />
              {messageText && (
                <button
                  type="button"
                  onClick={() => {
                    setMessageText('');
                    setResult(null);
                  }}
                  className="px-3.5 py-2 text-sm text-[#334155] hover:text-[#0F172A] font-black flex items-center gap-1.5 border-2 border-transparent hover:border-[#CBD5E1] rounded-xl"
                >
                  <RotateCcw className="w-4 h-4 stroke-[2.5]" /> Clear
                </button>
              )}
            </div>

            <button
              id="btn-check-scam-submit"
              type="button"
              disabled={loading || !messageText.trim()}
              onClick={() => handleCheckScam()}
              className={`px-8 py-4 sm:px-10 sm:py-4.5 rounded-2xl text-xl sm:text-2xl font-black transition-all flex items-center gap-3 focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                isHighContrast
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-[3px] border-white shadow-lg'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-[3px] border-amber-600 shadow-lumina-md hover:shadow-lumina-lg active:scale-[0.99]'
              }`}
            >
              {loading ? (
                <>
                  <span className="inline-block w-6 h-6 border-4 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Checking message safety...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-7 h-7 shrink-0 fill-current" />
                  <span>Check This Message</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-[#FFF1EE] border-2 border-[#E11D48] text-[#7A1D1D] text-base font-bold flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-[#7A1D1D] shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Results Display */}
      {result && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Verdict Card */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-[3px] shadow-warm-sm transition-colors ${
              result.safetyScore === 'HIGH_RISK_SCAM'
                ? isHighContrast
                  ? 'bg-slate-950 border-rose-400 text-white'
                  : 'bg-[#FFF5F5] border-[#991B1B] text-stone-950'
                : result.safetyScore === 'SUSPICIOUS'
                ? isHighContrast
                  ? 'bg-slate-950 border-amber-400 text-white'
                  : 'bg-[#FFFBEB] border-[#B45309] text-stone-950'
                : isHighContrast
                ? 'bg-slate-950 border-emerald-400 text-white'
                : 'bg-[#F0FDF4] border-[#166534] text-stone-950'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-current/15 pb-4 mb-5">
              <div className="flex items-center gap-3.5">
                {result.safetyScore === 'HIGH_RISK_SCAM' ? (
                  <div className="p-3 bg-[#991B1B] text-white rounded-2xl border-2 border-[#450A0A]">
                    <ShieldAlert className="w-9 h-9 stroke-[2.5]" />
                  </div>
                ) : result.safetyScore === 'SUSPICIOUS' ? (
                  <div className="p-3 bg-[#B45309] text-white rounded-2xl border-2 border-[#78350F]">
                    <AlertTriangle className="w-9 h-9 stroke-[2.5]" />
                  </div>
                ) : (
                  <div className="p-3 bg-[#166534] text-white rounded-2xl border-2 border-[#14532D]">
                    <ShieldCheck className="w-9 h-9 stroke-[2.5]" />
                  </div>
                )}
                <div>
                  <span className="text-xs font-black uppercase tracking-widest block text-stone-700 dark:text-slate-300">
                    {result.safetyScore === 'HIGH_RISK_SCAM'
                      ? '⚠️ High Risk Warning'
                      : result.safetyScore === 'SUSPICIOUS'
                      ? '⚠️ Caution Advised'
                      : '🛡️ Verified Safe'}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black font-serif text-stone-950 dark:text-white">
                    {result.verdictTitle}
                  </h3>
                </div>
              </div>
              <AudioPlayerButton textToRead={fullSpeechText} label="Listen to Advice" size="lg" />
            </div>

            <p className="text-xl sm:text-2xl font-bold leading-relaxed text-[#0F172A] dark:text-white">
              {result.safetySummary}
            </p>

            <div className="mt-4 p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border-2 border-[#CBD5E1] dark:border-slate-700 shadow-lumina-xs">
              <span className="text-xs font-black uppercase tracking-wider block text-[#475569] dark:text-slate-300 mb-1">
                Recommended Verification:
              </span>
              <p className="text-lg font-bold text-[#0F172A] dark:text-white">{result.contactRecommendation}</p>
            </div>
          </div>

          {/* Red Flags Identified */}
          {result.detectedRedFlags?.length > 0 && (
            <div
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <div className="flex items-center gap-3 mb-5">
                <AlertTriangle className="w-7 h-7 text-[#D97706] dark:text-amber-400" />
                <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white">
                  Warning Signs We Noticed
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {result.detectedRedFlags.map((rf, idx) => (
                  <div
                    key={idx}
                    className={`p-4 sm:p-5 rounded-xl border-2 ${
                      isHighContrast
                        ? 'bg-slate-950 border-slate-700'
                        : 'bg-[#F8FAFC] border-[#CBD5E1]'
                    }`}
                  >
                    <span className="text-base font-black text-[#D97706] dark:text-amber-400 block mb-1.5">
                      ⚠️ {rf.flag}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[#1E293B] dark:text-slate-100">
                      {rf.explanation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Steps: What You Should Do */}
          {result.whatToDo?.length > 0 && (
            <div
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <div className="flex items-center gap-3 mb-5">
                <ShieldCheck className="w-7 h-7 text-[#D97706] dark:text-amber-400" />
                <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white">
                  What You Should Do Right Now
                </h3>
              </div>
              <ul className="space-y-3">
                {result.whatToDo.map((step, idx) => (
                  <li
                    key={idx}
                    className={`p-4 rounded-xl border-2 text-lg sm:text-xl font-bold flex items-start gap-3.5 ${
                      isHighContrast
                        ? 'bg-slate-950 border-slate-700 text-white'
                        : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A]'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-full bg-[#0A192F] text-white dark:bg-amber-400 dark:text-slate-950 flex items-center justify-center font-black text-base shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safe Script to Say */}
          {result.safeResponseScript && (
            <div
              className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
                isHighContrast
                  ? 'bg-slate-900 border-slate-700 text-white'
                  : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-7 h-7 text-[#D97706] dark:text-amber-400" />
                  <div>
                    <h3 className="text-2xl font-black font-serif text-[#0A192F] dark:text-white">
                      Safe Words To Say Or Text
                    </h3>
                    <p className="text-sm font-bold text-[#475569] dark:text-slate-300">
                      If someone is pressuring you, use this polite and firm response:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyScript}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-black border-2 transition-all shadow-lumina-xs ${
                    copiedScript
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : isHighContrast
                      ? 'bg-slate-800 text-amber-300 border-slate-600 hover:bg-slate-700'
                      : 'bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706]'
                  }`}
                >
                  {copiedScript ? (
                    <>
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 stroke-[2.5]" />
                      <span>Copy Words</span>
                    </>
                  )}
                </button>
              </div>

              <div
                className={`p-5 rounded-xl border-2 font-mono text-lg sm:text-xl font-bold leading-relaxed ${
                  isHighContrast
                    ? 'bg-slate-950 border-slate-700 text-amber-200'
                    : 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]'
                }`}
              >
                "{result.safeResponseScript}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
