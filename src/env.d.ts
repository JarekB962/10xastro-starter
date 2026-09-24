declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    /** Klient Supabase utworzony raz na żądanie w middleware; `null`, gdy brakuje konfiguracji. */
    supabase: ReturnType<typeof import("@/lib/supabase").createClient>;
  }
}
