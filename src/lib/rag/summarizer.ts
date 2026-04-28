import { env } from "../env.ts";

export async function summarizeContract(rawText: string): Promise<string> {
  const truncated = rawText.slice(0, 24_000);

  if (!env.ANTHROPIC_API_KEY) {
    return truncated.slice(0, 1_200);
  }

  try {
    const ai = await import("ai");
    const anthropicMod = await import("@ai-sdk/anthropic");

    const response = await ai.generateText({
      model: anthropicMod.anthropic("claude-sonnet-4-5"),
      system: "Summarize renewable energy contracts in <=200 tokens with commercial terms and risk points.",
      prompt: `Summarize this contract for retrieval indexing. Keep exact terms and numeric values.\n\n${truncated}`,
      maxTokens: 300,
    });

    return response.text.trim();
  } catch {
    return truncated.slice(0, 1_200);
  }
}
