# Deployment runbook

## Environment variables

Set these in Vercel (Project, Settings, Environment Variables) for Production, and locally in `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only, bypasses row-level security. Never expose. |
| `RESEND_API_KEY` | for email | Resend key for the Monday digest |
| `CRON_SECRET` | for email | Random string; Vercel Cron sends it as a bearer token |
| `APP_URL` | for email | Public address, e.g. `https://your-app.vercel.app`, used for links in emails |
| `APP_TIMEZONE` | recommended | e.g. `Asia/Kathmandu`, so "today" and "Monday" are right |
| `DIGEST_FROM` | optional | Defaults to `Command Center <kcc@kacof.tech>` |

Generate a `CRON_SECRET` with: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

## First deployment

1. Create a private GitHub repository, then: `git remote add origin <url>` and `git push -u origin master`. Check the Actions tab shows a green `CI` run.
2. In Vercel: Add New Project, import the repository, framework Next.js, add the variables above, deploy.
3. Open `<your-url>/api/health`. Expected: `{"ok":true,"db":true}`.
4. In Supabase (Authentication, URL Configuration): set **Site URL** to the production address and add it plus `http://localhost:3000` to **Redirect URLs**. Until this is done, email links point at localhost.
5. Sign in on the production site with an email link, then set your password on the Account page.
6. Account page, "Monday email": press "Send me one now". Expected: the email arrives.
7. Run `SUPABASE_PROJECT_REF=<prod-ref> npm run check:auth -- --production` and make sure every line is PASS (this includes invite-only sign-up).

Vercel's free tier allows scheduled jobs only once per day and is intended for personal, non-commercial use. If KACOF uses the app as an organization, use the paid tier.

## Staging project

Migrations are tested on staging before production.

1. In the Supabase dashboard create a second project named `command-center-staging`. Note its project ref.
2. Apply every migration: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:migrate`.
   The runner wraps each migration in a transaction and refuses to run on a project that already has tables but no migration records; use --baseline for those.
3. Check it: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:test`. Expected: `0 failed`.
4. Optional: load a copy of production data for realistic checks by restoring from a backup file set (`npm run db:backup` on production first).

Production is baselined once (`--baseline`) so the runner knows what already ran there. From then on, apply new migrations to staging first, run the tests, take a backup of production, then apply to production.

## Before every production migration

1. `SUPABASE_PROJECT_REF=<prod-ref> npm run db:backup`
2. Apply and test on staging.
3. Apply to production: `SUPABASE_PROJECT_REF=<prod-ref> npm run db:migrate`
4. `SUPABASE_PROJECT_REF=<prod-ref> npm run db:test`

## Rotating keys

Do this whenever a key has appeared in chat, a screenshot or a log.

- **Resend:** create a new key in the Resend dashboard, update `RESEND_API_KEY` in Vercel and `.env.local`, redeploy, send a test digest, then delete the old key. Sign-in emails use a separate copy of the key inside Supabase (Authentication, SMTP): update that too.
- **Supabase access token (`.supabase-token`):** create a new personal access token in Supabase account settings, replace the file's content, revoke the old token.
- **`CRON_SECRET`:** generate a new value, update Vercel and `.env.local`, redeploy.
- **Service role key:** rotate in Supabase project settings only if it may have leaked, then update Vercel and `.env.local`.
