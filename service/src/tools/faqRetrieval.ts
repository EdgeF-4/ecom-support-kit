import type { FaqEntry, ToolResult } from "../types.js";

const STOPWORDS = new Set([
  "the", "and", "for", "are", "you", "your", "what", "how", "can", "does",
  "did", "with", "that", "this", "have", "has", "from", "about", "when",
  "will", "any", "our", "his", "her", "their", "they", "them",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function scoreEntry(
  f: FaqEntry,
  queryTerms: string[],
  query: string,
  topic: string | null
): number {
  let score = 0;
  if (topic && f.topic === topic) score += 5;
  for (const k of f.keywords) if (query.includes(k)) score += 2;
  const kwTokens = new Set(f.keywords.flatMap((k) => k.split(/\s+/)));
  for (const t of queryTerms) if (kwTokens.has(t)) score += 1;
  return score;
}

export interface FaqMatch {
  id: string;
  topic: string;
  question: string;
  answer: string;
  score: number;
}

export function makeFaqRetrieval(faq: FaqEntry[]) {
  return async function faqRetrieval(input: {
    query: string;
    topic?: string | null;
    limit?: number;
  }): Promise<ToolResult & { matches: FaqMatch[] }> {
    const query = (input.query || "").toLowerCase();
    const terms = tokenize(query);
    const ranked = faq
      .map((f) => ({ f, score: scoreEntry(f, terms, query, input.topic ?? null) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit ?? 3)
      .map((s) => ({
        id: s.f.id,
        topic: s.f.topic,
        question: s.f.question,
        answer: s.f.answer,
        score: Math.round(s.score * 100) / 100,
      }));

    if (!ranked.length) {
      return {
        matches: [],
        reply:
          "I could not find that in our FAQ. I can connect you with our team if you would like a hand.",
      };
    }

    return { matches: ranked, reply: ranked[0].answer };
  };
}
