# Monday email

A weekly summary sent to the owner: applications at risk, deadlines in the next two weeks, tasks and
milestones, professors to follow up with, and last week's research.

## Set up

Add these to the server environment (`.env.local` locally, or your host's settings):

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key. Without it nothing is sent; the preview still works. |
| `CRON_SECRET` | Random string the scheduler sends as `Authorization: Bearer <CRON_SECRET>`. |
| `APP_URL` | Public address of the app, for links in the email (e.g. `https://app.example.com`). |
| `APP_TIMEZONE` | Owner's timezone, e.g. `Asia/Kathmandu`, so "today" and "Monday" are right. |
| `DIGEST_FROM` | Optional sender. Defaults to `Command Center <kcc@kacof.tech>`. |

The sender's domain must be verified in Resend.

## Check it

- Account page: **Preview it** opens the email in a tab; **Send me one now** sends it to the signed-in owner.
- `GET /api/digest?preview=1` (signed in as owner) shows the HTML. `?dry=1` returns the subject and plain text.

## Schedule it

The app does not run its own timer. Any scheduler that can make an HTTP request works:

- **Vercel Cron**: add `{"crons":[{"path":"/api/digest","schedule":"15 1 * * 1"}]}` to `vercel.json`.
  Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
  Schedules are in UTC: `15 1 * * 1` is Monday 01:15 UTC, which is 07:00 in Nepal.
- **GitHub Actions or any cron**: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP/api/digest`

The route sends only to the owner's own email address.
