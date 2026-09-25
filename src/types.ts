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

/** Wynik operacji usługi (projekty, specjalności): dane albo jednoznaczny kod błędu. */
export type ServiceError = "duplicate_name" | "duplicate_number" | "invalid_specialty" | "not_found" | "unexpected";
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

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
  number: number;
  name: string;
  effort: number | null;
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
