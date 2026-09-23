import Link from "next/link";

export default function NotFound() {
  return (
    <main className="p-4 md:p-8 max-w-md mx-auto flex flex-col gap-4 items-start mt-10">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">404</div>
      <h1 className="text-2xl font-semibold">Nothing here</h1>
      <p className="text-sm text-gray-500">This page doesn't exist, or it was deleted. Use search (Ctrl K) or head back.</p>
      <div className="flex gap-2">
        <Link href="/" className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">Dashboard</Link>
        <Link href="/schools" className="border rounded px-3 py-1.5 text-sm hover:border-brass">Schools</Link>
      </div>
    </main>
  );
}
