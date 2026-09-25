import type { APIContext } from "astro";
import { errorUrl } from "@/lib/forms";
import { TASK_NOT_FOUND_MESSAGE } from "@/lib/services/tasks";
import { parseTaskId } from "@/lib/validation/task";

/** Identyfikator zadania z adresu albo przekierowanie na listę; niepoprawny uuid to "nie znaleziono". */
export function requireTaskId(context: APIContext): string | Response {
  return parseTaskId(context.params.id) ?? context.redirect(errorUrl("/tasks", TASK_NOT_FOUND_MESSAGE));
}
