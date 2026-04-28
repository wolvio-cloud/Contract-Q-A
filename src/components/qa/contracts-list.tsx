interface ContractsListProps {
  contracts: Array<{ code: string; type: string }>;
}

export function ContractsList({ contracts }: ContractsListProps) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contracts</h3>
      <ul className="space-y-1 text-sm">
        {contracts.map((contract) => (
          <li key={contract.code} className="rounded px-2 py-1 hover:bg-slate-100">
            ● {contract.code} {contract.type}
          </li>
        ))}
      </ul>
    </div>
  );
}
