# Statement drafts and the recommender workflow: design

Date: 2026-09-24
Status: approved in conversation, written for review

## 1. Goal

Two gaps in the application workflow. Today a "statement" is only a label saying which version was sent, and a
recommendation letter is only a status dropdown. This design adds a real place to write and version statements, and
a workflow that tells you which recommenders to chase and drafts the emails to do it.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Where statements are written | In the app: editor with autosave, word count and versions. |
| How recommenders are contacted | The app drafts the emails; the user sends them from their own mail. The app sends nothing. |
| Build order | Two independent sub-projects, each with its own plan: statements first, then recommenders. |
| Access | Owner-only, using the existing row-level rules (`owner_id = auth.uid()`). |

## 3. Statement drafts

### 3.1 Concepts
- A **general draft** is a statement not tied to a school (`school_id` null), one per kind you keep improving.
- A **tailored version** is a statement tied to a school (`school_id` set), optionally created from a general draft
  (`source_id`). It carries the school's prompt and word limit.
- A **snapshot** is a saved copy of a statement's text at a moment, with a note.
- Kinds: statement of purpose, research statement, personal statement, diversity statement, other.
- Status: `draft`, `final`, `sent`. `sent` records `sent_on`.

### 3.2 Data
- `statements(id, owner_id, kind, title, prompt, word_limit, body, words, status, sent_on, school_id, source_id, created_at, updated_at)`
- `statement_snapshots(id, owner_id, statement_id, body, words, note, created_at)`
- Both owner-only. `school_id` and `source_id` are `on delete` set null or cascade as noted in the plan.
- A school has at most one statement per kind (unique on `(school_id, kind)` where `school_id` is not null).

### 3.3 Behaviour
- **List** (Materials, Statements tab): general drafts, then tailored versions grouped by school, with kind, status,
  words against the limit, and last edited.
- **Editor** (`/materials/statements/[id]`): title, prompt, word limit, a text area with autosave (1.5 s) and the
  unsaved-changes protection used elsewhere, a live word count that is neutral under 90% of the limit, amber from 90%
  to the limit, and red above it, status controls, and a snapshots panel.
- **Snapshots:** "Save a version" stores a snapshot with a note. "Restore" first snapshots the current text
  (note "before restoring"), then replaces the text. Snapshots can be viewed and deleted.
- **Create:** blank, or "from general draft" (copies body and prompt, sets `source_id`, applies the school's limit
  if known). Available from the list and from a school's Application tab.
- **Status rules:** setting `sent` records today's date if none; setting `draft` clears `sent_on`.
- **Readiness:** a school's "Statement of purpose" item is done when its statement of kind `statement_of_purpose` is
  `final` or `sent`, or the legacy `schools.sop_version_id` is set (so existing entries keep counting).
- **School page:** the Application tab's statement step shows the school's statement (status, words, limit) with
  "Open editor", or "Create from your general draft" / "Start blank". The legacy SOP form stays available for schools
  that already use it.

## 4. Recommender workflow

### 4.1 Data
`letter_requests` gains `asked_on date`, `last_reminded_on date`, `reminder_count int default 0`, `received_on date`.
The existing `notes` column is kept. Recommenders remain rows of `people` (an email address is optional).

### 4.2 Flags (pure logic)
- **Needs reminder:** status is `asked` (not confirmed or submitted), the last contact (`last_reminded_on`, else
  `asked_on`) is 10 or more days ago, OR the letter is not submitted and its deadline is within 14 days and it is
  not yet `confirmed`.
- **Not yet asked:** status `not_asked`, with a deadline within 45 days.
- **Heavy load:** a recommender with 6 or more letters that are not `submitted`.
- **Overdue:** deadline passed and not submitted.

### 4.3 Email drafts
Pure functions produce `{ subject, body }` for: a **request** (one email listing all of a recommender's schools that
are `not_asked`, or one for a single school), a **reminder** (their pending schools with deadlines), and a
**thank-you** (after `submitted`). Each has a `mailto:` link (kept under a length limit; over-long bodies fall back to
"Copy") and a "Copy" action. Sending is manual. After sending, "Mark as asked" or "Mark as reminded" records the date,
sets status to `asked` if it was `not_asked`, and increments `reminder_count` for reminders.

### 4.4 Screens
- **Letters** (Materials tab): a card per recommender with their schools, statuses, dates, flags, and the email
  actions.
- **School Application tab:** the existing letter list shows dates and the same email actions for one school.
- **Weekly page and Monday email:** a "Recommenders to chase" list from the flags.

## 5. Out of scope
The app sending email, uploading letters, detecting submission automatically, a per-program breakdown of letters,
side-by-side diff of snapshots, and sharing drafts with other people.

## 6. Testing
Pure logic is unit-tested with Vitest: word-limit state, statement status transitions, readiness statement rule,
letter flags, load warning, email text and `mailto` length handling. Screens are checked in the browser with `ZZTEMP`
data that is deleted afterwards. Row-level security is confirmed with the database test harness.
