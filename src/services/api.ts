import { GoogleGenAI } from '@google/genai';
import {
  JargonTranslationResult,
  ScamAnalysisResult,
  DailyRhythmResult,
  TaskGuideResult,
  ChatMessage,
  PrimaryGoal,
  ExplanationPacing,
  InteractionPreference,
  AdaptiveConsultResult,
} from '../types/companion';
import { AdaptiveStateManager } from '../utils/adaptiveState';
import {
  getFallbackJargonStreamText,
  getFallbackJargonTranslation,
  getFallbackScamAnalysis,
  getFallbackDailyRhythm,
  getFallbackTaskGuide,
  getFallbackConsultationText,
  getFallbackAdaptiveConsultResult,
} from '../utils/fallbackData';
import {
  QuotaManager,
  isQuotaOrRateLimitError,
  QUOTA_EXCEEDED_MESSAGE,
  QUOTA_PAUSED_NOTICE,
  useQuotaCooldown,
} from '../utils/quotaManager';

export {
  QuotaManager,
  isQuotaOrRateLimitError,
  QUOTA_EXCEEDED_MESSAGE,
  QUOTA_PAUSED_NOTICE,
  useQuotaCooldown,
};

/**
 * Service to communicate with secure server-side Gemini API endpoints,
 * backed by automatic client-side execution and zero-fail local fallbacks.
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'An unexpected issue occurred.' }));
    if (res.status === 429 || isQuotaOrRateLimitError(errorData)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    throw new Error(errorData.error || `Server responded with error status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function getAdaptivePayload() {
  const current = AdaptiveStateManager.getPreferences();
  return {
    primaryGoal: current.primaryGoal,
    explanationPacing: current.explanationPacing,
    interactionPreference: current.interactionPreference,
  };
}

/**
 * Key Fallback Engine:
 * Implements tiered resolution:
 * process.env.GEMINI_API_KEY || process.env.API_KEY || window?.ENV?.GEMINI_API_KEY || ''
 */
export function getClientGeminiApiKey(): string {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (process.env.API_KEY) return process.env.API_KEY;
  }
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win?.ENV?.GEMINI_API_KEY) return win.ENV.GEMINI_API_KEY;
    if (win?.ENV?.API_KEY) return win.ENV.API_KEY;
    if (win?.GEMINI_API_KEY) return win.GEMINI_API_KEY;
    if (win?.API_KEY) return win.API_KEY;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    if (env.VITE_GEMINI_API_KEY) return env.VITE_GEMINI_API_KEY;
    if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
    if (env.API_KEY) return env.API_KEY;
  }
  return '';
}

// Client-side GoogleGenAI cache
let clientGenAIInstance: GoogleGenAI | null = null;
export function getClientGenAI(): GoogleGenAI | null {
  const apiKey = getClientGeminiApiKey();
  if (!apiKey) return null;
  if (!clientGenAIInstance) {
    clientGenAIInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-client',
        },
      },
    });
  }
  return clientGenAIInstance;
}

/**
 * Direct Client-Side Gemini Execution (with multiple candidate models and REST fallback)
 */
