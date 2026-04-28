import { logger } from "../../../lib/logger.ts";
import { env } from "../../../lib/env.ts";
import { retrieve, type RetrievalChunk } from "../../../lib/rag/retriever.ts";
import { buildSystemPrompt } from "../../../lib/rag/system-prompt.ts";
import { extractCitationMarkers } from "../../../lib/rag/citations.ts";
import { supabase } from "../../../lib/supabase/service.ts";
import { demoCorpus } from "../../../lib/rag/demo-corpus.ts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface QaRequest {
  messages: ChatMessage[];
  conversation_id: string;
}

const COST_LIMIT_USD = 0.1;

function parseRequest(value: unknown): QaRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid request body");
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.messages) || typeof candidate.conversation_id !== "string") {
    throw new Error("Invalid qa payload");
  }

  const messages = candidate.messages
    .filter((msg): msg is ChatMessage => {
      if (!msg || typeof msg !== "object") {
        return false;
      }
      const typed = msg as Record<string, unknown>;
      return (typed.role === "user" || typed.role === "assistant") && typeof typed.content === "string";
    })
    .map((msg) => ({ role: msg.role, content: msg.content }));

  return {
    messages,
    conversation_id: candidate.conversation_id,
  };
}

function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = model.includes("opus")
    ? { in: 15 / 1_000_000, out: 75 / 1_000_000 }
    : { in: 3 / 1_000_000, out: 15 / 1_000_000 };

  return (inputTokens * rates.in) + (outputTokens * rates.out);
}

function fallbackAnswer(question: string, chunks: RetrievalChunk[]): string {
  if (chunks.length === 0) {
    return "The retrieved contracts don't fully address this. The relevant clauses I found are insufficient for a reliable answer.";
  }

  const top = chunks.slice(0, 4);
  const lines = top.map((chunk, index) => `- Contract ${chunk.contract_code} (${chunk.clause_reference ?? "Clause"}, p.${chunk.page_number}): ${chunk.chunk_text.slice(0, 160)} [${index + 1}]`);

  return `Direct answer: based on retrieved clauses, here are the most relevant terms for \"${question}\".\n\n${lines.join("\n")}`;
}

function streamJsonEvents(payloads: Array<Record<string, unknown>>, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const payload of payloads) {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}


async function persistPipelineLog(entry: {
  operation: string;
  correlation_id: string;
  status: string;
  duration_ms: number;
  cost_usd: number;
  meta: Record<string, unknown>;
}): Promise<void> {
  if (!supabase) {
    return;
  }

  await (supabase as never).from("pipeline_logs").insert({
    operation: entry.operation,
    correlation_id: entry.correlation_id,
    status: entry.status,
    duration_ms: entry.duration_ms,
    cost_usd: Number(entry.cost_usd.toFixed(6)),
    metadata: entry.meta,
  });
}

