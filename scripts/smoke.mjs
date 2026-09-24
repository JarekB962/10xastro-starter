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

  return async function request(path, { method = "GET", form } = {}) {
    const response = await fetch(BASE_URL + path, {
      method,
      redirect: "manual",
      headers: {
        Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
        Origin: BASE_URL,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
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
    "A adds a project whose CRLF description fits the limit once newlines count as one character",
    () =>
      userA(
        "/api/projects",
        post({ project_name: `Projekt Gamma ${stamp}`, project_description: "a\r\n".repeat(495) }),
      ),
    { status: 302, locationIs: "/projects" },
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