export async function executeClientDirectGeminiCall(
  prompt: string,
  systemInstruction?: string,
  isJson = false
): Promise<string> {
  const apiKey = getClientGeminiApiKey();
  if (!apiKey) {
    throw new Error('API Key missing or invalid in server.ts');
  }

  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastErr: any = null;

  try {
    const ai = getClientGenAI();
    if (ai) {
      for (const model of models) {
        try {
          const resp = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              ...(systemInstruction ? { systemInstruction } : {}),
              temperature: 0.2,
              ...(isJson ? { responseMimeType: 'application/json' } : {}),
            },
          });
          if (resp.text) return resp.text;
        } catch (err: any) {
          lastErr = err;
          if (isQuotaOrRateLimitError(err)) {
            QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
          }
          console.warn(`[Client Direct Gemini SDK] ${model} warning:`, err?.message || err);
        }
      }
    }
  } catch (sdkErr) {
    lastErr = sdkErr;
    if (isQuotaOrRateLimitError(sdkErr)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
    }
  }

  // REST Fallback in case of browser bundle issues
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          ...(isJson ? { responseMimeType: 'application/json' } : {}),
        },
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      const fetchResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (fetchResp.status === 429) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      if (fetchResp.ok) {
        const data = await fetchResp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (restErr: any) {
      lastErr = restErr;
      if (isQuotaOrRateLimitError(restErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      }
      console.warn(`[Client Direct Gemini REST] ${model} warning:`, restErr?.message || restErr);
    }
  }

  if (isQuotaOrRateLimitError(lastErr)) {
    QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
    throw new Error(QUOTA_PAUSED_NOTICE);
  }

  throw lastErr || new Error('API Key missing or invalid in server.ts');
}

/**
 * Direct Client-Side Gemini Streaming Execution
 */
