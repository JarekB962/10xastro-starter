import { z } from "zod";
import type { ParsedTaskInput } from "@/types";

const MAX_NUMBER = 2147483647;
const MAX_EFFORT = 99999999.99;
const MAX_PREDECESSORS = 50;

const NUMBER_REQUIRED = "Numer zadania jest wymagany.";
const NUMBER_INVALID = "Numer zadania musi być liczbą całkowitą od 1.";
const PREDECESSORS_INVALID = "Poprzednicy to numery zadań rozdzielone przecinkami.";
const SELF_PREDECESSOR = "Zadanie nie może być własnym poprzednikiem.";
const EFFORT_INVALID = "Nakład musi być liczbą nie mniejszą niż 0.";

/** Numer zadania: same cyfry, 1..2147483647 (bez znaku, spacji i notacji naukowej). */
function toTaskNumber(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_NUMBER ? value : null;
}

const numberSchema = z
  .string({ error: NUMBER_REQUIRED })
  .trim()
  .min(1, NUMBER_REQUIRED)
  .transform((text, ctx) => {
    const value = toTaskNumber(text);
    if (value === null) {
      ctx.addIssue({ code: "custom", message: NUMBER_INVALID });
      return z.NEVER;
    }
    return value;
  });

const nameSchema = z
  .string({ error: "Nazwa zadania jest wymagana." })
  .trim()
  .min(1, "Nazwa zadania jest wymagana.")
  .max(100, "Nazwa zadania może mieć najwyżej 100 znaków.");

const specialtySchema = z
  .string()
  .trim()
  .transform((text) => (text === "" ? null : text))
  .pipe(z.uuid({ error: "Wybrana specjalność jest niepoprawna." }).nullable());

const effortSchema = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (text === "") return null;
    const normalized = text.replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      ctx.addIssue({ code: "custom", message: EFFORT_INVALID });
      return z.NEVER;
    }
    const value = Number(normalized);
    if (value > MAX_EFFORT) {
      ctx.addIssue({ code: "custom", message: EFFORT_INVALID });
      return z.NEVER;
    }
    return value;
  });

const predecessorsSchema = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (text === "") return [];
    const seen = new Set<number>();
    for (const part of text.split(",")) {
      const value = toTaskNumber(part.trim());
      if (value === null) {
        ctx.addIssue({ code: "custom", message: PREDECESSORS_INVALID });
        return z.NEVER;
      }
      seen.add(value);
    }
    if (seen.size > MAX_PREDECESSORS) {
      ctx.addIssue({ code: "custom", message: `Zadanie może mieć najwyżej ${String(MAX_PREDECESSORS)} poprzedników.` });
      return z.NEVER;
    }
    return [...seen];
  });

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Waliduje dane formularza zadania; pierwszy błąd (numer, nazwa, specjalność, nakład, poprzednicy) wraca jako tekst do `?error=`. */
export function parseTaskInput(form: FormData): ParsedTaskInput {
  const number = numberSchema.safeParse(form.get("task_number"));
  if (!number.success) return { ok: false, message: number.error.issues[0]?.message ?? NUMBER_INVALID };

  const name = nameSchema.safeParse(form.get("task_name"));
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message ?? "Niepoprawna nazwa zadania." };

  const specialty = specialtySchema.safeParse(field(form, "task_specialty"));
  if (!specialty.success) {
    return { ok: false, message: specialty.error.issues[0]?.message ?? "Wybrana specjalność jest niepoprawna." };
  }

  const effort = effortSchema.safeParse(field(form, "task_effort"));
  if (!effort.success) return { ok: false, message: effort.error.issues[0]?.message ?? EFFORT_INVALID };

  const predecessors = predecessorsSchema.safeParse(field(form, "task_predecessors"));
  if (!predecessors.success) {
    return { ok: false, message: predecessors.error.issues[0]?.message ?? PREDECESSORS_INVALID };
  }

  if (predecessors.data.includes(number.data)) {
    return { ok: false, message: SELF_PREDECESSOR };
  }

  return {
    ok: true,
    data: {
      number: number.data,
      name: name.data,
      specialtyId: specialty.data,
      effort: effort.data,
      predecessors: predecessors.data,
    },
  };
}
