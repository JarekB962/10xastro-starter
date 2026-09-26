import type { APIRoute } from "astro";
import { errorUrl } from "@/lib/forms";
import { requireSupabase } from "@/lib/services/project-routes";
import { requireTaskId } from "@/lib/services/task-routes";
import {
  TASK_ERROR_MESSAGES,
  TASK_NOT_FOUND_MESSAGE,
  deleteTask,
  taskHasDependentsMessage,
} from "@/lib/services/tasks";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/tasks");
  if (supabase instanceof Response) return supabase;
  const id = requireTaskId(context);
  if (id instanceof Response) return id;

  const result = await deleteTask(supabase, id);
  if (!result.ok) {
    if (result.error === "not_found") return context.redirect(errorUrl("/tasks", TASK_NOT_FOUND_MESSAGE));
    const message =
      result.error === "has_dependents" ? taskHasDependentsMessage(result.dependents) : TASK_ERROR_MESSAGES.unexpected;
    return context.redirect(errorUrl(`/tasks/${id}/delete`, message));
  }

  return context.redirect("/tasks");
};
