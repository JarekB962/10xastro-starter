import { z } from "zod";
import type { ProjectInput } from "@/types";

const nameSchema = z
  .string({ error: "Nazwa projektu jest wymagana." })
  .trim()
  .min(1, "Nazwa projektu jest wymagana.")
  .max(100, "Nazwa projektu może mieć najwyżej 100 znaków.");

const descriptionSchema = z
  .string()
  .trim()
  .max(1000, "Opis może mieć najwyżej 1000 znaków.")
  .nullish()
  .transform((value) => (value?.length ? value : null));

export const projectInputSchema = z.object({ name: nameSchema, description: descriptionSchema });

export const projectIdSchema = z.uuid();

export type ParsedProjectInput = { ok: true; data: ProjectInput } | { ok: false; message: string };

/** Waliduje dane formularza projektu; pierwszy błąd wraca jako tekst do `?error=`. */
export function parseProjectInput(form: FormData): ParsedProjectInput {
  const result = projectInputSchema.safeParse({ name: form.get("name"), description: form.get("description") });
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Niepoprawne dane projektu." };
  }
  return { ok: true, data: result.data };
}

/** Zwraca identyfikator, jeśli jest poprawnym uuid; w przeciwnym razie `null` (traktowany jak "nie znaleziono"). */
export function parseProjectId(value: string | undefined): string | null {
  const result = projectIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
