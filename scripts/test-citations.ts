#!/usr/bin/env node
import { extractCitationMarkers } from "../src/lib/rag/citations.ts";
import { demoCorpus } from "../src/lib/rag/demo-corpus.ts";

const text = "LD applies based on availability shortfall [1][2].";
const citations = extractCitationMarkers(text, demoCorpus);
if (citations.length !== 2) {
  throw new Error(`Expected 2 citations but found ${citations.length}`);
}
console.log("citation test passed", citations.map((c) => c.contract_code).join(","));
