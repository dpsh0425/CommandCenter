"use client";
import { useMemo, useState, useTransition } from "react";
import { addExperiment, deleteExperiment, updateExperiment } from "@/app/(app)/research/experiment-actions";
import { EXPERIMENT_OUTCOME, EXPERIMENT_STATUS, type Metric } from "@/lib/research";

export type ExperimentRow = {
  id: string; name: string; hypothesis: string | null; status: string; outcome: string | null; setup: string | null; code_ref: string | null; data_ref: string | null;
  metrics: Metric[]; result: string | null; run_on: string | null; person_id: string | null; milestone_id: string | null; created_at: string;
};
type Opt = { id: string; name: string };

const field = "border rounded px-2 py-1.5 text-sm w-full";
const primary = "bg-brass text-ink font-medium rounded px-3 py-1.5 text-sm disabled:opacity-50";
const STATUS_TONE: Record<string, string> = { planned: "text-gray-500", running: "text-brass", done: "text-teal-600", failed: "text-red-600", abandoned: "text-gray-400" };
const statusLabel = (k: string) => EXPERIMENT_STATUS.find((s) => s.key === k)?.label ?? k;
const outcomeLabel = (k: string | null) => EXPERIMENT_OUTCOME.find((s) => s.key === k)?.label ?? null;

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
  const outcome = outcomeLabel(e.outcome);

  return (
    <li className={`border-b border-line/60 last:border-0 py-3 ${pending ? "opacity-60" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left flex flex-col gap-1" aria-expanded={open}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-medium break-words">{e.name}</span>
          <span className={`text-sm whitespace-nowrap ${STATUS_TONE[e.status]}`}>{statusLabel(e.status)}</span>
        </span>
        {e.hypothesis && !open && <span className="text-sm text-gray-500 line-clamp-1">{e.hypothesis}</span>}
        <span className="text-xs text-gray-400">
          {[outcome, e.metrics.slice(0, 3).map((m) => `${m.name} ${m.value}`).join(" · ") || null, e.run_on ? `run ${e.run_on.slice(5)}` : null].filter(Boolean).join(" · ")}
        </span>
      </button>

      {open && (
        <form
          className="grid gap-3 sm:grid-cols-2 text-sm pt-4"
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
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Name<input name="name" defaultValue={e.name} required className={field + " text-cream"} /></label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Hypothesis: what you expect, and why<textarea name="hypothesis" defaultValue={e.hypothesis ?? ""} rows={2} className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Status
            <select name="status" defaultValue={e.status} className={field + " text-cream bg-transparent"}>{EXPERIMENT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 text-gray-500">Outcome
            <select name="outcome" defaultValue={e.outcome ?? ""} className={field + " text-cream bg-transparent"}><option value="">Not decided</option>{EXPERIMENT_OUTCOME.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Setup: model, data split, parameters, seeds, anything needed to repeat it<textarea name="setup" defaultValue={e.setup ?? ""} rows={3} className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Code (commit, branch or script)<input name="code_ref" defaultValue={e.code_ref ?? ""} placeholder="e.g. a1b2c3d or scripts/pilot.py" className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Data (file, version or split)<input name="data_ref" defaultValue={e.data_ref ?? ""} placeholder="e.g. items_v2.csv, 200 items" className={field + " text-cream"} /></label>

          <div className="sm:col-span-2 flex flex-col gap-2">
            <span className="text-gray-500">Metrics</span>
            {metrics.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input value={m.name} onChange={(ev) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} placeholder="Name, e.g. accuracy" className={field} aria-label="Metric name" />
                <input value={m.value} onChange={(ev) => setMetrics(metrics.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))} placeholder="Value" className={field + " max-w-[10rem]"} aria-label="Metric value" />
                <button type="button" onClick={() => setMetrics(metrics.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-600 px-1" aria-label="Remove metric">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setMetrics([...metrics, { name: "", value: "" }])} className="text-brass hover:underline self-start">+ Add a metric</button>
          </div>

          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Result and what it means<textarea name="result" defaultValue={e.result ?? ""} rows={4} className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Run on<input type="date" name="run_on" defaultValue={e.run_on ?? ""} className={field + " text-cream"} /></label>
          <label className="flex flex-col gap-1 text-gray-500">Run by
            <select name="person" defaultValue={e.person_id ?? ""} className={field + " text-cream bg-transparent"}><option value="">Not set</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className="sm:col-span-2 flex flex-col gap-1 text-gray-500">Milestone
            <select name="milestone" defaultValue={e.milestone_id ?? ""} className={field + " text-cream bg-transparent"}><option value="">Not linked</option>{milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button disabled={pending} className={primary}>Save experiment</button>
            <button type="button" onClick={() => { if (confirm(`Delete "${e.name}"?`)) run(() => deleteExperiment(e.id, projectId)); }} className="text-gray-500 hover:text-red-600">Delete</button>
            {saved && !pending && <span className="text-teal-600 text-xs">Saved</span>}
            {error && <span className="text-red-600 text-xs">{error}</span>}
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
  if (names.length === 0) return <p className="text-sm text-gray-500 py-6">No metrics recorded yet. Add metrics to your experiments and they line up here so you can compare runs.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse w-full min-w-max">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 pr-4 font-normal text-gray-500">Experiment</th>
            {names.map((n) => (
              <th key={n} className="py-2 pr-4 font-normal">
                <button onClick={() => { if (sortBy === n) setDesc(!desc); else { setSortBy(n); setDesc(true); } }} className={`hover:text-brass ${sortBy === n ? "text-brass" : "text-gray-500"}`}>{n}{sortBy === n ? (desc ? " ↓" : " ↑") : ""}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-b border-line/60">
              <td className="py-2 pr-4"><span className="block max-w-[16rem] truncate">{r.name}</span><span className={`text-xs ${STATUS_TONE[r.status]}`}>{statusLabel(r.status)}</span></td>
              {names.map((n) => <td key={n} className="py-2 pr-4 font-mono">{value(r, n) || <span className="text-gray-400">·</span>}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 pt-2">Click a metric to sort. Numbers are read from the value; anything else sorts last.</p>
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
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-2 text-sm border-b border-line pb-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          const form = ev.currentTarget; const f = new FormData(form);
          run(async () => setNewId(await addExperiment(projectId, { name: String(f.get("name") ?? ""), hypothesis: String(f.get("hypothesis") ?? "") })), () => form.reset());
        }}
      >
        <div className="flex flex-wrap gap-2">
          <input name="name" required placeholder="Name the experiment, e.g. Pilot: translation round-trip on 200 items" className={field + " flex-1 min-w-[16rem]"} />
          <button disabled={pending} className={primary}>Add experiment</button>
        </div>
        <input name="hypothesis" placeholder="Hypothesis (optional): what you expect to see, and why" className={field} />
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </form>

      {experiments.length === 0 ? (
        <p className="text-sm text-gray-500">No experiments yet. Write down each one before you run it: the hypothesis, the setup, then the metrics and what they mean. Failed runs belong here too.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line -mb-2">
            <div className="flex flex-wrap gap-x-5 text-sm">
              <button onClick={() => setFilter("all")} className={`pb-2 border-b-2 -mb-px ${filter === "all" ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>All {experiments.length}</button>
              {EXPERIMENT_STATUS.filter((s) => counts(s.key) > 0).map((s) => (
                <button key={s.key} onClick={() => setFilter(s.key)} className={`pb-2 border-b-2 -mb-px ${filter === s.key ? "border-brass text-cream font-medium" : "border-transparent text-gray-500 hover:text-cream"}`}>{s.label} {counts(s.key)}</button>
              ))}
            </div>
            <div className="flex gap-4 text-sm pb-2">
              <button onClick={() => setView("list")} className={view === "list" ? "text-cream font-medium" : "text-gray-500 hover:text-cream"}>List</button>
              <button onClick={() => setView("compare")} className={view === "compare" ? "text-cream font-medium" : "text-gray-500 hover:text-cream"}>Compare results</button>
            </div>
          </div>
          {view === "compare" ? <CompareTable rows={shown} /> : (
            <ul>{shown.map((e) => <Card key={e.id} e={e} projectId={projectId} people={people} milestones={milestones} defaultOpen={e.id === newId} />)}</ul>
          )}
        </>
      )}
    </div>
  );
}
