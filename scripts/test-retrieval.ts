#!/usr/bin/env node
import { retrieve, type RetrievalChunk } from "../src/lib/rag/retriever.ts";

const corpus: RetrievalChunk[] = [
  {
    id: "1", contract_id: "c001", contract_code: "C001", contract_type: "O&M", clause_reference: "Clause 2.1", section_title: "Availability", page_number: 12,
    chunk_text: "Monthly availability guarantee is 96%. If below threshold, liquidated damages apply.", similarity: 0,
  },
  {
    id: "2", contract_id: "c001", contract_code: "C001", contract_type: "O&M", clause_reference: "Clause 7.2", section_title: "Liquidated Damages", page_number: 18,
    chunk_text: "Liquidated damages are 0.5% of monthly fee per percentage point of availability shortfall, capped at 10% annual fee.", similarity: 0,
  },
  {
    id: "3", contract_id: "c002", contract_code: "C002", contract_type: "O&M", clause_reference: "Clause 9.1", section_title: "Termination", page_number: 22,
    chunk_text: "Either party may terminate for convenience by giving 90 days written notice.", similarity: 0,
  },
  {
    id: "4", contract_id: "c003", contract_code: "C003", contract_type: "Service", clause_reference: "Clause 8.2", section_title: "Termination", page_number: 14,
    chunk_text: "Termination notice period under this service contract is 60 days.", similarity: 0,
  },
  {
    id: "5", contract_id: "c004", contract_code: "C004", contract_type: "Supply", clause_reference: "Clause 4.1", section_title: "Escalation", page_number: 9,
    chunk_text: "Contract price is indexed to WPI once every contract year.", similarity: 0,
  },
  {
    id: "6", contract_id: "c005", contract_code: "C005", contract_type: "Admin", clause_reference: "Clause 5.3", section_title: "Escalation", page_number: 6,
    chunk_text: "Administrative service fee adjusts based on CPI only.", similarity: 0,
  },
  {
    id: "7", contract_id: "c006", contract_code: "C006", contract_type: "O&M", clause_reference: "Clause 2.2", section_title: "Availability", page_number: 11,
    chunk_text: "Availability guarantee is 95.5% with quarterly performance review.", similarity: 0,
  },
  {
    id: "8", contract_id: "c007", contract_code: "C007", contract_type: "O&M", clause_reference: "Clause 7.5", section_title: "Liquidated Damages", page_number: 17,
    chunk_text: "For each 1% availability drop, LD equals 0.4% of monthly fee, capped at 8% annual fee.", similarity: 0,
  },
  {
    id: "9", contract_id: "c007", contract_code: "C007", contract_type: "O&M", clause_reference: "Clause 10.2", section_title: "Termination", page_number: 23,
    chunk_text: "Termination for convenience requires 120 days prior written notice.", similarity: 0,
  },
  {
    id: "10", contract_id: "c002", contract_code: "C002", contract_type: "O&M", clause_reference: "Clause 4.6", section_title: "Escalation", page_number: 13,
    chunk_text: "Base fee escalates in line with WPI every April, subject to a 5% yearly cap.", similarity: 0,
  },
];

const queries = [
  "What's the availability guarantee in C001?",
  "Compare termination notice periods across all O&M contracts",
  "Total LD exposure if availability drops 1 percentage point",
  "Which contracts have WPI escalation?",
  "Tell me about renewable energy",
];

async function run(): Promise<void> {
  for (const question of queries) {
    const startedAt = Date.now();
    const result = await retrieve(question, { corpus, matchThreshold: 0.1, matchCount: 20 });

    console.log("\n================================================");
    console.log(`Query: ${question}`);
    console.log(`Classification: ${JSON.stringify(result.classification)}`);
    console.log(`Correlation ID: ${result.correlationId}`);
    console.log(`Retrieval time: ${Date.now() - startedAt}ms`);

    console.log("\nTop-8 before rerank (vector/lexical order):");
    result.vectorOrdered.forEach((chunk, index) => {
      console.log(
        `${index + 1}. ${chunk.contract_code} ${chunk.clause_reference ?? "n/a"} sim=${chunk.similarity.toFixed(4)} :: ${chunk.chunk_text.slice(0, 95)}...`,
      );
    });

    console.log("\nTop-8 after rerank:");
    result.chunks.forEach((chunk, index) => {
      console.log(
        `${index + 1}. ${chunk.contract_code} ${chunk.clause_reference ?? "n/a"} sim=${chunk.similarity.toFixed(4)} :: ${chunk.chunk_text.slice(0, 95)}...`,
      );
    });
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
