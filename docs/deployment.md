# Deployment runbook

## Environment variables

Set these in Vercel (Project, Settings, Environment Variables) for Production, and locally in `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only, bypasses row-level security. Never expose. |
| `RESEND_API_KEY` | for email | Resend key for the Monday digest |
| `CRON_SECRET` | for the weekly cron | Random string; Vercel Cron sends it as a bearer token. Required for the weekly cron to work |
| `APP_URL` | for email | Public address, e.g. `https://your-app.vercel.app`, used for links in emails |
| `APP_TIMEZONE` | recommended | e.g. `Asia/Kathmandu`, so "today" and "Monday" are right |
| `DIGEST_FROM` | optional | Defaults to `Command Center <kcc@kacof.tech>` |

Generate a `CRON_SECRET` with: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

## Before the first deployment: invite-only sign-up

Do this before deploying: once the app is deployed the project URL and anon key are public, so anyone could otherwise create an account by calling the sign-up endpoint directly.

1. Create the staging project (see "Staging project" below).
2. On staging run `SUPABASE_PROJECT_REF=<staging-ref> npm run check:auth -- --fix`. Then confirm that an existing user can still sign in by email link and by password, and that an invite sent from the People page still arrives. Staging starts empty, so to do this:
   - Create a user on the staging project in the Supabase dashboard (Authentication, Users, Add user), with an email address you can read and a password.
   - Run the app locally against staging: temporarily set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` to the staging project's values (keep a copy of the production values and restore them afterwards), run `npm run dev`, and sign in as that user by email link and by password.
   - The staging user is not treated as the workspace owner (its ID differs from the owner ID built into the app), so owner-only pages will say they are not available. That is expected: this check only needs sign-in and the invite email to work.
   - A new Supabase project uses Supabase's default email sender, which is rate-limited and only sends to project team members. For a representative invite test, copy the same custom SMTP settings (the Resend sender) into the staging project under Authentication, SMTP settings. Otherwise treat the staging invite test as approximate and repeat it on production, with your own address, after deployment.
3. Only then run `SUPABASE_PROJECT_REF=<prod-ref> npm run check:auth -- --fix`. This changes a live security setting and is done by the owner.
4. Confirm a stranger cannot sign up: request an email link for an address that has no account and check that sign-ups are refused.

## First deployment

Do not deploy until "Before the first deployment: invite-only sign-up" is complete.

1. Create a private GitHub repository, then: `git remote add origin <url>` and `git push -u origin master`. This repository's local branch is `master`; whichever branch you push first becomes the repository's default branch on GitHub. In the Vercel project settings (Git), make sure the Production Branch matches the branch you pushed, otherwise the weekly cron never runs. Check the Actions tab shows a green `CI` run.
2. In Vercel: Add New Project, import the repository, framework Next.js, add the variables above, deploy.
3. Open `<your-url>/api/health`. Expected: `{"ok":true,"db":true}`.
4. In Supabase (Authentication, URL Configuration): set **Site URL** to the production address and add it plus `http://localhost:3000` to **Redirect URLs**. Until this is done, email links point at localhost.
5. Sign in on the production site with an email link, then set your password on the Account page.
6. Account page, "Monday email": press "Send me one now". Expected: the email arrives.
7. Run `SUPABASE_PROJECT_REF=<prod-ref> npm run check:auth -- --production` and make sure every line is PASS (this includes invite-only sign-up). If `check:auth` reports a FAIL, go back to "Before the first deployment: invite-only sign-up" and finish it.

Vercel's free tier allows scheduled jobs only once per day and is intended for personal, non-commercial use. If KACOF uses the app as an organization, use the paid tier.

## Staging project

Migrations are tested on staging before production.

1. In the Supabase dashboard create a second project named `command-center-staging`. Note its project ref.
2. Apply every migration: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:migrate`.
   The runner wraps each migration in a transaction and refuses to run on a project that already has tables but no migration records; use --baseline for those.
3. Check it: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:test`. Expected: `0 failed`.
4. Staging starts empty. Restoring production data into staging is not automated yet; if you need realistic data, use the loaders in `scripts/` (`load_schools.py`, `seed_research_milestones.py`) or add rows by hand. Test data uses the `ZZTEMP` prefix and is deleted afterwards.

Production is baselined once with `SUPABASE_PROJECT_REF=<prod-ref> node scripts/apply-migrations.mjs --baseline --production` (already done for the current production project on 2026-09-24, so you only repeat this for a new production project) so the runner knows what already ran there. From then on, apply new migrations to staging first, run the tests, take a backup of production, then apply to production (with `--production`).

## Before every production migration

1. Apply and test on staging: `SUPABASE_PROJECT_REF=<staging-ref> npm run db:migrate`, then `SUPABASE_PROJECT_REF=<staging-ref> npm run db:test`.
2. Back up production: `SUPABASE_PROJECT_REF=<prod-ref> npm run db:backup`. The backup contains table data, the user list and a listing of stored files only: no schema (migrations recreate that) and no file contents, and restoring is manual.
3. Apply to production: `SUPABASE_PROJECT_REF=<prod-ref> npm run db:migrate -- --production`
4. `SUPABASE_PROJECT_REF=<prod-ref> npm run db:test`

The migration runner refuses to run against the production project without `--production`, rejects unknown options, and refuses `--baseline` on a project that already has recorded migrations unless `--force` is added.

The commands in this runbook are written for Git Bash. In PowerShell, set the variable first with `$env:SUPABASE_PROJECT_REF='<ref>'` and clear it afterwards with `Remove-Item Env:SUPABASE_PROJECT_REF`, because it stays set for the whole session.

## Rotating keys

Do this whenever a key has appeared in chat, a screenshot or a log.

- **Resend:** create a new key in the Resend dashboard, update `RESEND_API_KEY` in Vercel and `.env.local`, redeploy, send a test digest, then delete the old key. Sign-in emails use a separate copy of the key inside Supabase (Authentication, SMTP): update that too.
- **Supabase access token (`.supabase-token`):** create a new personal access token in Supabase account settings, replace the file's content, revoke the old token.
- **`CRON_SECRET`:** generate a new value, update Vercel and `.env.local`, redeploy.
- **Supabase keys:** rotate in Supabase project settings only if a key may have leaked. Then copy BOTH the anon key and the service role key from Supabase into Vercel and `.env.local` (the anon key is embedded at build time), and redeploy.
