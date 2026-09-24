# Word-style editor and statement tooling: design

Date: 2026-09-24
Status: approved in conversation (HTML storage chosen), written for review

## 1. Goal

Replace the plain text boxes used for writing with a Word-style editor, and make statements a professional writing
tool: portal-aware limits, clean exports, version comparison, and safeguards against losing or overwriting work.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Storage | HTML in the existing `body` text columns. No conversion migration; old plain text is converted on open. |
| Editor library | TipTap (ProseMirror). Marks and blocks limited to an allowed list; pasted Word or Google Docs text is reduced to it. |
| Where used | Statements and research writing (full toolbar); journal entries and school notes (compact toolbar); recommender emails stay plain text in a page-style box. |
| Safety | An allow-list sanitizer runs on save and again on display. No images, no scripts, no inline styles except text alignment. |
| Build order | Three plans: 1 foundation, 2 statement tooling, 3 rollout and polish. |
| Sending | Still nothing is sent by the app. |

## 3. Foundation (plan 1)

### 3.1 Rich text module (`lib/rich-text.ts`, pure, unit-tested)
- `sanitizeHtml(html)`: allowed tags `p br strong em u s h1 h2 h3 ul ol li blockquote hr a`; `a` allows `href` with
  `http`, `https` or `mailto` only, and always gets `rel="noopener noreferrer nofollow"`; the only allowed style is
  `text-align` (left, center, right, justify). Everything else is removed, including event attributes and `javascript:` links.
- `isHtml(s)`, `legacyToHtml(s)`: plain text becomes paragraphs (blank line splits paragraphs, single newlines become
  `br`); text that uses the old light markdown (`#` headings, `- ` lists, `**bold**`, `*italic*`, `[text](url)`) is
  converted to the matching tags. All text is escaped first.
- `toEditorHtml(s)`: `isHtml(s) ? sanitizeHtml(s) : legacyToHtml(s)`.
- `htmlToText(html)`: block-aware plain text (paragraphs separated by a blank line, list items on their own lines).
- `countWordsHtml(html)`: words from `htmlToText`, using the existing `countWords`, so limits behave as before.
- `portalText(html, { straightQuotes })`: plain text for pasting into a portal: single blank lines between
  paragraphs, no trailing spaces, optionally straight quotes and apostrophes.

### 3.2 Components
- `components/rich-editor.tsx` (client, loaded with `next/dynamic` so pages that do not edit do not download it):
  props `value` (any stored string), `onChange(html, text)`, `variant: "full" | "compact"`, `placeholder`,
  `readOnly`, `minHeight`, `label`. Toolbar: paragraph style (paragraph, heading 1 to 3), bold, italic, underline,
  strikethrough, bullet and numbered lists, quote, divider, left/center/right alignment, link, undo, redo, clear
  formatting; the compact variant has bold, italic, lists and link. Word shortcuts (Ctrl+B, I, U, Z, Y, K) work.
  The toolbar is `role="toolbar"`, each button has a label and `aria-pressed`, arrow keys move between buttons,
  and on a phone it scrolls sideways and stays above the on-screen keyboard.
- `components/rich-view.tsx` (server-safe): shows stored text read-only after `toEditorHtml`, in the same paper styles.
- `components/paper-textarea.tsx`: the page-style box without a toolbar, for emails.
- Paper look: a paper-coloured page on the dark app, serif body, comfortable margins, readable at phone width.

### 3.3 Safeguards
- **Local backup:** the editor writes its current content to `localStorage` (key per document) as it changes. On open,
  if a backup is newer than the server copy and different, offer "Restore unsaved changes". Storage errors are ignored.
- **Stale-write check:** save actions take the `updated_at` the editor loaded; if the row changed since, the save is
  refused with "This was changed somewhere else. Reload to see the latest, or copy your text first." and the editor
  keeps the user's text.
- The existing unsaved-changes guard and autosave timing stay.

## 4. Statement tooling (plan 2)

- **Editor page:** the paper editor; the school's prompt is pinned above the page and collapsible so you write to it.
- **Limits:** `statements.char_limit integer` (migration 0016, null allowed, positive). The limit state rules (neutral
  under 90 percent, amber to the limit, red above) apply to whichever limits are set, and the worse state shows.
- **Metrics line:** words, characters, characters without spaces, paragraphs, reading time (200 words a minute).
- **Writing hints** (optional panel, pure functions, tested): sentences longer than 40 words, how many sentences begin
  with the same word (flagging "I" when it starts a quarter or more of sentences), and the same word repeated three or
  more times within two sentences (excluding common words). Suggestions only, nothing is changed automatically.
- **Focus mode:** hides everything except the page and a slim status line.
- **Versions:** each stores formatted text; "View" shows it formatted; "Compare with current" shows a word-level
  added and removed view (pure diff function, tested).
- **Export:** "Download Word (.docx)" (Times New Roman 12 pt, 1 inch margins, headings and lists preserved, title and
  school in the file name), "Print or save as PDF" (print styles for the page only), "Copy as plain text", and
  "Copy for a portal" (`portalText` with an option for straight quotes). The .docx is generated on the server, owner-only.
- The statement rules from the earlier design (status, snapshots, readiness) are unchanged.

## 5. Rollout and polish (plan 3)

- Research writing sections, journal entries and school notes use the editor (full or compact) and show saved text
  through `RichView`. Existing entries keep working through `toEditorHtml`.
- Recommender email drafts use `paper-textarea`.
- Letters: add a request from the Letters tab; request one recommender for several schools in one step.
- Professional pass: a real audit of the new screens (statements, letters, editor) at phone and desktop widths,
  empty states, error messages, loading states, keyboard use and focus order; fix what it finds.
- Clear lint warnings in the files touched by plans 1 to 3.

## 6. Out of scope
Images and file embeds in text, comments and suggestions from other people, live co-editing, AI rewriting, find and
replace, and a table of contents.

## 7. Testing
Unit tests (Vitest): sanitizer (script tags, event attributes, `javascript:` and `data:` links, nested and broken
markup, allowed formatting kept), legacy conversion, plain-text and word-count parity with the old `countWords`,
`portalText`, hints and diff. Browser checks with `ZZTEMP` data that is deleted afterwards: typing and formatting,
autosave, local restore, stale-write refusal, pasting from Word-style HTML, exports (the .docx is opened and its
text checked), phone width. Row-level rules are unchanged; the new column follows the existing statements policy.
