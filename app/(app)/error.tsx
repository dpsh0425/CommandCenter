"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto mt-10 flex w-full max-w-md flex-col items-start gap-4 p-4 md:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700">Something went wrong</div>
      <h1 className="text-2xl font-semibold text-slate-900">That page hit a problem</h1>
      <p className="text-sm text-slate-600">
        Your data is safe. Try again, and if it keeps happening go back to the dashboard.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="w-full overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-600">{error.message}</pre>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700">Try again</button>
        <a href="/" className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-900 transition-colors hover:bg-slate-50">Dashboard</a>
      </div>
    </main>
  );
}
