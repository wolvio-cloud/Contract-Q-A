"use client";

import Link from "next/link";
import type { QaCitation } from "./types";

interface CitationBadgeProps {
  citation: QaCitation;
}

export function CitationBadge({ citation }: CitationBadgeProps) {
  const clause = citation.clause_ref?.replace(/^Clause\s+/i, "") ?? "n/a";
  const href = `/contracts/${citation.contract_code}?clause=${encodeURIComponent(clause)}&page=${citation.page}`;

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-md border border-slate-300 px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
      title={citation.snippet}
    >
      [{citation.contract_code} cl {clause} p.{citation.page}]
    </Link>
  );
}
