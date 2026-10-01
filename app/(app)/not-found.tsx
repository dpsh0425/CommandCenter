import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto mt-10 flex w-full max-w-md flex-col items-start gap-4 p-4 md:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">404</div>
      <h1 className="text-2xl font-semibold text-slate-900">Nothing here</h1>
      <p className="text-sm text-slate-600">This page doesn&apos;t exist, or it was deleted. Use search (Ctrl K) or head back.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">Dashboard</Link>
        <Link href="/schools" className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50">Schools</Link>
      </div>
    </main>
  );
}
