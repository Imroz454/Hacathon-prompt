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

/**
 * Service to communicate with the secure server-side Gemini API endpoints.
 * Automatically injects the user's active Adaptive Preferences (Q1 interaction, Q2 goal, Q3 pacing)
 * into all Gemini requests so the backend can dynamically append tailored prompt rules.
 */

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'An unexpected issue occurred.' }));
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
  const res = await fetch('/api/translate-jargon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<JargonTranslationResult>(res);
}

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
        const errorData = await res.json().catch(() => ({ error: 'An unexpected issue occurred.' }));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

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
  const res = await fetch('/api/check-scam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<ScamAnalysisResult>(res);
}

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
  const res = await fetch('/api/daily-rhythm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DailyRhythmResult>(res);
}

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
  const res = await fetch('/api/breakdown-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<TaskGuideResult>(res);
}

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
        const errorData = await res.json().catch(() => ({ error: 'An unexpected issue occurred.' }));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

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
  const res = await fetch('/api/companion-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ reply: string }>(res);
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
    try {
      const res = await fetch('/api/adaptive-consult-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'An unexpected issue occurred.' }));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

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
  const res = await fetch('/api/adaptive-consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<AdaptiveConsultResult>(res);
}
