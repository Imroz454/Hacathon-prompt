/**
 * Core type definitions for Lumina - Your Daily Companion
 */

export type FontSize = 'normal' | 'large' | 'huge';
export type ThemeMode = 'warm' | 'high-contrast';

export interface JargonTranslationResult {
  summary: string;
  actionItems?: Array<{
    title: string;
    detail: string;
    timing?: string;
  }>;
  redFlagsOrDeadlines?: Array<{
    title: string;
    detail: string;
    isUrgent?: boolean;
  }>;
  plainEnglishExplanation?: string;
  keyActionItems?: Array<{
    action: string;
    priority: 'immediate' | 'routine' | 'optional';
    timing?: string;
  }>;
  simplifiedTerms?: Array<{
    originalTerm: string;
    simpleMeaning: string;
  }>;
  questionsForDoctor?: string[];
  reassuranceNote?: string;
}

export interface ScamAnalysisResult {
  safetyScore: 'SAFE' | 'SUSPICIOUS' | 'HIGH_RISK_SCAM';
  verdictTitle: string;
  safetySummary: string;
  detectedRedFlags: Array<{
    flag: string;
    explanation: string;
  }>;
  whatToDo: string[];
  safeResponseScript: string;
  contactRecommendation: string;
}

export interface RoutineItem {
  id: string;
  title: string;
  category: 'health' | 'hydration' | 'movement' | 'social' | 'mind';
  timing: string;
  tip: string;
  completed: boolean;
}

export interface DailyRhythmResult {
  greeting: string;
  timeContext: 'morning' | 'afternoon' | 'evening';
  gentleCheckInQuestion: string;
  routineItems: RoutineItem[];
  upliftingThought: string;
  hydrationTip: string;
}

export interface TaskStep {
  stepNumber: number;
  title: string;
  instruction: string;
  checkpointTip: string;
}

export interface TaskGuideResult {
  taskTitle: string;
  estimatedTime: string;
  difficulty: 'Very Easy' | 'Gentle' | 'Moderate';
  thingsNeeded: string[];
  steps: TaskStep[];
  successCelebration: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'companion';
  text: string;
  timestamp: string;
}

/**
 * Adaptive Design & Cross-Generational Intake Types
 */
export type InteractionPreference = 'buttons' | 'voice' | 'large_buttons' | 'voice_commands';
export type PrimaryGoal = 'understand_notes' | 'organize_day' | 'learn_new';
export type ExplanationPacing = 'quick_summary' | 'step_by_step';

export interface AdaptivePreferences {
  interactionPreference: InteractionPreference;
  primaryGoal: PrimaryGoal;
  explanationPacing: ExplanationPacing;
  isCalmVoiceModeActive: boolean;
  hasCompletedIntake: boolean;
  lastUpdated?: string;
}

export interface AdaptiveConsultResult {
  headline: string;
  pacingMode: ExplanationPacing;
  primaryPoints: string[];
  detailedContent?: string;
  actionSteps?: string[];
  suggestedFollowUps?: string[];
}