export async function executeClientDirectGeminiStream(
  prompt: string,
  systemInstruction: string,
  onChunk: (accumulated: string, latestChunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const apiKey = getClientGeminiApiKey();
  if (!apiKey) {
    const err = new Error('API Key missing or invalid in server.ts');
    onError(err);
    return () => {};
  }

  let aborted = false;
  const abortFn = () => {
    aborted = true;
  };

  (async () => {
    try {
      const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let lastErr: any = null;
      let textStreamed = false;
      let accumulated = '';

      try {
        const ai = getClientGenAI();
        if (ai) {
          for (const model of models) {
            try {
              const stream = await ai.models.generateContentStream({
                model,
                contents: prompt,
                config: {
                  systemInstruction,
                  temperature: 0.2,
                },
              });
              for await (const chunk of stream) {
                if (aborted) return;
                const text = chunk.text || '';
                if (text) {
                  textStreamed = true;
                  accumulated += text;
                  onChunk(accumulated, text);
                }
              }
              if (textStreamed) {
                onDone(accumulated);
                return;
              }
            } catch (err: any) {
              lastErr = err;
              if (isQuotaOrRateLimitError(err)) {
                QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
              }
              console.warn(`[Client Direct Gemini Stream SDK] ${model} warning:`, err?.message || err);
            }
          }
        }
      } catch (sdkErr) {
        lastErr = sdkErr;
        if (isQuotaOrRateLimitError(sdkErr)) {
          QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        }
      }

      // Non-streaming call simulated chunk by chunk
      const full = await executeClientDirectGeminiCall(prompt, systemInstruction);
      if (full) {
        for (const line of full.split('\n')) {
          if (aborted) return;
          accumulated += line + '\n';
          onChunk(accumulated, line + '\n');
          await new Promise((r) => setTimeout(r, 20));
        }
        onDone(accumulated);
        return;
      }

      if (isQuotaOrRateLimitError(lastErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }

      throw lastErr || new Error('API Key missing or invalid in server.ts');
    } catch (err: any) {
      if (isQuotaOrRateLimitError(err)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        onError(new Error(QUOTA_PAUSED_NOTICE));
      } else {
        console.error('[Client Direct Gemini Stream Error]:', err);
        onError(err);
      }
    }
  })();

  return abortFn;
}

/**
 * 1. MEDICAL & JARGON TRANSLATOR (JSON)
 */
export async function translateJargon(input: {
  text: string;
  sourceType?: 'doctor_notes' | 'lab_results' | 'prescription' | 'bill_insurance' | 'general';
  primaryGoal?: PrimaryGoal;
  explanationPacing?: ExplanationPacing;
  interactionPreference?: InteractionPreference;
}): Promise<JargonTranslationResult> {
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  try {
    const res = await fetch('/api/translate-jargon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      return await res.json();
    }
    if (res.status === 429) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
  } catch (serverErr: any) {
    if (isQuotaOrRateLimitError(serverErr)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    console.warn('[translateJargon] Server unreachable or errored, engaging client fallback:', serverErr);
  }

  // Tier 2: Client-side Gemini direct call
  const clientKey = getClientGeminiApiKey();
  if (clientKey) {
    try {
      const prompt = `Translate this medical document to plain English in JSON with "summary", "actionItems", "redFlagsOrDeadlines":\n"""\n${input.text}\n"""`;
      const systemInstruction = 'You are Lumina, a warm medical accessibility consultant for seniors. Output valid JSON adhering to summary, actionItems, redFlagsOrDeadlines.';
      const rawJson = await executeClientDirectGeminiCall(prompt, systemInstruction, true);
      const cleaned = stripMarkdownCodeBlocks(rawJson);
      const parsed = JSON.parse(cleaned);
      if (parsed.summary && parsed.actionItems) {
        return parsed;
      }
    } catch (clientErr: any) {
      if (isQuotaOrRateLimitError(clientErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      console.warn('[translateJargon] Client direct Gemini failed, using zero-fail local fallback:', clientErr);
    }
  }

  // Tier 3: Zero-fail local fallback
  return getFallbackJargonTranslation(input.text, input.sourceType);
}

/**
 * 1. MEDICAL & JARGON TRANSLATOR (STREAMING)
 */
export async function translateJargonStream(
  input: {
    text: string;
    sourceType?: 'doctor_notes' | 'lab_results' | 'prescription' | 'bill_insurance' | 'general';
    primaryGoal?: PrimaryGoal;
    explanationPacing?: ExplanationPacing;
    interactionPreference?: InteractionPreference;
  },
  onChunk: (accumulatedText: string, latestChunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const controller = new AbortController();
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  (async () => {
    let serverFailed = false;
    try {
      const res = await fetch('/api/translate-jargon-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
          onError(new Error(QUOTA_PAUSED_NOTICE));
          return;
        }
        serverFailed = true;
      } else {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('Streaming is not supported by this browser.');

        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  accumulated += parsed.text;
                  onChunk(accumulated, parsed.text);
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('JSON')) {
                  throw e;
                }
              }
            }
          }
        }

        onDone(accumulated);
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isQuotaOrRateLimitError(err)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        onError(new Error(QUOTA_PAUSED_NOTICE));
        return;
      }
      serverFailed = true;
    }

    if (serverFailed) {
      const clientKey = getClientGeminiApiKey();
      if (clientKey) {
        try {
          const prompt = `Translate this medical document to plain English in 3 sections: 1. ONE-SENTENCE SUMMARY, 2. ACTION ITEMS NEEDED, 3. RED FLAGS OR DEADLINES:\n"""\n${input.text}\n"""`;
          const systemInstruction = 'You are Lumina, a warm accessibility consultant for seniors. Structure with ### 1. ONE-SENTENCE SUMMARY, ### 2. ACTION ITEMS NEEDED, ### 3. RED FLAGS OR DEADLINES.';
          await executeClientDirectGeminiStream(prompt, systemInstruction, onChunk, onDone, onError);
          return;
        } catch (streamClientErr: any) {
          if (isQuotaOrRateLimitError(streamClientErr)) {
            QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
            onError(new Error(QUOTA_PAUSED_NOTICE));
            return;
          }
          console.warn('[translateJargonStream] Client direct stream failed, streaming local fallback:', streamClientErr);
        }
      }

      // Zero-fail streaming fallback
      const fallbackText = getFallbackJargonStreamText(input.text);
      let acc = '';
      for (const line of fallbackText.split('\n')) {
        acc += line + '\n';
        onChunk(acc, line + '\n');
        await new Promise((r) => setTimeout(r, 20));
      }
      onDone(acc);
    }
  })();

  return () => {
    controller.abort();
  };
}

