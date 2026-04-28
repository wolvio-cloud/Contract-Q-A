#!/usr/bin/env node
import { buildSystemPrompt } from "../src/lib/rag/system-prompt.ts";
import { enforceCitationDiscipline } from "../src/lib/rag/answer-guard.ts";
import { classifyQuery } from "../src/lib/rag/query-classifier.ts";
import { demoCorpus } from "../src/lib/rag/demo-corpus.ts";

const q = "Compare termination notice periods across all O&M contracts";
const cls = classifyQuery(q);
const prompt = buildSystemPrompt("[1] (Contract C001, Clause 2.1, p.12): \"Availability guarantee is 96%.\"", cls, q);

if (!prompt.includes("CITATION DISCIPLINE")) {
  throw new Error("Prompt missing citation rules");
}

const answer = "Termination varies by contract. It can be 90 days [1].";
const guarded = enforceCitationDiscipline(answer, demoCorpus);
if (!guarded.guarded) {
  throw new Error("Expected citation guard to trigger for uncited sentence");
}

console.log("prompt guard test passed");
