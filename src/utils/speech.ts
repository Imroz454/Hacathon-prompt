/**
 * Sound and Speech Management Engine for Lumina Companion.
 * 
 * Provides:
 * 1. Text-to-Speech (TTS) with:
 *    - Cross-browser voice preloading and automatic retry on silent lock.
 *    - Chrome long-text chunking (prevents Chrome cutting off after ~15 seconds).
 *    - Chunk keep-alive ping interval.
 *    - Speed control tailored for seniors (calm, steady, or normal: 0.75x, 0.85x, 1.0x).
 *    - Voice selection with fallback across systems.
 *    - Global state listener so all UI buttons stay perfectly in sync.
 * 
 * 2. Gentle UI Audio Feedback (Web Audio API):
 *    - Chime on completion, soft click, success chime, alert tone.
 *    - Toggleable sound effects with volume control.
 */

export interface SpeechSettings {
  rate: number; // 0.75 (slow & calm), 0.88 (gentle default), 1.0 (normal)
  pitch: number;
  volume: number; // 0.0 to 1.0
  voiceURI: string | null;
  soundEffectsEnabled: boolean;
  muted: boolean; // Master mute for both speech narration and UI sound chimes
}

const DEFAULT_SETTINGS: SpeechSettings = {
  rate: 0.85,
  pitch: 1.0,
  volume: 1.0,
  voiceURI: null,
  soundEffectsEnabled: true,
  muted: false,
};

// Storage key
const SETTINGS_KEY = 'goldencare_speech_settings';

function loadSettings(): SpeechSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: SpeechSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // ignore
  }
}

let currentSettings: SpeechSettings = loadSettings();

// Listeners for speaking state and settings
type SpeakingStateListener = (speakingTextId: string | null, isPaused: boolean) => void;
type SettingsListener = (settings: SpeechSettings) => void;

const stateListeners = new Set<SpeakingStateListener>();
const settingsListeners = new Set<SettingsListener>();

let currentSpeakingId: string | null = null;
let isCurrentlyPaused = false;
let chunkKeepAliveTimer: any = null;
let currentUtterancesQueue: SpeechSynthesisUtterance[] = [];
let voicesCache: SpeechSynthesisVoice[] = [];

function notifyState(id: string | null, paused: boolean = false) {
  currentSpeakingId = id;
  isCurrentlyPaused = paused;
  stateListeners.forEach((fn) => {
    try {
      fn(id, paused);
    } catch (e) {
      console.error(e);
    }
  });
}

function notifySettings() {
  settingsListeners.forEach((fn) => {
    try {
      fn(currentSettings);
    } catch (e) {
      console.error(e);
    }
  });
}

// Pre-fetch and cache available voices
export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        voicesCache = v;
        resolve(v);
      }
    };

    load();
    if (voicesCache.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        load();
        window.speechSynthesis.onvoiceschanged = null;
      };
      // Fallback timeout in case onvoiceschanged does not fire
      setTimeout(load, 500);
    }
  });
}

// Run voice init early in browser
if (typeof window !== 'undefined') {
  initVoices();
}

/**
 * Splits long text into natural sentence/comma chunks.
 * This fixes the notorious Chromium bug where utterances longer than 15 seconds
 * get killed silently.
 */
