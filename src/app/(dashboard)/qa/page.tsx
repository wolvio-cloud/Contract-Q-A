import { ChatInterface } from "../../../components/qa/chat-interface";
import { demoCorpus } from "../../../lib/rag/demo-corpus";

export default function QaPage() {
  const contracts = Array.from(
    new Map(demoCorpus.map((chunk) => [chunk.contract_code, { code: chunk.contract_code, type: chunk.contract_type }])).values(),
  );

  return (
    <main className="h-full">
      <header className="border-b border-slate-200 px-4 py-3">
        <h1 className="text-xl font-semibold">Contract Q&A</h1>
      </header>
      <ChatInterface contracts={contracts} />
    </main>
  );
}
