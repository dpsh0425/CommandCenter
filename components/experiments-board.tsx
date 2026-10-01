"use client";
import { useMemo, useState, useTransition } from "react";
import { addExperiment, deleteExperiment, updateExperiment } from "@/app/(app)/research/experiment-actions";
import { EXPERIMENT_OUTCOME, EXPERIMENT_STATUS, type Metric } from "@/lib/research";

export type ExperimentRow = {
  id: string; name: string; hypothesis: string | null; status: string; outcome: string | null; setup: string | null; code_ref: string | null; data_ref: string | null;
  metrics: Metric[]; result: string | null; run_on: string | null; person_id: string | null; milestone_id: string | null; created_at: string;
};
type Opt = { id: string; name: string };

const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
const primary = "h-9 whitespace-nowrap rounded-md bg-blue-600 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-xs font-medium text-slate-600";
const STATUS_TONE: Record<string, string> = {
  planned: "bg-slate-100 text-slate-600", running: "bg-blue-50 text-blue-700", done: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700", abandoned: "bg-slate-100 text-slate-500",
};
const statusLabel = (k: string) => EXPERIMENT_STATUS.find((s) => s.key === k)?.label ?? k;
const outcomeLabel = (k: string | null) => EXPERIMENT_OUTCOME.find((s) => s.key === k)?.label ?? null;
const chip = (on: boolean) =>
  `h-8 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`;

function StatusBadge({ status }: { status: string }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status] ?? STATUS_TONE.planned}`}>{statusLabel(status)}</span>;
}

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, after?: () => void) => {
    setError(null);
    start(async () => { try { await fn(); after?.(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } });
  };
  return { pending, error, run };
}

function Card({ e, projectId, people, milestones, defaultOpen }: { e: ExperimentRow; projectId: string; people: Opt[]; milestones: Opt[]; defaultOpen: boolean }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(defaultOpen);
  const [metrics, setMetrics] = useState<Metric[]>(e.metrics.length ? e.metrics : []);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const outcome = outcomeLabel(e.outcome);
  const meta = [outcome, e.metrics.slice(0, 3).map((m) => `${m.name} ${m.value}`).join(" · ") || null, e.run_on ? `run ${e.run_on.slice(5)}` : null].filter(Boolean).join(" · ");

  return (
    <li className={`rounded-lg border border-slate-200 bg-white ${pending ? "opacity-60" : ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`flex w-full flex-col gap-1 px-5 py-3 text-left ${open ? "border-b border-slate-200" : ""}`} aria-expanded={open}>
        <span className="flex items-start justify-between gap-3">
          <span className="break-words text-[15px] font-semibold text-slate-900">{e.name}</span>
          <StatusBadge status={e.status} />
        </span>
        {e.hypothesis && !open && <span className="line-clamp-1 text-[13px] text-slate-600">{e.hypothesis}</span>}
        {meta && <span className="text-xs text-slate-500">{meta}</span>}
      </button>

      {open && (
        <form
          className="grid gap-3 px-5 py-4 sm:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget); const v = (k: string) => String(f.get(k) ?? "").trim();
            setSaved(false);
            run(() => updateExperiment(e.id, projectId, {
              name: v("name"), hypothesis: v("hypothesis") || null, status: v("status"), outcome: v("outcome") || null, setup: v("setup") || null,
              codeRef: v("code_ref") || null, dataRef: v("data_ref") || null, metrics, result: v("result") || null, runOn: v("run_on") || null,
              personId: v("person") || null, milestoneId: v("milestone") || null,
            }), () => setSaved(true));
          }}
        >
          <label className={`${labelCls} sm:col-span-2`}>Name<input name="name" defaultValue={e.name} required className={field} /></label>
          <label className={`${labelCls} sm:col-span-2`}>Hypothesis: what you expect, and why<textarea name="hypothesis" defaultValue={e.hypothesis ?? ""} rows={2} className={field} /></label>
          <label className={labelCls}>Status
            <select name="status" defaultValue={e.status} className={field}>{EXPERIMENT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
          <label className={labelCls}>Outcome
            <select name="outcome" defaultValue={e.outcome ?? ""} className={field}><option value="">Not decided</option>{EXPERIMENT_OUTCOME.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
          <label className={`${labelCls} sm:col-span-2`}>Setup: model, data split, parameters, seeds, anything needed to repeat it<textarea name="setup" defaultValue={e.setup ?? ""} rows={3} className={field} /></label>
          <label className={labelCls}>Code (commit, branch or script)<input name="code_ref" defaultValue={e.code_ref ?? ""} placeholder="e.g. a1b2c3d or scripts/pilot.py" className={`${field} font-mono`} /></label>
          <label className={labelCls}>Data (file, version or split)<input name="data_ref" defaultValue={e.data_ref ?? ""} placeholder="e.g. items_v2.csv, 200 items" className={`${field} font-mono`} /></label>

          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Metrics</span>
            {metrics.length === 0 && <span className="text-[13px] text-slate-500">No metrics yet.</span>}
            {metrics.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input value={m.name} onChange={(ev) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} placeholder="Name, e.g. accuracy" className={field} aria-label="Metric name" />
                <input value={m.value} onChange={(ev) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))} placeholder="Value" className={`${field} max-w-[10rem] font-mono`} aria-label="Metric value" />
                <button type="button" onClick={() => setMetrics(metrics.filter((_, j) => j !== i))} className="h-9 rounded-md px-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label="Remove metric">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setMetrics([...metrics, { name: "", value: "" }])} className="self-start text-[13px] font-medium text-blue-600 hover:text-blue-700">+ Add a metric</button>
          </div>

          <label className={`${labelCls} sm:col-span-2`}>Result and what it means<textarea name="result" defaultValue={e.result ?? ""} rows={4} className={field} /></label>
          <label className={labelCls}>Run on<input type="date" name="run_on" defaultValue={e.run_on ?? ""} className={field} /></label>
          <label className={labelCls}>Run by
            <select name="person" defaultValue={e.person_id ?? ""} className={field}><option value="">Not set</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className={`${labelCls} sm:col-span-2`}>Milestone
            <select name="milestone" defaultValue={e.milestone_id ?? ""} className={field}><option value="">Not linked</option>{milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 sm:col-span-2">
            <button disabled={pending} className={primary}>{pending ? "Saving…" : "Save experiment"}</button>
            {confirming ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-[13px] text-red-800" role="group" aria-label="Confirm delete">
                Delete &ldquo;{e.name}&rdquo;?
                <button type="button" disabled={pending} onClick={() => { setConfirming(false); run(() => deleteExperiment(e.id, projectId)); }} className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">Delete</button>
                <button type="button" onClick={() => setConfirming(false)} className="h-7 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-white">Keep</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="h-8 rounded-md px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700">Delete</button>
            )}
            {saved && !pending && <span role="status" className="text-xs text-emerald-700">Saved</span>}
            {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
          </div>
        </form>
      )}
    </li>
  );
}

