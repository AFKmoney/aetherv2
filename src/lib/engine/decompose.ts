// AetherOS Cognitive Decomposer + Complexity Analysis
// Port of aether-engine's decompose.rs — Rule-based classifier + 4 decomposition strategies

import type { Complexity, SubQuestion } from './types';

// Complexity signals — same catalog as aether-engine
const COMPLEXITY_SIGNALS = [
  'if ', 'then ', 'step by step', 'compare', 'write a function',
  'implement', 'design', 'architecture', 'refactor', 'analyze',
  'explain why', 'how does', 'what if', 'optimize', 'debug',
  'create a', 'build a', 'develop', 'integrate', 'migrate',
  'evaluate', 'synthesize', 'what are the differences',
  'pros and cons', 'advantages and disadvantages',
];

export function analyzeComplexity(query: string): Complexity {
  const lower = query.toLowerCase();
  const questionMarks = (query.match(/\?/g) || []).length;
  const signalCount = COMPLEXITY_SIGNALS.filter(s => lower.includes(s)).length;

  if (questionMarks > 1 || signalCount >= 3) return 'complex';
  if (signalCount >= 1 || questionMarks === 1) return 'moderate';
  return 'simple';
}

// Four decomposition strategies from aether-engine
export function decompose(query: string): SubQuestion[] {
  const lower = query.toLowerCase();
  const subQuestions: SubQuestion[] = [];
  let idx = 0;

  // Strategy 1: Conjunction split — split on " and " when multiple ? present
  if ((query.match(/\?/g) || []).length > 1 && lower.includes(' and ')) {
    const parts = query.split(/\s+and\s+/i);
    for (const part of parts) {
      subQuestions.push({
        id: `sub_${idx++}`,
        question: part.trim(),
        answer: '',
        dependencies: [],
      });
    }
    // Add synthesis step
    subQuestions.push({
      id: `sub_synth`,
      question: `Synthesize the answers to all sub-questions into a coherent response.`,
      answer: '',
      dependencies: subQuestions.map(s => s.id),
    });
    return subQuestions;
  }

  // Strategy 2: Numbered steps — each "N." line becomes a chained sub-question
  const numberedMatch = query.match(/\d+\.\s+/g);
  if (numberedMatch && numberedMatch.length >= 2) {
    const steps = query.split(/\d+\.\s+/).filter(s => s.trim());
    let prevId = '';
    for (const step of steps) {
      const id = `sub_${idx++}`;
      subQuestions.push({
        id,
        question: step.trim(),
        answer: '',
        dependencies: prevId ? [prevId] : [],
      });
      prevId = id;
    }
    subQuestions.push({
      id: `sub_synth`,
      question: `Combine all step results into a final comprehensive answer.`,
      answer: '',
      dependencies: subQuestions.map(s => s.id),
    });
    return subQuestions;
  }

  // Strategy 3: Comparison — "compare X and Y" → characteristics of X, characteristics of Y, synthesis
  const compareMatch = lower.match(/compare\s+(.+?)\s+(?:and|with|vs|versus)\s+(.+)/i);
  if (compareMatch) {
    const [, subjectA, subjectB] = compareMatch;
    subQuestions.push({
      id: `sub_${idx++}`,
      question: `What are the key characteristics and features of ${subjectA.trim()}?`,
      answer: '',
      dependencies: [],
    });
    subQuestions.push({
      id: `sub_${idx++}`,
      question: `What are the key characteristics and features of ${subjectB.trim()}?`,
      answer: '',
      dependencies: [],
    });
    subQuestions.push({
      id: `sub_synth`,
      question: `Compare and contrast ${subjectA.trim()} and ${subjectB.trim()}, highlighting key differences, similarities, and recommendations.`,
      answer: '',
      dependencies: subQuestions.map(s => s.id),
    });
    return subQuestions;
  }

  // Strategy 4: Generic fallback — context → components → synthesis
  subQuestions.push({
    id: `sub_${idx++}`,
    question: `Identify the key context and background needed to answer: "${query}"`,
    answer: '',
    dependencies: [],
  });
  subQuestions.push({
    id: `sub_${idx++}`,
    question: `Break down the main components or aspects of: "${query}"`,
    answer: '',
    dependencies: [`sub_0`],
  });
  subQuestions.push({
    id: `sub_synth`,
    question: `Based on the context and components identified, provide a comprehensive answer to: "${query}"`,
    answer: '',
    dependencies: subQuestions.map(s => s.id),
  });

  return subQuestions;
}

// Build sub-question prompt with dependency injection
export function buildSubPrompt(sub: SubQuestion, answers: Map<string, string>): string {
  let prompt = sub.question;

  if (sub.dependencies.length > 0) {
    const depAnswers = sub.dependencies
      .map(id => answers.get(id))
      .filter(Boolean);

    if (depAnswers.length > 0) {
      prompt = `# AETHER COGNITIVE PIPELINE — SUB-QUESTION\n\nPrevious findings:\n${depAnswers.join('\n\n')}\n\nNow answer: ${prompt}\n\nProvide a clear, concise answer.`;
    }
  } else {
    prompt = `# AETHER COGNITIVE PIPELINE — SUB-QUESTION\n\nFocus ONLY on this sub-question: ${prompt}\n\nProvide a clear, concise answer.`;
  }

  return prompt;
}
