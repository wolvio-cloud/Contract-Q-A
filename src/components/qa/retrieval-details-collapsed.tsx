"use client";

import { useState } from "react";
import type { QaDoneData } from "./types";

interface RetrievalDetailsCollapsedProps {
  data: QaDoneData;
}

export function RetrievalDetailsCollapsed({ data }: RetrievalDetailsCollapsedProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
      <button type="button" className="font-medium" onClick={() => setOpen((value) => !value)}>
        Retrieved {data.retrieved_chunks.length} sources {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {data.retrieved_chunks.map((chunk) => (
            <li key={chunk.id}>
              {chunk.contract_code} · {chunk.clause_reference ?? "Clause"} · p.{chunk.page_number}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
