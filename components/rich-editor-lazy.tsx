"use client";
import dynamic from "next/dynamic";
import type { RichEditorProps } from "@/components/rich-editor";

// The editor is large; load it only on pages that edit.
export const RichEditorLazy = dynamic<RichEditorProps>(() => import("@/components/rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <div className="paper paper-page" style={{ minHeight: "24rem" }} aria-busy="true" />,
});