/**
 * 2. SCAM & SUSPICIOUS MESSAGE GUARDIAN
 */
export async function checkScam(input: {
  messageText: string;
  senderOrChannel?: string;
  primaryGoal?: PrimaryGoal;
  explanationPacing?: ExplanationPacing;
  interactionPreference?: InteractionPreference;
}): Promise<ScamAnalysisResult> {
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  try {
    const res = await fetch('/api/check-scam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 429) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    console.warn('[checkScam] Server check failed, engaging client fallback:', err);
  }

  const clientKey = getClientGeminiApiKey();
  if (clientKey) {
    try {
      const prompt = `Analyze this message for scam signs. Return JSON with safetyScore (HIGH_RISK_SCAM | SUSPICIOUS | SAFE), verdictTitle, safetySummary, detectedRedFlags, whatToDo, safeResponseScript, contactRecommendation:\n"""\n${input.messageText}\n"""`;
      const systemInstruction = 'You are Lumina Scam Guardian for seniors. Return valid JSON.';
      const raw = await executeClientDirectGeminiCall(prompt, systemInstruction, true);
      const parsed = JSON.parse(stripMarkdownCodeBlocks(raw));
      if (parsed.safetyScore) return parsed;
    } catch (clientErr: any) {
      if (isQuotaOrRateLimitError(clientErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      console.warn('[checkScam] Client direct call failed, using zero-fail fallback:', clientErr);
    }
  }

  return getFallbackScamAnalysis(input.messageText);
}

/**
 * 3. DAILY RHYTHM & WELLNESS
 */
export async function fetchDailyRhythm(input: {
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  userMood?: string;
  primaryGoal?: PrimaryGoal;
  explanationPacing?: ExplanationPacing;
  interactionPreference?: InteractionPreference;
}): Promise<DailyRhythmResult> {
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  try {
    const res = await fetch('/api/daily-rhythm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 429) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    console.warn('[fetchDailyRhythm] Server call failed, engaging client fallback:', err);
  }

  const clientKey = getClientGeminiApiKey();
  if (clientKey) {
    try {
      const prompt = `Create a gentle daily wellness rhythm for ${input.timeOfDay || 'morning'}. Return JSON with timeOfDay, themeHeadline, comfortingAffirmation, hydrationReminder, blocks (blockTitle, timeWindow, recommendedActivities), socialOrJoyPrompt.`;
      const systemInstruction = 'You are Lumina Daily Rhythm consultant for older adults. Return valid JSON.';
      const raw = await executeClientDirectGeminiCall(prompt, systemInstruction, true);
      const parsed = JSON.parse(stripMarkdownCodeBlocks(raw));
      if (parsed.blocks) return parsed;
    } catch (clientErr: any) {
      if (isQuotaOrRateLimitError(clientErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      console.warn('[fetchDailyRhythm] Client direct call failed, using fallback:', clientErr);
    }
  }

  return getFallbackDailyRhythm(input.timeOfDay || 'morning');
}

/**
 * 4. TASK GUIDE (HOW-TO)
 */
export async function breakdownTask(input: {
  taskDescription: string;
  primaryGoal?: PrimaryGoal;
  explanationPacing?: ExplanationPacing;
  interactionPreference?: InteractionPreference;
}): Promise<TaskGuideResult> {
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  try {
    const res = await fetch('/api/breakdown-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 429) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    console.warn('[breakdownTask] Server call failed, engaging fallback:', err);
  }

  const clientKey = getClientGeminiApiKey();
  if (clientKey) {
    try {
      const prompt = `Break down this task into simple gentle steps for a senior: "${input.taskDescription}". Return JSON with taskTitle, estimatedTime, difficulty, thingsNeeded, steps (stepNumber, title, instruction, checkpointTip), successCelebration.`;
      const raw = await executeClientDirectGeminiCall(prompt, 'You are Lumina Task Teacher for seniors. Return valid JSON.', true);
      const parsed = JSON.parse(stripMarkdownCodeBlocks(raw));
      if (parsed.steps) return parsed;
    } catch (clientErr: any) {
      if (isQuotaOrRateLimitError(clientErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      console.warn('[breakdownTask] Client direct call failed, using fallback:', clientErr);
    }
  }

  return getFallbackTaskGuide(input.taskDescription);
}

/**
 * 5. COMPANION CHAT (STREAMING)
 */
export async function sendCompanionChatStream(
  input: {
    message: string;
    history: ChatMessage[];
    primaryGoal?: PrimaryGoal;
    explanationPacing?: ExplanationPacing;
    interactionPreference?: InteractionPreference;
  },
  onChunk: (accumulatedText: string, latestChunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const controller = new AbortController();
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  (async () => {
    let serverFailed = false;
    try {
      const res = await fetch('/api/companion-chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
          onError(new Error(QUOTA_PAUSED_NOTICE));
          return;
        }
        serverFailed = true;
      } else {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('Streaming is not supported by this browser.');

        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  accumulated += parsed.text;
                  onChunk(accumulated, parsed.text);
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('JSON')) {
                  throw e;
                }
              }
            }
          }
        }

        onDone(accumulated);
        return;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (isQuotaOrRateLimitError(err)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        onError(new Error(QUOTA_PAUSED_NOTICE));
        return;
      }
      serverFailed = true;
    }

    if (serverFailed) {
      const clientKey = getClientGeminiApiKey();
      if (clientKey) {
        try {
          const systemInstruction = 'You are Lumina, a warm, patient, and respectful digital companion for older adults. Speak kindly, warmly, and calmly.';
          await executeClientDirectGeminiStream(input.message, systemInstruction, onChunk, onDone, onError);
          return;
        } catch (clientErr: any) {
          if (isQuotaOrRateLimitError(clientErr)) {
            QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
            onError(new Error(QUOTA_PAUSED_NOTICE));
            return;
          }
          console.warn('[sendCompanionChatStream] Client direct call failed, using fallback:', clientErr);
        }
      }

      const fallbackReply = `Hello! It is wonderful to chat with you today. Lumina is always here to listen, offer gentle encouragement, and help you navigate your day with comfort and peace of mind.`;
      let acc = '';
      for (const word of fallbackReply.split(' ')) {
        acc += word + ' ';
        onChunk(acc, word + ' ');
        await new Promise((r) => setTimeout(r, 30));
      }
      onDone(acc.trim());
    }
  })();

  return () => {
    controller.abort();
  };
}

/**
 * 5. COMPANION CHAT (JSON)
 */
export async function sendCompanionChat(input: {
  message: string;
  history: ChatMessage[];
  primaryGoal?: PrimaryGoal;
  explanationPacing?: ExplanationPacing;
  interactionPreference?: InteractionPreference;
}): Promise<{ reply: string }> {
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  try {
    const res = await fetch('/api/companion-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 429) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    console.warn('[sendCompanionChat] Server call failed, using client fallback:', err);
  }

  const clientKey = getClientGeminiApiKey();
  if (clientKey) {
    try {
      const systemInstruction = 'You are Lumina, a warm, patient digital companion for older adults. Answer warmly and kindly.';
      const text = await executeClientDirectGeminiCall(input.message, systemInstruction);
      if (text) return { reply: text };
    } catch (clientErr: any) {
      if (isQuotaOrRateLimitError(clientErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      console.warn('[sendCompanionChat] Client direct call failed, using fallback:', clientErr);
    }
  }

  return {
    reply: 'It is wonderful to chat with you. Lumina is here to help keep your day calm, organized, and pleasant.',
  };
}

/**
 * Direct voice & adaptive consultation with dynamic system prompt injection (Streaming)
 */
export async function adaptiveConsultStream(
  input: {
    query: string;
    primaryGoal?: PrimaryGoal;
    explanationPacing?: ExplanationPacing;
    interactionPreference?: InteractionPreference;
  },
  onChunk: (accumulatedText: string, latestChunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
): Promise<() => void> {
  const controller = new AbortController();
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  (async () => {
    let serverFailed = false;
    let res: Response | null = null;

    try {
      res = await fetch('/api/adaptive-consult-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
          onError(new Error(QUOTA_PAUSED_NOTICE));
          return;
        }
        serverFailed = true;
      }
    } catch (networkErr: any) {
      if (networkErr.name === 'AbortError') return;
      if (isQuotaOrRateLimitError(networkErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        onError(new Error(QUOTA_PAUSED_NOTICE));
        return;
      }
      serverFailed = true;
    }

    // If server stream failed or server API key is missing:
    // Fall back to executing the Gemini call directly on the client side using the environment session
    if (serverFailed || !res || !res.ok) {
      const clientKey = getClientGeminiApiKey();
      if (clientKey) {
        console.info('[adaptiveConsultStream] Falling back to executing Gemini call directly on client side.');
        const prompt = input.query || 'Please explain clearly and calmly.';
        const systemInstruction = `You are Lumina, a warm, calm, accessible companion for older adults. Answer clearly, kindly, and concisely in senior-friendly plain English. Pacing: ${input.explanationPacing || 'step_by_step'}.`;
        const cancelDirect = await executeClientDirectGeminiStream(
          prompt,
          systemInstruction,
          onChunk,
          onDone,
          (directErr) => {
            if (isQuotaOrRateLimitError(directErr)) {
              QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
              onError(new Error(QUOTA_PAUSED_NOTICE));
            } else {
              onError(directErr);
            }
          }
        );
        return cancelDirect;
      } else {
        onError(new Error('API Key missing or invalid in server.ts'));
        return;
      }
    }

    try {
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming is not supported by this browser.');

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                accumulated += parsed.text;
                onChunk(accumulated, parsed.text);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) {
                throw e;
              }
            }
          }
        }
      }

      onDone(accumulated);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err);
    }
  })();

  return () => {
    controller.abort();
  };
}

/**
 * Direct voice & adaptive consultation with dynamic system prompt injection (JSON)
 */
export async function adaptiveConsult(input: {
  query: string;
  primaryGoal?: PrimaryGoal;
  explanationPacing?: ExplanationPacing;
  interactionPreference?: InteractionPreference;
}): Promise<AdaptiveConsultResult> {
  const payload = {
    ...getAdaptivePayload(),
    ...input,
  };

  try {
    const res = await fetch('/api/adaptive-consult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
    if (res.status === 429) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
  } catch (err: any) {
    if (isQuotaOrRateLimitError(err)) {
      QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
      throw new Error(QUOTA_PAUSED_NOTICE);
    }
    console.warn('[adaptiveConsult] Server call failed, engaging client fallback:', err);
  }

  const clientKey = getClientGeminiApiKey();
  if (clientKey) {
    try {
      const prompt = `Provide senior-friendly guidance for: "${input.query}". Return JSON with headline, pacingMode (${input.explanationPacing || 'step_by_step'}), primaryPoints, detailedContent, actionSteps, suggestedFollowUps.`;
      const raw = await executeClientDirectGeminiCall(prompt, 'You are Lumina Accessible Consultant. Return valid JSON.', true);
      const parsed = JSON.parse(stripMarkdownCodeBlocks(raw));
      if (parsed.headline) return parsed;
    } catch (clientErr: any) {
      if (isQuotaOrRateLimitError(clientErr)) {
        QuotaManager.triggerCooldown(30, QUOTA_PAUSED_NOTICE);
        throw new Error(QUOTA_PAUSED_NOTICE);
      }
      console.warn('[adaptiveConsult] Client direct call failed, using fallback:', clientErr);
    }
  }

  return getFallbackAdaptiveConsultResult(input.query, input.explanationPacing);
}

/**
 * Checks if a response string represents an HTML document or proxy error page
 */
export function isHtmlPayload(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return (
    /<html|<head|<body|<style|<div|<p|<h1|<!doctype/i.test(text) ||
    /color-scheme\s*:/i.test(text) ||
    /^\s*<[!a-z]/i.test(text.trim())
  );
}

/**
 * Safely strips markdown code blocks (e.g. ```json ... ```) from model responses
 */
export function stripMarkdownCodeBlocks(raw: string): string {
  if (!raw || typeof raw !== 'string') return '{}';
  const trimmed = raw.trim();

  if (isHtmlPayload(trimmed)) {
    return '{}';
  }

  let cleaned = trimmed;
  cleaned = cleaned.replace(/^```(?:json)?\s*/gi, '');
  cleaned = cleaned.replace(/\s*```$/gi, '');
  cleaned = cleaned.trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = cleaned.slice(start, end + 1);
    if (/"[^"]+"\s*:/.test(candidate)) {
      return candidate;
    }
  }

  if (cleaned.startsWith('{') && cleaned.endsWith('}') && /"[^"]+"\s*:/.test(cleaned)) {
    return cleaned;
  }

  return '{}';
}

/**
 * Checks server health and configuration
 */
export async function checkServerGeminiStatus(): Promise<{ configured: boolean; error?: string }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error(`Health endpoint returned status ${res.status}`);
    const data = await res.json();
    return { configured: !!data.geminiConfigured };
  } catch (err: any) {
    return { configured: false, error: err.message || 'Server health unreachable' };
  }
}

