import { useState, useRef, useEffect } from 'react';
import {
  MessageCircleHeart,
  Send,
  Sparkles,
  Bot,
  User,
  Heart,
  AlertCircle
} from 'lucide-react';
import { ChatMessage, ThemeMode } from '../types/companion';
import { sendCompanionChat, sendCompanionChatStream } from '../services/api';
import { AudioPlayerButton } from './AudioPlayerButton';
import { VoiceInputButton } from './VoiceInputButton';
import { SoundEffects } from '../utils/speech';

interface CompanionChatViewProps {
  themeMode: ThemeMode;
}

const STARTER_PROMPTS = [
  'Tell me a gentle, heartwarming story.',
  'What are some simple seated stretches I can do in my chair?',
  'Tips for remembering where I put my glasses and keys.',
  'Let us talk about favorite comfort foods and memories.',
];

export function CompanionChatView({ themeMode }: CompanionChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'companion',
      text: "Hello there! I'm Lumina, your personal companion. Whether you'd like to talk about your day, hear a story, ask a question, or simply chat, I am always right here with you. How can I brighten your day?",
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStreamingId, setActiveStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortStreamRef = useRef<(() => void) | null>(null);

  const isHighContrast = themeMode === 'high-contrast';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isStreaming]);

  useEffect(() => {
    return () => {
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, []);

  const handleSend = async (textToSend?: string) => {
    const message = textToSend !== undefined ? textToSend : inputText;
    if (!message.trim() || loading || isStreaming) return;

    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message.trim(),
      timestamp: 'Just now',
    };

    const companionMsgId = `companion-${Date.now()}`;
    const initialCompanionMsg: ChatMessage = {
      id: companionMsgId,
      sender: 'companion',
      text: '',
      timestamp: 'Just now',
    };

    // Immediately render user message and initial streaming bubble
    setMessages((prev) => [...prev, userMsg, initialCompanionMsg]);
    setInputText('');
    setLoading(true);
    setIsStreaming(true);
    setActiveStreamingId(companionMsgId);
    setError(null);

    try {
      const cancelFn = await sendCompanionChatStream(
        {
          message: userMsg.text,
          history: [...messages, userMsg],
        },
        (accumulatedText) => {
          // Words appear on screen immediately chunk-by-chunk!
          setLoading(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === companionMsgId ? { ...msg, text: accumulatedText } : msg
            )
          );
        },
        (finalText) => {
          setLoading(false);
          setIsStreaming(false);
          setActiveStreamingId(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === companionMsgId ? { ...msg, text: finalText } : msg
            )
          );
          SoundEffects.playSoftChime();
        },
        (err) => {
          console.warn('Companion chat stream warning, attempting fallback:', err);
          // Seamless fallback using accumulated endpoint
          sendCompanionChat({
            message: userMsg.text,
            history: messages,
          })
            .then((response) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === companionMsgId ? { ...msg, text: response.reply } : msg
                )
              );
              SoundEffects.playSoftChime();
            })
            .catch((fallbackErr) => {
              console.error('Fallback error:', fallbackErr);
              setError(fallbackErr.message || 'I had a little trouble responding. Please try again.');
              setMessages((prev) => prev.filter((msg) => msg.id !== companionMsgId));
            })
            .finally(() => {
              setLoading(false);
              setIsStreaming(false);
              setActiveStreamingId(null);
            });
        }
      );

      abortStreamRef.current = cancelFn;
    } catch (err: any) {
      console.error('Companion chat dispatch error:', err);
      setError(err.message || 'I had a little trouble responding. Please try again.');
      setLoading(false);
      setIsStreaming(false);
      setActiveStreamingId(null);
      setMessages((prev) => prev.filter((msg) => msg.id !== companionMsgId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div
        className={`p-6 sm:p-7 rounded-2xl border-2 transition-colors ${
          isHighContrast
            ? 'bg-slate-900 border-slate-700 text-white'
            : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-2xl border-2 ${
              isHighContrast
                ? 'bg-amber-400 text-slate-950 border-white'
                : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]'
            }`}
          >
            <MessageCircleHeart className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-[#0A192F] dark:text-white">
              Friendly Companion
            </h2>
            <p className="text-lg font-bold text-[#334155] dark:text-slate-200 mt-1">
              A patient, warm conversation partner ready to listen, reminisce, or answer questions.
            </p>
          </div>
        </div>

        {/* Conversation Starters */}
        <div className="mt-5 pt-4 border-t-2 border-[#E2E8F0] dark:border-slate-800">
          <p className="text-sm font-black uppercase tracking-wider mb-2.5 text-[#0A192F] dark:text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
            Comfortable topics to start with:
          </p>
          <div className="flex flex-wrap gap-2.5">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                className={`px-4 py-2 rounded-xl text-base font-extrabold border-2 transition-all text-left ${
                  isHighContrast
                    ? 'bg-slate-800 border-slate-600 text-amber-300 hover:bg-slate-700'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#D97706] hover:bg-white shadow-lumina-xs'
                }`}
              >
                💬 {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div
        className={`p-4 sm:p-6 rounded-2xl border-2 min-h-[420px] max-h-[620px] overflow-y-auto space-y-4 ${
          isHighContrast
            ? 'bg-slate-950 border-slate-700'
            : 'bg-[#F8FAFC] border-[#CBD5E1]'
        }`}
      >
        {messages.map((msg) => {
          const isCompanion = msg.sender === 'companion';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3.5 ${
                isCompanion ? 'justify-start' : 'justify-end'
              }`}
            >
              {isCompanion && (
                <div
                  className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center shrink-0 mt-1 shadow-warm-xs ${
                    isHighContrast ? 'bg-amber-400 text-slate-950 border-white' : 'bg-[#D97706] text-[#0A192F] border-[#92400E]'
                  }`}
                >
                  <Bot className="w-6 h-6 stroke-[2.25]" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-5 border-2 shadow-lumina-xs ${
                  isCompanion
                    ? isHighContrast
                      ? 'bg-slate-900 border-slate-700 text-white'
                      : 'bg-white border-[#CBD5E1] text-[#0F172A]'
                    : isHighContrast
                    ? 'bg-amber-400 text-slate-950 border-white font-bold'
                    : 'bg-[#0A192F] text-white border-[#1E293B] font-bold'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span
                    className={`text-xs uppercase font-black tracking-wider ${
                      isCompanion
                        ? 'text-[#475569] dark:text-slate-400'
                        : 'text-amber-200 dark:text-slate-950'
                    }`}
                  >
                    {isCompanion ? 'Lumina Companion' : 'You'}
                  </span>
                  {isCompanion && (
                    <AudioPlayerButton textToRead={msg.text} size="sm" label="Read" />
                  )}
                </div>

                <p className="text-lg sm:text-xl leading-relaxed whitespace-pre-line font-medium">
                  {msg.text}
                  {isStreaming && msg.id === activeStreamingId && (
                    <span
                      aria-hidden="true"
                      className="inline-block w-2.5 h-5 ml-1 bg-[#D97706] dark:bg-amber-400 animate-pulse align-middle rounded-sm"
                    />
                  )}
                </p>
              </div>

              {!isCompanion && (
                <div
                  className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center shrink-0 mt-1 shadow-lumina-xs ${
                    isHighContrast ? 'bg-slate-800 text-white border-slate-600' : 'bg-[#1E293B] text-white border-[#0F172A]'
                  }`}
                >
                  <User className="w-6 h-6 stroke-[2.25]" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center shrink-0 ${
                isHighContrast ? 'bg-amber-400 text-slate-950 border-white' : 'bg-[#D97706] text-[#0A192F] border-[#92400E]'
              }`}
            >
              <Heart className="w-6 h-6 animate-pulse stroke-[2.5]" />
            </div>
            <div
              className={`p-4 rounded-2xl border-2 text-lg font-bold flex items-center gap-2.5 ${
                isHighContrast ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-[#CBD5E1] text-[#0F172A] shadow-lumina-xs'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-[#D97706] animate-ping" />
              <span>Lumina is thinking warmly...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#FFF1EE] border-2 border-[#E11D48] text-[#7A1D1D] text-base font-bold flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-[#7A1D1D] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chat Input Bar with Voice & Large Warm Gold Send Button */}
      <div
        className={`p-4 rounded-2xl border-2 ${
          isHighContrast
            ? 'bg-slate-900 border-slate-700'
            : 'bg-white border-[#CBD5E1] shadow-lumina-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Type your message, or tap the microphone to speak..."
            className={`flex-1 p-4 text-lg font-medium rounded-xl border-2 transition-all focus:outline-none focus:ring-4 focus:ring-amber-400 ${
              isHighContrast
                ? 'bg-slate-950 border-slate-600 text-white placeholder:text-slate-400'
                : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] placeholder:text-[#64748B] focus:border-[#D97706]'
            }`}
          />

          <VoiceInputButton
            onTranscript={(transcript) => {
              setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
            }}
          />

          <button
            id="btn-companion-send"
            type="button"
            disabled={loading || !inputText.trim()}
            onClick={() => handleSend()}
            className={`px-7 py-4 rounded-2xl text-lg font-black transition-all flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-amber-400 disabled:opacity-40 disabled:cursor-not-allowed ${
              isHighContrast
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 border-[3px] border-white shadow-md'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 border-[3px] border-amber-600 shadow-lumina-md hover:shadow-lumina-lg active:scale-[0.99]'
            }`}
            aria-label="Send message"
          >
            <Send className="w-5 h-5 stroke-[2.5]" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
