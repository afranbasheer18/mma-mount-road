(function (global) {
  "use strict";

  const TIME_ZONE = "Asia/Kolkata";
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en", {
    timeZone: TIME_ZONE,
    weekday: "short"
  });

  function formattedParts(formatter, date) {
    return formatter.formatToParts(date).reduce(function (result, part) {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  }

  function calendarKey(date) {
    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0");
  }

  function todayKey(now) {
    const parts = formattedParts(dateFormatter, now || new Date());
    return parts.year + "-" + parts.month + "-" + parts.day;
  }

  function monthKey(now) {
    const parts = formattedParts(dateFormatter, now || new Date());
    return parts.year + "-" + parts.month;
  }

  function targetDate(daysFromToday, now) {
    const offset = Number(daysFromToday);
    if (!Number.isInteger(offset)) {
      throw new TypeError("daysFromToday must be an integer.");
    }
    const parts = formattedParts(dateFormatter, now || new Date());
    const shifted = new Date(Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + offset
    ));
    return new Date(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      12
    );
  }

  function timeKey(now) {
    const parts = formattedParts(timeFormatter, now || new Date());
    return parts.hour + ":" + parts.minute;
  }

  function weekdayKey(now) {
    return weekdayFormatter.format(now || new Date()).toLowerCase();
  }

  global.mmaMessDate = Object.freeze({
    calendarKey: calendarKey,
    todayKey: todayKey,
    monthKey: monthKey,
    targetDate: targetDate,
    timeKey: timeKey,
    weekdayKey: weekdayKey
  });
})(window);



 // API Client for MMA Mess Frontend
// Allow mobile devices on the same Wi-Fi to connect to Flask on port 5000.
// You can override this by setting window.MMA_API_BASE_URL before this file loads.
const API_BASE_URL = window.MMA_API_BASE_URL ||
  `${window.location.origin}/api`;
