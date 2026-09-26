import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findDependents } from "../src/lib/task-dependents.ts";

// Zadanie o podanym numerze i poprzednikach; reszta pól nie ma znaczenia dla wyszukiwania.
function task(number, predecessors = [], overrides = {}) {
  return {
    id: `id-${number}`,
    project_id: "project",
    number,
    name: `Zadanie ${number}`,
    effort: 1,
    specialty_id: "spec",
    specialty: "Elektryk",
    predecessors,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const numbers = (tasks) => tasks.map((t) => t.number);

describe("findDependents", () => {
  it("pusta lista nie ma zależnych", () => {
    assert.deepEqual(findDependents([], 1), []);
  });

  it("brak zależnych, gdy nikt nie wskazuje na numer", () => {
    assert.deepEqual(findDependents([task(1), task(2, [1]), task(3)], 3), []);
  });

  it("jedno zależne zadanie", () => {
    assert.deepEqual(numbers(findDependents([task(1), task(2, [1]), task(3)], 1)), [2]);
  });

  it("kilka zależnych posortowanych rosnąco po numerze", () => {
    const tasks = [task(7, [1]), task(1), task(5, [1]), task(3, [1]), task(4, [2])];
    assert.deepEqual(numbers(findDependents(tasks, 1)), [3, 5, 7]);
  });

  it("zadanie bez poprzedników nie jest zależne", () => {
    assert.deepEqual(findDependents([task(1), task(2, [])], 1), []);
  });

  it("zależność przez jednego z wielu poprzedników", () => {
    const tasks = [task(1), task(2), task(3, [1, 2, 9])];
    assert.deepEqual(numbers(findDependents(tasks, 2)), [3]);
    assert.deepEqual(numbers(findDependents(tasks, 9)), [3]);
  });

  it("pomija zadanie o tym samym numerze, także z pętlą własną", () => {
    assert.deepEqual(findDependents([task(1, [1])], 1), []);
  });

  it("zadania w cyklu wskazują na siebie nawzajem", () => {
    const tasks = [task(1, [2]), task(2, [1])];
    assert.deepEqual(numbers(findDependents(tasks, 1)), [2]);
    assert.deepEqual(numbers(findDependents(tasks, 2)), [1]);
  });

  it("zwraca zadania listy, nie kopie pól", () => {
    const tasks = [task(1), task(2, [1])];
    assert.equal(findDependents(tasks, 1)[0], tasks[1]);
  });
});
