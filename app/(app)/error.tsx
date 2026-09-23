"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="p-4 md:p-8 max-w-md mx-auto flex flex-col gap-4 items-start mt-10">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-600">Something went wrong</div>
      <h1 className="text-2xl font-semibold">That page hit a problem</h1>
      <p className="text-sm text-gray-500">
        Your data is safe. Try again, and if it keeps happening go back to the dashboard.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="text-xs text-gray-400 border border-line rounded p-3 w-full overflow-auto whitespace-pre-wrap">{error.message}</pre>
      )}
      <div className="flex gap-2">
        <button onClick={reset} className="bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm">Try again</button>
        <a href="/" className="border rounded px-3 py-1.5 text-sm hover:border-brass">Dashboard</a>
      </div>
    </main>
  );
}
