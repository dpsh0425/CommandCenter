export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-[1040px] animate-pulse flex-col gap-4 p-4 md:p-8" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-slate-200" />
      <div className="h-4 w-72 max-w-full rounded-md bg-slate-100" />
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg border border-slate-200 bg-white" />)}
      </div>
      <div className="h-40 rounded-lg border border-slate-200 bg-white" />
      <div className="h-40 rounded-lg border border-slate-200 bg-white" />
    </main>
  );
}
