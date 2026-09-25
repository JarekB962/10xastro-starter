import { failWith, type Db } from "@/lib/services/db-errors";
import type { ServiceError, ServiceResult, Task, TaskInput } from "@/types";

export { NO_PROJECT_SELECTED_MESSAGE } from "@/lib/services/specialties";

export const TASK_ERROR_MESSAGES: Record<ServiceError, string> = {
  duplicate_number: "Zadanie o takim numerze już istnieje.",
  invalid_specialty: "Wybrana specjalność nie istnieje w tym projekcie.",
  not_found: "Nie znaleziono projektu.",
  unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
  // Kod projektów i specjalności; usługa zadań go nie zwraca.
  duplicate_name: "Coś poszło nie tak. Spróbuj ponownie.",
};

// 23505 zajęty numer, 23503 specjalność spoza projektu, 23514 wyzwalacz "własny poprzednik" (zod łapie to wcześniej),
// 42501 cudzy projekt (RLS).
const TASK_DB_ERRORS: Record<string, ServiceError> = {
  "23505": "duplicate_number",
  "23503": "invalid_specialty",
  "23514": "unexpected",
  "42501": "not_found",
};

// Limit z zapasem ponad walidację, żeby adres przekierowania nie urósł bez końca.
const KEPT_FIELD_LENGTH = 200;
const FORM_FIELDS = ["task_number", "task_name", "task_specialty", "task_effort", "task_predecessors"] as const;

/** Wartości pól formularza zadania do odesłania razem z błędem, żeby dane nie znikały. */
export function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of FORM_FIELDS) {
    const value = form.get(name);
    values[name] = typeof value === "string" ? value.slice(0, KEPT_FIELD_LENGTH) : "";
  }
  return values;
}

const TASK_SELECT =
  "id, number, name, effort, created_at, updated_at, specialties(name), task_predecessors(predecessor_number)";

export async function listTasks(db: Db, projectId: string): Promise<ServiceResult<Task[]>> {
  const { data, error } = await db.from("tasks").select(TASK_SELECT).eq("project_id", projectId).order("number");
  if (error) return failWith("tasks", error, TASK_DB_ERRORS);

  const tasks = data.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    effort: row.effort,
    specialty: row.specialties?.name ?? null,
    predecessors: row.task_predecessors.map((p) => p.predecessor_number).sort((a, b) => a - b),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  return { ok: true, data: tasks };
}

export async function createTask(db: Db, projectId: string, input: TaskInput): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await db.rpc("create_task", {
    p_project_id: projectId,
    p_number: input.number,
    p_name: input.name,
    p_specialty_id: input.specialtyId,
    p_effort: input.effort,
    p_predecessors: input.predecessors,
  });
  if (error) return failWith("tasks", error, TASK_DB_ERRORS);
  return { ok: true, data: { id: data.id } };
}
