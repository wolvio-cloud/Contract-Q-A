interface ContractPageProps {
  params: { contractId: string };
  searchParams?: { clause?: string; page?: string };
}

export default function ContractPage({ params, searchParams }: ContractPageProps) {
  const clause = searchParams?.clause;
  const page = searchParams?.page;

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Contract {params.contractId}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {clause ? `Focused clause: ${clause}` : "No clause pre-selected."}
        {page ? ` (Page ${page})` : ""}
      </p>
      <section className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm">
          Highlight target for demo navigation: {clause ? `Clause ${clause}` : "N/A"} {page ? `on page ${page}` : ""}
        </p>
      </section>
    </main>
  );
}
