import { env } from "../env.ts";

export const hasSupabaseConfig = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

export const supabase = null;
