import crypto from "node:crypto";
import type { ChunkDraft, ContractRecord } from "./types.ts";

interface Segment {
  start: number;
  end: number;
  header: string;
  text: string;
}

const CLAUSE_HEADER = /^\s*(\d+\.\d+(?:\.\d+)?)\s+(.+)$/m;
const STRUCTURE_HEADER = /^\s*(ARTICLE\s+[IVX]+|Section\s+\d+(?:\.\d+)*|Clause\s+\d+(?:\.\d+)*)\b.*$/gim;
const CAPS_HEADER = /^\s*([A-Z][A-Z\s]{4,})\s*$/gm;

const MIN_TOKENS = 50;
const MAX_TOKENS = 1200;
const OVERLAP_TOKENS = 150;

const sentenceBoundary = /(?<=[.!?])\s+(?=[A-Z0-9])/g;

function roughTokenCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getPageFromOffset(contract: ContractRecord, offset: number): number {
  if (contract.spans && contract.spans.length > 0) {
    const hit = contract.spans.find((span) => offset >= span.start && offset <= span.end);
    if (hit) {
      return hit.page;
    }
  }

  const pageCount = Math.max(1, contract.page_count);
  const length = Math.max(1, contract.raw_text.length);
  return Math.min(pageCount, Math.max(1, Math.ceil(((offset + 1) / length) * pageCount)));
}

function extractHeaders(text: string): number[] {
  const starts = new Set<number>([0]);

  for (const regex of [STRUCTURE_HEADER, CAPS_HEADER]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(text);
    while (match) {
      starts.add(match.index);
      match = regex.exec(text);
    }
  }

  return [...starts].sort((a, b) => a - b);
}

function detectClauseBoundaries(text: string): Segment[] {
  const offsets = extractHeaders(text);
  const segments: Segment[] = [];

  for (let i = 0; i < offsets.length; i += 1) {
    const start = offsets[i];
    const end = offsets[i + 1] ?? text.length;
    const snippet = text.slice(start, end).trim();
    if (!snippet) {
      continue;
    }

    const firstLine = snippet.split("\n")[0] ?? "";
    segments.push({
      start,
      end,
      header: firstLine.trim(),
      text: snippet,
    });
  }

  return segments;
}

function parseClauseReference(header: string): string | null {
  const clauseMatch = header.match(CLAUSE_HEADER);
  if (clauseMatch) {
    return `Clause ${clauseMatch[1]}`;
  }

  const structuredMatch = header.match(/(ARTICLE\s+[IVX]+|Section\s+\d+(?:\.\d+)*|Clause\s+\d+(?:\.\d+)*)/i);
  return structuredMatch ? structuredMatch[1] : null;
}

function splitOversizedSegment(segment: Segment): string[] {
  const sentences = segment.text.split(sentenceBoundary).filter(Boolean);
  if (sentences.length <= 1) {
    return [segment.text];
  }

  const parts: string[] = [];
  let buffer: string[] = [];
  let tokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = roughTokenCount(sentence);
    if (tokens + sentenceTokens > MAX_TOKENS && buffer.length > 0) {
      const part = buffer.join(" ").trim();
      parts.push(part);

      const overlap: string[] = [];
      let overlapTokens = 0;
      for (let i = buffer.length - 1; i >= 0; i -= 1) {
        const t = roughTokenCount(buffer[i]);
        if (overlapTokens + t > OVERLAP_TOKENS) {
          break;
        }
        overlap.unshift(buffer[i]);
        overlapTokens += t;
      }

      buffer = overlap;
      tokens = overlapTokens;
    }

    buffer.push(sentence);
    tokens += sentenceTokens;
  }

  if (buffer.length > 0) {
    parts.push(buffer.join(" ").trim());
  }

  return parts;
}

function hashChunk(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function naiveTokenChunk(text: string, chunkSize = 300): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  return chunks;
}

export function chunkContract(contract: ContractRecord): ChunkDraft[] {
  const segments = detectClauseBoundaries(contract.raw_text);
  const draft: Omit<ChunkDraft, "chunk_index">[] = [];
  let currentSection: string | null = null;

  for (const segment of segments) {
    const clauseReference = parseClauseReference(segment.header);
    if (/^ARTICLE\s+[IVX]+|^Section\s+\d+|^[A-Z][A-Z\s]{4,}$/i.test(segment.header)) {
      currentSection = segment.header;
    }

    const split = roughTokenCount(segment.text) > MAX_TOKENS ? splitOversizedSegment(segment) : [segment.text];

    for (const part of split) {
      draft.push({
        contract_id: contract.id,
        contract_code: contract.contract_code,
        contract_type: contract.contract_type,
        chunk_kind: "clause",
        clause_reference: clauseReference,
        section_title: currentSection,
        page_number: getPageFromOffset(contract, segment.start),
        chunk_text: part,
        token_count: roughTokenCount(part),
        content_hash: hashChunk(`${contract.id}:${part}`),
      });
    }
  }

  const merged: Omit<ChunkDraft, "chunk_index">[] = [];
  for (let i = 0; i < draft.length; i += 1) {
    const current = draft[i];
    if (current.token_count >= MIN_TOKENS || i === draft.length - 1) {
      merged.push(current);
      continue;
    }

    const next = draft[i + 1];
    if (next) {
      merged.push({
        ...next,
        clause_reference: current.clause_reference ?? next.clause_reference,
        section_title: current.section_title ?? next.section_title,
        page_number: current.page_number,
        chunk_text: `${current.chunk_text}\n\n${next.chunk_text}`,
        token_count: current.token_count + next.token_count,
        content_hash: hashChunk(`${contract.id}:${current.chunk_text}:${next.chunk_text}`),
      });
      i += 1;
      continue;
    }

    merged.push(current);
  }

  return merged.map((item, chunk_index) => ({ ...item, chunk_index }));
}
