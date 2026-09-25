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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
export type ServiceError = "duplicate_name" | "not_found" | "unexpected";
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
