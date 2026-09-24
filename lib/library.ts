// Shared by the project library UI and its server actions.
export const LIB_KINDS = [
  { key: "paper", label: "Paper" },
  { key: "data", label: "Data" },
  { key: "code", label: "Code" },
  { key: "figure", label: "Figure" },
  { key: "slides", label: "Slides" },
  { key: "notes", label: "Notes" },
  { key: "proposal", label: "Proposal" },
  { key: "ethics", label: "Ethics and approvals" },
  { key: "writing_sample", label: "Draft or writing" },
  { key: "other", label: "Other" },
] as const;

export type Preview = "pdf" | "image" | "video" | "audio" | "markdown" | "csv" | "json" | "notebook" | "text" | "none";

const TEXT_EXT = new Set(["txt", "log", "py", "js", "ts", "tsx", "jsx", "r", "sql", "yaml", "yml", "toml", "ini", "cfg", "sh", "bib", "tex", "html", "css", "xml", "c", "cpp", "h", "java", "go", "rs", "tsv"]);

export function previewKind(fileName: string, mime: string | null): Preview {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const m = (mime ?? "").toLowerCase();
  if (ext === "pdf" || m === "application/pdf") return "pdf";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  if (m.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "csv") return "csv";
  if (ext === "json" || ext === "jsonl") return "json";
  if (ext === "ipynb") return "notebook";
  if (TEXT_EXT.has(ext) || m.startsWith("text/")) return "text";
  return "none";
}

export const guessKind = (fileName: string): string => {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (["pdf"].includes(ext)) return "paper";
  if (["csv", "tsv", "json", "jsonl", "parquet", "xlsx", "xls", "zip"].includes(ext)) return "data";
  if (["py", "ipynb", "r", "js", "ts", "sh", "sql", "c", "cpp", "java"].includes(ext)) return "code";
  if (["png", "jpg", "jpeg", "svg", "gif", "webp"].includes(ext)) return "figure";
  if (["ppt", "pptx", "key"].includes(ext)) return "slides";
  if (["md", "txt", "tex", "docx", "doc"].includes(ext)) return "notes";
  return "other";
};

export const parseTags = (s: string) => Array.from(new Set(s.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean)));
