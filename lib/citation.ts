// Citation key and BibTeX entry made from a paper's title, authors, year and link. Nothing here is stored.
export type CitablePaper = { title: string; authors: string | null; year: number | null; url: string | null };

const STOP = new Set(["a", "an", "the", "on", "of", "for", "and", "in", "to", "with", "towards", "toward", "via", "from", "by", "at", "is", "are"]);
const ascii = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

/** "Ashish Vaswani, Noam Shazeer" → ["Ashish Vaswani", "Noam Shazeer"]; also handles "and" and ";". */
export function splitAuthors(authors: string | null): string[] {
  if (!authors) return [];
  const text = authors.replace(/\bet al\.?/gi, "");
  // With "and", "&" or ";" between names, commas belong to "Last, First" and are kept; otherwise commas separate names.
  const separator = /;|\band\b|&/i.test(text) ? /\s*(?:;|\band\b|&)\s*/i : /\s*,\s*/;
  return text.split(separator).map((a) => a.trim().replace(/,$/, "")).filter((a) => a.length > 1);
}

function surname(author: string): string {
  if (author.includes(",")) return author.split(",")[0].trim(); // "Vaswani, Ashish"
  const parts = author.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? author;
}

/** e.g. vaswani2017attention: first author's surname, year, first meaningful word of the title. */
export function citationKey(p: CitablePaper): string {
  const first = splitAuthors(p.authors)[0];
  const name = first ? ascii(surname(first)).toLowerCase().replace(/[^a-z]/g, "") : "anon";
  const word = ascii(p.title).toLowerCase().split(/[^a-z0-9]+/).find((w) => w && !STOP.has(w)) ?? "paper";
  return `${name || "anon"}${p.year ?? ""}${word}`;
}

// Braces protect capitals in titles; special characters are escaped for BibTeX.
const bib = (s: string) => s.replace(/\\/g, "\\textbackslash{}").replace(/([&%$#_])/g, "\\$1").replace(/[{}]/g, "");

export function bibtex(p: CitablePaper): string {
  const authors = splitAuthors(p.authors);
  const lines = [`@misc{${citationKey(p)},`, `  title = {{${bib(p.title)}}},`];
  if (authors.length) lines.push(`  author = {${authors.map(bib).join(" and ")}},`);
  if (p.year) lines.push(`  year = {${p.year}},`);
  if (p.url) {
    const arxiv = p.url.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})/i);
    if (arxiv) lines.push(`  eprint = {${arxiv[1]}},`, "  archivePrefix = {arXiv},");
    const doi = p.url.match(/doi\.org\/(10\.[^\s?#]+)/i);
    if (doi) lines.push(`  doi = {${doi[1]}},`);
    lines.push(`  url = {${p.url}},`);
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
  lines.push("}");
  return lines.join("\n");
}