function CompareTable({ rows }: { rows: ExperimentRow[] }) {
  const names = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.metrics.map((m) => m.name)))), [rows]);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [desc, setDesc] = useState(true);
  const value = (r: ExperimentRow, n: string) => r.metrics.find((m) => m.name === n)?.value ?? "";
  const sorted = useMemo(() => {
    if (!sortBy) return rows;
    const num = (s: string) => { const x = parseFloat(s.replace(/[^\d.\-eE]/g, "")); return Number.isNaN(x) ? null : x; };
    return [...rows].sort((a, b) => {
      const x = num(value(a, sortBy)); const y = num(value(b, sortBy));
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return desc ? y - x : x - y;
    });
  }, [rows, sortBy, desc]);
  if (names.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-[13px] text-slate-500">
        No metrics recorded yet. Add metrics to your experiments and they line up here so you can compare runs.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-5 py-2.5 font-medium">Experiment</th>
              {names.map((n) => (
                <th key={n} className="px-3 py-2.5 font-medium">
                  <button type="button" onClick={() => { if (sortBy === n) setDesc(!desc); else { setSortBy(n); setDesc(true); } }} className={`hover:text-blue-700 ${sortBy === n ? "text-blue-700" : "text-slate-500"}`} aria-label={`Sort by ${n}`}>
                    {n}{sortBy === n ? (desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-5 py-2.5">
                  <span className="block max-w-[16rem] truncate font-medium text-slate-900">{r.name}</span>
                  <StatusBadge status={r.status} />
                </td>
                {names.map((n) => <td key={n} className="px-3 py-2.5 font-mono tabular-nums text-slate-800">{value(r, n) || <span className="text-slate-300">·</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-500">Click a metric to sort. Numbers are read from the value; anything else sorts last.</p>
    </div>
  );
}

export function ExperimentsBoard({ projectId, experiments, people, milestones }: { projectId: string; experiments: ExperimentRow[]; people: Opt[]; milestones: Opt[] }) {
  const { pending, error, run } = useRun();
  const [filter, setFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "compare">("list");
  const [newId, setNewId] = useState<string | null>(null);

  const counts = (k: string) => experiments.filter((e) => e.status === k).length;
  const shown = filter === "all" ? experiments : experiments.filter((e) => e.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const form = ev.currentTarget; const f = new FormData(form);
          run(async () => setNewId(await addExperiment(projectId, { name: String(f.get("name") ?? ""), hypothesis: String(f.get("hypothesis") ?? "") })), () => form.reset());
        }}
      >
        <h2 className="text-[15px] font-semibold text-slate-900">Add an experiment</h2>
        <div className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name the experiment, e.g. Pilot: translation round-trip on 200 items" aria-label="Experiment name" className={`${field} min-w-[16rem] flex-1`} />
          <button disabled={pending} className={primary}>Add experiment</button>
        </div>
        <input name="hypothesis" placeholder="Hypothesis (optional): what you expect to see, and why" aria-label="Hypothesis" className={field} />
        {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      </form>

      {experiments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-900">No experiments yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Write down each one before you run it: the hypothesis, the setup, then the metrics and what they mean. Failed runs belong here too.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>All {experiments.length}</button>
              {EXPERIMENT_STATUS.filter((s) => counts(s.key) > 0).map((s) => (
                <button key={s.key} type="button" aria-pressed={filter === s.key} onClick={() => setFilter(s.key)} className={chip(filter === s.key)}>{s.label} {counts(s.key)}</button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="View">
              {([["list", "List"], ["compare", "Compare results"]] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`h-8 px-3 text-[13px] font-medium ${view === k ? "bg-slate-100 text-slate-900" : "bg-white text-slate-500 hover:text-slate-900"}`}>{label}</button>
              ))}
            </div>
          </div>
          {view === "compare" ? <CompareTable rows={shown} /> : (
            <ul className="flex flex-col gap-2.5">{shown.map((e) => <Card key={e.id} e={e} projectId={projectId} people={people} milestones={milestones} defaultOpen={e.id === newId} />)}</ul>
          )}
        </>
      )}
    </div>
  );
}