export type VoiceIntentAction = 'CHANGE_FONT' | 'CHANGE_TAB' | 'ASSISTANT_QUERY';

export interface VoiceIntentResult {
  action: VoiceIntentAction;
  value: string;
  debugNotice?: string;
}

export function fallbackIntentParser(text: string): VoiceIntentResult {
  const lower = text.toLowerCase().trim();

  // Font size check
  const isFontRelated =
    lower.includes('font') ||
    lower.includes('size') ||
    lower.includes('text') ||
    lower.includes('letter') ||
    lower.includes('word') ||
    lower.includes('screen') ||
    lower.includes('display') ||
    lower.includes('zoom') ||
    lower.includes('phone');

  if (
    lower.includes('huge') ||
    lower.includes('maximum size') ||
    lower.includes('biggest size') ||
    lower.includes('extra large') ||
    lower.includes('size huge') ||
    lower.includes('a++')
  ) {
    return { action: 'CHANGE_FONT', value: 'A++' };
  }

  if (
    lower.includes('bigger') ||
    lower.includes('larger') ||
    lower.includes('increase') ||
    lower.includes('make large') ||
    lower.includes('a+')
  ) {
    if (isFontRelated || lower.startsWith('make') || lower.startsWith('increase')) {
      return { action: 'CHANGE_FONT', value: 'A+' };
    }
  }

  if (
    lower.includes('standard') ||
    lower.includes('normal') ||
    lower.includes('default') ||
    lower.includes('reset') ||
    lower.includes('smaller') ||
    lower.includes('decrease')
  ) {
    if (isFontRelated) {
      return { action: 'CHANGE_FONT', value: 'DEFAULT' };
    }
  }

  // Navigation check
  if (
    lower.includes('doctor note') ||
    lower.includes('medical note') ||
    lower.includes('explain note') ||
    lower.includes('translate') ||
    lower.includes('prescription') ||
    lower.includes('medical bill') ||
    lower.includes('explain it simply')
  ) {
    return { action: 'CHANGE_TAB', value: 'Explain It Simply' };
  }

  if (
    lower.includes('scam') ||
    lower.includes('fraud') ||
    lower.includes('suspicious') ||
    lower.includes('check a message') ||
    lower.includes('check text')
  ) {
    return { action: 'CHANGE_TAB', value: 'Check A Message' };
  }

  if (
    lower.includes('daily rhythm') ||
    lower.includes('routine') ||
    lower.includes('schedule') ||
    lower.includes('hydration') ||
    lower.includes('morning check')
  ) {
    return { action: 'CHANGE_TAB', value: 'My Daily Rhythm' };
  }

  if (
    lower.includes('task guide') ||
    lower.includes('how to') ||
    lower.includes('step by step') ||
    lower.includes('instructions') ||
    lower.includes('walk me through')
  ) {
    return { action: 'CHANGE_TAB', value: 'Walk Me Through It' };
  }

  if (
    lower.includes('companion chat') ||
    lower.includes('talk to me') ||
    lower.includes('friendly chat') ||
    lower.includes('friendly companion')
  ) {
    return { action: 'CHANGE_TAB', value: 'Friendly Companion' };
  }

  return { action: 'ASSISTANT_QUERY', value: text };
}

