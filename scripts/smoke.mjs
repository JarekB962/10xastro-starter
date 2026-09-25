// Smoke test: proves the built app, the Cloudflare adapter, the Supabase auth flow and the project flow
// (including per-user row access) still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const stamp = Date.now();
const password = "Smoke-Test-Passw0rd!";
const emailA = `smoke-a-${stamp}@example.com`;
const emailB = `smoke-b-${stamp}@example.com`;
const projectName = `Projekt Alfa ${stamp}`;
const renamedProject = `Projekt Beta ${stamp}`;

// Each session keeps its own cookies, so two users can act in one run.
function createSession() {
  const jar = new Map();

  function storeCookies(response) {
    for (const raw of response.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const [name, ...rest] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
      if (expired) jar.delete(name.trim());
      else jar.set(name.trim(), rest.join("="));
    }
  }

  return async function request(path, { method = "GET", form, json } = {}) {
    const response = await fetch(BASE_URL + path, {
      method,
      redirect: "manual",
      headers: {
        Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
        Origin: BASE_URL,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(json ? { "Content-Type": "application/json" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
    });
    storeCookies(response);
    return {
      status: response.status,
      location: response.headers.get("location") ?? "",
      body: await response.text(),
    };
  };
}

const anon = createSession();
const userA = createSession();
const userB = createSession();
let projectId = "";
let specialtyId = "";
const specialtyName = `Elektryk ${stamp}`;
const renamedSpecialty = `Hydraulik ${stamp}`;
const taskName = `Zadanie glowne ${stamp}`;
const duplicateTaskName = `Zadanie duplikat ${stamp}`;
const plainTaskName = `Zadanie proste ${stamp}`;
const editedTaskName = `Zadanie poprawione ${stamp}`;
let taskId = "";
// Zadania kontrolne sprawdzenia listy (numery od 10, poza użytymi wcześniej).
const dupTaskName = `Kable ${stamp}`;
const dupTaskNameOtherCase = `KABLE ${stamp}`;
const zeroEffortTaskName = `Zadanie zero ${stamp}`;
const missingPredTaskName = `Zadanie sierota ${stamp}`;
const validTaskName = `Zadanie poprawne ${stamp}`;
const projectNameB = `Projekt B ${stamp}`;
const specialtyNameB = `Spawacz ${stamp}`;
const validTaskNameB = `Zadanie B ${stamp}`;
let projectIdB = "";
let specialtyIdB = "";
const unknownTaskId = "00000000-0000-4000-8000-000000000000";

const post = (form = {}) => ({ method: "POST", form });

const steps = [
  ["home renders", () => anon("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => anon("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["projects redirects anonymous user", () => anon("/projects"), { status: 302, location: "/auth/signin" }],
  [
    "creating a project requires signin",
    () => anon("/api/projects", post({ project_name: "Anon" })),
    { status: 302, location: "/auth/signin" },
  ],
  ["specialties redirects anonymous user", () => anon("/specialties"), { status: 302, location: "/auth/signin" }],
  [
    "creating a specialty requires signin",
    () => anon("/api/specialties", post({ specialty_name: "Anon" })),
    { status: 302, location: "/auth/signin" },
  ],
  ["tasks redirects anonymous user", () => anon("/tasks"), { status: 302, location: "/auth/signin" }],
  [
    "creating a task requires signin",
    () => anon("/api/tasks", post({ task_number: "1", task_name: "Anon" })),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "task edit page redirects anonymous user",
    () => anon(`/tasks/${unknownTaskId}/edit`),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "editing a task requires signin",
    () => anon(`/api/tasks/${unknownTaskId}`, post({ task_name: "Anon" })),
    { status: 302, location: "/auth/signin" },
  ],
  ["task check redirects anonymous user", () => anon("/tasks/check"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account A",
    () => userA("/api/auth/signup", post({ email: emailA, password })),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => userA("/api/auth/signin", post({ email: emailA, password: "wrong" })),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => userA("/api/auth/signin", post({ email: emailA, password })),
    { status: 302, location: "/projects" },
  ],
  ["dashboard renders for signed-in user", () => userA("/dashboard"), { status: 200 }],
  [
    "A adds a project",
    () => userA("/api/projects", post({ project_name: projectName, project_description: "Opis" })),
    { status: 302, location: "/projects" },
  ],
  [
    "A cannot add the same name in another letter case",
    () => userA("/api/projects", post({ project_name: projectName.toUpperCase() })),
    { status: 302, location: "/projects/new?error=" },
  ],
  ["A's list contains the project", () => userA("/projects"), { status: 200, bodyIncludes: [projectName] }],
  [
    "A finds the project id on the list",
    async () => {
      const list = await userA("/projects");
      projectId = /\/projects\/([0-9a-f-]{36})\/edit/.exec(list.body)?.[1] ?? "";
      return { ...list, status: projectId ? list.status : 0 };
    },
    { status: 200 },
  ],
  [
    "A edits the project name",
    () => userA(`/api/projects/${projectId}`, post({ project_name: renamedProject })),
    { status: 302, location: "/projects" },
  ],
  [
    "A selects the project",
    () => userA(`/api/projects/${projectId}/select`, post()),
    { status: 302, location: "/dashboard" },
  ],
  ["dashboard shows the selected project", () => userA("/dashboard"), { status: 200, bodyIncludes: [renamedProject] }],
  [
    "A adds a specialty to the selected project",
    () => userA("/api/specialties", post({ specialty_name: specialtyName })),
    { status: 302, locationIs: "/specialties" },
  ],
  [
    "A cannot add the same specialty name in another letter case",
    () => userA("/api/specialties", post({ specialty_name: specialtyName.toUpperCase() })),
    { status: 302, location: "/specialties?error=" },
  ],
  [
    "A's specialties list contains the specialty",
    () => userA("/specialties"),
    { status: 200, bodyIncludes: [specialtyName] },
  ],
  [
    "A finds the specialty id on the list",
    async () => {
      const list = await userA("/specialties");
      specialtyId = /\/specialties\/([0-9a-f-]{36})\/edit/.exec(list.body)?.[1] ?? "";
      return { ...list, status: specialtyId ? list.status : 0 };
    },
    { status: 200 },
  ],
  [
    "A edits the specialty name",
    () => userA(`/api/specialties/${specialtyId}`, post({ specialty_name: renamedSpecialty })),
    { status: 302, locationIs: "/specialties" },
  ],
  [
    "the renamed specialty replaces the old name on the list",
    () => userA("/specialties"),
    { status: 200, bodyIncludes: [renamedSpecialty], bodyExcludes: [specialtyName] },
  ],
  [
    "selecting a project with after_select=specialties opens the specialties page",
    () => userA(`/api/projects/${projectId}/select`, post({ after_select: "specialties" })),
    { status: 302, locationIs: "/specialties" },
  ],
  [
    "an unknown after_select value falls back to the dashboard",
    () => userA(`/api/projects/${projectId}/select`, post({ after_select: "https://evil.example" })),
    { status: 302, locationIs: "/dashboard" },
  ],
  [
    "A adds a task with a specialty, decimal effort and repeated predecessors",
    () =>
      userA(
        "/api/tasks",
        post({
          task_number: "1",
          task_name: taskName,
          task_specialty: specialtyId,
          task_effort: "2,5",
          task_predecessors: "2, 2, 99",
        }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A's task list shows the task with its specialty, effort and deduplicated predecessors",
    () => userA("/tasks"),
    { status: 200, bodyIncludes: [taskName, renamedSpecialty, "2.5", "2, 99"], bodyExcludes: ["2, 2, 99"] },
  ],
  [
    "A cannot add a task with a taken number and keeps the typed name",
    () => userA("/api/tasks", post({ task_number: "1", task_name: duplicateTaskName })),
    { status: 302, location: "/tasks?error=", locationIncludes: ["istnieje", "task_name=", String(stamp)] },
  ],
  [
    "A cannot make a task its own predecessor",
    () => userA("/api/tasks", post({ task_number: "4", task_name: `Nie ${stamp}`, task_predecessors: "4" })),
    { status: 302, location: "/tasks?error=", locationIncludes: ["poprzednikiem"] },
  ],
  [
    "A cannot add a task with a non-numeric effort",
    () => userA("/api/tasks", post({ task_number: "5", task_name: `Nie ${stamp}`, task_effort: "abc" })),
    { status: 302, location: "/tasks?error=" },
  ],
  [
    "A adds a task with only a number and a name",
    () => userA("/api/tasks", post({ task_number: "3", task_name: plainTaskName })),
    { status: 302, locationIs: "/tasks" },
  ],
  ["A's task list shows the plain task", () => userA("/tasks"), { status: 200, bodyIncludes: [plainTaskName] }],
  [
    "selecting a project with after_select=tasks opens the tasks page",
    () => userA(`/api/projects/${projectId}/select`, post({ after_select: "tasks" })),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A finds the main task id on the list",
    async () => {
      const list = await userA("/tasks");
      const start = list.body.indexOf(taskName);
      taskId = /\/tasks\/([0-9a-f-]{36})\/edit/.exec(start < 0 ? "" : list.body.slice(start))?.[1] ?? "";
      return { ...list, status: taskId ? list.status : 0 };
    },
    { status: 200 },
  ],
  [
    "A opens the task edit page with the current name and a fixed number",
    () => userA(`/tasks/${taskId}/edit`),
    { status: 200, bodyIncludes: [taskName, "Numer zadania"] },
  ],
  [
    "A edits the task: new name, no specialty, effort 7, predecessor 3, number in the form ignored",
    () =>
      userA(
        `/api/tasks/${taskId}`,
        post({
          task_number: "99",
          task_name: editedTaskName,
          task_specialty: "",
          task_effort: "7",
          task_predecessors: "3",
        }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A's list shows the edited task with the same number, no specialty and the new predecessor",
    async () => {
      const list = await userA("/tasks");
      const at = list.body.indexOf(editedTaskName);
      const from = list.body.lastIndexOf("<li", at);
      const to = list.body.indexOf("</li>", at);
      return { ...list, body: at < 0 ? "" : list.body.slice(from, to) };
    },
    {
      status: 200,
      bodyIncludes: [editedTaskName, "1.", "<dd>3</dd>", "<dd>7</dd>"],
      bodyExcludes: [renamedSpecialty, "99.", "2, 99"],
    },
  ],
  ["the old task name is gone from A's list", () => userA("/tasks"), { status: 200, bodyExcludes: [taskName] }],
  [
    "A cannot make a task its own predecessor on edit and keeps the typed name",
    () => userA(`/api/tasks/${taskId}`, post({ task_name: `Nie ${stamp}`, task_predecessors: "1" })),
    {
      status: 302,
      location: "/tasks/",
      locationIncludes: ["/edit?error=", "poprzednikiem", "task_name=", String(stamp)],
    },
  ],
  [
    "A cannot save a task with a non-numeric effort and keeps the typed name",
    () => userA(`/api/tasks/${taskId}`, post({ task_name: `Nie ${stamp}`, task_effort: "abc" })),
    { status: 302, location: "/tasks/", locationIncludes: ["/edit?error=", "task_name=", String(stamp)] },
  ],
  [
    "A cannot save a task with an empty name",
    () => userA(`/api/tasks/${taskId}`, post({ task_name: "" })),
    { status: 302, location: "/tasks/", locationIncludes: ["/edit?error=", "wymagana", "task_name="] },
  ],
  [
    "A adds a check task with a specialty and effort",
    () =>
      userA(
        "/api/tasks",
        post({ task_number: "10", task_name: dupTaskName, task_specialty: specialtyId, task_effort: "1" }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A adds a check task with the same name in another letter case and a trailing space",
    () =>
      userA(
        "/api/tasks",
        post({
          task_number: "11",
          task_name: `${dupTaskNameOtherCase} `,
          task_specialty: specialtyId,
          task_effort: "1",
        }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A adds a check task with effort 0",
    () =>
      userA(
        "/api/tasks",
        post({
          task_number: "12",
          task_name: zeroEffortTaskName,
          task_specialty: specialtyId,
          task_effort: "0",
          task_predecessors: "998",
        }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A adds a check task with a predecessor that does not exist",
    () =>
      userA(
        "/api/tasks",
        post({
          task_number: "13",
          task_name: missingPredTaskName,
          task_specialty: specialtyId,
          task_effort: "1",
          task_predecessors: "999",
        }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A adds a valid check task",
    () =>
      userA(
        "/api/tasks",
        post({
          task_number: "14",
          task_name: validTaskName,
          task_specialty: specialtyId,
          task_effort: "1",
          task_predecessors: "10",
        }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "A's check lists duplicates, effort 0 and the missing predecessor, and not the valid task",
    () => userA("/tasks/check"),
    {
      status: 200,
      bodyIncludes: [
        dupTaskName,
        dupTaskNameOtherCase,
        zeroEffortTaskName,
        missingPredTaskName,
        "Duplikat nazwy: zadania 11",
        "Duplikat nazwy: zadania 10",
        "wny 0",
        "poprzednik: 999",
        "Cykle zale",
      ],
      bodyExcludes: [validTaskName, "wszystko w porz"],
    },
  ],
  [
    "A's check shows several reasons at once for a task without specialty and effort",
    async () => {
      const page = await userA("/tasks/check");
      const at = page.body.indexOf(plainTaskName);
      const from = page.body.lastIndexOf("<li", at);
      const to = page.body.indexOf("</ul>", at);
      return { ...page, body: at < 0 ? "" : page.body.slice(from, to) };
    },
    { status: 200, bodyIncludes: [plainTaskName, "brak specjalno", "nak", "pusty"] },
  ],
  [
    "A's check shows reasons from two categories as separate lines for one task",
    async () => {
      const page = await userA("/tasks/check");
      const at = page.body.indexOf(zeroEffortTaskName);
      const from = page.body.lastIndexOf("<li", at);
      const to = page.body.indexOf("</ul>", at);
      return { ...page, body: at < 0 ? "" : page.body.slice(from, to) };
    },
    { status: 200, bodyIncludes: [zeroEffortTaskName, "wny 0", "poprzednik: 998"], bodyExcludes: ["Duplikat"] },
  ],
  [
    "signup creates account B",
    () => userB("/api/auth/signup", post({ email: emailB, password })),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin B",
    () => userB("/api/auth/signin", post({ email: emailB, password })),
    { status: 302, location: "/projects" },
  ],
  ["B gets 404 on A's edit page", () => userB(`/projects/${projectId}/edit`), { status: 404 }],
  ["B gets 404 on A's delete page", () => userB(`/projects/${projectId}/delete`), { status: 404 }],
  [
    "B cannot delete A's project",
    () => userB(`/api/projects/${projectId}/delete`, post()),
    { status: 302, location: "/projects?error=" },
  ],
  ["B's list does not contain A's project", () => userB("/projects"), { status: 200, bodyExcludes: [renamedProject] }],
  [
    "B without a selected project sees the empty state on /specialties",
    () => userB("/specialties"),
    { status: 200, bodyIncludes: ["Nie wybrano projektu"], bodyExcludes: [renamedSpecialty] },
  ],
  [
    "B cannot add a specialty without a selected project",
    () => userB("/api/specialties", post({ specialty_name: "Nie dla B" })),
    { status: 302, location: "/specialties?error=" },
  ],
  ["B gets 404 on A's specialty edit page", () => userB(`/specialties/${specialtyId}/edit`), { status: 404 }],
  [
    "B cannot edit A's specialty",
    () => userB(`/api/specialties/${specialtyId}`, post({ specialty_name: "Przejete" })),
    { status: 302, location: "/specialties?error=" },
  ],
  [
    "B without a selected project sees the empty state on /tasks",
    () => userB("/tasks"),
    { status: 200, bodyIncludes: ["Nie wybrano projektu"], bodyExcludes: [taskName, plainTaskName] },
  ],
  [
    "B cannot add a task without a selected project",
    () => userB("/api/tasks", post({ task_number: "1", task_name: "Nie dla B" })),
    { status: 302, location: "/tasks?error=" },
  ],
  ["B gets 404 on A's task edit page", () => userB(`/tasks/${taskId}/edit`), { status: 404 }],
  [
    "B cannot edit A's task",
    () => userB(`/api/tasks/${taskId}`, post({ task_name: "Przejete" })),
    { status: 302, location: "/tasks?error=" },
  ],
  [
    "B without a selected project sees the empty state on /tasks/check",
    () => userB("/tasks/check"),
    { status: 200, bodyIncludes: ["Nie wybrano projektu"], bodyExcludes: [dupTaskName, zeroEffortTaskName] },
  ],
  [
    "B adds a project",
    () => userB("/api/projects", post({ project_name: projectNameB })),
    { status: 302, location: "/projects" },
  ],
  [
    "B finds the project id on the list",
    async () => {
      const list = await userB("/projects");
      projectIdB = /\/projects\/([0-9a-f-]{36})\/edit/.exec(list.body)?.[1] ?? "";
      return { ...list, status: projectIdB ? list.status : 0 };
    },
    { status: 200 },
  ],
  [
    "B selects the project",
    () => userB(`/api/projects/${projectIdB}/select`, post()),
    { status: 302, locationIs: "/dashboard" },
  ],
  [
    "B adds a specialty to the selected project",
    () => userB("/api/specialties", post({ specialty_name: specialtyNameB })),
    { status: 302, locationIs: "/specialties" },
  ],
  [
    "B finds the specialty id on the list",
    async () => {
      const list = await userB("/specialties");
      specialtyIdB = /\/specialties\/([0-9a-f-]{36})\/edit/.exec(list.body)?.[1] ?? "";
      return { ...list, status: specialtyIdB ? list.status : 0 };
    },
    { status: 200 },
  ],
  [
    "B adds a valid task",
    () =>
      userB(
        "/api/tasks",
        post({ task_number: "1", task_name: validTaskNameB, task_specialty: specialtyIdB, task_effort: "2" }),
      ),
    { status: 302, locationIs: "/tasks" },
  ],
  [
    "B's check finds no problems, warns about cycles and does not show A's tasks",
    () => userB("/tasks/check"),
    {
      status: 200,
      bodyIncludes: ["Nie znaleziono zad", "Cykle zale"],
      bodyExcludes: ["wszystko w porz", validTaskNameB, dupTaskName, zeroEffortTaskName, missingPredTaskName],
    },
  ],
  [
    "A sees the delete confirmation page",
    () => userA(`/projects/${projectId}/delete`),
    { status: 200, bodyIncludes: [renamedProject] },
  ],
  [
    "A deletes the project",
    () => userA(`/api/projects/${projectId}/delete`, post()),
    { status: 302, location: "/projects" },
  ],
  [
    "A's list no longer contains the project",
    () => userA("/projects"),
    { status: 200, bodyExcludes: [renamedProject] },
  ],
  [
    "dashboard is empty after deleting the selected project",
    () => userA("/dashboard"),
    { status: 200, bodyIncludes: ["Nie wybrano projektu"], bodyExcludes: [renamedProject] },
  ],
  [
    "the specialties page shows the empty state after deleting the selected project",
    () => userA("/specialties"),
    { status: 200, bodyIncludes: ["Nie wybrano projektu"], bodyExcludes: [renamedSpecialty] },
  ],
  [
    "the specialty edit page is gone after its project is deleted",
    () => userA(`/specialties/${specialtyId}/edit`),
    { status: 404 },
  ],
  ["the task edit page is gone after its project is deleted", () => userA(`/tasks/${taskId}/edit`), { status: 404 }],
  [
    "A adds a project whose CRLF description fits the limit once newlines count as one character",
    () =>
      userA(
        "/api/projects",
        post({ project_name: `Projekt Gamma ${stamp}`, project_description: "a\r\n".repeat(495) }),
      ),
    { status: 302, locationIs: "/projects" },
  ],
  [
    "a non-form body on signin redirects with an error instead of failing",
    () => anon("/api/auth/signin", { method: "POST", json: { email: emailA } }),
    { status: 302, location: "/auth/signin?error=Niepoprawne" },
  ],
  [
    "a malformed project id counts as not found",
    () => userA("/api/projects/nie-uuid/delete", post()),
    { status: 302, location: "/projects?error=" },
  ],
  ["signout clears session", () => userA("/api/auth/signout", post()), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => userA("/dashboard"), { status: 302, location: "/auth/signin" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const problems = [];
  if (actual.status !== expected.status) problems.push(`status ${actual.status}, expected ${expected.status}`);
  if (expected.locationIs !== undefined && actual.location !== expected.locationIs) {
    problems.push(`location "${actual.location.slice(0, 80)}", expected exactly "${expected.locationIs}"`);
  }
  if (expected.location !== undefined && !actual.location.startsWith(expected.location)) {
    problems.push(`location "${actual.location}", expected "${expected.location}"`);
  }
  for (const text of expected.locationIncludes ?? []) {
    if (!actual.location.includes(text)) problems.push(`location "${actual.location.slice(0, 80)}" missing "${text}"`);
  }
  for (const text of expected.bodyIncludes ?? []) {
    if (!actual.body.includes(text)) problems.push(`body missing "${text}"`);
  }
  for (const text of expected.bodyExcludes ?? []) {
    if (actual.body.includes(text)) problems.push(`body unexpectedly contains "${text}"`);
  }
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (problems.length) {
    failed++;
    for (const problem of problems) console.log(`      ${problem}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
