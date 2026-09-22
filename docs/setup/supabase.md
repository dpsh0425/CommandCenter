# Supabase setup

**Status: done**, via the Management API using a personal access token, against an
already-existing project (`commandcenter`, ref `yzbpaoknnzdtrvowbvum`, region
ap-northeast-1) rather than creating a new one.

- `.env.local` is populated with the project URL, anon key, and service_role key.
- Email auth is enabled (`external_email_enabled: true`).
- Owner account created: `dbhatta245@gmail.com`, user id
  `41781551-3aca-4a59-b517-16189aa9c896` — this is the `--owner-id` value every
  later seed script in the plan (Tasks 6, 15) needs.
- The Management API token used to do this is stored in `.supabase-token`
  (gitignored) for reuse in later tasks — never commit it, and treat it like a
  password (it can create/modify/delete projects on the account).

The manual steps below are kept for reference / for redoing this on a fresh
account, but were not the path actually taken this time.

1. Go to https://supabase.com/dashboard and sign in (create an account if you don't have one).
2. Click "New project". Name it `grad-command-center`, pick a region close to you, set a database password (save it somewhere — you won't need it for the app, only for direct DB access).
3. Once provisioned, go to Project Settings > API. Copy:
   - "Project URL" -> NEXT_PUBLIC_SUPABASE_URL
   - "anon public" key -> NEXT_PUBLIC_SUPABASE_ANON_KEY
   - "service_role" key -> SUPABASE_SERVICE_ROLE_KEY (keep this one secret — it bypasses RLS; used only by the Python loader script in Task 6, never in the Next.js app itself)
4. Paste all three into `.env.local`.
5. Go to Authentication > Providers and confirm Email is enabled. Under Authentication > Settings, decide: magic link (simplest) or email/password. This plan uses magic link — if you'd rather use a password, adjust Task 4 accordingly.
6. Go to Authentication > Users and manually create your one user account (your email). This is the only account this app will ever have.
