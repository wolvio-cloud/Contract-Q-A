#!/usr/bin/env node
import { retrieve } from "../src/lib/rag/retriever.ts";
import { demoCorpus } from "../src/lib/rag/demo-corpus.ts";

const result = await retrieve("Compare termination notice periods across all O&M contracts", {
  corpus: demoCorpus,
  matchThreshold: 0.1,
  matchCount: 20,
});

if (!result.classification.suggested_contract_types?.includes("O&M")) {
  throw new Error("Expected O&M filter classification");
}

const nonOm = result.chunks.find((chunk) => chunk.contract_type !== "O&M");
if (nonOm) {
  throw new Error(`Unexpected non-O&M chunk in filtered results: ${nonOm.contract_code}`);
}

console.log("retriever filter test passed", result.chunks.length);
