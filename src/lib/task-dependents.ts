// Zadania blokujące usunięcie innego zadania: czysta funkcja bez bazy i bez zależności od Astro.
// Tylko `import type` z aliasu, żeby moduł ładował się w Node (testy jednostkowe) bez transpilacji aliasów.
import type { Task } from "@/types";

/** Zadania z listy, które mają `number` wśród poprzedników, rosnąco po numerze; zadanie o tym numerze jest pomijane. */
export function findDependents(tasks: Task[], number: number): Task[] {
  return tasks
    .filter((task) => task.number !== number && task.predecessors.includes(number))
    .sort((a, b) => a.number - b.number);
}
