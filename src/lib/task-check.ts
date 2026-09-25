// Sprawdzenie listy zadań jednego projektu: czysta funkcja bez bazy i bez zależności od Astro.
// Tylko `import type` z aliasu, żeby moduł ładował się w Node (testy jednostkowe) bez transpilacji aliasów.
import type { NoResponsibilityReason, Task, TaskCheckResult, TaskProblem } from "@/types";

function nameKey(task: Task): string {
  return task.name.trim().toLowerCase();
}

/**
 * Silnie spójne składowe grafu zależności (algorytm Tarjana, iteracyjny: bez rekurencji zależnej od liczby zadań).
 * Wierzchołki to numery zadań, krawędź prowadzi z zadania do jego poprzednika istniejącego na liście.
 * Zwraca dla numeru zadania numery jego składowej rosnąco, tylko dla składowych o rozmiarze >= 2
 * (zadanie w składowej jednoelementowej, także z pętlą własną, nie leży na cyklu).
 * Pętli własnej nie oznaczamy, bo warstwa walidacji (validation/task.ts) blokuje ją przy zapisie.
 */
function cycleGroups(tasks: Task[]): Map<number, number[]> {
  const edges = new Map<number, number[]>();
  for (const task of tasks) {
    const list = edges.get(task.number) ?? [];
    edges.set(task.number, list);
    for (const predecessor of task.predecessors) list.push(predecessor);
  }
  for (const [number, list] of edges) {
    edges.set(
      number,
      list.filter((predecessor) => edges.has(predecessor)),
    );
  }

  const index = new Map<number, number>();
  const lowLink = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const groups = new Map<number, number[]>();
  let counter = 0;

  for (const root of edges.keys()) {
    if (index.has(root)) continue;
    const work: { vertex: number; next: number }[] = [{ vertex: root, next: 0 }];
    index.set(root, counter);
    lowLink.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const neighbours = edges.get(frame.vertex) ?? [];
      if (frame.next < neighbours.length) {
        const target = neighbours[frame.next++];
        if (!index.has(target)) {
          index.set(target, counter);
          lowLink.set(target, counter);
          counter++;
          stack.push(target);
          onStack.add(target);
          work.push({ vertex: target, next: 0 });
        } else if (onStack.has(target)) {
          lowLink.set(frame.vertex, Math.min(lowLink.get(frame.vertex) ?? 0, index.get(target) ?? 0));
        }
        continue;
      }

      work.pop();
      if (lowLink.get(frame.vertex) === index.get(frame.vertex)) {
        const component: number[] = [];
        let member: number | undefined;
        do {
          member = stack.pop();
          if (member === undefined) break;
          onStack.delete(member);
          component.push(member);
        } while (member !== frame.vertex);
        if (component.length >= 2) {
          component.sort((a, b) => a - b);
          for (const number of component) groups.set(number, component);
        }
      }
      const parent = work.length > 0 ? work[work.length - 1] : undefined;
      if (parent) {
        lowLink.set(parent.vertex, Math.min(lowLink.get(parent.vertex) ?? 0, lowLink.get(frame.vertex) ?? 0));
      }
    }
  }
  return groups;
}

/**
 * Liczy zadania z problemami: nieistniejący poprzednik, brak odpowiedzialności, duplikat nazwy
 * i cykl zależności (zadanie leży na cyklu co najmniej dwóch zadań).
 */
export function checkTasks(tasks: Task[]): TaskCheckResult {
  const numbers = new Set(tasks.map((task) => task.number));
  const groups = new Map<string, number[]>();
  for (const task of tasks) {
    const key = nameKey(task);
    groups.set(key, [...(groups.get(key) ?? []), task.number]);
  }
  const cycles = cycleGroups(tasks);

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
      cycleWith: cycles.get(task.number) ?? [],
    };
    if (
      problem.missingPredecessors.length > 0 ||
      noResponsibility.length > 0 ||
      problem.duplicateOf.length > 0 ||
      problem.cycleWith.length > 0
    ) {
      problems.push(problem);
    }
  }

  problems.sort((a, b) => a.task.number - b.task.number);
  return { problems };
}