function splitIntoNaturalChunks(text: string, maxChunkLen = 140): string[] {
  const clean = text
    .replace(/[#*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return [];

  // Split on sentences, punctuation, or line breaks
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).trim().length <= maxChunkLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxChunkLen) {
        current = trimmed;
      } else {
        // If an individual sentence is too long, split by comma or clause
        const parts = trimmed.split(/([,;:]\s+)/);
        let sub = '';
        for (const part of parts) {
          if ((sub + part).length <= maxChunkLen) {
            sub += part;
          } else {
            if (sub) chunks.push(sub.trim());
            sub = part;
          }
        }
        current = sub.trim();
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((c) => c.length > 0);
}

function chooseBestVoice(voices: SpeechSynthesisVoice[], preferredUri: string | null): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  if (preferredUri) {
    const found = voices.find((v) => v.voiceURI === preferredUri);
    if (found) return found;
  }

  // Look for high-quality, gentle, clear English voices
  // Hierarchy: Natural/Neural -> Google US -> Samantha / Victoria / Daniel -> en-US -> en
  const enVoices = voices.filter((v) => v.lang.startsWith('en'));
  if (enVoices.length === 0) return voices[0] || null;

  const topPick = enVoices.find(
    (v) =>
      v.name.includes('Natural') ||
      v.name.includes('Online') ||
      v.name.includes('Neural') ||
      (v.name.includes('Google') && v.lang.includes('US')) ||
      v.name.includes('Samantha') ||
      v.name.includes('Karen') ||
      v.name.includes('Victoria') ||
      v.name.includes('Daniel')
  );

  return topPick || enVoices.find((v) => v.lang === 'en-US') || enVoices[0];
}

/**
 * Web Audio chime generator for pleasant tactile confirmation
 */
class SoundEffectsManager {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playSoftChime() {
    if (currentSettings.muted || !currentSettings.soundEffectsEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5

      gain.gain.setValueAtTime(0.06 * currentSettings.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {
      // AudioContext might be blocked until user gesture, ignore safely
    }
  }

  playSuccessChime() {
    if (currentSettings.muted || !currentSettings.soundEffectsEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 triad
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.08 * currentSettings.volume, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.36);
      });
    } catch (e) {
      // ignore
    }
  }

  playAlertChime() {
    if (currentSettings.muted || !currentSettings.soundEffectsEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(370, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.08 * currentSettings.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      // ignore
    }
  }
}

export const SoundEffects = new SoundEffectsManager();

/**
 * Public Text-To-Speech Interface
 */
