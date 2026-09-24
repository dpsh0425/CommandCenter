// Which environment variables the app needs, so a bad deployment fails loudly instead of half working.
export const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

// Features that switch off quietly without these.
export const OPTIONAL_ENV = ["RESEND_API_KEY", "DIGEST_FROM", "CRON_SECRET", "APP_URL", "APP_TIMEZONE"];

export function missingEnv(names: string[], env: Record<string, string | undefined> = process.env): string[] {
  return names.filter((n) => !env[n]);
}
