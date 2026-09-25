import type { APIRoute } from "astro";
import { INVALID_FORM_MESSAGE, errorUrl, readForm } from "@/lib/forms";
import { requireSupabase } from "@/lib/services/project-routes";
import { requireTaskId } from "@/lib/services/task-routes";
import { TASK_ERROR_MESSAGES, TASK_NOT_FOUND_MESSAGE, editFormValues, getTask, updateTask } from "@/lib/services/tasks";
import { parseTaskUpdateInput } from "@/lib/validation/task";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = requireSupabase(context, "/tasks");
  if (supabase instanceof Response) return supabase;
  const id = requireTaskId(context);
  if (id instanceof Response) return id;

  const back = `/tasks/${id}/edit`;
  const notFound = () => context.redirect(errorUrl("/tasks", TASK_NOT_FOUND_MESSAGE));
  const form = await readForm(context.request);
  if (!form) {
    return context.redirect(errorUrl(back, INVALID_FORM_MESSAGE));
  }

  // Numer bierzemy z zapisanego zadania, nie z formularza.
  const task = await getTask(supabase, id);
  if (!task.ok) {
    return task.error === "not_found"
      ? notFound()
      : context.redirect(errorUrl(back, TASK_ERROR_MESSAGES[task.error], editFormValues(form)));
  }

  const parsed = parseTaskUpdateInput(form, task.data.number);
  if (!parsed.ok) {
    return context.redirect(errorUrl(back, parsed.message, editFormValues(form)));
  }

  const result = await updateTask(supabase, id, parsed.data);
  if (!result.ok) {
    if (result.error === "not_found") return notFound();
    return context.redirect(errorUrl(back, TASK_ERROR_MESSAGES[result.error], editFormValues(form)));
  }

  return context.redirect("/tasks");
};