const API_DEBUG = window.MMA_API_DEBUG === true;

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    if (API_DEBUG) {
      console.log("API REQUEST METHOD:", options.method || "GET");
    }
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers
      });

      const data = await response.json().catch(() => ({}));
      if (API_DEBUG) {
        console.log("API STATUS:", response.status);
      }

      if (!response.ok) {
        if (
          response.status === 401 &&
          endpoint !== '/auth/login' &&
          endpoint !== '/auth/current-user'
        ) {
          window.dispatchEvent(new Event('mma:session-expired'));
        }
        const method = String(options.method || 'GET').toUpperCase();
        const diagnostic = `${method} ${endpoint}`;
        const message = data.message || `Request failed (${response.status})`;
        const error = new Error(`${message} [${diagnostic}]`);
        error.status = response.status;
        error.endpoint = endpoint;
        error.method = method;
        error.retryAfter = data.retryAfter;
        throw error;
      }

      return data;
    } catch (error) {
      if (!error.status) {
        console.error('API request failed:', error.name);
        if (error && error.name === 'TypeError') {
          const networkError = new Error(
            `The browser could not complete a network or CORS request to ${API_BASE_URL}. No HTTP response was available; check Flask connectivity and the allowed frontend origin.`
          );
          networkError.code = 'NETWORK_OR_CORS_ERROR';
          networkError.cause = error;
          throw networkError;
        }
      }
      throw error;
    }
  }

  // Auth
  async login(uid, pw) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ uid, pw })
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  async changePassword(data) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async register(data) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getCurrentUser() {
    return this.request('/auth/current-user');
  }

  // Users
  async getUsers() {
    return this.request('/users/');
  }

  async getRegistrations() {
    return this.request('/users/registrations');
  }

  async approveRegistration(registrationId) {
    return this.request(`/users/registrations/${registrationId}/approve`, { method: 'POST' });
  }

  async rejectRegistration(registrationId) {
    return this.request(`/users/registrations/${registrationId}/reject`, { method: 'POST' });
  }

  async createUser(data) {
    return this.request('/users/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateUser(userId, data) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteUser(userId) {
    return this.request(`/users/${userId}`, { method: 'DELETE' });
  }

  async toggleUserStatus(userId) {
    return this.request(`/users/${userId}/toggle-status`, { method: 'POST' });
  }

  // Menu
  async getTodayMenu() {
    return this.request('/menu/today');
  }

  async getTomorrowMenu() {
    return this.request('/menu/tomorrow');
  }

  async updateTodayMenu(data) {
    return this.request('/menu/today', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getWeeklyMenu() {
    return this.request('/menu/weekly');
  }

  async updateWeeklyMenu(data) {
    return this.request('/menu/weekly', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Entries
  async getEntries(date, page = 1, perPage = 100) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    params.set('page', page);
    params.set('per_page', perPage);
    return this.request(`/entries/?${params.toString()}`);
  }

  async getEntriesForMonth(month, page = 1, perPage = 100) {
    const params = new URLSearchParams({
      month,
      page: String(page),
      per_page: String(perPage)
    });
    return this.request(`/entries/?${params.toString()}`);
  }

  async getAllEntriesForMonth(month, perPage = 200) {
    const first = await this.getEntriesForMonth(month, 1, perPage);
    const entries = Array.isArray(first.entries) ? first.entries.slice() : [];
    for (let page = 2; page <= Number(first.pages || 1); page += 1) {
      const response = await this.getEntriesForMonth(month, page, perPage);
      entries.push(...(Array.isArray(response.entries) ? response.entries : []));
    }
    return { ...first, entries };
  }

  async getTomorrowEntries() {
    return this.request('/entries/tomorrow');
  }

  async getEntryHistory() {
    return this.request('/entries/history');
  }

  async submitEntry(data) {
    return this.request('/entries/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async saveAdminEntry(data) {
    return this.request('/entries/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Meal Records
  async getMealRecords(date) {
    const query = date
      ? `?date=${encodeURIComponent(date)}`
      : '';
    return this.request(`/meal-records/${query}`);
  }

  async getMealRecordsForMonth(month) {
    return this.request(`/meal-records/?month=${encodeURIComponent(month)}`);
  }

  async getMealCancellations(dateOrMonth, mode = 'date') {
    const query = dateOrMonth
      ? `?${mode}=${encodeURIComponent(dateOrMonth)}`
      : '';
    return this.request(`/meal-records/cancellations${query}`);
  }

  async cancelMeal(data) {
    return this.request('/meal-records/cancellations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateAdminPresence(viewerId) {
    return this.request('/users/admin-presence', {
      method: 'POST',
      body: JSON.stringify({ viewerId })
    });
  }

  async clearAdminPresence(viewerId) {
    return this.request('/users/admin-presence', {
      method: 'DELETE',
      body: JSON.stringify({ viewerId })
    });
  }

  async getMyTodayRecord() {
    return this.request('/meal-records/my-today');
  }

  async saveMealRecord(data) {
    return this.request('/meal-records/', {
      method: 'POST',
      body: JSON.stringify({
        date: data.date,
        expectedUserId: data.expectedUserId,
        meals: data.meals,
        confirmed: data.confirmed,
        confirmedAt: data.confirmedAt
      })
    });
  }

  async getPendingMealPermissions() {
    return this.request('/meal-records/permissions/pending');
  }

  async decideMealPermission(recordId, meal, status) {
    return this.request(
      `/meal-records/permissions/${encodeURIComponent(recordId)}/${encodeURIComponent(meal)}`,
      {
        method: 'POST',
        body: JSON.stringify({ status })
      }
    );
  }

  // No-food requests
  async getNoFoodRequests(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.request(`/meal-records/no-food-requests${query}`);
  }

  async submitNoFoodRequest(data) {
    return this.request('/meal-records/no-food-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async cancelNoFoodRequest(requestId) {
    return this.request(`/meal-records/no-food-requests/${encodeURIComponent(requestId)}`, {
      method: 'DELETE'
    });
  }

  async approveNoFoodRequest(requestId) {
    return this.request(`/meal-records/no-food-requests/${encodeURIComponent(requestId)}/approve`, {
      method: 'POST'
    });
  }

  async rejectNoFoodRequest(requestId) {
    return this.request(`/meal-records/no-food-requests/${encodeURIComponent(requestId)}/reject`, {
      method: 'POST'
    });
  }

  // Bills
  async getBills(month) {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request(`/bills/${query}`);
  }

  async getBillDrafts(month) {
    return this.request(`/bills/drafts?month=${encodeURIComponent(month)}`);
  }

  async saveBillDrafts(month, drafts) {
    return this.request('/bills/drafts', {
      method: 'PUT',
      body: JSON.stringify({ month, drafts })
    });
  }

  async getExpenses(month) {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return this.request(`/bills/expenses${query}`);
  }

  async getPointRate(month) {
    return this.request(`/bills/point-rate?month=${encodeURIComponent(month)}`);
  }

  async generateBills(month, bills) {
    return this.request('/bills/generate', {
      method: 'POST',
      body: JSON.stringify({ month, bills })
    });
  }

  async getBillArchive() {
    return this.request('/bills/archive');
  }

  async saveBillSnapshots(bills) {
    return this.request('/bills/snapshots', {
      method: 'PUT',
      body: JSON.stringify({ bills })
    });
  }

  async recalculateBillSnapshots(month, userIds) {
    return this.request('/bills/snapshots', {
      method: 'PUT',
      body: JSON.stringify({ month, recalculate: true, user_ids: userIds })
    });
  }

  async saveBillArchive(archive) {
    return this.request('/bills/archive', {
      method: 'POST',
      body: JSON.stringify({ archive })
    });
  }

  async markBillPaid(billId) {
    return this.request(`/bills/${billId}/mark-paid`, { method: 'POST' });
  }

  // Notifications
  async getNotifications() {
    return this.request('/notifications/');
  }

  async sendNotification(data) {
    return this.request('/notifications/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST'
    });
  }

  async markNotificationsRead(target) {
    return this.request('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify(target ? { target } : {})
    });
  }

  async clearNotifications() {
    return this.request('/notifications/clear', { method: 'POST' });
  }

  // Feedback
  async getFeedback() {
    return this.request('/feedback/');
  }

  async submitFeedback(data) {
    return this.request('/feedback/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Settings
  async getSettings() {
    return this.request('/settings/');
  }

  async saveSettings(data) {
    return this.request('/settings/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateFoodPoints(foodPoints, changedKey) {
    const data = { foodPoints };
    if (changedKey) data.changedKey = changedKey;
    return this.request('/settings/food-points', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

}

const api = new APIClient();


(function (global) {
  "use strict";

  var ROOM_ORDER = Object.freeze([
    "G1", "G2", "G3",
    "F1", "F2", "F3",
    "S1", "S2", "S3",
    "T1", "T2", "T3"
  ]);
  var ROOM_PRIORITIES = new Map(ROOM_ORDER.map(function (room, index) {
    return [room, index];
  }));

  function normalizeRoom(room) {
    return String(room == null ? "" : room)
      .trim()
      .toUpperCase()
      .replace(/[\s/_-]+/g, "");
  }

  function getRoomPriority(room) {
    var key = normalizeRoom(room);
    return ROOM_PRIORITIES.has(key) ? ROOM_PRIORITIES.get(key) : ROOM_ORDER.length;
  }

  function compareText(a, b) {
    return String(a == null ? "" : a).localeCompare(
      String(b == null ? "" : b),
      undefined,
      { sensitivity: "base" }
    );
  }

  function compareRooms(a, b) {
    var priorityA = getRoomPriority(a);
    var priorityB = getRoomPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;
    if (priorityA < ROOM_ORDER.length) return 0;
    return compareText(normalizeRoom(a), normalizeRoom(b)) ||
      compareText(a, b);
  }

  function recordName(record) {
    var user = record && record.user && typeof record.user === "object"
      ? record.user
      : null;
    return record && (
      record.name ||
      record.displayName ||
      record.user_name ||
      record.userName ||
      user && user.name ||
      record.user_id ||
      typeof record.user === "string" && record.user ||
      record.id
    ) || "";
  }

  function recordRoom(record) {
    var user = record && record.user && typeof record.user === "object"
      ? record.user
      : null;
    return record && (
      record.room != null
        ? record.room
        : record.displayRoom != null ? record.displayRoom : user && user.room
    );
  }

  function sortByRoom(records, tieBreaker) {
    return (Array.isArray(records) ? records : []).slice().sort(function (a, b) {
      return compareRooms(recordRoom(a), recordRoom(b)) ||
        compareText(recordName(a), recordName(b)) ||
        (typeof tieBreaker === "function" ? tieBreaker(a, b) : 0);
    });
  }

  function sortRooms(rooms) {
    return (Array.isArray(rooms) ? rooms : []).slice().sort(compareRooms);
  }

  global.MMARoomSort = Object.freeze({
    ROOM_ORDER: ROOM_ORDER,
    normalizeRoom: normalizeRoom,
    getRoomPriority: getRoomPriority,
    compareRooms: compareRooms,
    sortByRoom: sortByRoom,
    sortRooms: sortRooms
  });
})(typeof window !== "undefined" ? window : globalThis);


/* =========================================================
   MMA POINTS ENGINE  (shared by the Admin app and the User app)
   ---------------------------------------------------------
   IMPORTANT: this file is intentionally IDENTICAL in
   "admin mess/" and "mess project/". Both apps read the same
   localStorage keys, so the same code gives the same numbers.

   localStorage keys used (all prefixed "mma_"):
     foodPoints      { "<normalised food name>": {name, price, point} }
     weekMenu        existing weekly menu  [{day,b,l,d} x 7, Mon..Sun]
     todayMenu       existing today's menu {breakfast,lunch,dinner}
     menuSnapshots   { "YYYY-MM-DD": {b,l,d,points:{b,l,d}} } date-specific menu and point weights
     messEntryHistory existing mess entries [{user,date,b,l,d}]
   ========================================================= */
(function (global) {
  "use strict";

  var PREFIX = "mma_";
  var deferBusinessPersistence = 0;

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value, changedKey) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      /* Only persist business data (food points, menu, settings) when explicitly saved by the admin.
         Do not autosave on every localStorage write in the student app to prevent
         automatic saves when entering edit mode or during background refresh. */
      if (!deferBusinessPersistence && typeof global.mmaPersistBusinessData === "function") {
        /* Student app: disable automatic persistence to prevent unintended saves */
        if (typeof global.currentUser !== "undefined" && global.currentUser && global.currentUser.role === "student") {
          return true;
        }
        var result = global.mmaPersistBusinessData(key, value, changedKey);
        if (result && typeof result.catch === "function") {
          result.catch(function (error) {
            console.error("Business-data sync error:", error);
            if (global.MMAUI && typeof global.MMAUI.toast === "function") {
              global.MMAUI.toast(error.message || "The change could not be saved to the server.", "error");
            }
          });
        }
      }
      return true;
    }
    catch (e) { console.error("Storage write error:", e); return false; }
  }

  function round(n, places) {
    var f = Math.pow(10, places == null ? 2 : places);
    return Math.round((Number(n) + Number.EPSILON) * f) / f;
  }

  function effectiveMeal(input) {
    var planned = Math.max(0, Number(input.planned) || 0);
    var meal = input.meal && typeof input.meal === "object" ? input.meal : null;
    if (input.cancelled) {
      return { planned: planned, quantity: 0, value: 0, fine: false, missing: 0, cancelled: true };
    }

    var calculation = meal && meal.calculation;
    if (calculation && calculation.billable_quantity != null &&
        Number.isFinite(Number(calculation.billable_quantity))) {
      return {
        planned: planned,
        quantity: Number.isFinite(Number(calculation.entered_quantity))
          ? Number(calculation.entered_quantity)
          : Math.max(0, Number(meal.q) || 0),
        value: Number(calculation.billable_quantity),
        fine: Number(calculation.additional_fine || 0) > 0,
        missing: Number(calculation.missing_fine_points || 0),
        unauthorized: Number(calculation.unauthorized_quantity || 0),
        permissionStatus: calculation.permission_status ||
          (meal.permission && meal.permission.status) || "not_requested",
        cancelled: !!calculation.cancelled
      };
    }

    if (input.noFoodStatus === "approved") {
      return { planned: planned, value: 0, fine: false, missing: 0, noFoodApproved: true };
    }
    if (input.noFoodStatus === "rejected") {
      return { planned: planned, value: planned, fine: false, missing: 0, noFoodRejected: true };
    }
    if (meal && meal.optOut) {
      return {
        planned: planned,
        value: planned,
        fine: true,
        missing: 0,
        optOut: true,
        finePoints: Math.max(0, Number(meal.finePoints) || 0)
      };
    }
    if (input.adminApproved) {
      return { planned: planned, quantity: planned, value: planned, fine: false, adminApproved: true };
    }

    var actual = meal
      ? Math.max(0, Number(meal.q) || 0)
      : input.closed ? 0 : planned;
    var permission = meal && meal.permission;
    var approved = permission && permission.status === "approved"
      ? Math.max(0, Number(permission.approved_quantity) || 0)
      : 0;
    var approvedExtra = Math.min(Math.max(0, actual - planned), approved);
    var unauthorized = Math.max(0, actual - planned - approvedExtra);
    var missing = input.closed ? Math.max(0, planned - actual) : 0;
    var normal = Math.min(actual, planned) + approvedExtra + missing;
    var permissionPending = permission && permission.status === "pending";
    return {
      planned: planned,
      quantity: actual,
      value: normal + missing + (permissionPending ? 0 : unauthorized * 2),
      fine: missing > 0 || (!permissionPending && unauthorized > 0),
      missing: missing,
      unauthorized: permissionPending ? 0 : unauthorized,
      permissionStatus: permission ? permission.status : "not_requested"
    };
  }

  function dateKey(d) {
    return window.mmaMessDate.calendarKey(d);
  }
  function todayKey() { return window.mmaMessDate.todayKey(); }

  /* ---------- food names / points ---------- */

  function normFood(name) {
    return String(name == null ? "" : name).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getFoodPoints() {
    var fp = read("foodPoints", {});
    return fp && typeof fp === "object" && !Array.isArray(fp) ? fp : {};
  }
  function saveFoodPoints(map, changedKey) {
    var previous = read("foodPoints", {});
    var result = write("foodPoints", map, changedKey);
    if (result && typeof result.then === "function") {
      return result.catch(function (error) {
        localStorage.setItem(PREFIX + "foodPoints", JSON.stringify(previous));
        throw error;
      });
    }
    return result;
  }

  /* Point weight of a dish. Unknown / empty dish => null (not configured). */
  function pointOf(name, map) {
    var key = normFood(name);
    if (!key) return null;
    var row = (map || getFoodPoints())[key];
    if (!row || row.point === "" || row.point == null) return null;
    var p = Number(row.point);
    return Number.isFinite(p) && p >= 0 ? p : null;
  }

  /* ---------- which dish was served on which date ---------- */

  function weekIndex(key) {            // weekMenu is Mon..Sun
    var d = new Date(key + "T00:00:00");
    return (d.getDay() + 6) % 7;
  }

  function currentTodayMenu() {
    var t = read("todayMenu", null);
    if (!t || typeof t !== "object") return null;
    return { b: t.breakfast || "", l: t.lunch || "", d: t.dinner || "" };
  }

  /* Menu snapshots pin the food and its point value to a calendar date.
     * Old snapshots without point values are upgraded on first read. */
  function weeklyMenuForDate(key) {
    var week = read("weekMenu", []);
    var row = Array.isArray(week) ? week[weekIndex(key)] : null;
    return row ? { b: row.b || "", l: row.l || "", d: row.d || "" } : { b: "", l: "", d: "" };
  }

  function menuForDate(key) {
    var today = todayKey();
    if (key === today) {
      var current = currentTodayMenu();
      if (current) return current;
    }
    var snaps = read("menuSnapshots", {});
    if (snaps && snaps[key] && typeof snaps[key] === "object") {
      return { b: snaps[key].b || "", l: snaps[key].l || "", d: snaps[key].d || "" };
    }
    return weeklyMenuForDate(key);
  }

  function snapshotDate(key, force) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return null;
    var snaps = read("menuSnapshots", {});
    if (!snaps || typeof snaps !== "object" || Array.isArray(snaps)) snaps = {};
    var today = todayKey();
    var old = snaps[key];
    var hasOldMenu = !!(old && typeof old === "object" &&
      Object.prototype.hasOwnProperty.call(old, "b") &&
      Object.prototype.hasOwnProperty.call(old, "l") &&
      Object.prototype.hasOwnProperty.call(old, "d"));
    var scheduledMenu = key === today ? (currentTodayMenu() || weeklyMenuForDate(key)) : weeklyMenuForDate(key);
    // Do not replace an already captured past date with today's edited weekly menu.
    // Today's actual menu may change during the day, and forced refreshes update
    // only the date range explicitly requested by the admin.
    var updateMenu = !!force || !hasOldMenu || key === today;
    var menu = updateMenu ? scheduledMenu : { b: old.b || "", l: old.l || "", d: old.d || "" };
    var menuChanged = !hasOldMenu || old.b !== menu.b || old.l !== menu.l || old.d !== menu.d;
    var lacksPoints = !old || !old.points || typeof old.points !== "object";
    if (!force && !menuChanged && !lacksPoints) return old;
    var fp = getFoodPoints();
    snaps[key] = {
      b: menu.b || "", l: menu.l || "", d: menu.d || "",
      points: {
        b: pointOf(menu.b, fp),
        l: pointOf(menu.l, fp),
        d: pointOf(menu.d, fp)
      },
      capturedAt: (old && old.capturedAt && !force && !menuChanged && !lacksPoints) ? old.capturedAt : new Date().toISOString()
    };
    write("menuSnapshots", snaps);
    return snaps[key];
  }

  /* Snapshot today's actual menu; used when the admin saves the daily menu. */
  function snapshotToday() {
    return snapshotDate(todayKey(), false);
  }

  /* Refresh current/upcoming dates after a weekly menu or food point update.
     Past dates are intentionally left untouched. */
  function refreshFutureSnapshots(days) {
    var count = Math.max(1, Math.min(180, Number(days) || 90));
    deferBusinessPersistence++;
    try {
      for (var i = 0; i < count; i++) {
        var d = window.mmaMessDate.targetDate(i);
        var key = dateKey(d);
        snapshotDate(key, true);
      }
    } finally {
      deferBusinessPersistence--;
    }
    return write("menuSnapshots", read("menuSnapshots", {}));
  }

  /* Every distinct dish name currently on the menu (weekly + today). */
  function listMenuFoods() {
    var seen = {}, out = [];
    function add(name) {
      var key = normFood(name);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({ key: key, name: String(name).replace(/\s+/g, " ").trim() });
    }
    var week = read("weekMenu", []);
    (Array.isArray(week) ? week : []).forEach(function (r) { add(r && r.b); add(r && r.l); add(r && r.d); });
    var t = read("todayMenu", null);
    if (t) { add(t.breakfast); add(t.lunch); add(t.dinner); }
    return out;
  }

  /* ---------- points for one day / one month ---------- */

  /* eff(userId, dateKey, entry, "b"|"l"|"d") -> number of meals counted
     (the app's own rule, including the doubled-if-not-confirmed rule). */
  function dayPoints(key, entry, userId, eff, map, menuOverride) {
    var menu = menuOverride || menuForDate(key);
    var fp = map || getFoodPoints();
    var res = { b: 0, l: 0, d: 0, total: 0, missing: [] };
    ["b", "l", "d"].forEach(function (m) {
      var qty = Number(eff(userId, key, entry, m)) || 0;
      if (!(qty > 0)) return;
      // Always use the current Admin > Food Menu point value for the dish
      // recorded for this date. Snapshots preserve which dish was served, but
      // must not override the current Food Menu point setting during calculation.
      var p = pointOf(menu[m], fp);
      if (p === null || p === "" || p == null || !Number.isFinite(Number(p)) || Number(p) < 0) {
        if (menu[m]) res.missing.push(menu[m]);
        return;
      }
      res[m] = qty * p;
      res.total += qty * p;
    });
    return res;
  }

  function monthPoints(userId, month, entries, eff, menuForMonthDate) {
    var uid = String(userId || "").toUpperCase();
    var fp = getFoodPoints();
    var unique = {};
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      if (String(e.user || "").toUpperCase() !== uid) return;
      if (typeof e.date !== "string" || e.date.indexOf(month + "-") !== 0) return;
      unique[e.date] = e;          // one entry per user per day (last wins)
    });
    var out = { total: 0, days: 0, perDay: [], missing: [] };
    Object.keys(unique).sort().forEach(function (key) {
      var menu = typeof menuForMonthDate === "function" ? menuForMonthDate(key) : undefined;
      var dp = dayPoints(key, unique[key], uid, eff, fp, menu);
      out.total += dp.total;
      out.days += 1;
      out.perDay.push({ date: key, points: dp });
      dp.missing.forEach(function (n) { if (out.missing.indexOf(n) < 0) out.missing.push(n); });
    });
    out.total = round(out.total, 2);
    return out;
  }

  function fmtPoints(n) {
    var v = round(n, 2);
    return Number.isInteger(v) ? String(v) : String(v.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
  }

  global.MMAPoints = {
    read: read, write: write, round: round, effectiveMeal: effectiveMeal, dateKey: dateKey, todayKey: todayKey,
    normFood: normFood, getFoodPoints: getFoodPoints, saveFoodPoints: saveFoodPoints, pointOf: pointOf,
    menuForDate: menuForDate, weeklyMenuForDate: weeklyMenuForDate, snapshotDate: snapshotDate, snapshotToday: snapshotToday, refreshFutureSnapshots: refreshFutureSnapshots, listMenuFoods: listMenuFoods,
    dayPoints: dayPoints, monthPoints: monthPoints, fmtPoints: fmtPoints
  };

  try { snapshotToday(); } catch (e) { /* storage unavailable */ }
})(window);
