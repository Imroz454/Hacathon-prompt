import { useState, useEffect } from 'react';

export const QUOTA_EXCEEDED_MESSAGE =
  'Lumina is taking a quick breath. Please wait 30 seconds and try again.';

export const QUOTA_PAUSED_NOTICE =
  'Lumina is taking a quick breath. Please wait 30 seconds and try again. For your security and comfort, requests are briefly paused.';

/**
 * Checks if an error is a 429 Too Many Requests, Quota Exceeded, or Rate Limit error.
 */
export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  if (typeof err === 'number') return err === 429;
  if (err?.status === 429 || err?.statusCode === 429 || err?.response?.status === 429) {
    return true;
  }
  const msg = String(err?.message || err?.error || err || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('taking a quick breath') ||
    msg.includes('briefly paused') ||
    msg.includes('rate_limit_exceeded')
  );
}

export interface QuotaState {
  isActive: boolean;
  remainingSeconds: number;
  message: string;
}

type QuotaListener = (state: QuotaState) => void;

class QuotaManagerService {
  private cooldownUntil: number = 0;
  private message: string = QUOTA_EXCEEDED_MESSAGE;
  private timer: any = null;
  private listeners: Set<QuotaListener> = new Set();

  public isCooldownActive(): boolean {
    return Date.now() < this.cooldownUntil;
  }

  public getRemainingSeconds(): number {
    return Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000));
  }

  public getMessage(): string {
    return this.message;
  }

  public triggerCooldown(seconds = 30, message = QUOTA_EXCEEDED_MESSAGE): void {
    const targetTime = Date.now() + seconds * 1000;
    this.cooldownUntil = Math.max(this.cooldownUntil, targetTime);
    this.message = message;
    this.notify();

    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(() => {
      const remaining = this.getRemainingSeconds();
      this.notify();
      if (remaining <= 0) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
  }

  public reset(): void {
    this.cooldownUntil = 0;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public subscribe(listener: QuotaListener): () => void {
    this.listeners.add(listener);
    listener({
      isActive: this.isCooldownActive(),
      remainingSeconds: this.getRemainingSeconds(),
      message: this.message,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state: QuotaState = {
      isActive: this.isCooldownActive(),
      remainingSeconds: this.getRemainingSeconds(),
      message: this.message,
    };
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        // ignore subscriber errors
      }
    }
  }
}

export const QuotaManager = new QuotaManagerService();

/**
 * React hook to subscribe to live quota cooldown countdown.
 */
export function useQuotaCooldown(): QuotaState {
  const [quotaState, setQuotaState] = useState<QuotaState>(() => ({
    isActive: QuotaManager.isCooldownActive(),
    remainingSeconds: QuotaManager.getRemainingSeconds(),
    message: QuotaManager.getMessage(),
  }));

  useEffect(() => {
    return QuotaManager.subscribe((state) => {
      setQuotaState(state);
    });
  }, []);

  return quotaState;
}
