import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: SupabaseClient | null = null;

/** Retorna o mesmo cliente Supabase (singleton) para evitar múltiplas instâncias GoTrueClient. */
export function createClient(): SupabaseClient {
  if (_client) return _client;
  _client = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return _client;
}
