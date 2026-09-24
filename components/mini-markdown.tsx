import React from "react";

// A small, safe Markdown renderer for previews (README files, notes). It builds React elements, never raw HTML.
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(!?\[[^\]]*\]\([^)\s]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0]; const key = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) out.push(<code key={key} className="px-1 rounded bg-surface-raised font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("*")) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else {
      const lm = tok.match(/^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (lm) {
        const [, bang, label, href] = lm;
        if (bang) out.push(<span key={key} className="text-gray-400">[image{label ? `: ${label}` : ""}]</span>);
        else if (/^https?:\/\//i.test(href)) out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-brass hover:underline">{label || href}</a>);
        else out.push(label);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0; let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="bg-surface-raised rounded p-3 overflow-x-auto text-xs font-mono leading-relaxed my-3">{buf.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? "text-2xl font-serif mt-5 mb-2" : level === 2 ? "text-xl font-serif mt-5 mb-2 border-b border-line pb-1" : "text-base font-semibold mt-4 mb-1";
      blocks.push(<div key={k++} role="heading" aria-level={level} className={cls}>{inline(h[2], `h${k}`)}</div>);
      i++; continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { blocks.push(<hr key={k++} className="border-line my-4" />); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++} className="border-l-2 border-line pl-3 text-gray-500 my-3">{inline(buf.join(" "), `q${k}`)}</blockquote>);
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line); const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={k++} className={`${ordered ? "list-decimal" : "list-disc"} pl-5 my-2 flex flex-col gap-1`}>{items.map((it, j) => <li key={j}>{inline(it, `l${k}-${j}`)}</li>)}</Tag>);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<pre key={k++} className="bg-surface-raised rounded p-3 overflow-x-auto text-xs font-mono my-3">{buf.join("\n")}</pre>);
      continue;
    }
    if (line.trim() === "") { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s+|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={k++} className="my-2 leading-relaxed">{inline(buf.join(" "), `p${k}`)}</p>);
  }
  return <div className="text-sm break-words">{blocks}</div>;
}
