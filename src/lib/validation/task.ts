import { z } from "zod";
import type { ParsedTaskInput, ParsedTaskUpdateInput, TaskUpdateInput } from "@/types";
import {
  MAX_NAME_LENGTH,
  TASK_FIELD_MESSAGES as MESSAGES,
  parseEffort,
  parsePredecessors,
  toTaskNumber,
} from "@/lib/validation/task-fields";

const numberSchema = z
  .string({ error: MESSAGES.numberRequired })
  .trim()
  .min(1, MESSAGES.numberRequired)
  .transform((text, ctx) => {
    const value = toTaskNumber(text);
    if (value === null) {
      ctx.addIssue({ code: "custom", message: MESSAGES.numberInvalid });
      return z.NEVER;
    }
    return value;
  });

const nameSchema = z
  .string({ error: MESSAGES.nameRequired })
  .trim()
  .min(1, MESSAGES.nameRequired)
  .max(MAX_NAME_LENGTH, MESSAGES.nameTooLong);

const specialtySchema = z
  .string()
  .trim()
  .transform((text) => (text === "" ? null : text))
  .pipe(z.uuid({ error: "Wybrana specjalność jest niepoprawna." }).nullable());

const effortSchema = z.string().transform((text, ctx) => {
  const result = parseEffort(text);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: MESSAGES.effortInvalid });
    return z.NEVER;
  }
  return result.value;
});

const predecessorsSchema = z.string().transform((text, ctx) => {
  const result = parsePredecessors(text);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.message });
    return z.NEVER;
  }
  return result.value;
});

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Waliduje pola wspólne dodania i poprawki (nazwa, specjalność, nakład, poprzednicy); `number` służy do odrzucenia własnego poprzednika. */
function parseSharedFields(
  form: FormData,
  number: number,
): { ok: true; data: TaskUpdateInput } | { ok: false; message: string } {
  const name = nameSchema.safeParse(form.get("task_name"));
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message ?? "Niepoprawna nazwa zadania." };

  const specialty = specialtySchema.safeParse(field(form, "task_specialty"));
  if (!specialty.success) {
    return { ok: false, message: specialty.error.issues[0]?.message ?? "Wybrana specjalność jest niepoprawna." };
  }

  const effort = effortSchema.safeParse(field(form, "task_effort"));
  if (!effort.success) return { ok: false, message: effort.error.issues[0]?.message ?? MESSAGES.effortInvalid };

  const predecessors = predecessorsSchema.safeParse(field(form, "task_predecessors"));
  if (!predecessors.success) {
    return { ok: false, message: predecessors.error.issues[0]?.message ?? MESSAGES.predecessorsInvalid };
  }

  if (predecessors.data.includes(number)) {
    return { ok: false, message: MESSAGES.selfPredecessor };
  }

  return {
    ok: true,
    data: {
      name: name.data,
      specialtyId: specialty.data,
      effort: effort.data,
      predecessors: predecessors.data,
    },
  };
}

/** Waliduje dane formularza zadania; pierwszy błąd (numer, nazwa, specjalność, nakład, poprzednicy) wraca jako tekst do `?error=`. */
export function parseTaskInput(form: FormData): ParsedTaskInput {
  const number = numberSchema.safeParse(form.get("task_number"));
  if (!number.success) return { ok: false, message: number.error.issues[0]?.message ?? MESSAGES.numberInvalid };

  const fields = parseSharedFields(form, number.data);
  if (!fields.ok) return fields;
  return { ok: true, data: { number: number.data, ...fields.data } };
}

/** Waliduje poprawkę zadania: pole `task_number` jest ignorowane, `taskNumber` to numer zapisanego zadania. */
export function parseTaskUpdateInput(form: FormData, taskNumber: number): ParsedTaskUpdateInput {
  return parseSharedFields(form, taskNumber);
}

const taskIdSchema = z.uuid();

/** Zwraca identyfikator, jeśli jest poprawnym uuid; w przeciwnym razie `null` (traktowany jak "nie znaleziono"). */
export function parseTaskId(value: string | undefined): string | null {
  const result = taskIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
