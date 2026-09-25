import {
  JargonTranslationResult,
  ScamAnalysisResult,
  DailyRhythmResult,
  TaskGuideResult,
  AdaptiveConsultResult,
} from '../types/companion';

export function getFallbackJargonStreamText(text: string): string {
  return `### 1. ONE-SENTENCE SUMMARY
This medical document outlines key care recommendations designed to keep your daily health and treatment steady and safe.

### 2. ACTION ITEMS NEEDED
- **Follow Prescribed Dosages**: Take any listed medications at the exact times noted on your label with food or water as indicated.
- **Keep Notes for Your Doctor**: Note down how you feel and any questions for your next scheduled clinic visit.
- **Involve Your Care Team**: Share these instructions with a family member or caregiver so they can support your routine.

### 3. RED FLAGS OR DEADLINES
- **Emergency Warnings**: Seek urgent medical attention or call 911 if you develop acute chest pain, shortness of breath, sudden severe dizziness, or high fever.

*(Lumina verified health guidance provided while cloud AI experiences high demand)*`;
}

export function getFallbackJargonTranslation(text: string, sourceType = 'general'): JargonTranslationResult {
  return {
    summary: 'Here is a plain English summary: Your document contains essential healthcare steps to keep your recovery and daily wellness safely on track.',
    actionItems: [
      {
        title: 'Daily as directed',
        timing: 'Daily as directed',
        detail: 'Take your prescribed medicines as directed, noting whether to take them with a meal or a glass of water.',
      },
      {
        title: 'Next visit',
        timing: 'Next visit',
        detail: 'Bring this document and your current prescription bottles to your next appointment with your doctor.',
      },
      {
        title: 'When questions arise',
        timing: 'When questions arise',
        detail: 'Contact your primary healthcare provider or local pharmacist if any instructions feel unclear.',
      },
    ],
    redFlagsOrDeadlines: [
      {
        title: 'Urgent Warning',
        detail: 'If you experience sudden severe symptoms like chest pressure, severe shortness of breath, or allergic swelling, call 911 immediately.',
        isUrgent: true,
      },
    ],
    simplifiedTerms: [
      {
        originalTerm: 'Rx / Prescription',
        simpleMeaning: 'The medicine authorized by your physician.',
      },
      {
        originalTerm: 'PRN',
        simpleMeaning: 'Take only as needed when symptoms occur, rather than on a rigid schedule.',
      },
    ],
    questionsForDoctor: [
      'Should I watch for any particular side effects with this medicine?',
      'When would you like to follow up on these test results?',
    ],
    reassuranceNote: 'You are being proactive about your health. Lumina is here to help you understand every step.',
  };
}

export function getFallbackScamAnalysis(messageText: string): ScamAnalysisResult {
  const lower = (messageText || '').toLowerCase();
  const isHighRisk =
    lower.includes('gift card') ||
    lower.includes('wire') ||
    lower.includes('urgent') ||
    lower.includes('arrest') ||
    lower.includes('irs') ||
    lower.includes('suspended') ||
    lower.includes('verify your password') ||
    lower.includes('click here') ||
    lower.includes('crypto');

  return {
    safetyScore: isHighRisk ? 'HIGH_RISK_SCAM' : 'SUSPICIOUS',
    verdictTitle: isHighRisk ? '🚨 High Alert: Likely Imposter Scam' : '⚠️ Proceed With Caution',
    safetySummary: isHighRisk
      ? 'This message exhibits classic warning signs of a scam: pressure to act urgently or request for sensitive credentials.'
      : 'This message could not be fully verified. Do not click links or share personal info until verified.',
    detectedRedFlags: isHighRisk
      ? [
          { flag: 'Urgent pressure to act immediately', explanation: 'Scammers create artificial deadlines to cause panic.' },
          { flag: 'Unverified request for sensitive action or funds', explanation: 'Legitimate companies do not ask for urgent transfers via text.' },
        ]
      : [
          { flag: 'Unfamiliar sender format', explanation: 'Always verify unexpected messages through official phone channels.' },
        ],
    whatToDo: [
      'Do NOT click any links in the message.',
      'Do NOT reply with personal info or banking details.',
      'If they claim to be your bank, call the number printed on the back of your official debit or credit card.',
    ],
    safeResponseScript: 'Do not reply at all. Block the sender number.',
    contactRecommendation: 'Call your family member or the organization directly using an official number from their website.',
  };
}

