import { fail, type Db } from "@/lib/services/db-errors";
import type { ProjectState, ServiceResult } from "@/types";

export const PROJECT_STATE_LOAD_ERROR = "Nie udało się wczytać stanu projektu.";

/** Stan projektu; brak wiersza (nowy projekt, projekt sprzed migracji) to licznik 0 i brak weryfikacji. */
export async function getProjectState(db: Db, projectId: string): Promise<ServiceResult<ProjectState>> {
  const { data, error } = await db
    .from("project_states")
    .select("data_revision, verified_revision")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) return fail("project-state", error);
  if (!data) return { ok: true, data: { revision: 0, verified: false } };
  return { ok: true, data: { revision: data.data_revision, verified: data.verified_revision === data.data_revision } };
}

/**
 * Zapisuje weryfikację, jeśli dane nie zmieniły się od odczytu licznika `revision`.
 * `true` = zapisano stan zweryfikowany, `false` = dane zmieniły się w międzyczasie.
 */
export async function verifyProject(db: Db, projectId: string, revision: number): Promise<ServiceResult<boolean>> {
  const { data, error } = await db.rpc("verify_project", { p_project_id: projectId, p_revision: revision });
  if (error) return fail("project-state", error);
  return { ok: true, data };
}
