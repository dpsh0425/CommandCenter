"use client";
import { useEffect, useState } from "react";
import { getFileUrl, getLinkPreview, type LinkPreview } from "@/app/(app)/research/library-actions";
import { MiniMarkdown } from "@/components/mini-markdown";
import { previewKind } from "@/lib/library";

const MAX_TEXT = 300_000;

function parseCsv(text: string, delim: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length && rows.length < 201; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function Notebook({ text }: { text: string }) {
  let nb: any;
  try { nb = JSON.parse(text); } catch { return <p className="text-sm text-gray-500">This notebook could not be read.</p>; }
  const cells: any[] = nb.cells ?? [];
  const src = (c: any) => (Array.isArray(c.source) ? c.source.join("") : String(c.source ?? ""));
  return (
    <div className="flex flex-col gap-3">
      {cells.slice(0, 120).map((c, i) => c.cell_type === "markdown" ? (
        <div key={i}><MiniMarkdown source={src(c)} /></div>
      ) : c.cell_type === "code" ? (
        <div key={i} className="flex flex-col gap-1">
          <pre className="bg-surface-raised rounded p-3 overflow-x-auto text-xs font-mono">{src(c)}</pre>
          {(c.outputs ?? []).map((o: any, j: number) => {
            const t = o.text ?? o.data?.["text/plain"];
            const png = o.data?.["image/png"];
            if (png) return <img key={j} alt="notebook output" src={`data:image/png;base64,${Array.isArray(png) ? png.join("") : png}`} className="max-w-full rounded bg-white" />;
            return t ? <pre key={j} className="text-xs font-mono text-gray-500 overflow-x-auto pl-3 border-l-2 border-line">{Array.isArray(t) ? t.join("") : String(t)}</pre> : null;
          })}
        </div>
      ) : null)}
      {cells.length > 120 && <p className="text-xs text-gray-400">Showing the first 120 cells.</p>}
    </div>
  );
}

export function FilePreview({ id, fileName, mime }: { id: string; fileName: string; mime: string | null }) {
  const kind = previewKind(fileName, mime);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    setUrl(null); setText(null); setError(null); setTruncated(false);
    if (kind === "none") return;
    (async () => {
      try {
        const u = await getFileUrl(id);
        if (dead) return;
        setUrl(u);
        if (["markdown", "csv", "json", "notebook", "text"].includes(kind)) {
          const res = await fetch(u);
          if (!res.ok) throw new Error("Could not load the file.");
          const t = await res.text();
          if (dead) return;
          setTruncated(t.length > MAX_TEXT);
          setText(t.slice(0, MAX_TEXT));
        }
      } catch (e) { if (!dead) setError(e instanceof Error ? e.message : "Could not load the preview."); }
    })();
    return () => { dead = true; };
  }, [id, kind]);

  if (kind === "none") return <p className="text-sm text-gray-500 py-8 text-center">No preview for this file type. Use Download to open it.</p>;
  if (error) return <p className="text-sm text-red-600 py-6">{error}</p>;
  if (!url) return <p className="text-sm text-gray-400 py-8 text-center">Loading preview…</p>;
  if (kind === "pdf") return <iframe src={url} title={fileName} className="w-full h-[70vh] rounded border border-line bg-white" />;
  if (kind === "image") return <img src={url} alt={fileName} className="max-w-full max-h-[70vh] mx-auto rounded" />;
  if (kind === "video") return <video src={url} controls className="w-full max-h-[70vh] rounded bg-black" />;
  if (kind === "audio") return <audio src={url} controls className="w-full" />;
  if (text == null) return <p className="text-sm text-gray-400 py-8 text-center">Loading preview…</p>;

  return (
    <div className="max-h-[70vh] overflow-auto rounded border border-line p-3">
      {kind === "markdown" && <MiniMarkdown source={text} />}
      {kind === "notebook" && <Notebook text={text} />}
      {kind === "csv" && (() => {
        const rows = parseCsv(text, fileName.toLowerCase().endsWith(".tsv") ? "\t" : ",");
        const [head, ...body] = rows;
        return (
          <table className="text-xs border-collapse w-max min-w-full">
            <thead><tr>{head?.map((h, i) => <th key={i} className="text-left font-semibold border-b border-line px-2 py-1 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{body.slice(0, 200).map((r, i) => <tr key={i} className="border-b border-line/50">{r.map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap max-w-[16rem] truncate">{c}</td>)}</tr>)}</tbody>
          </table>
        );
      })()}
      {kind === "json" && <pre className="text-xs font-mono whitespace-pre-wrap break-words">{(() => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; } })()}</pre>}
      {kind === "text" && <pre className="text-xs font-mono whitespace-pre-wrap break-words">{text}</pre>}
      {truncated && <p className="text-xs text-gray-400 pt-2">Preview cut off. Download the file to see everything.</p>}
    </div>
  );
}

