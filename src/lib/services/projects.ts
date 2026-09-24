import type { createClient } from "@/lib/supabase";
import type { Project, ProjectInput } from "@/types";

type Db = NonNullable<ReturnType<typeof createClient>>;

export type ProjectError = "duplicate_name" | "not_found" | "unexpected";
export type ProjectResult<T> = { ok: true; data: T } | { ok: false; error: ProjectError };

const PROJECT_COLUMNS = "id, name, description, created_at, updated_at";

export const SUPABASE_NOT_CONFIGURED = "Supabase nie jest skonfigurowany";
export const INVALID_FORM_MESSAGE = "Niepoprawne dane formularza.";

export const PROJECT_ERROR_MESSAGES: Record<ProjectError, string> = {
  duplicate_name: "Projekt o takiej nazwie już istnieje.",
  not_found: "Nie znaleziono projektu.",
  unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
};

/** Adres przekierowania z komunikatem błędu w `?error=` (wzorzec z tras logowania); `keep` odsyła wpisane wartości formularza. */
export function errorUrl(path: string, message: string, keep?: Record<string, string>): string {
  const params = new URLSearchParams({ error: message, ...keep });
  return `${path}?${params.toString()}`;
}

/** Odczytuje dane formularza; `null`, gdy treść żądania nie jest formularzem (zamiast wyjątku i błędu 500). */
export async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

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

// Kody Postgres/PostgREST: 23505 unikalność, 23503 klucz obcy, 42501 naruszenie RLS, PGRST116 brak wiersza.
// Cudzy lub nieistniejący projekt wygląda tak samo: baza ukrywa cudze wiersze, więc to "nie znaleziono".
// Wyjątek: przy dodawaniu nie ma czego szukać, więc 23503/42501 (np. usunięty użytkownik z ważnym tokenem) to błąd niespodziewany.
function toError(error: { code?: string }, creating: boolean): ProjectError {
  switch (error.code) {
    case "23505":
      return "duplicate_name";
    case "23503":
    case "42501":
      return creating ? "unexpected" : "not_found";
    case "PGRST116":
      return "not_found";
    default:
      return "unexpected";
  }
}

function fail(error: { code?: string; message?: string }, creating = false): { ok: false; error: ProjectError } {
  const result = toError(error, creating);
  if (result === "unexpected") {
    // eslint-disable-next-line no-console -- surowy błąd bazy trafia do logów serwera, użytkownik dostaje ogólny komunikat
    console.error("projects: unexpected database error", error.code, error.message);
  }
  return { ok: false, error: result };
}

export async function listProjects(db: Db): Promise<ProjectResult<Project[]>> {
  const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).order("name");
  if (error) return fail(error);
  return { ok: true, data };
}

export async function getProject(db: Db, id: string): Promise<ProjectResult<Project>> {
  const { data, error } = await db.from("projects").select(PROJECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) return fail(error);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data };
}

export async function getSelectedProject(db: Db): Promise<ProjectResult<Project | null>> {
  // Reguły dostępu ograniczają odczyt do własnego wiersza użytkownika.
  const { data, error } = await db.from("user_settings").select("selected_project_id").maybeSingle();
  if (error) return fail(error);
  if (!data?.selected_project_id) return { ok: true, data: null };

  const project = await getProject(db, data.selected_project_id);
  if (project.ok) return project;
  return project.error === "not_found" ? { ok: true, data: null } : project;
}

export async function selectProject(db: Db, id: string): Promise<ProjectResult<null>> {
  // `user_id` ma domyślną wartość auth.uid(); wiersz powstaje przy pierwszym wyborze projektu.
  const { error } = await db
    .from("user_settings")
    .upsert({ selected_project_id: id }, { onConflict: "user_id", defaultToNull: false });
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function createProject(db: Db, input: ProjectInput): Promise<ProjectResult<Project>> {
  const { data, error } = await db
    .from("projects")
    .insert({ name: input.name, description: input.description })
    .select(PROJECT_COLUMNS)
    .single();
  if (error) return fail(error, true);

  // Bez wybranego projektu pierwszy dodany staje się bieżącym; niepowodzenie wyboru nie cofa dodania.
  // Dwa atomowe kroki zamiast "odczytaj, potem zapisz", żeby równoległe dodania nie nadpisywały sobie wyboru:
  // 1) wstaw wiersz ustawień, jeśli go nie ma; 2) ustaw wybór tylko tam, gdzie jest jeszcze pusty.
  await db
    .from("user_settings")
    .upsert({ selected_project_id: data.id }, { onConflict: "user_id", ignoreDuplicates: true, defaultToNull: false });
  await db.from("user_settings").update({ selected_project_id: data.id }).is("selected_project_id", null);
  return { ok: true, data };
}

export async function updateProject(db: Db, id: string, input: ProjectInput): Promise<ProjectResult<Project>> {
  const { data, error } = await db
    .from("projects")
    .update({ name: input.name, description: input.description })
    .eq("id", id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, data };
}

export async function deleteProject(db: Db, id: string): Promise<ProjectResult<null>> {
  // Klucz obcy `on delete set null` w user_settings sam czyści wybór, jeśli usunięto wybrany projekt.
  const { data, error } = await db.from("projects").delete().eq("id", id).select("id");
  if (error) return fail(error);
  if (data.length === 0) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}
