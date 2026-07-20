import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env";

/**
 * Server-only Supabase client using the SECRET key.
 *
 * This bypasses row-level security and must NEVER be imported into a Client
 * Component or exposed to the browser. All privileged reads/writes go through
 * route handlers and server actions that import this.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(serverEnv.supabaseUrl(), serverEnv.supabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