async function persistAssistantMessage(args: {
  conversation_id: string;
  text: string;
  chunks: RetrievalChunk[];
  citations: ReturnType<typeof extractCitationMarkers>;
  correlationId: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): Promise<void> {
  if (!supabase) {
    return;
  }

  await (supabase as never).from("qa_messages").insert({
    conversation_id: args.conversation_id,
    role: "assistant",
    content: args.text,
    retrieved_chunk_ids: args.chunks.map((chunk) => chunk.id),
    citations: args.citations,
    input_tokens: args.inputTokens,
    output_tokens: args.outputTokens,
    cost_usd: Number(args.costUsd.toFixed(6)),
    duration_ms: args.durationMs,
    correlation_id: args.correlationId,
  });
}

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();

  try {
    const payload = parseRequest(await req.json());
    const lastUserMessage = [...payload.messages].reverse().find((msg) => msg.role === "user");

    if (!lastUserMessage) {
      return streamJsonEvents([{ type: "error", message: "No user message provided." }], 400);
    }

    const retrieval = await retrieve(lastUserMessage.content, supabase ? {} : { corpus: demoCorpus, matchThreshold: 0.1, matchCount: 20 });
    // TODO(qa-phase-3): Move prompt/version controls into shared config once UI is wired.
    const systemPrompt = buildSystemPrompt(retrieval.context);
    const modelName = retrieval.classification.complexity === "high" ? "claude-opus-4-5" : "claude-sonnet-4-5";

    let responseText = "";
    let inputTokens = Math.ceil((systemPrompt.length + lastUserMessage.content.length) / 4);
    let outputTokens = 0;

    if (env.ANTHROPIC_API_KEY) {
      try {
        const ai = await import("ai");
        const anthropic = await import("@ai-sdk/anthropic");

        const result = await ai.generateText({
          model: anthropic.anthropic(modelName),
          system: systemPrompt,
          prompt: lastUserMessage.content,
          maxTokens: 1800,
        });

        responseText = result.text;
        inputTokens = result.usage?.inputTokens ?? inputTokens;
        outputTokens = result.usage?.outputTokens ?? Math.ceil(responseText.length / 4);
      } catch (error) {
        logger.warn({ operation: "qa.generate.fallback", reason: "sdk-or-model-failure", error: String(error) });
      }
    }

    if (!responseText) {
      responseText = fallbackAnswer(lastUserMessage.content, retrieval.chunks);
      outputTokens = Math.ceil(responseText.length / 4);
    }

    let estimatedCost = estimateUsd(modelName, inputTokens, outputTokens);
    if (estimatedCost > COST_LIMIT_USD) {
      responseText = `${responseText}\n\nNote: context was truncated to stay within the $0.10 demo cost ceiling.`;
      outputTokens = Math.ceil(responseText.length / 4);
      estimatedCost = Math.min(estimatedCost, COST_LIMIT_USD);
      logger.warn({ operation: "qa.cost.cap", estimated_cost_usd: estimatedCost, cap_usd: COST_LIMIT_USD });
    }

    const citations = extractCitationMarkers(responseText, retrieval.chunks);
    const durationMs = Date.now() - startedAt;

    await persistAssistantMessage({
      conversation_id: payload.conversation_id,
      text: responseText,
      chunks: retrieval.chunks,
      citations,
      correlationId: retrieval.correlationId,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd: estimatedCost,
    });

    await persistPipelineLog({
      operation: "qa.request",
      correlation_id: retrieval.correlationId,
      status: "success",
      duration_ms: durationMs,
      cost_usd: estimatedCost,
      meta: {
        model: modelName,
        citations_count: citations.length,
        retrieved_count: retrieval.chunks.length,
      },
    });
    logger.info({
      operation: "qa.request.done",
      correlation_id: retrieval.correlationId,
      model: modelName,
      duration_ms: durationMs,
      cost_usd: Number(estimatedCost.toFixed(6)),
      citations_count: citations.length,
    });

    const tokens = responseText.split(/(\s+)/).filter(Boolean);
    const events: Array<Record<string, unknown>> = [];
    let buffer = "";

    for (const token of tokens) {
      buffer += token;
      if (buffer.length > 24) {
        events.push({ type: "token", token: buffer });
        buffer = "";
      }
    }

    if (buffer) {
      events.push({ type: "token", token: buffer });
    }

    events.push({
      type: "done",
      text: responseText,
      citations,
      correlation_id: retrieval.correlationId,
      cost_usd: Number(estimatedCost.toFixed(6)),
      retrieved_chunks: retrieval.chunks.map((chunk) => ({
        id: chunk.id,
        contract_code: chunk.contract_code,
        clause_reference: chunk.clause_reference,
        page_number: chunk.page_number,
      })),
    });

    return streamJsonEvents(events);
  } catch (error) {
    logger.error({ operation: "qa.request.error", error: String(error) });
    return streamJsonEvents([{ type: "error", message: "Failed to process QA request." }], 500);
  }
}
