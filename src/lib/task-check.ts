// Sprawdzenie listy zadań jednego projektu: czysta funkcja bez bazy i bez zależności od Astro.
import type { NoResponsibilityReason, Task, TaskCheckResult, TaskProblem } from "@/types";

function nameKey(task: Task): string {
  return task.name.trim().toLowerCase();
}

/** Liczy zadania z problemami: nieistniejący poprzednik, brak odpowiedzialności, duplikat nazwy. */
export function checkTasks(tasks: Task[]): TaskCheckResult {
  const numbers = new Set(tasks.map((task) => task.number));
  const groups = new Map<string, number[]>();
  for (const task of tasks) {
    const key = nameKey(task);
    groups.set(key, [...(groups.get(key) ?? []), task.number]);
  }

  const problems: TaskProblem[] = [];
  for (const task of tasks) {
    const noResponsibility: NoResponsibilityReason[] = [];
    if (task.specialty === null) noResponsibility.push("no_specialty");
    if (task.effort === null) noResponsibility.push("effort_empty");
    else if (task.effort === 0) noResponsibility.push("effort_zero");

    const problem: TaskProblem = {
      task,
      missingPredecessors: task.predecessors.filter((number) => !numbers.has(number)),
      noResponsibility,
      duplicateOf: (groups.get(nameKey(task)) ?? []).filter((number) => number !== task.number).sort((a, b) => a - b),
    };
    if (problem.missingPredecessors.length > 0 || noResponsibility.length > 0 || problem.duplicateOf.length > 0) {
      problems.push(problem);
    }
  }

  problems.sort((a, b) => a.task.number - b.task.number);
  return { problems };
}
