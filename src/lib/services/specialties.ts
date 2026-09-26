import { fail, type Db } from "@/lib/services/db-errors";
import { listTasks } from "@/lib/services/tasks";
import { findTasksWithSpecialty } from "@/lib/task-dependents";
import type {
  CommonServiceError,
  DeleteSpecialtyResult,
  ServiceResult,
  Specialty,
  SpecialtyInput,
  Task,
} from "@/types";

const SPECIALTY_COLUMNS = "id, name, created_at, updated_at";
// Do usuwania potrzebny jest też projekt specjalności (lista jego zadań); nie trafia do typu `Specialty` w interfejsie.
const SPECIALTY_WITH_PROJECT_COLUMNS = "id, name, created_at, updated_at, project_id";

export const SPECIALTY_ERROR_MESSAGES: Record<CommonServiceError, string> = {
  duplicate_name: "Specjalność o takiej nazwie już istnieje.",
  not_found: "Nie znaleziono specjalności.",
  unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
};

export const SPECIALTY_IN_USE_MESSAGE = "Specjalność jest używana w zadaniach i nie można jej usunąć.";

export const NO_PROJECT_SELECTED_MESSAGE = "Nie wybrano projektu.";

// Limit z zapasem ponad walidację (100 znaków), żeby adres przekierowania nie urósł bez końca.
const KEPT_NAME_LENGTH = 200;

/** Wartość pola formularza specjalności do odesłania razem z błędem, żeby dane nie znikały. */
export function formValues(form: FormData): Record<string, string> {
  const value = form.get("specialty_name");
  return { specialty_name: typeof value === "string" ? value.slice(0, KEPT_NAME_LENGTH) : "" };
}

export async function listSpecialties(db: Db, projectId: string): Promise<ServiceResult<Specialty[]>> {
  const { data, error } = await db
    .from("specialties")
    .select(SPECIALTY_COLUMNS)
    .eq("project_id", projectId)
    .order("name");
  if (error) return fail("specialties", error);
  return { ok: true, data };
}

export async function getSpecialty(db: Db, id: string): Promise<ServiceResult<Specialty>> {
  const { data, error } = await db.from("specialties").select(SPECIALTY_COLUMNS).eq("id", id).maybeSingle();
  if (error) return fail("specialties", error);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data };
}

// Kody 23503 (projekt zniknął) i 42501 (cudzy projekt) oznaczają tu "nie znaleziono", więc `creating` zostaje wyłączone.
export async function createSpecialty(
  db: Db,
  projectId: string,
  input: SpecialtyInput,
): Promise<ServiceResult<Specialty>> {
  const { data, error } = await db
    .from("specialties")
    .insert({ project_id: projectId, name: input.name })
    .select(SPECIALTY_COLUMNS)
    .single();
  if (error) return fail("specialties", error);
  return { ok: true, data };
}

export async function updateSpecialty(db: Db, id: string, input: SpecialtyInput): Promise<ServiceResult<Specialty>> {
  const { data, error } = await db
    .from("specialties")
    .update({ name: input.name })
    .eq("id", id)
    .select(SPECIALTY_COLUMNS)
    .maybeSingle();
  if (error) return fail("specialties", error);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data };
}

/** Specjalność razem z zadaniami projektu, które jej używają (rosnąco po numerze); brak specjalności to `not_found`. */
export async function getSpecialtyUsage(
  db: Db,
  id: string,
): Promise<ServiceResult<{ specialty: Specialty; tasks: Task[] }>> {
  const { data, error } = await db
    .from("specialties")
    .select(SPECIALTY_WITH_PROJECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("specialties", error);
  if (!data) return { ok: false, error: "not_found" };

  const tasks = await listTasks(db, data.project_id);
  if (!tasks.ok) return { ok: false, error: "unexpected" };
  const { project_id: _projectId, ...specialty } = data;
  return { ok: true, data: { specialty, tasks: findTasksWithSpecialty(tasks.data, id) } };
}

/**
 * Usuwa specjalność, o ile żadne zadanie projektu jej nie używa; inaczej `in_use` z listą zadań. Blokadę pilnuje też
 * klucz obcy w bazie (23503, `on delete restrict`), który zabezpiecza bezpośrednie wywołania API i wyścig z przypisaniem
 * specjalności do zadania.
 */
export async function deleteSpecialty(db: Db, id: string): Promise<DeleteSpecialtyResult> {
  const usage = await getSpecialtyUsage(db, id);
  if (!usage.ok) return { ok: false, error: usage.error === "not_found" ? "not_found" : "unexpected" };
  if (usage.data.tasks.length > 0) return { ok: false, error: "in_use", tasks: usage.data.tasks };

  const { data, error } = await db.from("specialties").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") {
      const fresh = await getSpecialtyUsage(db, id);
      if (!fresh.ok) return { ok: false, error: fresh.error === "not_found" ? "not_found" : "unexpected" };
      // Zadania zniknęły w międzyczasie: nie ma czego pokazać, więc zwykły błąd do ponowienia.
      return fresh.data.tasks.length > 0
        ? { ok: false, error: "in_use", tasks: fresh.data.tasks }
        : { ok: false, error: "unexpected" };
    }
    const failure = fail("specialties", error);
    return { ok: false, error: failure.error === "not_found" ? "not_found" : "unexpected" };
  }
  if (data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}
