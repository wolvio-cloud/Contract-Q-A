import type { QaDoneData } from "./types";

export const DEMO_MODE_STORAGE_KEY = "qa-demo-mode";

const makeDone = (text: string): QaDoneData => ({
  text,
  citations: [
    {
      marker: 1,
      chunk_id: "2",
      contract_id: "c001",
      contract_code: "C001",
      clause_ref: "Clause 7.2",
      page: 18,
      snippet: "Liquidated damages are 0.5% monthly fee per percentage-point shortfall.",
    },
  ],
  correlation_id: `demo_${Date.now()}`,
  cost_usd: 0,
  retrieved_chunks: [{ id: "2", contract_code: "C001", clause_reference: "Clause 7.2", page_number: 18 }],
});

export const DEMO_RESPONSES: Record<string, QaDoneData> = {
  "What's our total LD exposure if availability drops 1pp across O&M contracts?": makeDone(
    "Estimated portfolio LD exposure for a 1pp availability drop is driven by C001 (0.5% monthly fee/pp) and C007 (0.4% monthly fee/pp), subject to annual caps; aggregate impact depends on each contract's monthly fee base. [1]",
  ),
  "Compare termination notice periods across all contracts": makeDone(
    "Termination notice ranges from 60 to 120 days across retrieved contracts; O&M examples show 90 days (C002) and 120 days (C007). [1]",
  ),
  "Which contracts have WPI escalation due in the next 90 days?": makeDone(
    "WPI escalation language is present in C002 and C004; next due-date requires each contract's effective-date calendar alignment. [1]",
  ),
  "List payment milestones triggering between May and July 2026": makeDone(
    "The retrieved clauses reference PAC/FAC-triggered milestones, but exact May–July 2026 triggers require schedule annex dates not currently in context. [1]",
  ),
  "Are there any uncapped indemnities in the portfolio?": makeDone(
    "No uncapped indemnity clause is explicitly present in the retrieved set; treat as inconclusive pending indemnity schedules review. [1]",
  ),
  "What's the warranty period for Contract C004?": makeDone(
    "C004 warranty term is not explicit in currently retrieved chunks; the warranty schedule or technical annex should be reviewed. [1]",
  ),
  "Show me Indian contracts with explicit GST treatment": makeDone(
    "GST treatment references were not explicit in current retrieved chunks; jurisdiction-specific tax clauses should be pulled for Indian contracts. [1]",
  ),
  "Which contract has the largest TCV?": makeDone(
    "Largest TCV cannot be concluded from retrieved clauses alone; commercial summary tables are required for a definitive ranking. [1]",
  ),
};
