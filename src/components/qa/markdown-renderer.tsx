"use client";

import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";
import { CitationBadge } from "./citation-badge";
import type { QaCitation } from "./types";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface MarkdownRendererProps {
  text: string;
  citations: QaCitation[];
}

function renderWithCitations(text: string, citations: QaCitation[]): Array<string | QaCitation> {
  const out: Array<string | QaCitation> = [];
  const regex = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match) {
    const idx = Number(match[1]);
    const citation = citations.find((item) => item.marker === idx);

    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }

    out.push(citation ?? match[0]);
    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }

  return out;
}

export function MarkdownRenderer({ text, citations }: MarkdownRendererProps) {
  const parts = renderWithCitations(text, citations);

  return (
    <div className="space-y-2">
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <ReactMarkdown key={`md-${index}`} remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
            {part}
          </ReactMarkdown>
        ) : (
          <CitationBadge key={`cite-${part.marker}-${index}`} citation={part} />
        ),
      )}
    </div>
  );
}
