"use client";

import { useMemo, useState } from "react";
import { useChat } from "ai/react";
import { ContractsList } from "./contracts-list";
import { MessageList } from "./message-list";
import { SuggestedQuestionsPanel } from "./suggested-questions-panel";
import type { QaDoneData } from "./types";

interface ChatInterfaceProps {
  contracts: Array<{ code: string; type: string }>;
}

export function ChatInterface({ contracts }: ChatInterfaceProps) {
  const [doneByMessageId, setDoneByMessageId] = useState<Record<string, QaDoneData | undefined>>({});

  const { messages, input, setInput, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/qa",
    onResponse: async (response) => {
      const text = await response.text();
      const lines = text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
      const done = lines.find((item) => item.type === "done") as QaDoneData | undefined;

      if (done) {
        setDoneByMessageId((previous) => {
          const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
          if (!lastAssistant) {
            return previous;
          }
          return { ...previous, [lastAssistant.id]: done };
        });
      }
    },
  });

  const shellClass = useMemo(() => "grid h-[calc(100vh-6rem)] grid-cols-1 md:grid-cols-[300px_1fr]", []);

  return (
    <div className={shellClass}>
      <aside className="border-r border-slate-200 p-4">
        <ContractsList contracts={contracts} />
        <SuggestedQuestionsPanel onPick={(question) => setInput(question)} />
      </aside>

      <section className="flex h-full flex-col">
        <MessageList messages={messages} doneByMessageId={doneByMessageId} isStreaming={isLoading} />

        <form
          className="border-t border-slate-200 p-4"
          onSubmit={(event) => {
            handleSubmit(event);
          }}
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your question..."
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={isLoading}
            />
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" disabled={isLoading}>
              ↑
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
