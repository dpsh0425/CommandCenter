export default function Loading() {
  return (
    <main className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded bg-surface-raised" />
      <div className="h-4 w-72 rounded bg-surface-raised" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-surface border border-line" />)}
      </div>
      <div className="h-40 rounded-lg bg-surface border border-line" />
      <div className="h-40 rounded-lg bg-surface border border-line" />
    </main>
  );
}
