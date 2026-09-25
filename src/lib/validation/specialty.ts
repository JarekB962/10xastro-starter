import { z } from "zod";
import type { ParsedSpecialtyInput } from "@/types";

const nameSchema = z
  .string({ error: "Nazwa specjalności jest wymagana." })
  .trim()
  .min(1, "Nazwa specjalności jest wymagana.")
  .max(100, "Nazwa specjalności może mieć najwyżej 100 znaków.");

const specialtyIdSchema = z.uuid();

/** Waliduje dane formularza specjalności; pierwszy błąd wraca jako tekst do `?error=`. */
export function parseSpecialtyInput(form: FormData): ParsedSpecialtyInput {
  const result = nameSchema.safeParse(form.get("specialty_name"));
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Niepoprawne dane specjalności." };
  }
  return { ok: true, data: { name: result.data } };
}

/** Zwraca identyfikator, jeśli jest poprawnym uuid; w przeciwnym razie `null` (traktowany jak "nie znaleziono"). */
export function parseSpecialtyId(value: string | undefined): string | null {
  const result = specialtyIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
