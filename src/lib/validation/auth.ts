import { z } from "zod";
import { INVALID_FORM_MESSAGE } from "@/lib/forms";

const credentialsSchema = z.object({
  email: z
    .string({ error: "Podaj adres email" })
    .trim()
    .min(1, "Podaj adres email")
    .pipe(z.email("Podaj poprawny adres email")),
  password: z.string({ error: "Podaj hasło" }).min(1, "Podaj hasło"),
});

export type ParsedCredentials = { ok: true; email: string; password: string } | { ok: false; message: string };

/** Waliduje pola logowania i rejestracji; pierwszy błąd wraca jako tekst do `?error=`. */
export function parseCredentials(form: FormData | null): ParsedCredentials {
  if (!form) return { ok: false, message: INVALID_FORM_MESSAGE };
  const result = credentialsSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!result.success) return { ok: false, message: result.error.issues[0]?.message ?? INVALID_FORM_MESSAGE };
  return { ok: true, ...result.data };
}
