"use client";

import { MarkdownRenderer } from "./markdown-renderer";
import { RetrievalDetailsCollapsed } from "./retrieval-details-collapsed";
import type { QaDoneData } from "./types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  doneByMessageId: Record<string, QaDoneData | undefined>;
  isStreaming: boolean;
}

export function MessageList({ messages, doneByMessageId, isStreaming }: MessageListProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
      {messages.map((message) => {
        const isUser = message.role === "user";
        const done = doneByMessageId[message.id];

        return (
          <div key={message.id} className={`max-w-3xl rounded-lg p-3 ${isUser ? "ml-auto bg-blue-600 text-white" : "bg-slate-100"}`}>
            {isUser ? (
              <p>{message.content}</p>
            ) : (
              <>
                <MarkdownRenderer text={message.content} citations={done?.citations ?? []} />
                {done ? <RetrievalDetailsCollapsed data={done} /> : null}
              </>
            )}
          </div>
        );
      })}
      {isStreaming ? <p className="text-xs text-slate-500">Streaming response…</p> : null}
    </div>
  );
}
