#!/usr/bin/env node
import { chunkContract } from "../src/lib/rag/chunker.ts";

const contract = {
  id: "demo",
  contract_code: "C001",
  contract_type: "O&M",
  raw_text: [
    "ARTICLE I TERMS",
    "1.1 Availability guarantee is 96%.",
    "1.2 LD is 0.5% per shortfall point.",
    "ARTICLE II TERMINATION",
    "2.1 90-day notice required.",
  ].join("\n\n"),
  page_count: 5,
};

const chunks = chunkContract(contract);
if (chunks.length < 1) {
  throw new Error("Expected at least 1 chunk");
}

if (!chunks[0].section_title) {
  throw new Error("Expected section metadata to be populated");
}

console.log("chunker test passed", chunks.length);
