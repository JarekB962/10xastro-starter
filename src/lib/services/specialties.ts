import { fail, type Db } from "@/lib/services/db-errors";
import type { CommonServiceError, ServiceResult, Specialty, SpecialtyInput } from "@/types";

const SPECIALTY_COLUMNS = "id, name, created_at, updated_at";

export const SPECIALTY_ERROR_MESSAGES: Record<CommonServiceError, string> = {
  duplicate_name: "Specjalność o takiej nazwie już istnieje.",
  not_found: "Nie znaleziono specjalności.",
  unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
};

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
