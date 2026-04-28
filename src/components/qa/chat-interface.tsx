"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ContractsList } from "./contracts-list";
import { MessageList } from "./message-list";
import { SuggestedQuestionsPanel } from "./suggested-questions-panel";
import { DEMO_MODE_STORAGE_KEY, DEMO_RESPONSES } from "./demo-mode";
import type { QaDoneData } from "./types";

interface ChatInterfaceProps {
  contracts: Array<{ code: string; type: string }>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function ChatInterface({ contracts }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [doneByMessageId, setDoneByMessageId] = useState<Record<string, QaDoneData | undefined>>({});
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [showContractPane, setShowContractPane] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const enabled = localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "1";
    setDemoMode(enabled);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowContractPane((prev) => !prev);
      }
      if (event.key === "Escape") {
        setInput("");
        setError(null);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function streamDemo(question: string, assistantId: string): Promise<void> {
    const canned = DEMO_RESPONSES[question];
    if (!canned) {
      return;
    }

    const tokens = canned.text.split(/(\s+)/).filter(Boolean);
    let text = "";
    const started = Date.now();

    for (const token of tokens) {
      text += token;
      setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? { ...msg, content: text } : msg)));
      await new Promise((resolve) => setTimeout(resolve, 18));
    }

    const elapsed = Date.now() - started;
    if (elapsed < 800) {
      await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
    }

    setDoneByMessageId((prev) => ({ ...prev, [assistantId]: canned }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const question = input.trim();
    if (!question || isLoading) {
      return;
    }

    const userId = uid();
    const assistantId = uid();

    setMessages((prev) => [...prev, { id: userId, role: "user", content: question }, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setIsLoading(true);
    setBreadcrumbs(null);

    const breadcrumbTimeout = setTimeout(() => {
      setBreadcrumbs("Searching contracts… Retrieving clauses… Composing answer…");
    }, 5000);

    try {
      if (demoMode && DEMO_RESPONSES[question]) {
        await streamDemo(question, assistantId);
        return;
      }

      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: `conv_${uid()}`, messages: [{ role: "user", content: question }] }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Network failure");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // TODO(qa-phase-5): Move NDJSON parser into shared stream utility.
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          const eventPayload = JSON.parse(line) as Record<string, unknown>;
          if (eventPayload.type === "token") {
            const token = String(eventPayload.token ?? "");
            setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + token } : msg)));
          }
          if (eventPayload.type === "done") {
            setDoneByMessageId((prev) => ({ ...prev, [assistantId]: eventPayload as unknown as QaDoneData }));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load response");
    } finally {
      clearTimeout(breadcrumbTimeout);
      setIsLoading(false);
      setBreadcrumbs(null);
    }
  }

  const shellClass = useMemo(() => "grid h-[calc(100vh-6rem)] grid-cols-1 md:grid-cols-[300px_1fr]", []);

  return (
    <div className={shellClass}>
      {showContractPane ? (
        <aside className="border-r border-slate-200 p-4">
          <ContractsList contracts={contracts} />
          <div className="mt-4 flex items-center justify-between rounded-md border border-slate-300 p-2 text-xs">
            <span>Demo mode</span>
            <button
              type="button"
              className={`rounded px-2 py-1 ${demoMode ? "bg-green-100" : "bg-slate-100"}`}
              onClick={() => {
                const next = !demoMode;
                setDemoMode(next);
                localStorage.setItem(DEMO_MODE_STORAGE_KEY, next ? "1" : "0");
              }}
            >
              {demoMode ? "On" : "Off"}
            </button>
          </div>
          <SuggestedQuestionsPanel onPick={(question) => setInput(question)} />
        </aside>
      ) : null}

      <section className="flex h-full flex-col">
        {messages.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            Ask portfolio-wide contract questions and click citations to jump to source clauses.
          </div>
        ) : (
          <MessageList messages={messages} doneByMessageId={doneByMessageId} isStreaming={isLoading} />
        )}

        {breadcrumbs ? <p className="px-4 text-xs text-slate-500">{breadcrumbs}</p> : null}
        {error ? (
          <div className="px-4 pb-2 text-sm text-red-600">
            {error} <button onClick={() => setError(null)} className="underline">Dismiss</button>
          </div>
        ) : null}

        <form className="border-t border-slate-200 p-4" onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
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
