import { failWith, type Db } from "@/lib/services/db-errors";
import { findDependents } from "@/lib/task-dependents";
import { TASK_FIELD_MESSAGES } from "@/lib/validation/task-fields";
import type {
  DeleteTaskResult,
  ServiceResult,
  Task,
  TaskInput,
  TaskServiceError,
  TaskUpdateInput,
  UpdateTaskResult,
} from "@/types";

export { NO_PROJECT_SELECTED_MESSAGE } from "@/lib/services/specialties";

export const TASK_NOT_FOUND_MESSAGE = "Nie znaleziono zadania.";

export const TASK_ERROR_MESSAGES: Record<TaskServiceError, string> = {
  duplicate_number: "Zadanie o takim numerze już istnieje.",
  has_dependents: "Zadanie nie może zostać usunięte: jest poprzednikiem innych zadań.",
  invalid_specialty: "Wybrana specjalność nie istnieje w tym projekcie.",
  not_found: "Nie znaleziono projektu.",
  number_referenced: "Ten numer jest już wpisany jako poprzednik w innych zadaniach.",
  self_predecessor: TASK_FIELD_MESSAGES.selfPredecessor,
  unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
};

/** Komunikat o zadaniach blokujących usunięcie, np. „Zadanie nie może zostać usunięte: jest poprzednikiem zadań 3, 5, 7.” */
export function taskHasDependentsMessage(dependents: Task[]): string {
  if (dependents.length === 0) return TASK_ERROR_MESSAGES.has_dependents;
  return `Zadanie nie może zostać usunięte: jest poprzednikiem zadań ${dependents.map((task) => task.number).join(", ")}.`;
}

// 23505 zajęty numer, 23503 specjalność spoza projektu, 23514 wyzwalacz "własny poprzednik" (zod łapie to wcześniej;
// przy zmianie numeru wyzwalacz sprawdza jeszcze zapisane dane), 23001 wyzwalacz blokady usunięcia poprzednika
// (przy zmianie numeru `updateTask` mapuje go na `number_referenced`), 42501 cudzy projekt (RLS), P0002 brak zadania w `update_task`.
const TASK_DB_ERRORS: Record<string, Exclude<TaskServiceError, "number_referenced">> = {
  "23505": "duplicate_number",
  "23503": "invalid_specialty",
  "23514": "self_predecessor",
  "23001": "has_dependents",
  "42501": "not_found",
  P0002: "not_found",
};

/** Komunikat o zadaniach blokujących zmianę numeru, np. „Numer 7 jest już wpisany jako poprzednik w zadaniach: 3, 5. Popraw ich poprzedników i spróbuj ponownie.” */
export function taskNumberReferencedMessage(number: number, dependents: Task[]): string {
  if (dependents.length === 0) return TASK_ERROR_MESSAGES.number_referenced;
  return `Numer ${String(number)} jest już wpisany jako poprzednik w zadaniach: ${dependents.map((task) => task.number).join(", ")}. Popraw ich poprzedników i spróbuj ponownie.`;
}

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
  "id, project_id, number, name, effort, specialty_id, created_at, updated_at, specialties(name), task_predecessors(predecessor_number)";

