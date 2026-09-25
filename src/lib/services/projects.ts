import { fail, type Db } from "@/lib/services/db-errors";
import type { Project, ServiceError, ProjectInput, ServiceResult } from "@/types";

const PROJECT_COLUMNS = "id, name, description, created_at, updated_at";

export const SUPABASE_NOT_CONFIGURED = "Supabase nie jest skonfigurowany";

export const PROJECT_ERROR_MESSAGES: Record<ServiceError, string> = {
  duplicate_name: "Projekt o takiej nazwie już istnieje.",
  not_found: "Nie znaleziono projektu.",
  unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
  // Kody zadań; usługa projektów ich nie zwraca.
  duplicate_number: "Coś poszło nie tak. Spróbuj ponownie.",
  invalid_specialty: "Coś poszło nie tak. Spróbuj ponownie.",
};

// Limity z zapasem ponad walidację (100 i 1000 znaków), żeby adres przekierowania nie urósł bez końca.
const KEPT_NAME_LENGTH = 200;
const KEPT_DESCRIPTION_LENGTH = 1100;

/** Wartości pól formularza projektu do odesłania razem z błędem, żeby dane nie znikały. */
export function formValues(form: FormData): Record<string, string> {
  const pick = (key: string, max: number) => {
    const value = form.get(key);
    return typeof value === "string" ? value.slice(0, max) : "";
  };
  return {
    project_name: pick("project_name", KEPT_NAME_LENGTH),
    project_description: pick("project_description", KEPT_DESCRIPTION_LENGTH),
  };
}

export async function listProjects(db: Db): Promise<ServiceResult<Project[]>> {
  const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).order("name");
  if (error) return fail("projects", error);
  return { ok: true, data };
}

export async function getProject(db: Db, id: string): Promise<ServiceResult<Project>> {
  const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) return fail("projects", error);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data };
}

/** Identyfikator wybranego projektu (jedno zapytanie); wystarcza tam, gdzie treść projektu jest już wczytana. */
export async function getSelectedProjectId(db: Db): Promise<ServiceResult<string | null>> {
  // Reguły dostępu ograniczają odczyt do własnego wiersza użytkownika.
  const { data, error } = await db.from("user_settings").select("selected_project_id").maybeSingle();
  if (error) return fail("projects", error);
  return { ok: true, data: data?.selected_project_id ?? null };
}

export async function getSelectedProject(db: Db): Promise<ServiceResult<Project | null>> {
  const selectedId = await getSelectedProjectId(db);
  if (!selectedId.ok) return selectedId;
  if (!selectedId.data) return { ok: true, data: null };

  const project = await getProject(db, selectedId.data);
  if (project.ok) return project;
  return project.error === "not_found" ? { ok: true, data: null } : project;
}

export async function selectProject(db: Db, id: string): Promise<ServiceResult<null>> {
  // `user_id` ma domyślną wartość auth.uid(); wiersz powstaje przy pierwszym wyborze projektu.
  const { error } = await db
    .from("user_settings")
    .upsert({ selected_project_id: id }, { onConflict: "user_id", defaultToNull: false });
  if (error) return fail("projects", error);
  return { ok: true, data: null };
}

// Bez wybranego projektu pierwszy dodany staje się bieżącym; niepowodzenie wyboru nie cofa dodania, ale trafia do logów.
// Użytkownik, który już ma wybór, kosztuje jedno dodatkowe zapytanie. Zapis to dwa atomowe kroki, żeby równoległe
// dodania nie nadpisywały sobie wyboru: 1) wstaw wiersz ustawień, jeśli go nie ma; 2) ustaw wybór tylko tam, gdzie jest pusty.
async function selectIfNothingSelected(db: Db, projectId: string): Promise<void> {
  const current = await getSelectedProjectId(db);
  if (current.ok && current.data) return;

  const insert = await db
    .from("user_settings")
    .upsert(
      { selected_project_id: projectId },
      { onConflict: "user_id", ignoreDuplicates: true, defaultToNull: false },
    );
  const update = await db
    .from("user_settings")
    .update({ selected_project_id: projectId })
    .is("selected_project_id", null);
  const failure = insert.error ?? update.error;
  if (failure) {
    // eslint-disable-next-line no-console -- projekt został dodany, więc użytkownik nie dostaje błędu; szczegóły trafiają do logów
    console.error("projects: could not select the new project", failure.code, failure.message);
  }
}

export async function createProject(db: Db, input: ProjectInput): Promise<ServiceResult<Project>> {
  const { data, error } = await db
    .from("projects")
    .insert({ name: input.name, description: input.description })
    .select(PROJECT_COLUMNS)
    .single();
  if (error) return fail("projects", error, true);

  await selectIfNothingSelected(db, data.id);
  return { ok: true, data };
}

export async function updateProject(db: Db, id: string, input: ProjectInput): Promise<ServiceResult<Project>> {
  const { data, error } = await db
    .from("projects")
    .update({ name: input.name, description: input.description })
    .eq("id", id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();
  if (error) return fail("projects", error);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data };
}

export async function deleteProject(db: Db, id: string): Promise<ServiceResult<null>> {
  // Klucz obcy `on delete set null` w user_settings sam czyści wybór, jeśli usunięto wybrany projekt.
  const { data, error } = await db.from("projects").delete().eq("id", id).select("id");
  if (error) return fail("projects", error);
  if (data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}
