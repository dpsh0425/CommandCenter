# Audit of the new screens

Date: 2026-09-24
Screens: Statements list, Statement editor (all panels), Letters tab, School Application tab, `/week` "Recommenders to chase",
research writing section, journal form and entries, school notes.
Method: scripted checks in the browser (unlabeled controls, colour contrast of every text node against its background,
touch-target height, horizontal overflow, image alt text, heading count) at desktop width and at 375 wide, plus manual checks
of keyboard order, focus ring, long names, and the production build. All test data was `ZZTEMP` and has been deleted.

## Found and fixed

| # | Screen | Finding | Severity | Fix |
| --- | --- | --- | --- | --- |
| 1 | School notes, journal entries | Saved rich text used the paper text colour directly on the dark surface (dark on dark, about 1:1 contrast), so notes and journal details were nearly invisible. | High | `RichHtml` takes `onDark`, with a light-on-dark style, used by the notes timeline and journal rows. |
| 2 | Statement editor (phone) | Focus mode was covered at the bottom by the phone navigation. The page entry animation makes its own stacking layer, so `z-index` could not win. | Medium | Focus mode hides the fixed phone nav while it is on. |
| 3 | Statement editor | Undoing back to the saved text left a crash backup, offered on the next open as "unsaved changes". | Medium | The editor clears the backup it wrote when the text returns to the saved value (an older session's backup is untouched). |
| 4 | Statement editor (compare) | "1 words removed". | Low | Singular wording. |
| 5 | Letters tab, School Application, Statement editor (phone) | Buttons and selects were 29 to 33 px tall; links 16 to 20 px; the remove and delete icons 10 px wide. | Medium | One rule for phones: buttons and selects at least 40 px tall, icon buttons at least 40 px wide; padding on the new links. |
| 6 | School Application | Recommender picker and interview date-time input had no accessible name. | Medium | Added labels. |
| 7 | Letter request form | Screen readers read a school name and its "already requested" tag as one word. | Low | Space and parentheses added. |
| 8 | Whole app | Scrollbars showed as white strips on the dark theme. | Low | `color-scheme: dark`. |
| 9 | Whole app | Focus ring was the browser default (thin, pale). | Low | A 2 px brand-colour ring on every control for keyboard focus. |
| 10 | Letter actions | "not authenticated" was shown to a signed-out user. | Low | "You are signed out. Sign in again and retry." (the school-page letter actions). |

## Checked and fine

- Contrast: no text failed 4.5:1 (or 3:1 for large text) on any screen, dark or paper.
- No horizontal page scroll at 375 on any screen, including a 124-character recommender name and a very long email address.
- Keyboard order in the editor: back link, formatting toolbar (one stop, arrow keys inside), text, focus mode, status, exports.
- Empty states have a next action (Statements, Letters, hints panel).
- Errors: in a production build, creating a second statement of purpose for a school shows "This school already has a statement of that type."
- Saved sections, journal entries and notes: old plain text displays correctly; stored `<script>` and event handlers never run.
- Section text: no save on open; autosave stores cleaned HTML and bumps the version; a change made elsewhere stops saving and keeps the typed text.
- Letters tab: requesting letters for one recommender across schools adds each once, with the shared deadline, and disables schools already requested.

## Deferred

- Older screens (project tabs, "← All schools", the school header) still have 30 px tap targets and 16 px links; the phone rule covers buttons and selects only.
- Older server actions (schools, tasks, outreach, people, links, research) still throw `not authenticated` and other plain errors whose messages production hides; convert them to `ActionResult` in a later pass.
- The statement editor keeps its own copy of the autosave logic; move it onto `useRichAutosave` to remove the duplication.