export const TextToSpeech = {
  isSupported: (): boolean => {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  getVoices: (): SpeechSynthesisVoice[] => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    if (voicesCache.length > 0) return voicesCache;
    voicesCache = window.speechSynthesis.getVoices();
    return voicesCache;
  },

  getSettings: (): SpeechSettings => {
    return { ...currentSettings };
  },

  updateSettings: (newSettings: Partial<SpeechSettings>): void => {
    currentSettings = { ...currentSettings, ...newSettings };
    saveSettings(currentSettings);
    notifySettings();
  },

  subscribeSettings: (listener: SettingsListener): (() => void) => {
    settingsListeners.add(listener);
    listener(currentSettings);
    return () => settingsListeners.delete(listener);
  },

  subscribeState: (listener: SpeakingStateListener): (() => void) => {
    stateListeners.add(listener);
    listener(currentSpeakingId, isCurrentlyPaused);
    return () => stateListeners.delete(listener);
  },

  getCurrentSpeakingId: (): string | null => {
    return currentSpeakingId;
  },

  isSpeaking: (textId?: string): boolean => {
    if (textId) {
      return currentSpeakingId === textId;
    }
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      (window.speechSynthesis.speaking || currentSpeakingId !== null)
    );
  },

  isMuted: (): boolean => {
    return !!currentSettings.muted;
  },

  setMuted: (muted: boolean): void => {
    if (muted) {
      TextToSpeech.stop();
    }
    TextToSpeech.updateSettings({ muted });
  },

  toggleMute: (): boolean => {
    const nextState = !currentSettings.muted;
    TextToSpeech.setMuted(nextState);
    if (!nextState) {
      SoundEffects.playSoftChime();
    }
    return nextState;
  },

  /**
   * Primary speech invocation function.
   * Handles resume locks, queueing, audio chiming, and auto-cleanup.
   */
  speak: (
    text: string,
    textId: string = 'generic',
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ): void => {
    if (currentSettings.muted) {
      if (onEnd) onEnd();
      return;
    }

    if (!TextToSpeech.isSupported()) {
      if (onError) onError(new Error('Speech is not supported in this browser.'));
      return;
    }

    const synth = window.speechSynthesis;

    // First, play a soft start chime if enabled
    SoundEffects.playSoftChime();

    // Cancel prior speech and clear previous queue
    TextToSpeech.stop();

    const chunks = splitIntoNaturalChunks(text);
    if (chunks.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    // Refresh voices
    const voices = TextToSpeech.getVoices();
    const chosenVoice = chooseBestVoice(voices, currentSettings.voiceURI);

    // Build utterances
    currentUtterancesQueue = chunks.map((chunk, index) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.rate = 0.85; // Explicitly set speech rate to 0.85 for comprehension
      u.pitch = 1.0; // Explicitly set pitch to 1.0
      u.volume = currentSettings.volume;
      if (chosenVoice) {
        u.voice = chosenVoice;
      }

      const isFirst = index === 0;
      const isLast = index === chunks.length - 1;

      u.onstart = () => {
        if (isFirst) {
          notifyState(textId, false);
          if (onStart) onStart();
        }
      };

      u.onend = () => {
        if (isLast) {
          clearInterval(chunkKeepAliveTimer);
          chunkKeepAliveTimer = null;
          notifyState(null, false);
          if (onEnd) onEnd();
        }
      };

      u.onerror = (e) => {
        // Ignore user cancellation or interruptions
        if (e.error === 'interrupted' || e.error === 'canceled') {
          if (isLast) {
            clearInterval(chunkKeepAliveTimer);
            chunkKeepAliveTimer = null;
            notifyState(null, false);
          }
          return;
        }

        console.warn('Speech chunk error:', e.error);
        if (isLast) {
          clearInterval(chunkKeepAliveTimer);
          chunkKeepAliveTimer = null;
          notifyState(null, false);
          if (onError) onError(e);
        }
      };

      return u;
    });

    // Un-pause if browser engine is suspended
    try {
      if (synth.paused) {
        synth.resume();
      }
    } catch (e) {
      // ignore
    }

    // Chrome keep-alive hack: periodically pause & resume to avoid Chrome 15s bug
    clearInterval(chunkKeepAliveTimer);
    chunkKeepAliveTimer = setInterval(() => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10000);

    // Enqueue all chunks sequentially
    for (const utterance of currentUtterancesQueue) {
      synth.speak(utterance);
    }

    // Fallback: If for some reason speaking doesn't trigger in 300ms, force resume
    setTimeout(() => {
      if (synth.paused) {
        synth.resume();
      }
    }, 300);
  },

  /**
   * Pause speech
   */
  pause: (): void => {
    if (TextToSpeech.isSupported()) {
      window.speechSynthesis.pause();
      notifyState(currentSpeakingId, true);
    }
  },

  /**
   * Resume speech
   */
  resume: (): void => {
    if (TextToSpeech.isSupported()) {
      window.speechSynthesis.resume();
      notifyState(currentSpeakingId, false);
    }
  },

  /**
   * Stop and reset all speech immediately
   */
  stop: (): void => {
    if (TextToSpeech.isSupported()) {
      clearInterval(chunkKeepAliveTimer);
      chunkKeepAliveTimer = null;
      currentUtterancesQueue = [];
      window.speechSynthesis.cancel();
      notifyState(null, false);
    }
  },

  /**
   * Speaks sequential segments (e.g. Summary, Point 1, Point 2, Point 3, Reassurance)
   * with real-time active segment index tracking for visual read-along feedback.
   */
  speakSegments: (
    segments: Array<{ id: string; text: string }>,
    textId: string = 'summary-voice-assistant',
    onSegmentStart?: (index: number, segment: { id: string; text: string }) => void,
    onComplete?: () => void,
    onError?: (err: any) => void
  ): void => {
    if (!TextToSpeech.isSupported()) {
      if (onError) onError(new Error('Speech is not supported in this browser.'));
      return;
    }

    if (currentSettings.muted) {
      TextToSpeech.setMuted(false);
    }

    // Play subtle cue tone
    SoundEffects.playSoftChime();

    // Cancel prior playback
    TextToSpeech.stop();

    const validSegments = segments.filter((s) => s.text && s.text.trim().length > 0);
    if (validSegments.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const synth = window.speechSynthesis;
    const voices = TextToSpeech.getVoices();
    const chosenVoice = chooseBestVoice(voices, currentSettings.voiceURI);

    currentUtterancesQueue = validSegments.map((segment, index) => {
      const cleanText = segment.text.replace(/[#*_`~]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      // Strictly set speech rate to 0.85 for comprehension
      utterance.rate = 0.85;
      // Strictly set pitch to 1.0
      utterance.pitch = 1.0;
      utterance.volume = currentSettings.volume || 1.0;
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onstart = () => {
        notifyState(textId, false);
        if (onSegmentStart) {
          onSegmentStart(index, segment);
        }
      };

      const isLast = index === validSegments.length - 1;
      utterance.onend = () => {
        if (isLast) {
          clearInterval(chunkKeepAliveTimer);
          chunkKeepAliveTimer = null;
          notifyState(null, false);
          if (onComplete) onComplete();
        }
      };

      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') {
          if (isLast) {
            clearInterval(chunkKeepAliveTimer);
            chunkKeepAliveTimer = null;
            notifyState(null, false);
          }
          return;
        }
        console.warn('Speech segment error:', e.error);
        if (isLast) {
          clearInterval(chunkKeepAliveTimer);
          chunkKeepAliveTimer = null;
          notifyState(null, false);
          if (onError) onError(e);
        }
      };

      return utterance;
    });

    // Chrome keep-alive hack
    clearInterval(chunkKeepAliveTimer);
    chunkKeepAliveTimer = setInterval(() => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10000);

    // Enqueue
    for (const utterance of currentUtterancesQueue) {
      synth.speak(utterance);
    }

    setTimeout(() => {
      if (synth.paused) {
        synth.resume();
      }
    }, 250);
  },
};


