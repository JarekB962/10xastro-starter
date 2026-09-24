import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";
import { errorUrl, readForm } from "@/lib/forms";
import { parseCredentials } from "@/lib/validation/auth";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = parseCredentials(await readForm(context.request));
  if (!parsed.ok) {
    return context.redirect(errorUrl("/auth/signup", parsed.message));
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(errorUrl("/auth/signup", "Supabase nie jest skonfigurowany"));
  }
  const { error } = await supabase.auth.signUp({ email: parsed.email, password: parsed.password });

  if (error) {
    return context.redirect(errorUrl("/auth/signup", authErrorMessage(error)));
  }

  return context.redirect("/auth/confirm-email");
};