export function LinkPreviewPane({ id, url, meta }: { id: string; url: string; meta: Record<string, any> }) {
  const [p, setP] = useState<LinkPreview | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  useEffect(() => {
    let dead = false;
    setP(null); setShowPdf(false);
    getLinkPreview(id).then((r) => { if (!dead) setP(r); }).catch(() => { if (!dead) setP({ type: "none", reason: "Could not load the preview." }); });
    return () => { dead = true; };
  }, [id]);

  if (!p) return <p className="text-sm text-gray-400 py-8 text-center">Loading preview…</p>;
  if (p.type === "youtube") return <iframe src={p.embed} title="Video" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen className="w-full aspect-video rounded" />;
  if (p.type === "pdf") return <iframe src={p.url} title="PDF" className="w-full h-[70vh] rounded border border-line bg-white" />;
  if (p.type === "github") {
    return (
      <div className="flex flex-col gap-3">
        {meta.description && <p className="text-sm text-gray-500">{meta.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 font-mono">
          {meta.language && <span className="text-cream">{meta.language}</span>}
          <span>★ {Number(meta.stars ?? 0).toLocaleString()}</span>
          <span>⑂ {Number(meta.forks ?? 0).toLocaleString()}</span>
          <span>{Number(meta.openIssues ?? 0)} open issues</span>
          {meta.license && <span>{meta.license}</span>}
        </div>
        {p.readme ? <div className="max-h-[60vh] overflow-auto rounded border border-line p-3"><MiniMarkdown source={p.readme} /></div> : <p className="text-sm text-gray-500">No README to show. The repository may be private or empty.</p>}
      </div>
    );
  }
  if (p.type === "arxiv") {
    return (
      <div className="flex flex-col gap-3">
        <h4 className="font-serif text-xl leading-snug">{p.title}</h4>
        <p className="text-xs text-gray-500">{p.authors.join(", ")}{p.published ? ` · ${p.published}` : ""}</p>
        <p className="text-sm leading-relaxed">{p.summary}</p>
        <button onClick={() => setShowPdf((v) => !v)} className="text-sm text-brass hover:underline self-start">{showPdf ? "Hide PDF" : "Read the PDF here"}</button>
        {showPdf && <iframe src={p.pdfUrl} title="Paper PDF" className="w-full h-[70vh] rounded border border-line bg-white" />}
      </div>
    );
  }
  if (p.type === "page") {
    return (
      <div className="flex flex-col gap-3 border border-line rounded overflow-hidden">
        {p.image && <img src={p.image} alt="" className="w-full max-h-56 object-cover" />}
        <div className="p-4 flex flex-col gap-1">
          <span className="text-xs text-gray-400">{p.siteName}</span>
          <span className="font-medium">{p.title ?? url}</span>
          {p.description && <p className="text-sm text-gray-500">{p.description}</p>}
        </div>
      </div>
    );
  }
  return <p className="text-sm text-gray-500 py-6">{p.reason}</p>;
}