/**
 * Native webkitSpeechRecognition engine for senior-tailored voice dictation
 */
export function createSpeechRecognizer(
  onResult: (transcript: string) => void,
  onStatusChange: (isListening: boolean) => void,
  onError: (errorMsg: string) => void
) {
  // Use native webkitSpeechRecognition API with SpeechRecognition fallback
  const SpeechRecognition =
    (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (!SpeechRecognition) {
    return {
      start: () =>
        onError(
          'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type your text directly.'
        ),
      stop: () => {},
      isSupported: false,
    };
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  let finalTranscript = '';
  let isListening = false;

  recognition.onstart = () => {
    isListening = true;
    finalTranscript = '';
    SoundEffects.playSoftChime();
    onStatusChange(true);
  };

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const trans = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) {
        finalTranscript += trans + ' ';
      } else {
        interimTranscript += trans;
      }
    }
    const current = (finalTranscript + interimTranscript).trim();
    if (current) {
      onResult(current);
    }
  };

  recognition.onerror = (event: any) => {
    console.warn('Speech recognition notice/error:', event.error);
    if (event.error === 'not-allowed') {
      onError('Microphone permission was not granted. Please allow microphone access in your browser settings.');
      isListening = false;
      onStatusChange(false);
    } else if (event.error === 'no-speech') {
      // User paused momentarily, keep listening in continuous mode
    } else if (event.error === 'audio-capture') {
      onError('No microphone was detected. Please connect or enable your microphone.');
      isListening = false;
      onStatusChange(false);
    } else {
      onError(`Microphone notice: ${event.error}`);
      isListening = false;
      onStatusChange(false);
    }
  };

  recognition.onend = () => {
    isListening = false;
    onStatusChange(false);
  };

  return {
    start: async () => {
      try {
        // Explicitly activate microphone stream to ensure browser permission prompt triggers
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Release the probe track immediately so webkitSpeechRecognition has exclusive access
            stream.getTracks().forEach((track) => track.stop());
          } catch (micErr: any) {
            if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
              onError('Microphone permission was denied. Please allow microphone access to dictate.');
              return;
            }
          }
        }
        recognition.start();
      } catch (err: any) {
        console.warn('Recognition start warning:', err);
      }
    },
    stop: () => {
      try {
        isListening = false;
        recognition.stop();
      } catch (err) {
        // ignore
      }
    },
    isSupported: true,
  };
}
