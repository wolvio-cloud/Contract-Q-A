export type QueryIntent = "lookup" | "comparison" | "aggregation" | "risk";
export type QueryComplexity = "low" | "medium" | "high";

export interface QueryClassification {
  intent: QueryIntent;
  suggested_contract_types: string[] | null;
  complexity: QueryComplexity;
  risk_flags: string[];
}

const CONTRACT_TYPE_MAP: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bo\s*&\s*m\b|operations?\s*&\s*maintenance|\bom\b/i, type: "O&M" },
  { pattern: /\bservice\b/i, type: "Service" },
  { pattern: /\bsupply\b/i, type: "Supply" },
  { pattern: /\badmin\b|administrative/i, type: "Admin" },
];

export function classifyQuery(question: string): QueryClassification {
  const normalized = question.trim().toLowerCase();

  const isAggregation = /\b(total|sum|across|aggregate|exposure|portfolio)\b/.test(normalized);
  const isComparison = /\b(compare|versus|vs\.?|across all|difference)\b/.test(normalized);
  const isRisk = /\b(risk|penalty|liquidated damages|ld|uncapped|breach|termination)\b/.test(normalized);

  let intent: QueryIntent = "lookup";
  if (isAggregation) {
    intent = "aggregation";
  } else if (isComparison) {
    intent = "comparison";
  } else if (isRisk) {
    intent = "risk";
  }

  const suggested = CONTRACT_TYPE_MAP.filter((entry) => entry.pattern.test(question)).map((entry) => entry.type);
  const uniqueTypes = [...new Set(suggested)];

  const complexity: QueryComplexity =
    intent === "aggregation" || (intent === "comparison" && /\bacross\b|\ball\b/.test(normalized))
      ? "high"
      : intent === "comparison" || isRisk
        ? "medium"
        : "low";

  const risk_flags: string[] = [];
  if (/\bld|liquidated damages\b/i.test(question)) {
    risk_flags.push("liquidated-damages");
  }
  if (/\btermination\b/i.test(question)) {
    risk_flags.push("termination");
  }

  return {
    intent,
    suggested_contract_types: uniqueTypes.length > 0 ? uniqueTypes : null,
    complexity,
    risk_flags,
  };
}
