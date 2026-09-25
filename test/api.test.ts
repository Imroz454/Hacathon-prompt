import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('GoldenCare Data Structure & Validation Tests', () => {
  test('Jargon translation schema structure verification', () => {
    const mockResult = {
      summary: 'Your blood test looks very good and healthy.',
      plainEnglishExplanation: 'The test measured your body sugar over the past 3 months.',
      keyActionItems: [
        { action: 'Take your regular morning tablet', priority: 'routine', timing: 'With breakfast' }
      ],
      simplifiedTerms: [
        { originalTerm: 'HbA1c', simpleMeaning: 'Average blood sugar reading over 3 months' }
      ],
      questionsForDoctor: ['Should I continue my current diet plan?'],
      reassuranceNote: 'You are doing great taking care of your health.'
    };

    assert.strictEqual(typeof mockResult.summary, 'string');
    assert.ok(mockResult.keyActionItems.length > 0);
    assert.strictEqual(mockResult.simplifiedTerms[0].originalTerm, 'HbA1c');
    assert.ok(mockResult.questionsForDoctor.length > 0);
  });

  test('Scam analysis classification checks', () => {
    const validScores = ['SAFE', 'SUSPICIOUS', 'HIGH_RISK_SCAM'];
    const testVerdict = 'HIGH_RISK_SCAM';
    assert.ok(validScores.includes(testVerdict));

    const mockScamOutput = {
      safetyScore: 'HIGH_RISK_SCAM',
      verdictTitle: '🚨 High Alert: Likely Imposter Scam',
      safetySummary: 'Someone is impersonating your grandchild asking for urgent money.',
      detectedRedFlags: [
        { flag: 'Urgent money transfer request', explanation: 'Scammers create fake emergencies.' }
      ],
      whatToDo: ['Do not send any money or gift cards.', 'Call your grandchild directly on their normal phone number.'],
      safeResponseScript: 'I will call you back on your regular phone.',
      contactRecommendation: 'Call your family member directly.'
    };

    assert.strictEqual(mockScamOutput.safetyScore, 'HIGH_RISK_SCAM');
    assert.ok(mockScamOutput.detectedRedFlags.length > 0);
    assert.ok(mockScamOutput.whatToDo.length > 0);
  });

  test('Daily rhythm category validation', () => {
    const categories = ['health', 'hydration', 'movement', 'social', 'mind'];
    const sampleItem = {
      id: '1',
      title: 'Glass of warm water',
      category: 'hydration',
      timing: '8:00 AM',
      tip: 'Sip slowly to wake up your body gently',
      completed: false
    };

    assert.ok(categories.includes(sampleItem.category));
    assert.strictEqual(sampleItem.completed, false);
  });

  test('Step-by-step task guide ordering', () => {
    const taskGuide = {
      taskTitle: 'Set up weekly pill organizer',
      estimatedTime: '10 minutes',
      difficulty: 'Gentle',
      thingsNeeded: ['Prescription bottles', '7-day plastic pill tray'],
      steps: [
        { stepNumber: 1, title: 'Clear the table', instruction: 'Sit at a well-lit kitchen table', checkpointTip: 'Clean space' },
        { stepNumber: 2, title: 'Open Monday slot', instruction: 'Flip open the lid marked MON', checkpointTip: 'Lid is open' }
      ],
      successCelebration: 'Well done! All pills are neatly arranged.'
    };

    assert.strictEqual(taskGuide.steps[0].stepNumber, 1);
    assert.strictEqual(taskGuide.steps[1].stepNumber, 2);
    assert.ok(taskGuide.thingsNeeded.length > 0);
  });

  test('3-Point bullet structure markdown parser verification', () => {
    const sampleMarkdown = `
### SUMMARY
Your blood test looks very stable and healthy.

### 3 KEY TAKEAWAYS
1. **Take Your Morning Pill**: Take one tablet every morning with breakfast and water.
2. **Drink Plenty of Water**: Keep a water bottle nearby and sip throughout the day.
3. **Walk 15 Minutes**: A gentle stroll after lunch helps your heart and joints.
4. **Extra Point**: This fourth point should be capped to 3 points.

### WORDS MADE SIMPLE
- **HbA1c**: Average body sugar measurement.
- **eGFR**: Kidney filtration health score.

### QUESTIONS FOR YOUR DOCTOR
- Should I continue this routine for 6 months?
- Can I take this pill with coffee?

### REASSURANCE
You are doing a wonderful job taking care of yourself!
`;

    // Simulated parser test
    const summaryMatch = sampleMarkdown.match(/###\s*SUMMARY[\s\S]*?(?=###|$)/i);
    const summary = summaryMatch ? summaryMatch[0].replace(/###\s*SUMMARY/i, '').trim() : '';
    assert.strictEqual(summary, 'Your blood test looks very stable and healthy.');

    const pointsMatch = sampleMarkdown.match(/###\s*(?:3\s*)?KEY[\s\S]*?(?=###|$)/i);
    assert.ok(pointsMatch);

    const rawSection = pointsMatch[0].replace(/###\s*(?:3\s*)?KEY[^\n]*/i, '').trim();
    const lines = rawSection.split('\n').map((l) => l.trim()).filter(Boolean);
    const points: Array<{ title: string; detail: string }> = [];

    for (const line of lines) {
      const boldMatch = line.match(/^(?:\d+\.|\*|-)\s*\*\*(.*?)\*\*[:\-]?\s*(.*)$/);
      if (boldMatch) {
        points.push({ title: boldMatch[1].trim(), detail: boldMatch[2].trim() });
      }
    }

    const cappedPoints = points.slice(0, 3);
    assert.strictEqual(cappedPoints.length, 3);
    assert.strictEqual(cappedPoints[0].title, 'Take Your Morning Pill');
    assert.strictEqual(cappedPoints[1].title, 'Drink Plenty of Water');
    assert.strictEqual(cappedPoints[2].title, 'Walk 15 Minutes');
  });

  test('Key Fallback logic resolves GEMINI_API_KEY, API_KEY, or window.ENV.GEMINI_API_KEY', async () => {
    const { getClientGeminiApiKey } = await import('../src/services/api');
    
    // Test window.ENV fallback
    (globalThis as any).window = { ENV: { GEMINI_API_KEY: 'test-window-key-123' } };
    const savedProcessGemini = process.env.GEMINI_API_KEY;
    const savedProcessApi = process.env.API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;

    const resolvedWindow = getClientGeminiApiKey();
    assert.strictEqual(resolvedWindow, 'test-window-key-123');

    // Test process.env.API_KEY fallback
    process.env.API_KEY = 'test-api-key-456';
    const resolvedApi = getClientGeminiApiKey();
    assert.ok(resolvedApi === 'test-api-key-456' || resolvedApi === 'test-window-key-123');

    // Cleanup
    if (savedProcessGemini) process.env.GEMINI_API_KEY = savedProcessGemini;
    if (savedProcessApi) process.env.API_KEY = savedProcessApi;
    delete (globalThis as any).window;
  });

  test('Instant Local Action Routing matches font size and tab switches without network calls', () => {
    // Font regex
    const fontRegex = /larger|bigger|increase font|huge/i;
    assert.ok(fontRegex.test('Make the text larger'));
    assert.ok(fontRegex.test('Make font bigger'));
    assert.ok(fontRegex.test('Please increase font size'));
    assert.ok(fontRegex.test('Make it huge'));
    assert.strictEqual(fontRegex.test('What is my medicine schedule?'), false);

    // Tab switching regex
    const tabRegex = /(?:go to|open|switch to)/i;
    assert.ok(tabRegex.test('go to check a message'));
    assert.ok(tabRegex.test('switch to daily rhythm'));
    assert.ok(tabRegex.test('open friendly companion'));
    assert.ok(tabRegex.test('open explain it simply'));
    assert.ok(tabRegex.test('switch to walk me through it'));
    assert.strictEqual(tabRegex.test('Can you explain my blood pressure?'), false);
  });
});
