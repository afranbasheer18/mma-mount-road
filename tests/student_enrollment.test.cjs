const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "static", "app.js"), "utf8");
const studentTemplate = fs.readFileSync(
  path.join(root, "templates", "student.html"),
  "utf8",
);

function extractStudentScript() {
  const marker = 'eval("/* =========================================================\\n   MMA UI BUTTON HELPERS';
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, "student-page script eval must exist");
  const end = appSource.indexOf("\n", start);
  const statement = appSource.slice(start, end).trim();
  assert.ok(statement.startsWith("eval(") && statement.endsWith(");"));
  return vm.runInNewContext(statement.slice(5, -2));
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end).trim();
}

function createBrowserContext(responseBody, status = 200) {
  const requests = [];
  const fields = {
    enrollName: { value: "New Student" },
    enrollRoom: { value: "G1-01" },
    enrollPhone: { value: "2222222222" },
    enrollEmail: { value: "new.student@gmail.com" },
    enrollPassword: { value: "student-password" },
    enrollConfirm: { value: "student-password" },
    enrollErr: { textContent: "", style: {} },
  };
  const button = { disabled: false };
  const card = { innerHTML: "" };
  const window = {
    location: { origin: "https://mma-mount-road1.vercel.app" },
    dispatchEvent() {},
  };
  const document = {
    getElementById(id) {
      return fields[id] || null;
    },
    querySelector(selector) {
      return selector === "#enroll .login-card" ? card : button;
    },
  };
  const context = vm.createContext({
    window,
    document,
    currentUser: null,
    console: { log() {}, error() {} },
    Event: class Event {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => responseBody,
      };
    },
  });
  window.window = window;
  const apiClient = extractBetween(
    appSource,
    "class APIClient {",
    "\nconst api = new APIClient();",
  );
  const studentScript = extractStudentScript();
  const handler = extractBetween(
    studentScript,
    "async function submitEnrollment() {",
    "\nwindow.submitEnrollment = submitEnrollment;",
  );
  assert.doesNotThrow(() => new vm.Script(studentScript));
  const exposeHandler = studentScript.match(
    /window\.submitEnrollment\s*=\s*submitEnrollment\s*;/g,
  );
  assert.equal(exposeHandler?.length, 1, "expose one enrollment handler");
  assert.ok(
    studentScript.indexOf(exposeHandler[0]) > studentScript.indexOf(handler),
    "expose the handler after its definition",
  );
  assert.doesNotMatch(studentScript, /showUnavailable/);
  assert.doesNotMatch(studentScript, /window\.submitEnrollment\s*=\s*function/);

  vm.runInContext(
    [
      "const API_BASE_URL = `${window.location.origin}/api`;",
      "const API_DEBUG = false;",
      apiClient,
      "const api = new APIClient();",
      handler,
      exposeHandler[0],
    ].join("\n"),
    context,
  );
  return { context, fields, requests, card };
}

test("student form invokes the real handler and posts to the registration API", async () => {
  assert.match(studentTemplate, /onclick="submitEnrollment\(\)">Submit Enrollment/);
  assert.match(studentTemplate, /app\.js'\) \}\}\?v=3/);

  const { context, requests, card } = createBrowserContext({
    success: true,
    message: "Registration submitted. Wait for admin approval.",
  });
  await vm.runInContext("submitEnrollment()", context);

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://mma-mount-road1.vercel.app/api/auth/register",
  );
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    name: "New Student",
    room: "G1-01",
    phone: "2222222222",
    email: "new.student@gmail.com",
    password: "student-password",
    confirm: "student-password",
  });
  assert.match(card.innerHTML, /Enrollment Submitted/);
});

test("backend validation errors are displayed in the enrollment form", async () => {
  const backendMessage = "This email or phone is already registered or awaiting approval";
  const { context, fields, requests } = createBrowserContext(
    { success: false, message: backendMessage },
    409,
  );
  await vm.runInContext("submitEnrollment()", context);

  assert.equal(requests.length, 1);
  assert.equal(
    fields.enrollErr.textContent,
    `${backendMessage} [POST /auth/register]`,
  );
  assert.equal(fields.enrollErr.style.display, "block");
});
