// Ręcznie pisane typy bazy zgodne z migracjami w supabase/migrations/.
// Aktualizuj razem ze schematem (generowanie typów wymaga uruchomionego Dockera).
/* eslint-disable @typescript-eslint/consistent-type-definitions -- typ `Database` musi być aliasem, bo interfejsy nie spełniają ograniczenia klienta Supabase */

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          selected_project_id: string | null;
        };
        Insert: {
          user_id?: string;
          selected_project_id?: string | null;
        };
        Update: {
          user_id?: string;
          selected_project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_selected_project_id_fkey";
            columns: ["selected_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      specialties: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialties_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          number: number;
          name: string;
          specialty_id: string | null;
          effort: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          number: number;
          name: string;
          specialty_id?: string | null;
          effort?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          number?: number;
          name?: string;
          specialty_id?: string | null;
          effort?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_specialty_project_fkey";
            columns: ["specialty_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      task_predecessors: {
        Row: {
          task_id: string;
          predecessor_number: number;
        };
        Insert: {
          task_id: string;
          predecessor_number: number;
        };
        Update: {
          task_id?: string;
          predecessor_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "task_predecessors_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      project_states: {
        Row: {
          project_id: string;
          data_revision: number;
          verified_revision: number | null;
        };
        // Zapis tylko przez funkcje bazy (wyzwalacze i verify_project), nie przez klienta.
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "project_states_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: true;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_task: {
        Args: {
          p_project_id: string;
          p_number: number;
          p_name: string;
          p_specialty_id: string | null;
          p_effort: number | null;
          p_predecessors: number[] | null;
        };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      update_task: {
        Args: {
          p_id: string;
          p_name: string;
          p_specialty_id: string | null;
          p_effort: number | null;
          p_predecessors: number[] | null;
        };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      verify_project: {
        Args: {
          p_project_id: string;
          p_revision: number;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Projekt widoczny w interfejsie (bez identyfikatora właściciela). */
export type Project = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "description" | "created_at" | "updated_at"
>;

/** Dane formularza projektu po walidacji: opis pusty zapisywany jako null. */
export interface ProjectInput {
  name: string;
  description: string | null;
}

/** Kody błędów usług: wspólne (projekty, specjalności) i zadań; każda usługa zwraca tylko swój podzbiór. */
export type CommonServiceError = "duplicate_name" | "not_found" | "unexpected";
export type TaskServiceError = "duplicate_number" | "invalid_specialty" | "not_found" | "unexpected";
export type ServiceError = CommonServiceError | TaskServiceError;

/** Wynik operacji usługi: dane albo jednoznaczny kod błędu (domyślnie wspólny zestaw). */
export type ServiceResult<T, E extends ServiceError = CommonServiceError> =
  { ok: true; data: T } | { ok: false; error: E };

/** Wynik walidacji formularza projektu: dane albo pierwszy komunikat błędu. */
export type ParsedProjectInput = { ok: true; data: ProjectInput } | { ok: false; message: string };

/** Specjalność projektu widoczna w interfejsie (bez identyfikatora projektu). */
export type Specialty = Pick<
  Database["public"]["Tables"]["specialties"]["Row"],
  "id" | "name" | "created_at" | "updated_at"
>;

/** Dane formularza specjalności po walidacji. */
export interface SpecialtyInput {
  name: string;
}

/** Wynik walidacji formularza specjalności: dane albo pierwszy komunikat błędu. */
export type ParsedSpecialtyInput = { ok: true; data: SpecialtyInput } | { ok: false; message: string };

/** Zadanie projektu widoczne w interfejsie: specjalność jako nazwa, poprzednicy jako numery zadań. */
export interface Task {
  id: string;
  project_id: string;
  number: number;
  name: string;
  effort: number | null;
  specialty_id: string | null;
  specialty: string | null;
  predecessors: number[];
  created_at: string;
  updated_at: string;
}

/** Dane formularza zadania po walidacji: puste pola opcjonalne jako null, poprzednicy bez powtórzeń. */
export interface TaskInput {
  number: number;
  name: string;
  specialtyId: string | null;
  effort: number | null;
  predecessors: number[];
}

/** Wynik walidacji formularza zadania: dane albo pierwszy komunikat błędu. */
export type ParsedTaskInput = { ok: true; data: TaskInput } | { ok: false; message: string };

/** Powody braku odpowiedzialności za zadanie: brak specjalności, nakład pusty albo równy 0. */
export type NoResponsibilityReason = "no_specialty" | "effort_empty" | "effort_zero";

/** Zadanie z problemami; puste tablice oznaczają brak danego powodu, `duplicateOf` to numery pozostałych zadań o tej samej nazwie. */
export interface TaskProblem {
  task: Task;
  missingPredecessors: number[];
  noResponsibility: NoResponsibilityReason[];
  duplicateOf: number[];
  /** Numery wszystkich zadań grupy wzajemnie zależnych (co najmniej 2, rosnąco, razem z tym zadaniem); [] = brak cyklu. */
  cycleWith: readonly number[];
}

/** Wynik sprawdzenia listy zadań: tylko zadania z co najmniej jednym powodem, rosnąco po numerze. */
export interface TaskCheckResult {
  problems: TaskProblem[];
}

/** Dane poprawki zadania po walidacji (bez numeru, który jest niezmienny). */
export interface TaskUpdateInput {
  name: string;
  specialtyId: string | null;
  effort: number | null;
  predecessors: number[];
}

/** Wynik walidacji formularza poprawki zadania: dane albo pierwszy komunikat błędu. */
export type ParsedTaskUpdateInput = { ok: true; data: TaskUpdateInput } | { ok: false; message: string };

/** Stan projektu: `revision` to licznik zmian danych z chwili odczytu, `verified` to sprawdzenie bez problemów po ostatniej zmianie danych. */
export interface ProjectState {
  revision: number;
  verified: boolean;
}
