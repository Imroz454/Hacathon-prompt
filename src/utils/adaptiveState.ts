/**
 * Adaptive Design & Cognitive State Management for Lumina.
 * 
 * Provides:
 * 1. Persistent storage of the 3-question adaptive intake answers.
 * 2. Cross-component subscription pattern for real-time reactivity.
 * 3. Dynamic UI mode determination (Calm Design vs Standard Large Buttons).
 */

import { AdaptivePreferences, InteractionPreference, PrimaryGoal, ExplanationPacing } from '../types/companion';

const STORAGE_KEY = 'lumina_adaptive_preferences';

export const DEFAULT_ADAPTIVE_PREFERENCES: AdaptivePreferences = {
  interactionPreference: 'buttons',
  primaryGoal: 'understand_notes',
  explanationPacing: 'step_by_step',
  isCalmVoiceModeActive: false,
  hasCompletedIntake: false,
};

type Listener = (prefs: AdaptivePreferences) => void;
const listeners = new Set<Listener>();

export const AdaptiveStateManager = {
  /**
   * Reads current adaptive preferences from localStorage or defaults
   */
  getPreferences(): AdaptivePreferences {
    if (typeof window === 'undefined') return DEFAULT_ADAPTIVE_PREFERENCES;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_ADAPTIVE_PREFERENCES;
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_ADAPTIVE_PREFERENCES,
        ...parsed,
      };
    } catch {
      return DEFAULT_ADAPTIVE_PREFERENCES;
    }
  },

  /**
   * Saves updated preferences and notifies all listeners
   */
  savePreferences(updates: Partial<AdaptivePreferences>): AdaptivePreferences {
    const current = this.getPreferences();
    const updated: AdaptivePreferences = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    // If user explicitly chose voice in Q1, auto-enable Voice mode (expanding mic button)
    if (updates.interactionPreference === 'voice' || updates.interactionPreference === 'voice_commands') {
      updated.isCalmVoiceModeActive = true;
      updated.interactionPreference = 'voice';
    } else if (updates.interactionPreference === 'buttons' || updates.interactionPreference === 'large_buttons') {
      if (updates.isCalmVoiceModeActive === undefined) {
        updated.isCalmVoiceModeActive = false;
      }
      updated.interactionPreference = 'buttons';
    }

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not persist adaptive preferences to localStorage', err);
      }
    }

    listeners.forEach((listener) => {
      try {
        listener(updated);
      } catch (err) {
        console.error('Error in adaptive listener:', err);
      }
    });

    return updated;
  },

  /**
   * Explicitly toggle Calm Voice Design Mode on/off
   */
  toggleCalmVoiceMode(force?: boolean): boolean {
    const current = this.getPreferences();
    const nextVal = force !== undefined ? force : !current.isCalmVoiceModeActive;
    this.savePreferences({ isCalmVoiceModeActive: nextVal });
    return nextVal;
  },

  /**
   * Set explanation pacing
   */
  setPacing(pacing: ExplanationPacing) {
    this.savePreferences({ explanationPacing: pacing });
  },

  /**
   * Subscribes to preference changes
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Resets preferences (for onboarding retry or testing)
   */
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    listeners.forEach((l) => l(DEFAULT_ADAPTIVE_PREFERENCES));
  },
};
