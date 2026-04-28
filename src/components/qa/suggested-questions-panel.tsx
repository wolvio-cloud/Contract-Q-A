"use client";

import { SUGGESTED_QUESTIONS } from "./suggested-questions";

interface SuggestedQuestionsPanelProps {
  onPick: (question: string) => void;
}

export function SuggestedQuestionsPanel({ onPick }: SuggestedQuestionsPanelProps) {
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested</h3>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onPick(question)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
