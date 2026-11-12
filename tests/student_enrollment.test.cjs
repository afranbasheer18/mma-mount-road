const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "static", "app.js"), "utf8");
const adminScriptSource = fs.readFileSync(
  path.join(root, "static", "admin.js"),
  "utf8",
);
const studentScriptSource = fs.readFileSync(
  path.join(root, "static", "student.js"),
  "utf8",
);
const studentTemplate = fs.readFileSync(
  path.join(root, "templates", "student.html"),
  "utf8",
);

function extractStudentScript() {
  assert.notEqual(studentScriptSource.length, 0, "student-page script must exist");
  return studentScriptSource;
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

test("common login redirects administrator accounts to the admin dashboard", async () => {
  const loginHandler = extractBetween(
    studentScriptSource,
    "async function doLogin() {",
    "\nasync function submitEnrollment() {",
  );
  const destinations = [];
  const button = { disabled: false };
  const fields = {
    uid: { value: "ADMIN01" },
    pw: { value: "admin-password" },
    loginErr: { textContent: "", style: {} },
    login: { classList: { remove() {} } },
    app: { style: {} },
  };
  const context = vm.createContext({
    api: {
      async login(identity, password) {
        assert.equal(identity, "ADMIN01");
        assert.equal(password, "admin-password");
        return { success: true, user: { role: "admin" } };
      },
    },
    currentUser: null,
    document: {
      getElementById(id) {
        return fields[id] || null;
      },
      querySelector() {
        return button;
      },
    },
    window: {
      location: {
        assign(destination) {
          destinations.push(destination);
        },
      },
    },
  });

  vm.runInContext(loginHandler, context);
  await vm.runInContext("doLogin()", context);

  assert.deepEqual(destinations, ["/admin"]);
  assert.equal(button.disabled, false);
});

test("admin logout clears the client user and redirects to common login", async () => {
  const logoutHandler = extractBetween(
    adminScriptSource,
    "async function doLogout() {",
    "\n}\n",
  ) + "\n}";
  const destinations = [];
  const removedKeys = [];
  let logoutCalls = 0;
  const context = vm.createContext({
    api: {
      async logout() {
        logoutCalls += 1;
      },
    },
    localStorage: {
      removeItem(key) {
        removedKeys.push(key);
      },
    },
    window: {
      __mmaAdminSessionReady: true,
      location: {
        replace(destination) {
          destinations.push(destination);
        },
      },
    },
    console: { error() {} },
    alert(message) {
      assert.fail(`unexpected logout error: ${message}`);
    },
  });

  vm.runInContext(logoutHandler, context);
  await vm.runInContext("doLogout()", context);

  assert.equal(logoutCalls, 1);
  assert.equal(context.window.__mmaAdminSessionReady, false);
  assert.deepEqual(removedKeys, ["mma_currentUser", "mma_adminLastScreen"]);
  assert.deepEqual(destinations, ["/student"]);
});

test("admin startup renders its preloaded datasets without repeating API reads", async () => {
  const requests = [];
  const usersBody = { innerHTML: "" };
  const noFoodBox = { innerHTML: "" };
  const todayMenuForm = { innerHTML: "" };
  const weekBody = { innerHTML: "" };
  const context = vm.createContext({
    api: {
      getUsers() {
        requests.push("users");
        throw new Error("startup should use the preloaded users");
      },
      getNoFoodRequests() {
        requests.push("no-food");
        throw new Error("startup should use the preloaded requests");
      },
      getTodayMenu() {
        requests.push("today-menu");
        throw new Error("startup should use the preloaded menu");
      },
      getWeeklyMenu() {
        requests.push("weekly-menu");
        throw new Error("startup should use the preloaded menu");
      },
    },
    document: {
      getElementById(id) {
        if (id === "usersBody") return usersBody;
        if (id === "noFoodRequestsRoot") return noFoodBox;
        if (id === "todayMenuForm") return todayMenuForm;
        if (id === "weekBody") return weekBody;
        if (id === "login") return { classList: { contains: () => false } };
        return null;
      },
    },
    escapeApiHtml: (value) => String(value),
    renderAdminUsersTable() {},
    renderFoodPoints() {},
    store: {
      get(key) {
        if (key === "users") return [{ id: "S001" }];
        if (key === "todayMenu") return { breakfast: "Idli" };
        if (key === "weekMenu") return [{ day: "Mon", b: "Idli", l: "Rice", d: "Chapati" }];
        return [];
      },
    },
    window: {},
    console: { error() {} },
    localStorage: { setItem() {} },
  });
  vm.runInContext(
    [
      "let users = [];",
      "let noFoodRefreshBusy = false;",
      extractBetween(
        adminScriptSource,
        "async function renderUsers(useCachedData) {",
        "\nasync function saveUser() {",
      ),
      extractBetween(
        adminScriptSource,
        "async function renderNoFoodRequests(useCachedData) {",
        "\nwindow.refreshNoFoodRequests = renderNoFoodRequests;",
      ),
      extractBetween(
        adminScriptSource,
        "async function renderMenu(useCachedData) {",
        "\n// Modified saveTodayMenu to use API",
      ),
    ].join("\n"),
    context,
  );

  await vm.runInContext("renderUsers(true)", context);
  await vm.runInContext("renderNoFoodRequests(true)", context);
  await vm.runInContext("renderMenu(true)", context);

  assert.deepEqual(requests, []);
  assert.match(noFoodBox.innerHTML, /No pending no-food requests/);
  assert.match(todayMenuForm.innerHTML, /Idli/);
  assert.match(weekBody.innerHTML, /Chapati/);
});

test("student form invokes the real handler and posts to the registration API", async () => {
  assert.match(studentTemplate, /onclick="submitEnrollment\(\)">Submit Enrollment/);
  assert.match(studentTemplate, /app\.js'\) \}\}\?v=6/);
  assert.match(studentTemplate, /student\.js'\) \}\}\?v=3/);

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

test("API client shares concurrent identical GETs and allows later refreshes", async () => {
  const requests = [];
  let releaseRequest;
  const context = vm.createContext({
    window: {
      location: { origin: "https://mma-mount-road1.vercel.app" },
      dispatchEvent() {},
    },
    Event: class Event {},
    console: { log() {}, error() {} },
    fetch: (url, options) => {
      requests.push({ url, options });
      return new Promise((resolve) => {
        releaseRequest = () => resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
      });
    },
  });
  context.window.window = context.window;
  const apiClient = extractBetween(
    appSource,
    "class APIClient {",
    "\nconst api = new APIClient();",
  );
  vm.runInContext(
    [
      "const API_BASE_URL = `${window.location.origin}/api`;",
      "const API_DEBUG = false;",
      apiClient,
      "const api = new APIClient();",
    ].join("\n"),
    context,
  );

  const first = vm.runInContext("api.request('/menu/weekly')", context);
  const second = vm.runInContext("api.request('/menu/weekly')", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  releaseRequest();
  await Promise.all([first, second]);

  const later = vm.runInContext("api.request('/menu/weekly')", context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 2);
  releaseRequest();
  await later;
});
