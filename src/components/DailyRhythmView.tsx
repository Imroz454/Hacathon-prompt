import { useState, useEffect } from 'react';
import {
  Sun,
  Sunset,
  Moon,
  Droplets,
  Heart,
  Smile,
  Activity,
  Users,
  Check,
  Sparkles,
  Coffee,
  AlertCircle
} from 'lucide-react';
import { DailyRhythmResult, RoutineItem, ThemeMode } from '../types/companion';
import { fetchDailyRhythm } from '../services/api';
import { AudioPlayerButton } from './AudioPlayerButton';
import { VoiceInputButton } from './VoiceInputButton';

interface DailyRhythmViewProps {
  themeMode: ThemeMode;
}

export function DailyRhythmView({ themeMode }: DailyRhythmViewProps) {
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [userMood, setUserMood] = useState('Feeling peaceful and steady');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rhythmData, setRhythmData] = useState<DailyRhythmResult | null>(null);
  const [items, setItems] = useState<RoutineItem[]>([]);

  const isHighContrast = themeMode === 'high-contrast';

  // Automatically detect time of day on initial mount
  useEffect(() => {
    const hour = new Date().getHours();
    let detected: 'morning' | 'afternoon' | 'evening' = 'morning';
    if (hour >= 12 && hour < 17) detected = 'afternoon';
    else if (hour >= 17 || hour < 5) detected = 'evening';
    setTimeOfDay(detected);

    // Fetch initial proactive rhythm for today
    loadRhythm(detected, 'Feeling steady and ready for a good day');
  }, []);

  const loadRhythm = async (time: 'morning' | 'afternoon' | 'evening', mood?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailyRhythm({
        timeOfDay: time,
        userMood: mood || userMood,
      });
      setRhythmData(data);
      setItems(data.routineItems || []);
    } catch (err: any) {
      console.error('Rhythm error:', err);
      setError(err.message || 'Unable to update daily rhythm. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = items.filter((i) => i.completed).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hydration':
        return <Droplets className="w-5 h-5 text-sky-500" />;
      case 'movement':
        return <Activity className="w-5 h-5 text-emerald-500" />;
      case 'social':
        return <Users className="w-5 h-5 text-indigo-500" />;
      case 'mind':
        return <Smile className="w-5 h-5 text-amber-500" />;
      case 'health':
      default:
        return <Heart className="w-5 h-5 text-rose-500" />;
    }
  };

  const fullSpeechText = rhythmData
    ? `${rhythmData.greeting}. ${rhythmData.gentleCheckInQuestion}. Today's routine includes: ${items.map(i => i.title).join('. ')}. Hydration reminder: ${rhythmData.hydrationTip}. Uplifting thought: ${rhythmData.upliftingThought}`
    : '';

  return (
    <div className="space-y-8">
      {/* Time & Mood Customizer */}
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
              <Sun className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-[#0A192F] dark:text-white">
                My Daily Rhythm
              </h2>
              <p className="text-lg font-bold text-[#334155] dark:text-slate-200 mt-1">
                A gentle, proactive schedule that moves at your comfortable pace.
              </p>
            </div>
          </div>
        </div>

        {/* Time of Day Buttons */}
        <div className="mt-6">
          <label className="block text-base sm:text-lg font-black text-[#0A192F] dark:text-white mb-2.5">
            Select Time of Day:
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'morning', label: 'Morning', icon: Sun },
              { id: 'afternoon', label: 'Afternoon', icon: Sunset },
              { id: 'evening', label: 'Evening', icon: Moon },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = timeOfDay === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTimeOfDay(t.id as any);
                    loadRhythm(t.id as any);
                  }}
                  className={`p-4 rounded-2xl border-2 font-black text-lg sm:text-xl flex flex-col items-center gap-2 transition-all ${
                    isSelected
                      ? isHighContrast
                        ? 'bg-amber-400 text-slate-950 border-white shadow-md scale-[1.02]'
                        : 'bg-[#0A192F] text-white border-[#D97706] shadow-lumina-xs scale-[1.02]'
                      : isHighContrast
                      ? 'bg-slate-950 text-slate-200 border-slate-700 hover:border-slate-500'
                      : 'bg-[#F8FAFC] text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706] hover:bg-white'
                  }`}
                >
                  <Icon className="w-7 h-7 stroke-[2.5]" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gentle Check-In Mood */}
        <div className="mt-6">
          <label className="block text-base sm:text-lg font-black text-[#0A192F] dark:text-white mb-2.5">
            How are you feeling right now?
          </label>
          <div className="flex flex-wrap gap-2 mb-3.5">
            {[
              'Feeling peaceful',
              'A bit sluggish',
              'A little joint stiffness',
              'Looking forward to today',
              'Could use a smile',
            ].map((presetMood) => (
              <button
                key={presetMood}
                type="button"
                onClick={() => {
                  setUserMood(presetMood);
                  loadRhythm(timeOfDay, presetMood);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${
                  userMood === presetMood
                    ? isHighContrast
                      ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                      : 'bg-[#0A192F] text-white border-[#D97706] shadow-lumina-xs'
                    : isHighContrast
                    ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-[#F8FAFC] text-[#0F172A] border-[#CBD5E1] hover:border-[#D97706] hover:bg-white'
                }`}
              >
                {presetMood}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={userMood}
              onChange={(e) => setUserMood(e.target.value)}
              placeholder="Or type or speak how you feel..."
              className={`flex-1 p-3.5 text-lg font-medium rounded-xl border-2 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isHighContrast
                  ? 'bg-slate-950 border-slate-600 text-white placeholder:text-slate-400'
                  : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#D97706]'
              }`}
            />
            <VoiceInputButton
              onTranscript={(transcript) => {
                setUserMood(transcript);
                loadRhythm(timeOfDay, transcript);
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => loadRhythm(timeOfDay, userMood)}
              className={`px-6 py-3.5 rounded-2xl text-lg font-black transition-all flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-amber-400 ${
                isHighContrast
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-[3px] border-white shadow-md'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-[3px] border-amber-600 shadow-lumina-md hover:shadow-lumina-lg'
              }`}
            >
              <Sparkles className="w-5 h-5 fill-current" />
              <span>Update Rhythm</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-[#FFF1EE] border-2 border-[#E11D48] text-[#7A1D1D] text-base font-bold flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-[#7A1D1D] shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center bg-white rounded-2xl border-2 border-[#CBD5E1] shadow-lumina-xs">
          <div className="inline-block w-8 h-8 border-4 border-[#0A192F] border-t-[#D97706] rounded-full animate-spin mb-3" />
          <p className="text-xl font-bold text-[#0F172A]">
            Tailoring your {timeOfDay} rhythm with care...
          </p>
        </div>
      )}

      {/* Dynamic Results */}
      {rhythmData && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Greeting Banner */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 shadow-lumina-xs transition-colors ${
              isHighContrast
                ? 'bg-slate-900 border-amber-400 text-white'
                : 'bg-white border-[#CBD5E1] text-[#0F172A]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#E2E8F0] pb-4 mb-4">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-[#0A192F] dark:text-white">
                  {rhythmData.greeting}
                </h3>
                <p className="text-lg font-bold text-[#334155] dark:text-slate-200 mt-1">
                  {rhythmData.gentleCheckInQuestion}
                </p>
              </div>
              <AudioPlayerButton textToRead={fullSpeechText} label="Listen to Rhythm" size="lg" />
            </div>

            {/* Hydration & Thought Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div
                className={`p-4 sm:p-5 rounded-2xl border-2 flex items-start gap-3.5 ${
                  isHighContrast ? 'bg-slate-950 border-slate-700' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-sky-100 text-sky-900 shrink-0 mt-0.5 border border-sky-300">
                  <Droplets className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider font-black text-[#475569] dark:text-sky-300 block mb-1">
                    Hydration Reminder
                  </span>
                  <p className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
                    {rhythmData.hydrationTip}
                  </p>
                </div>
              </div>

              <div
                className={`p-4 sm:p-5 rounded-2xl border-2 flex items-start gap-3.5 ${
                  isHighContrast ? 'bg-slate-950 border-slate-700' : 'bg-[#F8FAFC] border-[#CBD5E1]'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-950 shrink-0 mt-0.5 border border-amber-300">
                  <Coffee className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wider font-black text-[#475569] dark:text-amber-300 block mb-1">
                    Thought for the Day
                  </span>
                  <p className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white italic">
                    "{rhythmData.upliftingThought}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Routine Checklist */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border-2 transition-colors ${
              isHighContrast
                ? 'bg-slate-900 border-slate-700 text-white'
                : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl sm:text-3xl font-black font-serif text-[#0A192F] dark:text-white">
                  Gentle Routine Steps
                </h3>
                <p className="text-base font-bold text-[#475569] dark:text-slate-300 mt-1">
                  Completed {completedCount} of {items.length} steps. Take your time!
                </p>
              </div>

              {completedCount === items.length && items.length > 0 && (
                <div className="px-4 py-2 bg-[#F0FDF4] text-[#14532D] border-2 border-[#166534] rounded-xl font-black text-sm flex items-center gap-2">
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Wonderful job completing today's routine!</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-start gap-4 ${
                    item.completed
                      ? isHighContrast
                        ? 'bg-slate-950 border-slate-700 text-slate-400 opacity-75'
                        : 'bg-[#F1F5F9] border-[#CBD5E1] text-[#64748B] opacity-80'
                      : isHighContrast
                      ? 'bg-slate-950 border-slate-700 hover:border-amber-400'
                      : 'bg-[#F8FAFC] border-[#CBD5E1] hover:border-[#D97706] shadow-lumina-xs'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                      item.completed
                        ? 'bg-slate-700 border-slate-700 text-white'
                        : 'border-[#CBD5E1] bg-[#EFF6FF] text-[#1E3A8A]'
                    }`}
                  >
                    {item.completed && <Check className="w-5 h-5 stroke-[3]" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="p-1 rounded-md bg-[#EFF6FF] dark:bg-slate-800 border border-[#BFDBFE]">
                        {getCategoryIcon(item.category)}
                      </span>
                      <span
                        className={`text-xl sm:text-2xl font-black ${
                          item.completed ? 'line-through text-[#94A3B8]' : 'text-[#0A192F] dark:text-white'
                        }`}
                      >
                        {item.title}
                      </span>
                      <span
                        className={`text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${
                          isHighContrast
                            ? 'bg-slate-800 text-amber-300 border-slate-700'
                            : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
                        }`}
                      >
                        ⏰ {item.timing}
                      </span>
                    </div>

                    <p
                      className={`text-base sm:text-lg font-semibold pl-1 ${
                        item.completed ? 'line-through text-[#94A3B8]' : 'text-[#334155] dark:text-slate-200'
                      }`}
                    >
                      {item.tip}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