/**
 * Robust Intent Router API caller with server proxy, client direct fallback, and rule fallback
 */
export async function routeVoiceIntent(transcript: string): Promise<VoiceIntentResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const clientApiKey = getClientGeminiApiKey();

    let response: Response | null = null;
    try {
      response = await fetch('/api/route-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        return {
          ...fallbackIntentParser(transcript),
          debugNotice: 'Request timed out; resilient rule engine engaged',
        };
      }

      if (clientApiKey) {
        try {
          const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${clientApiKey}`;
          response = await fetch(directUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Classify this voice command into strict JSON with "action" and "value":\n"${transcript}"` }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
            signal: controller.signal,
          });
        } catch (directErr) {
          console.warn('[IntentRouter] Direct Google API failed:', directErr);
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response || !response.ok) {
      if (clientApiKey) {
        try {
          const directPrompt = `You are Lumina's Voice Intent Router. Classify this voice command: "${transcript}"\nReturn strict JSON with "action" ('CHANGE_FONT' | 'CHANGE_TAB' | 'ASSISTANT_QUERY') and "value".`;
          const directJson = await executeClientDirectGeminiCall(directPrompt, undefined, true);
          const candidate = stripMarkdownCodeBlocks(directJson);
          const parsed = JSON.parse(candidate);
          if (parsed && parsed.action && parsed.value) {
            return {
              action: parsed.action as VoiceIntentAction,
              value: String(parsed.value),
              debugNotice: 'Client direct Gemini intent execution',
            };
          }
        } catch (directErr) {
          console.error('[IntentRouter Client Direct Error]:', directErr);
        }
      }

      throw new Error('API Key missing or invalid in server.ts');
    }

    const contentType = response.headers.get('content-type') || '';
    const rawResponseBody = await response.text();

    if (contentType.includes('text/html') || isHtmlPayload(rawResponseBody)) {
      return {
        ...fallbackIntentParser(transcript),
        debugNotice: 'HTML response from proxy; rule fallback used',
      };
    }

    const cleanedJsonText = stripMarkdownCodeBlocks(rawResponseBody);
    if (!cleanedJsonText || cleanedJsonText === '{}') {
      return {
        ...fallbackIntentParser(transcript),
        debugNotice: 'Non-JSON response; resilient rule engine engaged',
      };
    }

    const parsedResult = JSON.parse(cleanedJsonText);
    if (parsedResult && parsedResult.action && parsedResult.value) {
      return {
        action: parsedResult.action as VoiceIntentAction,
        value: String(parsedResult.value),
        debugNotice: parsedResult.serviceNotice || undefined,
      };
    }

    return fallbackIntentParser(transcript);
  } catch (err: any) {
    if (err?.message === 'API Key missing or invalid in server.ts') {
      throw err;
    }

    return {
      ...fallbackIntentParser(transcript),
      debugNotice: err?.message || 'Rule engine engaged',
    };
  }
}
