import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const invalidSupabaseEnvVars = [];

if (!supabaseUrl || supabaseUrl.includes("your-project-ref.supabase.co")) {
  invalidSupabaseEnvVars.push("VITE_SUPABASE_URL");
}

if (!supabaseAnonKey || supabaseAnonKey === "your-supabase-anon-key") {
  invalidSupabaseEnvVars.push("VITE_SUPABASE_ANON_KEY");
}

export const isSupabaseConfigured = invalidSupabaseEnvVars.length === 0;
export { invalidSupabaseEnvVars };

function createConfigError() {
  return {
    message: `Invalid or missing Supabase environment variables: ${invalidSupabaseEnvVars.join(", ")}`,
    code: "SUPABASE_ENV_INVALID",
  };
}

function createDisabledSupabaseClient() {
  const error = createConfigError();
  const disabledAuthResult = async () => ({ data: null, error });

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
      signInWithPassword: disabledAuthResult,
      signUp: disabledAuthResult,
      signOut: disabledAuthResult,
    },
    from() {
      throw error;
    },
    rpc() {
      throw error;
    },
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDisabledSupabaseClient();
