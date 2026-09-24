"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import { linkHref, toEditorHtml } from "@/lib/rich-text";

export type RichEditorProps = {
  value: string; onChange: (html: string) => void; label: string;
  variant?: "full" | "compact"; placeholder?: string; readOnly?: boolean; minHeight?: string; resetKey?: string | number;
};

type Block = "p" | "h1" | "h2" | "h3";

function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const block: Block = e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p";
      return {
        bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
        bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"), link: e.isActive("link"),
        left: e.isActive({ textAlign: "left" }), center: e.isActive({ textAlign: "center" }), right: e.isActive({ textAlign: "right" }),
        block, canUndo: e.can().undo(), canRedo: e.can().redo(),
      };
    },
  });
}

function Btn({ title, active, disabled, onClick, children }: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-tb=""
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`shrink-0 min-w-8 h-8 px-2 rounded text-sm border ${active ? "bg-brass text-black border-brass" : "border-transparent text-cream hover:bg-brass-soft"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, variant }: { editor: Editor; variant: "full" | "compact" }) {
  const s = useToolbarState(editor);
  const ref = useRef<HTMLDivElement>(null);
  const [tabIdx, setTabIdx] = useState(0);
  const full = variant === "full";

  // Roving tabindex: only one control is in the tab order.
  useEffect(() => {
    const list = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-tb]") ?? []);
    const keep = Math.min(tabIdx, list.length - 1);
    list.forEach((el, n) => el.setAttribute("tabindex", n === keep ? "0" : "-1"));
  });

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { e.preventDefault(); editor.commands.focus(); return; }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const list = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-tb]:not(:disabled)") ?? []);
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    list[(at + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length].focus();
  }
  function onFocus() {
    const list = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-tb]") ?? []);
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (at >= 0) setTabIdx(at);
  }
  function setLink() {
    const current = (editor.getAttributes("link").href as string | undefined) ?? "";
    const input = window.prompt("Link address", current);
    if (input === null) return;
    if (input.trim() === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const href = linkHref(input);
    if (!href) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }
  function setBlock(v: Block) {
    const c = editor.chain().focus();
    if (v === "p") c.setParagraph().run();
    else c.setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Formatting"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className="sticky top-0 z-10 flex flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-surface-raised border-b border-line px-2 py-1 rounded-t"
    >
      {full && (
        <select
          data-tb=""
          aria-label="Paragraph style"
          title="Paragraph style"
          value={s.block}
          onChange={(e) => setBlock(e.target.value as Block)}
          className="shrink-0 h-8 rounded border border-line bg-surface text-cream text-sm px-1"
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      )}
      <Btn title="Bold (Ctrl+B)" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></Btn>
      <Btn title="Italic (Ctrl+I)" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></Btn>
      {full && <Btn title="Underline (Ctrl+U)" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>}
      {full && <Btn title="Strikethrough (Ctrl+Shift+S)" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>}
      <Btn title="Bullet list (Ctrl+Shift+8)" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>Bullets</Btn>
      <Btn title="Numbered list (Ctrl+Shift+7)" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
      {full && <Btn title="Quote (Ctrl+Shift+B)" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>Quote</Btn>}
      {full && <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>Divider</Btn>}
      {full && <Btn title="Align left (Ctrl+Shift+L)" active={s.left} onClick={() => editor.chain().focus().setTextAlign("left").run()}>Left</Btn>}
      {full && <Btn title="Align centre (Ctrl+Shift+E)" active={s.center} onClick={() => editor.chain().focus().setTextAlign("center").run()}>Centre</Btn>}
      {full && <Btn title="Align right (Ctrl+Shift+R)" active={s.right} onClick={() => editor.chain().focus().setTextAlign("right").run()}>Right</Btn>}
      <Btn title="Link" active={s.link} onClick={setLink}>Link</Btn>
      {full && <Btn title="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>Undo</Btn>}
      {full && <Btn title="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>Redo</Btn>}
      {full && <Btn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear</Btn>}
    </div>
  );
}

export function RichEditor({ value, onChange, label, variant = "full", placeholder, readOnly = false, minHeight, resetKey }: RichEditorProps) {
  const height = minHeight ?? "24rem";
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "paper-content", role: "textbox", "aria-multiline": "true", "aria-label": label, style: `min-height:${height}` },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    editor?.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    // Only an outside reset replaces the document, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  // setEditable announces an update unless told not to, which would look like an edit on every open.
  useEffect(() => { if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly, false); }, [editor, readOnly]);

  if (!editor) return <div className="paper paper-page" style={{ minHeight: height }} aria-busy="true" />;

  return (
    <div className="paper focus-within:ring-1 focus-within:ring-brass">
      {!readOnly && <Toolbar editor={editor} variant={variant} />}
      <div className="paper-page" onClick={() => { if (!readOnly) editor.commands.focus(); }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
