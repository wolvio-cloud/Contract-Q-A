#!/usr/bin/env node
import { POST } from "../src/app/api/qa/route.ts";

interface TestCase {
  label: string;
  question: string;
}

const tests: TestCase[] = [
  { label: "Q1", question: "What's the availability guarantee in C001?" },
  { label: "Q2", question: "Compare termination notice periods across all O&M contracts" },
  { label: "Q3", question: "Total LD exposure if availability drops 1 percentage point" },
];

async function readNdjson(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function run(): Promise<void> {
  for (const test of tests) {
    const req = new Request("http://localhost/api/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: `${test.label.toLowerCase()}-conv`,
        messages: [{ role: "user", content: test.question }],
      }),
    });

    const response = await POST(req);
    const events = await readNdjson(response);
    const done = events.find((evt) => evt.type === "done") ?? {};

    console.log("\n================================================");
    console.log(`${test.label}: ${test.question}`);
    console.log("Streamed response (markdown):");
    console.log(String(done.text ?? ""));
    console.log("\nStructured citations:");
    console.log(JSON.stringify(done.citations ?? [], null, 2));
    console.log(`Cost USD: ${String(done.cost_usd ?? "n/a")}`);
    console.log(`Correlation ID: ${String(done.correlation_id ?? "n/a")}`);
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