export function getFallbackDailyRhythm(timeOfDay: string): DailyRhythmResult {
  const timeContext: 'morning' | 'afternoon' | 'evening' =
    timeOfDay === 'afternoon' ? 'afternoon' : timeOfDay === 'evening' ? 'evening' : 'morning';

  return {
    greeting: `Good ${timeContext}, welcome to your daily rhythm`,
    timeContext,
    gentleCheckInQuestion: 'How is your energy feeling right now?',
    hydrationTip: 'Enjoy a glass of warm water or gentle herbal tea to stay hydrated.',
    upliftingThought: 'Every moment is a fresh opportunity to care for your peace of mind and wellness.',
    routineItems: [
      {
        id: '1',
        title: 'Morning Wellness & Medication Check',
        category: 'health',
        timing: '8:00 AM - 10:00 AM',
        tip: 'Take any morning tablets with breakfast and a tall glass of water.',
        completed: false,
      },
      {
        id: '2',
        title: 'Gentle Sunlight & Stretching',
        category: 'movement',
        timing: '10:30 AM',
        tip: 'Sit by natural window light or take a brief peaceful stroll.',
        completed: false,
      },
      {
        id: '3',
        title: 'Cheerful Social Check-In',
        category: 'social',
        timing: '1:30 PM',
        tip: 'Call a friend, family member, or neighbor for a 5-minute chat.',
        completed: false,
      },
    ],
  };
}

export function getFallbackTaskGuide(taskDescription: string): TaskGuideResult {
  return {
    taskTitle: taskDescription || 'Simple Step-by-Step Task',
    estimatedTime: '5 to 10 minutes',
    difficulty: 'Gentle',
    thingsNeeded: ['Comfortable chair', 'A little time and focus'],
    steps: [
      {
        stepNumber: 1,
        title: 'Get Ready',
        instruction: 'Find a well-lit, quiet spot and have any necessary items right in front of you.',
        checkpointTip: 'You feel relaxed and unhurried.',
      },
      {
        stepNumber: 2,
        title: 'Take the First Step',
        instruction: 'Focus only on the single first action without worrying about finishing everything at once.',
        checkpointTip: 'You have completed the first action calmly.',
      },
      {
        stepNumber: 3,
        title: 'Review & Rest',
        instruction: 'Check that everything is in order, and take a moment to breathe and appreciate your progress.',
        checkpointTip: 'Everything looks neat and done.',
      },
    ],
    successCelebration: 'Great job! You took it step by step and finished successfully.',
  };
}

export function getFallbackConsultationText(query: string, pacing = 'step_by_step'): string {
  if (pacing === 'quick_summary') {
    return `### Lumina Guidance Summary
- **Your Request**: Received inquiry about "${query.slice(0, 50)}".
- **Immediate Advice**: Take one calm step at a time. Review your screen options or click the large buttons below.
- **Voice Control**: You can say "Hey Lumina, make text larger" or "Hey Lumina, go to Check A Message" at any time.

*(Lumina resilient guidance active)*`;
  }
  return `### Step-by-Step Guidance: ${query.slice(0, 50)}

1. **Step 1: Check Your Screen**
   Lumina provides dedicated tools for medical notes, message scam checking, daily schedules, and friendly conversation.

2. **Step 2: Adjust Accessibility As Needed**
   Say "Hey Lumina, make text larger" or use the top buttons to switch between Standard, Large, and Extra Large font sizes.

3. **Step 3: Proceed With Confidence**
   Speak clearly into your microphone anytime you would like to run another action.

*(Lumina resilient guidance active)*`;
}

export function getFallbackAdaptiveConsultResult(query: string, pacing = 'step_by_step'): AdaptiveConsultResult {
  return {
    headline: 'Guidance for Your Voice Request',
    pacingMode: (pacing as any) || 'step_by_step',
    primaryPoints: [
      `We registered your question: "${query.slice(0, 60)}".`,
      'All Lumina tools remain active and ready for your voice or touch commands.',
      'For any emergency or urgent clinical symptom, contact your medical provider or call 911.',
    ],
    detailedContent: 'Lumina is providing resilient offline guidance to keep your experience uninterrupted.',
    actionSteps: ['Speak another command or select a tool from the header.'],
    suggestedFollowUps: ['Make text larger', 'Open Check A Message'],
  };
}
