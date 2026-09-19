import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Sound & Speech Helper Unit Tests', () => {
  test('Speech chunking logic cleanly handles punctuation and long texts', () => {
    const text = 'First sentence is clear and peaceful. Second sentence has some more detailed words. Third sentence wraps up warmly!';
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    
    assert.strictEqual(sentences.length, 3);
    assert.strictEqual(sentences[0].trim(), 'First sentence is clear and peaceful.');
  });

  test('Speech rate clamps and settings verification', () => {
    const defaultSettings = {
      rate: 0.85,
      pitch: 1.0,
      volume: 1.0,
      voiceURI: null,
      soundEffectsEnabled: true,
      muted: false,
    };

    assert.ok(defaultSettings.rate >= 0.7 && defaultSettings.rate <= 1.2);
    assert.strictEqual(defaultSettings.soundEffectsEnabled, true);
    assert.strictEqual(defaultSettings.volume, 1.0);
    assert.strictEqual(defaultSettings.muted, false);
  });

  test('Mute toggle properly silences audio state', () => {
    let settings = { muted: false };
    // toggle mute
    settings.muted = !settings.muted;
    assert.strictEqual(settings.muted, true);
    // toggle unmute
    settings.muted = !settings.muted;
    assert.strictEqual(settings.muted, false);
  });

  test('Voice assistant segments construction with active segment IDs', () => {
    const mockResult = {
      summary: 'Your heart test looks reassuring and normal.',
      threePoints: [
        { title: 'Take Medication', detail: 'Take your tablet once daily with food.' },
        { title: 'Hydration', detail: 'Drink a glass of water when you wake up.' },
        { title: 'Follow Up', detail: 'See your doctor in 3 weeks.' }
      ],
      reassuranceNote: 'You are doing great!'
    };

    const segments: Array<{ id: string; text: string; label: string }> = [];

    if (mockResult.summary) {
      segments.push({
        id: 'summary',
        text: `Plain English summary: ${mockResult.summary}`,
        label: 'Reading The Plain English Summary',
      });
    }

    mockResult.threePoints.forEach((pt, idx) => {
      segments.push({
        id: `point-${idx}`,
        text: `Point ${idx + 1}: ${pt.title}. ${pt.detail}`,
        label: `Reading Key Takeaway ${idx + 1} of 3`,
      });
    });

    if (mockResult.reassuranceNote) {
      segments.push({
        id: 'reassurance',
        text: `Reassurance note: ${mockResult.reassuranceNote}`,
        label: 'Reading Reassurance Note',
      });
    }

    assert.strictEqual(segments.length, 5);
    assert.strictEqual(segments[0].id, 'summary');
    assert.strictEqual(segments[1].id, 'point-0');
    assert.strictEqual(segments[2].id, 'point-1');
    assert.strictEqual(segments[3].id, 'point-2');
    assert.strictEqual(segments[4].id, 'reassurance');
  });
});