function toTask(row: {
  id: string;
  project_id: string;
  number: number;
  name: string;
  effort: number | null;
  specialty_id: string | null;
  specialties: { name: string } | null;
  task_predecessors: { predecessor_number: number }[];
  created_at: string;
  updated_at: string;
}): Task {
  return {
    id: row.id,
    project_id: row.project_id,
    number: row.number,
    name: row.name,
    effort: row.effort,
    specialty_id: row.specialty_id,
    specialty: row.specialties?.name ?? null,
    predecessors: row.task_predecessors.map((p) => p.predecessor_number).sort((a, b) => a - b),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listTasks(db: Db, projectId: string): Promise<ServiceResult<Task[], TaskServiceError>> {
  const { data, error } = await db.from("tasks").select(TASK_SELECT).eq("project_id", projectId).order("number");
  if (error) return failWith("tasks", error, TASK_DB_ERRORS);
  return { ok: true, data: data.map(toTask) };
}

export async function getTask(db: Db, id: string): Promise<ServiceResult<Task, TaskServiceError>> {
  const { data, error } = await db.from("tasks").select(TASK_SELECT).eq("id", id).maybeSingle();
  if (error) return failWith("tasks", error, TASK_DB_ERRORS);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data: toTask(data) };
}

/**
 * Usuwa zadanie, o ile żadne inne zadanie projektu nie ma go za poprzednika; inaczej `has_dependents` z ich listą.
 * Blokadę pilnuje też wyzwalacz w bazie (23001), który zabezpiecza bezpośrednie wywołania API. Wyścig z dodaniem
 * poprzednika wskazującego na usuwane zadanie nie jest blokowany: zostaje wtedy „nieistniejący poprzednik”, który
 * wykrywa sprawdzenie listy zadań (PRD dopuszcza takie odwołania).
 */
export async function deleteTask(db: Db, id: string): Promise<DeleteTaskResult> {
  const task = await getTask(db, id);
  if (!task.ok) return { ok: false, error: task.error === "not_found" ? "not_found" : "unexpected" };

  const tasks = await listTasks(db, task.data.project_id);
  if (!tasks.ok) return { ok: false, error: "unexpected" };
  const dependents = findDependents(tasks.data, task.data.number);
  if (dependents.length > 0) return { ok: false, error: "has_dependents", dependents };

  const { data, error } = await db.from("tasks").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23001") {
      const fresh = await listTasks(db, task.data.project_id);
      if (!fresh.ok) return { ok: false, error: "unexpected" };
      const dependents = findDependents(fresh.data, task.data.number);
      // Zależne zadania zniknęły w międzyczasie: nie ma czego pokazać, więc zwykły błąd do ponowienia.
      return dependents.length > 0
        ? { ok: false, error: "has_dependents", dependents }
        : { ok: false, error: "unexpected" };
    }
    const failure = failWith("tasks", error, TASK_DB_ERRORS);
    return { ok: false, error: failure.error === "not_found" ? "not_found" : "unexpected" };
  }
  if (data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}

/**
 * Zapisuje poprawkę zadania razem z numerem; zmiana numeru przepisuje poprzedników w bazie (wyzwalacz). Numer zajęty
 * to `duplicate_number`, a numer wpisany już jako poprzednik w innych zadaniach to `number_referenced` z ich listą.
 * Wyzwalacz nie serializuje się względem równoległych zapisów poprzedników: równoczesne dodanie poprzednika o starym
 * lub nowym numerze może dać mylny komunikat albo wiszące odwołanie, które wykryje sprawdzenie listy zadań (znany,
 * akceptowany wyścig, jak przy usuwaniu zadania).
 */
export async function updateTask(db: Db, id: string, input: TaskUpdateInput): Promise<UpdateTaskResult> {
  const { data, error } = await db.rpc("update_task", {
    p_id: id,
    p_number: input.number,
    p_name: input.name,
    p_specialty_id: input.specialtyId,
    p_effort: input.effort,
    p_predecessors: input.predecessors,
  });
  if (error) {
    if (error.code === "23001") {
      const task = await getTask(db, id);
      if (!task.ok) return { ok: false, error: task.error === "not_found" ? "not_found" : "unexpected" };
      const fresh = await listTasks(db, task.data.project_id);
      if (!fresh.ok) return { ok: false, error: "unexpected" };
      const dependents = findDependents(
        fresh.data.filter((t) => t.id !== id),
        input.number,
      );
      // Zależne zadania zniknęły w międzyczasie: nie ma czego pokazać, więc zwykły błąd do ponowienia.
      return dependents.length > 0
        ? { ok: false, error: "number_referenced", dependents }
        : { ok: false, error: "unexpected" };
    }
    const failure = failWith("tasks", error, TASK_DB_ERRORS);
    return { ok: false, error: failure.error };
  }
  return { ok: true, data: { id: data.id } };
}

export async function createTask(
  db: Db,
  projectId: string,
  input: TaskInput,
): Promise<ServiceResult<{ id: string }, TaskServiceError>> {
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
