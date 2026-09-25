import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkTasks } from "../src/lib/task-check.ts";

// Zadanie z kompletną odpowiedzialnością i unikalną nazwą, o ile test nie zmieni pól.
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

function cyclesOf(tasks) {
  const map = {};
  for (const problem of checkTasks(tasks).problems) map[problem.task.number] = problem.cycleWith;
  return map;
}

describe("checkTasks: cykle zależności", () => {
  it("pusta lista nie ma problemów", () => {
    assert.deepEqual(checkTasks([]).problems, []);
  });

  it("łańcuch bez cyklu", () => {
    assert.deepEqual(checkTasks([task(1), task(2, [1]), task(3, [2])]).problems, []);
  });

  it("romb bez cyklu", () => {
    assert.deepEqual(checkTasks([task(1), task(2, [1]), task(3, [1]), task(4, [2, 3])]).problems, []);
  });

  it("cykl dwuelementowy oznacza oba zadania", () => {
    assert.deepEqual(cyclesOf([task(1, [2]), task(2, [1]), task(3)]), { 1: [1, 2], 2: [1, 2] });
  });

  it("długi cykl pięciu zadań", () => {
    const tasks = [task(1, [5]), task(2, [1]), task(3, [2]), task(4, [3]), task(5, [4])];
    const all = [1, 2, 3, 4, 5];
    assert.deepEqual(cyclesOf(tasks), { 1: all, 2: all, 3: all, 4: all, 5: all });
  });

  it("kilka niezależnych cykli: każde zadanie dostaje tylko swoją grupę", () => {
    const tasks = [task(1, [2]), task(2, [1]), task(3, [5]), task(4, [3]), task(5, [4]), task(6)];
    assert.deepEqual(cyclesOf(tasks), { 1: [1, 2], 2: [1, 2], 3: [3, 4, 5], 4: [3, 4, 5], 5: [3, 4, 5] });
  });

  it("zadanie zależne od cyklu, ale nieleżące na nim, nie jest oznaczone", () => {
    const tasks = [task(1, [2]), task(2, [1]), task(3, [1])];
    assert.deepEqual(cyclesOf(tasks), { 1: [1, 2], 2: [1, 2] });
  });

  it("zadanie, od którego zależy cykl, ale nieleżące na nim, nie jest oznaczone", () => {
    const tasks = [task(1, [2]), task(2, [1, 3]), task(3)];
    assert.deepEqual(cyclesOf(tasks), { 1: [1, 2], 2: [1, 2] });
  });

  it("dwa cykle współdzielące zadanie tworzą jedną składową", () => {
    // 1 -> 2 -> 1 oraz 1 -> 3 -> 1
    const tasks = [task(1, [2, 3]), task(2, [1]), task(3, [1])];
    assert.deepEqual(cyclesOf(tasks), { 1: [1, 2, 3], 2: [1, 2, 3], 3: [1, 2, 3] });
  });

  it("poprzednik spoza projektu obok cyklu na tym samym zadaniu", () => {
    const { problems } = checkTasks([task(1, [2, 99]), task(2, [1])]);
    assert.equal(problems.length, 2);
    assert.deepEqual(problems[0].missingPredecessors, [99]);
    assert.deepEqual(problems[0].cycleWith, [1, 2]);
    assert.deepEqual(problems[1].missingPredecessors, []);
    assert.deepEqual(problems[1].cycleWith, [1, 2]);
  });

  it("poprzednik spoza projektu sam nie tworzy cyklu", () => {
    const { problems } = checkTasks([task(1, [99])]);
    assert.equal(problems.length, 1);
    assert.deepEqual(problems[0].cycleWith, []);
  });

  it("pętla własna nie jest cyklem i nie zapętla funkcji", () => {
    assert.deepEqual(checkTasks([task(1, [1]), task(2, [1])]).problems, []);
  });

  it("powtórzeni poprzednicy i powtórzone numery nie zawieszają ani nie mnożą numerów", () => {
    const { problems } = checkTasks([task(1, [2, 2, 2]), task(2, [1, 1])]);
    assert.deepEqual(
      problems.map((p) => p.cycleWith),
      [
        [1, 2],
        [1, 2],
      ],
    );
    assert.doesNotThrow(() => checkTasks([task(1, [1]), task(1, [1])]));
  });

  it("głęboki łańcuch zamknięty w cykl nie przepełnia stosu", () => {
    const size = 50000;
    const tasks = Array.from({ length: size }, (_, i) => task(i + 1, [i === 0 ? size : i]));
    const { problems } = checkTasks(tasks);
    assert.equal(problems.length, size);
    assert.deepEqual(
      problems[0].cycleWith,
      Array.from({ length: size }, (_, i) => i + 1),
    );
  });

  it("dwa cykle połączone jedną krawędzią jednokierunkową to dwie osobne grupy", () => {
    const cycles = cyclesOf([task(1, [2]), task(2, [1]), task(3, [4, 1]), task(4, [3])]);
    assert.deepEqual(cycles, { 1: [1, 2], 2: [1, 2], 3: [3, 4], 4: [3, 4] });
  });

  it("wynik jest posortowany po numerze zadania", () => {
    const { problems } = checkTasks([task(3, [4]), task(4, [3]), task(1, [2]), task(2, [1])]);
    assert.deepEqual(
      problems.map((p) => p.task.number),
      [1, 2, 3, 4],
    );
  });
});

describe("checkTasks: kryteria z S-04 (regresja)", () => {
  it("duplikat nazwy w innej wielkości liter i ze spacją", () => {
    const { problems } = checkTasks([task(1, [], { name: "Kable" }), task(2, [], { name: "KABLE " })]);
    assert.deepEqual(
      problems.map((p) => [p.task.number, p.duplicateOf]),
      [
        [1, [2]],
        [2, [1]],
      ],
    );
  });

  it("nakład 0 kontra pusty", () => {
    const { problems } = checkTasks([task(1, [], { effort: 0 }), task(2, [], { effort: null }), task(3)]);
    assert.deepEqual(
      problems.map((p) => [p.task.number, p.noResponsibility]),
      [
        [1, ["effort_zero"]],
        [2, ["effort_empty"]],
      ],
    );
  });

  it("brak specjalności i nakładu naraz", () => {
    const { problems } = checkTasks([task(1, [], { specialty: null, specialty_id: null, effort: null })]);
    assert.deepEqual(problems[0].noResponsibility, ["no_specialty", "effort_empty"]);
  });

  it("kilka powodów naraz na jednym zadaniu", () => {
    const tasks = [task(1, [2, 99], { name: "Kable", effort: 0 }), task(2, [1], { name: "kable" })];
    const first = checkTasks(tasks).problems[0];
    assert.deepEqual(first.missingPredecessors, [99]);
    assert.deepEqual(first.noResponsibility, ["effort_zero"]);
    assert.deepEqual(first.duplicateOf, [2]);
    assert.deepEqual(first.cycleWith, [1, 2]);
  });
});
