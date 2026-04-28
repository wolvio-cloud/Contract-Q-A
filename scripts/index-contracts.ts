#!/usr/bin/env node
import { indexContracts } from "../src/lib/rag/indexer.ts";
import type { ContractRecord } from "../src/lib/rag/types.ts";
import { hasSupabaseConfig, supabase } from "../src/lib/supabase/service.ts";
import { logger } from "../src/lib/logger.ts";

function buildSampleContracts(): ContractRecord[] {
  const baseText = [
    "ARTICLE I DEFINITIONS",
    "1.1 Availability means the proportion of turbines available for operation.",
    "1.2 Contract Year means a continuous twelve-month period from PAC.",
    "ARTICLE II SERVICE LEVELS",
    "2.1 Contractor shall ensure monthly availability of 96%.",
    "2.2 Where availability falls below 96%, LD applies at 0.5% monthly fee per percentage point.",
    "ARTICLE III TERMINATION",
    "3.1 Either party may terminate for convenience with 90 days written notice.",
    "3.2 Material breach uncured for 30 days may trigger immediate termination.",
    "ARTICLE IV PRICE ESCALATION",
    "4.1 Fees shall be indexed to WPI annually every April.",
  ].join("\n\n");

  return Array.from({ length: 7 }, (_, index) => {
    const id = `00000000-0000-0000-0000-00000000010${index}`;
    const code = `C00${index + 1}`;

    return {
      id,
      contract_code: code,
      contract_type: index % 2 === 0 ? "O&M" : "Service",
      raw_text: `${baseText}\n\n5.1 Payment milestone for ${code} includes 30% at PAC and 70% at FAC.`,
      page_count: 20,
    } satisfies ContractRecord;
  });
}

async function fetchContracts(contractId?: string): Promise<ContractRecord[]> {
  if (!hasSupabaseConfig || !supabase) {
    return buildSampleContracts();
  }

  let query = supabase
    .from("contracts")
    .select("id, contract_code, contract_type, raw_text, page_count, spans")
    .order("contract_code", { ascending: true });

  if (contractId) {
    query = query.eq("id", contractId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as ContractRecord[];
}

async function main(): Promise<void> {
  const argContractId = process.argv.find((arg) => arg.startsWith("--contract-id="));
  const contractId = argContractId?.split("=")[1];

  const contracts = await fetchContracts(contractId);
  if (contracts.length === 0) {
    console.log("No contracts found to index.");
    return;
  }

  const startedAt = Date.now();
  const output = await indexContracts(contracts);

  console.log("\n=== Indexing Report ===");
  console.log(`Contracts indexed: ${contracts.length}`);
  console.log(`Total chunks generated: ${output.results.reduce((sum, item) => sum + item.chunkCount, 0)}`);
  console.log(`Total embedding cost (USD): ${output.totalCostUsd.toFixed(6)}`);
  console.log(`Total duration (ms): ${Date.now() - startedAt}`);

  console.log("\nChunk size histogram (tokens):");
  for (const [bucket, count] of Object.entries(output.histogram)) {
    console.log(`${bucket.padEnd(8)} ${"#".repeat(Math.min(40, count))} (${count})`);
  }

  console.log("\nClause-aware vs naive token chunk samples:");
  for (const sample of output.sampleComparison.slice(0, 2)) {
    console.log(`\nContract ${sample.contractCode}`);
    console.log("- Clause-aware:");
    sample.clauseAware.forEach((item, idx) => console.log(`  ${idx + 1}. ${item.replace(/\n/g, " ").slice(0, 160)}...`));
    console.log("- Naive token:");
    sample.naive.forEach((item, idx) => console.log(`  ${idx + 1}. ${item.replace(/\n/g, " ").slice(0, 160)}...`));
  }

  logger.info({
    operation: "rag.index.run",
    contracts_indexed: contracts.length,
    chunk_total: output.results.reduce((sum, item) => sum + item.chunkCount, 0),
    cost_usd: Number(output.totalCostUsd.toFixed(8)),
    duration_ms: Date.now() - startedAt,
  });
}

main().catch((error: unknown) => {
  logger.error({ operation: "rag.index.error", error }, "Indexing failed");
  process.exitCode = 1;
});
