/**
 * Markdown & Streaming Response Parser for Lumina Jargon Translator.
 * Parses Gemini output strictly into the 3-part layout:
 * 1. One-Sentence Summary
 * 2. Action Items Needed
 * 3. Red Flags or Deadlines
 */

export interface ParsedJargonResult {
  summary: string;
  actionItems: Array<{
    title: string;
    detail: string;
    timing?: string;
    priority?: 'immediate' | 'routine';
  }>;
  redFlagsAndDeadlines: Array<{
    title: string;
    detail: string;
    isUrgent?: boolean;
    deadline?: string;
  }>;
  // Compatibility fields
  threePoints: Array<{
    title: string;
    detail: string;
  }>;
  keyActionItems: Array<{
    action: string;
    priority: 'immediate' | 'routine' | 'optional';
    timing?: string;
  }>;
  simplifiedTerms: Array<{
    originalTerm: string;
    simpleMeaning: string;
  }>;
  questionsForDoctor: string[];
  reassuranceNote: string;
  isStreamingComplete?: boolean;
}

export function parseJargonMarkdown(markdown: string, isComplete: boolean = false): ParsedJargonResult {
  if (!markdown || !markdown.trim()) {
    return {
      summary: '',
      actionItems: [],
      redFlagsAndDeadlines: [],
      threePoints: [],
      keyActionItems: [],
      simplifiedTerms: [],
      questionsForDoctor: [],
      reassuranceNote: '',
      isStreamingComplete: isComplete,
    };
  }

  // 1. Extract One-Sentence Summary
  let summary = '';
  const summaryMatch =
    markdown.match(/###\s*(?:1\.\s*)?(?:ONE-SENTENCE\s+)?SUMMARY[\s\S]*?(?=###|$)/i) ||
    markdown.match(/###\s*SUMMARY[\s\S]*?(?=###|$)/i);

  if (summaryMatch) {
    summary = summaryMatch[0].replace(/###\s*(?:1\.\s*)?(?:ONE-SENTENCE\s+)?SUMMARY[^\n]*/i, '').trim();
    // Clean any leading quotes or stray markdown
    summary = summary.replace(/^["']|["']$/g, '').trim();
  }

  // Fallback while initial streaming chunks are arriving before section headers appear
  if (!summary && !markdown.includes('###')) {
    summary = markdown.trim();
  }

  // 2. Extract Action Items Needed
  const actionItems: Array<{
    title: string;
    detail: string;
    timing?: string;
    priority?: 'immediate' | 'routine';
  }> = [];

  const actionsMatch =
    markdown.match(/###\s*(?:2\.\s*)?ACTION\s+ITEMS(?:\s+NEEDED)?[\s\S]*?(?=###|$)/i) ||
    markdown.match(/###\s*(?:3\s*)?KEY[\s\S]*?(?=###|$)/i);

  if (actionsMatch) {
    const rawSection = actionsMatch[0].replace(/###\s*(?:2\.\s*)?ACTION\s+ITEMS[^\n]*|###\s*(?:3\s*)?KEY[^\n]*/i, '').trim();
    const lines = rawSection.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Matches "1. **Title**: Detail" or "- **Title**: Detail" or "* **Title**: Detail"
      const boldMatch = line.match(/^(?:\d+\.|\*|-)\s*\*\*(.*?)\*\*[:\-]?\s*(.*)$/);
      if (boldMatch) {
        actionItems.push({
          title: boldMatch[1].trim(),
          detail: boldMatch[2].trim(),
          priority: actionItems.length === 0 ? 'immediate' : 'routine',
        });
      } else {
        const plainMatch = line.match(/^(?:\d+\.|\*|-)\s*(.*)$/);
        if (plainMatch && plainMatch[1].trim()) {
          const content = plainMatch[1].trim();
          const separatorIdx = content.indexOf(':');
          if (separatorIdx > 0) {
            actionItems.push({
              title: content.slice(0, separatorIdx).trim(),
              detail: content.slice(separatorIdx + 1).trim(),
              priority: 'routine',
            });
          } else {
            actionItems.push({
              title: 'Action Step',
              detail: content,
              priority: 'routine',
            });
          }
        }
      }
    }
  }

  // 3. Extract Red Flags or Deadlines
  const redFlagsAndDeadlines: Array<{
    title: string;
    detail: string;
    isUrgent?: boolean;
    deadline?: string;
  }> = [];

  const redFlagsMatch =
    markdown.match(/###\s*(?:3\.\s*)?RED\s+FLAGS(?:\s+OR\s+DEADLINES)?[\s\S]*?(?=###|$)/i) ||
    markdown.match(/###\s*(?:WARNINGS?|DEADLINES?|CRITICAL)[\s\S]*?(?=###|$)/i);

  if (redFlagsMatch) {
    const rawSection = redFlagsMatch[0].replace(/###\s*(?:3\.\s*)?RED\s+FLAGS[^\n]*|###\s*(?:WARNINGS?|DEADLINES?)[^\n]*/i, '').trim();
    const lines = rawSection.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const boldMatch = line.match(/^(?:\d+\.|\*|-)\s*\*\*(.*?)\*\*[:\-]?\s*(.*)$/);
      if (boldMatch) {
        redFlagsAndDeadlines.push({
          title: boldMatch[1].trim(),
          detail: boldMatch[2].trim(),
          isUrgent: true,
        });
      } else {
        const plainMatch = line.match(/^(?:\d+\.|\*|-)\s*(.*)$/);
        if (plainMatch && plainMatch[1].trim()) {
          const content = plainMatch[1].trim();
          const separatorIdx = content.indexOf(':');
          if (separatorIdx > 0) {
            redFlagsAndDeadlines.push({
              title: content.slice(0, separatorIdx).trim(),
              detail: content.slice(separatorIdx + 1).trim(),
              isUrgent: true,
            });
          } else {
            redFlagsAndDeadlines.push({
              title: 'Warning Sign or Deadline',
              detail: content,
              isUrgent: true,
            });
          }
        }
      }
    }
  }

  // Backward compatibility mappings
  const threePoints = actionItems.slice(0, 3).map((item) => ({
    title: item.title,
    detail: item.detail,
  }));

  const keyActionItems = actionItems.map((item) => ({
    action: `${item.title}: ${item.detail}`,
    priority: (item.priority || 'routine') as 'immediate' | 'routine',
    timing: item.timing,
  }));

  // Simplified Terms (if present in output)
  const simplifiedTerms: Array<{ originalTerm: string; simpleMeaning: string }> = [];
  const wordsMatch = markdown.match(/###\s*WORDS[\s\S]*?(?=###|$)/i);
  if (wordsMatch) {
    const rawSection = wordsMatch[0].replace(/###\s*WORDS[^\n]*/i, '').trim();
    const lines = rawSection.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^(?:\*|-|\d+\.)\s*\*\*(.*?)\*\*[:\-]?\s*(.*)$/);
      if (match && match[1] && match[2]) {
        simplifiedTerms.push({
          originalTerm: match[1].trim(),
          simpleMeaning: match[2].trim(),
        });
      }
    }
  }

  // Questions For Doctor (if present in output)
  const questionsForDoctor: string[] = [];
  const questionsMatch = markdown.match(/###\s*QUESTIONS[\s\S]*?(?=###|$)/i);
  if (questionsMatch) {
    const rawSection = questionsMatch[0].replace(/###\s*QUESTIONS[^\n]*/i, '').trim();
    const lines = rawSection.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const clean = line.replace(/^(?:\d+\.|\*|-)\s*/, '').trim();
      if (clean) questionsForDoctor.push(clean);
    }
  }

  // Reassurance note
  let reassuranceNote = '';
  const reassuranceMatch = markdown.match(/###\s*REASSURANCE[\s\S]*?(?=###|$)/i);
  if (reassuranceMatch) {
    reassuranceNote = reassuranceMatch[0].replace(/###\s*REASSURANCE/i, '').trim();
  }

  return {
    summary,
    actionItems,
    redFlagsAndDeadlines,
    threePoints,
    keyActionItems,
    simplifiedTerms,
    questionsForDoctor,
    reassuranceNote,
    isStreamingComplete: isComplete,
  };
}
