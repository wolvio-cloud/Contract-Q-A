import { extractCitationMarkers } from "./citations.ts";
import type { RetrievalChunk } from "./retriever.ts";

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function sentenceHasCitation(sentence: string): boolean {
  return /\[\d+\]/.test(sentence);
}

export function enforceCitationDiscipline(answer: string, chunks: RetrievalChunk[]): {
  text: string;
  citations: ReturnType<typeof extractCitationMarkers>;
  guarded: boolean;
} {
  const citations = extractCitationMarkers(answer, chunks);
  const sentences = answer.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  const unsupported = sentences.filter((s) => !sentenceHasCitation(s));

  if (sentences.length === 0 || unsupported.length === 0) {
    return { text: answer, citations, guarded: false };
  }

  const normalized = `${answer}\n\nThe retrieved contracts don't fully address this. The relevant clauses I found suggest caution before relying on uncited claims.`;
  const normalizedCitations = extractCitationMarkers(normalized, chunks);
  return {
    text: normalized,
    citations: normalizedCitations,
    guarded: true,
  };
}
