(function (global) {
  "use strict";

  var UNASSIGNED_ROOM = "__mma_unassigned_room__";

  function roomOf(user) {
    return String(user && user.room != null ? user.room : "").trim();
  }

  function normalizeRoom(room) {
    return String(room == null ? "" : room).trim().toUpperCase();
  }

  function listRooms(users) {
    var roomSort = global.MMARoomSort;
    var labelsByRoom = new Map();
    (Array.isArray(users) ? users : []).forEach(function (user) {
      var label = roomOf(user);
      var key = normalizeRoom(label);
      if (key && !labelsByRoom.has(key)) labelsByRoom.set(key, label);
    });
    return Array.from(labelsByRoom.entries())
      .map(function (item) { return { value: item[0], label: item[1] }; })
      .sort(function (a, b) {
        return roomSort.compareRooms(a.label, b.label);
      });
  }

  function filterUsers(users, selectedRoom) {
    var source = Array.isArray(users) ? users : [];
    if (!selectedRoom) return source.slice();
    if (selectedRoom === UNASSIGNED_ROOM) {
      return source.filter(function (user) { return !roomOf(user); });
    }
    var key = normalizeRoom(selectedRoom);
    return source.filter(function (user) {
      return normalizeRoom(roomOf(user)) === key;
    });
  }

  function groupForRoom(room) {
    var match = String(room || "").match(/^([GFST])\s*[-_/ ]?\s*\d+$/i);
    return match ? match[1].toUpperCase() : "Other";
  }

  function populateSelect(select, users) {
    if (!select) return;
    var previous = select.value;
    var rooms = listRooms(users);
    var groups = { G: [], F: [], S: [], T: [], Other: [] };
    rooms.forEach(function (room) {
      groups[groupForRoom(room.label)].push(room);
    });

    select.textContent = "";
    var allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All rooms";
    select.appendChild(allOption);

    ["G", "F", "S", "T", "Other"].forEach(function (key) {
      if (!groups[key].length) return;
      var group = document.createElement("optgroup");
      group.label = key === "Other" ? "Other rooms" : key + " rooms";
      groups[key].forEach(function (room) {
        var option = document.createElement("option");
        option.value = room.value;
        option.textContent = room.label;
        group.appendChild(option);
      });
      select.appendChild(group);
    });

    if ((Array.isArray(users) ? users : []).some(function (user) { return !roomOf(user); })) {
      var unassigned = document.createElement("option");
      unassigned.value = UNASSIGNED_ROOM;
      unassigned.textContent = "Unassigned";
      select.appendChild(unassigned);
    }

    var validValues = rooms.map(function (room) { return room.value; });
    if (previous === UNASSIGNED_ROOM &&
        (Array.isArray(users) ? users : []).some(function (user) { return !roomOf(user); })) {
      select.value = previous;
    } else {
      var normalized = normalizeRoom(previous);
      select.value = validValues.indexOf(normalized) >= 0 ? normalized : "";
    }
  }

  global.MMAAdminRoomFilter = Object.freeze({
    unassignedValue: UNASSIGNED_ROOM,
    roomOf: roomOf,
    listRooms: listRooms,
    filterUsers: filterUsers,
    groupForRoom: groupForRoom,
    populateSelect: populateSelect
  });
})(window);


/* =========================================================
   MMA UI BUTTON HELPERS  (identical copy in both apps)
   - MMAUI.toast(message, "success" | "error" | "info")
   - MMAUI.run(button, fn, {label, success, error, minMs})
        shows a loading state, blocks double clicks, then
        shows a success / error message.
   - Global guard: a second click on the same button within
     700 ms is ignored (prevents accidental double submits).
   Uses the existing theme variables only; no theme changes.
   ========================================================= */
(function (global) {
  "use strict";

  var css = [
    ".mma-toast-wrap{position:fixed;left:50%;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;width:min(92vw,420px);pointer-events:none}",
    "@media(min-width:821px){.mma-toast-wrap{bottom:28px}}",
    ".mma-toast{pointer-events:auto;width:100%;padding:11px 14px;border-radius:12px;font-size:13px;font-weight:600;line-height:1.4;color:#fff;background:#3b3151;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s}",
    ".mma-toast.show{opacity:1;transform:none}",
    ".mma-toast.success{background:#1E8E5A}.mma-toast.error{background:#C6403E}.mma-toast.info{background:#5B3E9E}",
    "button.is-loading{position:relative;pointer-events:none;opacity:.85}",
    "button.is-loading::after{content:'';display:inline-block;width:13px;height:13px;margin-left:8px;vertical-align:-2px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:mmaSpin .7s linear infinite}",
    "@keyframes mmaSpin{to{transform:rotate(360deg)}}",
    "@media(prefers-reduced-motion:reduce){button.is-loading::after{animation-duration:1.6s}.mma-toast{transition:none}}"
  ].join("\n");
  var style = document.createElement("style");
  style.setAttribute("data-mma", "ui-buttons");
  style.textContent = css;
  document.head.appendChild(style);

  var wrap = null;
  function ensureWrap() {
    if (wrap && document.body.contains(wrap)) return wrap;
    wrap = document.createElement("div");
    wrap.className = "mma-toast-wrap";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    document.body.appendChild(wrap);
    return wrap;
  }

  function toast(message, type, ms) {
    if (!document.body) return;
    var el = document.createElement("div");
    el.className = "mma-toast " + (type || "info");
    el.textContent = message;
    ensureWrap().appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    var life = ms || (type === "error" ? 5000 : 2800);
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, life);
  }

  /* run fn with a loading state. fn may return a value, a promise, or throw. */
  function run(btn, fn, opts) {
    opts = opts || {};
    if (btn && (btn.disabled || btn.dataset.mmaBusy === "1")) return Promise.resolve();
    var original = null;
    if (btn) {
      btn.dataset.mmaBusy = "1";
      original = btn.textContent;
      if (opts.label) btn.textContent = opts.label;
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");
    }
    var started = Date.now();
    var minMs = opts.minMs == null ? 350 : opts.minMs;
    function finish(ok, err) {
      var wait = Math.max(0, minMs - (Date.now() - started));
      setTimeout(function () {
        if (btn) {
          btn.classList.remove("is-loading");
          btn.removeAttribute("aria-busy");
          if (original !== null) btn.textContent = original;
          delete btn.dataset.mmaBusy;
        }
        if (ok && !ok.skip && opts.success) toast(typeof opts.success === "function" ? opts.success(ok.value) : opts.success, "success");
        if (!ok) {
          console.error(err);
          toast((typeof opts.error === "function" ? opts.error(err) : opts.error) || (err && err.message) || "Something went wrong. Please try again.", "error");
        }
      }, wait);
    }
    var result;
    try { result = fn(); }
    catch (e) { finish(null, e); return Promise.resolve(); }
    return Promise.resolve(result).then(
      function (v) { if (v === false) { finish({ value: v, skip: true }); return v; } finish({ value: v }); return v; },
      function (e) { finish(null, e); }
    );
  }

  /* Global double-click guard. Counters (+/-), nav and inputs are exempt. */
  document.addEventListener("click", function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest("button") : null;
    if (!btn) return;
    if (btn.closest(".qty-ctrl, .navbtn, .hamburger, .top-tool, .icon-btn, [data-no-guard]")) return;
    var now = Date.now();
    if (btn._mmaGuard && now < btn._mmaGuard) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return;
    }
    btn._mmaGuard = now + 700;
  }, true);

  global.MMAUI = { toast: toast, run: run };
})(window);


/* =========================================================
   MMA MESS - ADMIN APP
   ========================================================= */


/* =========================================================
   SHARED STORAGE
   ========================================================= */

const store = {

  get(key, defaultValue) {

    try {

      const value =
        localStorage.getItem("mma_" + key);

      return value !== null
        ? JSON.parse(value)
        : defaultValue;

    } catch (error) {

      console.error("Storage read error:", error);

      return defaultValue;

    }

  },


  set(key, value) {

    try {

      localStorage.setItem(
        "mma_" + key,
        JSON.stringify(value)
      );

    } catch (error) {

      console.error("Storage write error:", error);

    }

  }

};


/* =========================================================
   ADMIN DATA
   ========================================================= */

let users = store.get("users", []);

let todayMenu = store.get(
  "todayMenu",
  {
    breakfast: "",
    lunch: "",
    dinner: ""
  }
);

let weekMenu = store.get(
  "weekMenu",
  [
    {
      day: "Mon",
      b: "",
      l: "",
      d: ""
    },
    {
      day: "Tue",
      b: "",
      l: "",
      d: ""
    },
    {
      day: "Wed",
      b: "",
      l: "",
      d: ""
    },
    {
      day: "Thu",
      b: "",
      l: "",
      d: ""
    },
    {
      day: "Fri",
      b: "",
      l: "",
      d: ""
    },
    {
      day: "Sat",
      b: "",
      l: "",
      d: ""
    },
    {
      day: "Sun",
      b: "",
      l: "",
      d: ""
    }
  ]
);

let cutoff =
  store.get("cutoffTime", "06:00");
let adminServerDateKey = "";
let adminCookingDateKey = "";

let bills =
  store.get("adminBills", []);

let notifHistory =
  store.get("notifHistory", []);

let feedback =
  store.get("feedback", []);

let editingUserId = null;


/* =========================================================
   DATE HELPERS
   ========================================================= */

function getDateKey(date) {
  return window.mmaMessDate.calendarKey(date);

}


function getTargetDate(daysFromToday) {
  return window.mmaMessDate.targetDate(daysFromToday);

}


function formatDate(date) {

  return date.toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );

}


/* =========================================================
   GET ALL MESS HISTORY
   ========================================================= */

function getEntryHistory() {

  return store.get(
    "messEntryHistory",
    []
  );

}


/* =========================================================
   GET ENTRIES FOR A SPECIFIC DATE
   ========================================================= */

function getEntriesForDate(dateKey) {

  const history =
    getEntryHistory();

  return history.filter(function(entry) {

    return entry.date === dateKey;

  });

}


/* =========================================================
   MEAL POINT RULE (same calculation as the user app)
   - Confirmed portions count normally.
   - After cutoff, only missing portions are doubled.
   - Explicit opt-out retains the normal booked point; the half-point
     surcharge is added separately in billing.
   - Each date is evaluated on its own.
   ========================================================= */

const ADMIN_MEAL_KEYS = { b: "Breakfast", l: "Lunch", d: "Dinner" };

function adminMealCloseTime(short) {
  const defaults = { breakfastClose: "11:00", lunchClose: "15:00", dinnerClose: "23:30" };
  const saved = store.get("generalSettings", {});
  const t = Object.assign({}, defaults);
  Object.keys(defaults).forEach(function (key) {
    const value = saved && typeof saved === "object" ? String(saved[key] || "") : "";
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) t[key] = value;
  });
  return { b: t.breakfastClose, l: t.lunchClose, d: t.dinnerClose }[short];
}

function adminNowHHMM() {
  return window.mmaMessDate.timeKey();
}

function createMealDisplayContext() {
  const records = store.get("mealRecords", []);
  const recordByKey = new Map();
  (Array.isArray(records) ? records : []).forEach(function (record) {
    const userId = String(record.user || record.user_id || "").toUpperCase();
    const date = String(record.date || "").slice(0, 10);
    if (userId && date) recordByKey.set(userId + "|" + date, record);
  });
  const cancellations = store.get("mealCancellations", []);
  const cancelledKeys = new Set((Array.isArray(cancellations) ? cancellations : []).map(function (item) {
    return item.status === "cancelled"
      ? String(item.date || "") + "|" + String(item.meal_type || "")
      : "";
  }));
  const settings = store.get("generalSettings", {}) || {};
  const closeTimes = {
    b: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(settings.breakfastClose || "")) ? settings.breakfastClose : "11:00",
    l: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(settings.lunchClose || "")) ? settings.lunchClose : "15:00",
    d: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(settings.dinnerClose || "")) ? settings.dinnerClose : "23:30"
  };
  return {
    recordByKey: recordByKey,
    cancelledKeys: cancelledKeys,
    todayKey: adminServerDateKey || getDateKey(getTargetDate(0)),
    closeTimes: closeTimes
  };
}

function getEffectiveMeal(userId, dateKey, entry, short, recordsCache) {
  const context = recordsCache && !Array.isArray(recordsCache) && recordsCache.recordByKey
    ? recordsCache
    : null;
  const planned = Math.max(0, Number(entry ? entry[short] : 0) || 0);
  if (context ? context.cancelledKeys.has(dateKey + "|" + short) : isMealCancelled(dateKey, short)) {
    return { planned: planned, quantity: 0, value: 0, fine: false, missing: 0, cancelled: true };
  }

  const todayKey = context ? context.todayKey : getDateKey(getTargetDate(0));
  let closed = false;
  if (dateKey < todayKey) closed = true;
  else if (dateKey === todayKey) {
    const close = context ? context.closeTimes[short] : adminMealCloseTime(short);
    closed = adminNowHHMM() >= close;
  }

  const uid = String(userId || "").toUpperCase();
  const records = Array.isArray(recordsCache) ? recordsCache : store.get("mealRecords", []);
  const record = context
    ? context.recordByKey.get(uid + "|" + dateKey)
    : (Array.isArray(records) ? records.find(function (r) {
      return String(r.user || r.user_id || "").toUpperCase() === uid && r.date === dateKey;
    }) : null);
  const meal = record && record.meals ? record.meals[short] : null;
  return MMAPoints.effectiveMeal({
    planned: planned,
    meal: meal,
    cancelled: context
      ? context.cancelledKeys.has(dateKey + "|" + short)
      : isMealCancelled(dateKey, short),
    noFoodStatus: meal && meal.noFood && String(meal.noFood.status || "").toLowerCase(),
    closed: closed,
    adminApproved: !!(entry && entry.adminApproved)
  });
}

function isMealCancelled(dateKey, short) {
  const cancellations = store.get("mealCancellations", []);
  return Array.isArray(cancellations) && cancellations.some(function (item) {
    return item.date === dateKey && item.meal_type === short && item.status === "cancelled";
  });
}

/* Raw meal quantities for one date. Used by Mess Entries AND the dashboard;
   billing-point multipliers stay in the separate calculation fields. */
function getEffectiveDayTotals(dateKey, context) {
  const mealContext = context || createMealDisplayContext();
  const totals = { breakfast: 0, lunch: 0, dinner: 0 };
  getEntriesForDate(dateKey).forEach(function (entry) {
    // Match the student confirmation display: use the effective billable/display value,
    // not the raw entered quantity, which can be 0 while a stored calculation has a
    // non-zero effective value (for example, closed-meal missing-entry rules).
    totals.breakfast += getEffectiveMeal(entry.user, dateKey, entry, "b", mealContext).value;
    totals.lunch += getEffectiveMeal(entry.user, dateKey, entry, "l", mealContext).value;
    totals.dinner += getEffectiveMeal(entry.user, dateKey, entry, "d", mealContext).value;
  });
  return totals;
}

/* =========================================================
   ROOM SORTING  (fixed custom room order, then other labels)
   ========================================================= */

function compareRooms(a, b) {
  return window.MMARoomSort.compareRooms(a, b);
}

function sortUsersByRoom(list) {
  return window.MMARoomSort.sortByRoom(list);
}


/* =========================================================
   LOGIN
   ========================================================= */






/* =========================================================
   NAVIGATION
   ========================================================= */

function openScreen(id) {

  document
    .querySelectorAll("main .screen")
    .forEach(function(screen) {

      screen.classList.remove("active");

    });


  const target =
    document.getElementById(id);


  if (target) {

    target.classList.add("active");

    const main = document.querySelector("main");
    if (main) {
      main.classList.toggle(
        "admin-wide-content",
        id === "entries" || id === "cancellations"
      );
    }

    if (localStorage.getItem("mma_currentUser")) {
      localStorage.setItem("mma_adminLastScreen", id);
    }

  }


  document
    .querySelectorAll(
      ".side .navbtn[data-s]"
    )
    .forEach(function(button) {

      button.classList.toggle(
        "active",
        button.dataset.s === id
      );

    });


  const side =
    document.querySelector(".side");

  if (side) {
    side.classList.remove("open");
  }

}


function toggleSide() {

  const side =
    document.querySelector(".side");

  if (side) {

    side.classList.toggle("open");

  }

}


/* =========================================================
   INITIALIZE APP
   ========================================================= */

function baseInitApp() {

  renderDashboard();

  renderUsers();

  renderMenu();

  renderEntries();

  renderRecords();

  renderBills();

  renderNotifHistory();

  renderFeedback();

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function dashMoney(value) {
  return "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function dashDate(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function dashDateKey(value) {
  const d = new Date(value + "T12:00:00Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata"
  });
}

window.mmaAdminSetCookingDate = function(serverDate, cookingDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serverDate || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cookingDate || "")) return;
  adminServerDateKey = serverDate;
  adminCookingDateKey = cookingDate;
};

function dashSafe(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function getDashboardStats() {
  const allUsers = store.get("users", []).filter(function (u) {
    const role = String(u.role || u.type || "student").toLowerCase();
    return role !== "admin";
  });
  const seen = new Set();
  const active = allUsers.filter(function (u) {
    const status = String(u.status || "active").toLowerCase();
    if (status !== "active") return false;
    const userId = String(u.id || "").trim();
    if (!userId) return false;
    const key = userId.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const pendingRegs = store.get("registrationRequests", []).filter(function (r) {
    return r && r.status === "pending";
  });

  const monthKey = getDateKey(getTargetDate(0)).slice(0, 7);

  // Revenue = bills marked Paid during this calendar month (Bills → Mark Paid).
  const revenue = store.get("adminBills", []).reduce(function (sum, bill) {
    if (bill.status !== "paid") return sum;
    const paidMonth = bill.paidAt ? String(bill.paidAt).slice(0, 7) : String(bill.month || bill.billingMonth || "");
    if (paidMonth !== monthKey) return sum;
    return sum + (Number(bill.finalTotal !== undefined ? bill.finalTotal : bill.amount) || 0);
  }, 0);

  // Expenses = records in mma_expenses dated this month ({date, amount}). There is no expense screen in this project yet.
  const expensesList = store.get("expenses", []);
  const expenses = (Array.isArray(expensesList) ? expensesList : []).reduce(function (sum, item) {
    const d = String(item && (item.date || item.createdAt) || "");
    return d.slice(0, 7) === monthKey ? sum + (Number(item.amount) || 0) : sum;
  }, 0);

  return {
    total: allUsers.length,
    active: active.length,
    pending: pendingRegs.length,
    revenue: revenue,
    expenses: expenses,
    profit: revenue - expenses
  };
}

function getRecentActivity(limit) {
  const items = [];

  store.get("registrationRequests", []).forEach(function (r) {
    if (r && r.name && r.createdAt) {
      items.push({ time: new Date(r.createdAt).getTime(), text: r.name + " registered", date: r.createdAt, icon: "👤" });
    }
  });

  store.get("adminBills", []).forEach(function (bill) {
    if (bill.status === "paid" && bill.paidAt) {
      items.push({
        time: new Date(bill.paidAt).getTime(),
        text: (bill.name || bill.user) + " paid ₹" + (Number(bill.finalTotal !== undefined ? bill.finalTotal : bill.amount) || 0).toLocaleString("en-IN"),
        date: bill.paidAt,
        icon: "💰"
      });
    }
  });

  store.get("adminNotifications", []).forEach(function (n) {
    if (n && n.title && n.createdAt) {
      items.push({ time: new Date(n.createdAt).getTime(), text: n.title, date: n.createdAt, icon: "🔔" });
    }
  });

  return items
    .filter(function (i) { return Number.isFinite(i.time); })
    .sort(function (a, b) { return b.time - a.time; })
    .slice(0, limit || 5);
}

function renderExtraMealsAvailable() {
  const countEl = document.getElementById("dsExtraMeals");
  const listEl = document.getElementById("dsExtraMealsList");
  if (!countEl && !listEl) return;
  const todayKey = getDateKey(getTargetDate(0));
  const records = store.get("mealRecords", []);
  const allUsers = store.get("users", []);
  const menu = store.get("todayMenu", {}) || {};
  const menuByMeal = { b: menu.breakfast || menu.b || "", l: menu.lunch || menu.l || "", d: menu.dinner || menu.d || "" };
  const mealNames = { b: "Breakfast", l: "Lunch", d: "Dinner" };
  const entries = store.get("messEntryHistory", []);
  const extras = [];
  (Array.isArray(records) ? records : []).forEach(function (record) {
    if (!record || record.date !== todayKey || !record.meals) return;
    ["b", "l", "d"].forEach(function (short) {
      const meal = record.meals[short];
      if (!meal || !meal.optOut) return;
      const user = (Array.isArray(allUsers) ? allUsers : []).find(function (u) {
        return String(u.id || "").toUpperCase() === String(record.user || "").toUpperCase();
      });
      const expectedEntry = (Array.isArray(entries) ? entries : []).find(function (entry) {
        return String(entry.user || "").toUpperCase() === String(record.user || "").toUpperCase() && entry.date === todayKey;
      });
      extras.push({
        name: user ? (user.name || user.id) : record.user,
        room: user ? (user.room || record.room || "-") : (record.room || "-"),
        meal: mealNames[short], food: menuByMeal[short] || "Menu not set",
        quantity: Math.max(1, Number(expectedEntry && expectedEntry[short]) || 1),
        time: meal.t || ""
      });
    });
  });
  if (countEl) countEl.textContent = String(extras.reduce(function (sum, x) { return sum + x.quantity; }, 0));
  if (listEl) {
    listEl.innerHTML = extras.length ? '<div class="table-wrap"><table class="dtable"><thead><tr><th>Resident</th><th>Room</th><th>Meal</th><th>Food</th><th>Extra Portions</th><th>Cancelled At</th></tr></thead><tbody>' + extras.map(function (x) {
      return '<tr><td><strong>' + dashSafe(x.name) + '</strong></td><td>' + dashSafe(x.room) + '</td><td>' + dashSafe(x.meal) + '</td><td>' + dashSafe(x.food) + '</td><td>' + x.quantity + '</td><td>' + dashSafe(x.time || "-") + '</td></tr>';
    }).join("") + '</tbody></table></div>' : '<p class="dash-note">No cancelled meals are available right now.</p>';
  }
}

window.addEventListener("storage", function (event) {
  if (event && event.key === "mma_mealRecords") {
    renderExtraMealsAvailable();
    if (document.getElementById("dash") && document.getElementById("dash").classList.contains("active")) renderDashboard();
  }
});

function renderDashboard() {

  users =
    store.get("users", []);

  bills =
    store.get("adminBills", []);

  feedback =
    store.get("feedback", []);

  const stats = getDashboardStats();

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  setText("dsTotal", stats.total);
  setText("dsActive", stats.active);
  setText("dsPending", stats.pending);
  setText("dsRevenue", dashMoney(stats.revenue));
  setText("dsExpenses", dashMoney(stats.expenses));

  const profitEl = document.getElementById("dsProfit");
  if (profitEl) {
    profitEl.textContent = (stats.profit < 0 ? "-" : "") + dashMoney(Math.abs(stats.profit));
    profitEl.classList.toggle("loss", stats.profit < 0);
    profitEl.classList.toggle("gain", stats.profit > 0);
  }
  const profitLabel = document.getElementById("dsProfitLabel");
  if (profitLabel) profitLabel.textContent = stats.profit < 0 ? "Loss" : stats.profit > 0 ? "Profit" : "Profit / Loss";

  // Today's meals: same effective numbers as Mess Entries (shared function).
  const calendarTodayKey = adminServerDateKey || getDateKey(getTargetDate(0));
  const cookingKey = adminCookingDateKey || calendarTodayKey;
  const todayEntries = getEntriesForDate(cookingKey);

  // If no entries found for today, trigger a refresh from API
  if (todayEntries.length === 0 && typeof refreshAdminEntries === "function") {
    refreshAdminEntries();
  }

  const todayTotals = getEffectiveDayTotals(cookingKey);
  setText("dsMealB", todayTotals.breakfast);
  setText("dsMealL", todayTotals.lunch);
  setText("dsMealD", todayTotals.dinner);
  renderExtraMealsAvailable();
  setText("dsMealDate", dashDateKey(cookingKey));

  // Other existing counters (kept)
  const tomorrowKey = addAdminCalendarDays(calendarTodayKey, 1);
  setText("statEntries", getEntriesForDate(tomorrowKey).length);
  setText("statPending", bills.filter(function (bill) { return bill.status === "pending"; }).length);
  setText("statFb", feedback.length);

  const activity = document.getElementById("dashActivity");
  if (activity) {
    const recent = getRecentActivity(5);
    activity.innerHTML = recent.length
      ? recent.map(function (item) {
          return '<div class="activity-item"><span class="activity-ico">' + item.icon + '</span><div><div class="activity-text">' +
            dashSafe(item.text) + '</div><div class="activity-date">' + dashSafe(dashDate(item.date)) + '</div></div></div>';
        }).join("")
      : '<div class="admin-empty">No recent activity yet.</div>';
  }

  const dashMenu =
    document.getElementById(
      "dashMenu"
    );

  if (dashMenu) {

    const currentTodayMenu = store.get("todayMenu", todayMenu);
    dashMenu.innerHTML =
      Object.entries(currentTodayMenu)
        .map(function(item) {

          return `
            <div class="fc">

              <div class="meal">
                ${dashSafe(item[0])}
              </div>

              <div class="name">
                ${dashSafe(item[1])}
              </div>

            </div>
          `;

        })
        .join("");

  }

}


/* =========================================================
   USERS
   ========================================================= */

function renderUsers() {

  users =
    store.get("users", []);

  const body =
    document.getElementById(
      "usersBody"
    );

  if (!body) {
    return;
  }


  body.innerHTML =
    sortUsersByRoom(users).map(function(user, index) {

      return `
        <tr>

          <td>
            ${user.id}
          </td>

          <td>
            ${user.name}
          </td>

          <td>
            ${user.room}
          </td>

          <td>
            ${user.branch}
          </td>

          <td>
            <span
              class="status-pill ${user.status}"
            >
              ${
                user.status === "active"
                  ? "Active"
                  : "Inactive"
              }
            </span>
          </td>

          <td>

            <button
              class="link-btn"
              onclick="toggleUserStatus(${index})"
            >
              ${
                user.status === "active"
                  ? "Deactivate"
                  : "Activate"
              }
            </button>

          </td>

        </tr>
      `;

    }).join("");

}

/* =========================================================
   MENU
   ========================================================= */

function renderMenu() {

  const todayForm =
    document.getElementById(
      "todayMenuForm"
    );


  if (todayForm) {

    todayForm.innerHTML =
      [
        "breakfast",
        "lunch",
        "dinner"
      ]
      .map(function(meal) {

        return `
          <div class="field">

            <label
              style="text-transform:capitalize"
            >
              ${meal}
            </label>

            <input
              id="tm_${meal}"
              type="text"
              value="${todayMenu[meal]}"
            >

          </div>
        `;

      })
      .join("");

  }


  const weekBody =
    document.getElementById(
      "weekBody"
    );


  if (weekBody) {

    weekBody.innerHTML =
      weekMenu.map(function(day, index) {

        return `
          <tr>

            <td>
              ${day.day}
            </td>

            <td>
              <input
                id="wb_${index}"
                value="${day.b}"
              >
            </td>

            <td>
              <input
                id="wl_${index}"
                value="${day.l}"
              >
            </td>

            <td>
              <input
                id="wd_${index}"
                value="${day.d}"
              >
            </td>

          </tr>
        `;

      }).join("");

  }


  const cutoffInput =
    document.getElementById(
      "cutoffTime"
    );

  if (cutoffInput) {
    cutoffInput.value = cutoff;
  }

}


function saveTodayMenu() {

  [
    "breakfast",
    "lunch",
    "dinner"
  ].forEach(function(meal) {

    todayMenu[meal] =
      document.getElementById(
        "tm_" + meal
      ).value;

  });


  store.set(
    "todayMenu",
    todayMenu
  );


  flash("menuConfirm");

  renderDashboard();

}


function saveWeekMenu() {

  weekMenu.forEach(function(day, index) {

    day.b =
      document.getElementById(
        "wb_" + index
      ).value;

    day.l =
      document.getElementById(
        "wl_" + index
      ).value;

    day.d =
      document.getElementById(
        "wd_" + index
      ).value;

  });


  store.set(
    "weekMenu",
    weekMenu
  );


  flash("weekConfirm");

}


function saveCutoff() {

  cutoff =
    document.getElementById(
      "cutoffTime"
    ).value;

  store.set(
    "cutoffTime",
    cutoff
  );

  flash("cutoffConfirm");

}


/* =========================================================
   MESS ENTRY TOTALS
   ========================================================= */

function calculateTotals(entries) {

  return entries.reduce(
    function(total, entry) {

      total.breakfast +=
        Number(entry.b || 0);

      total.lunch +=
        Number(entry.l || 0);

      total.dinner +=
        Number(entry.d || 0);

      return total;

    },
    {
      breakfast: 0,
      lunch: 0,
      dinner: 0
    }
  );

}


/* =========================================================
   RENDER TODAY + TOMORROW ENTRIES
   ========================================================= */

let selectedAdminEntryDates = null;
const adminEntryDateRequests = new Map();
const adminEntryDateLoading = { today: false, tomorrow: false };
const adminEntryDateErrors = { today: "", tomorrow: "" };
const adminEntryDateRequestVersions = { today: 0, tomorrow: 0 };

function getSelectedAdminEntryDates() {
  if (!selectedAdminEntryDates) {
    const today = adminServerDateKey || getDateKey(getTargetDate(0));
    selectedAdminEntryDates = {
      today,
      tomorrow: addAdminCalendarDays(today, 1)
    };
  }
  return selectedAdminEntryDates;
}

function isValidAdminEntryDate(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day;
}

function addAdminCalendarDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.getUTCFullYear() + "-" +
    String(shifted.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(shifted.getUTCDate()).padStart(2, "0");
}

window.mmaAdminGetEntryDateKey = function(period) {
  const dates = getSelectedAdminEntryDates();
  return period === "tomorrow" ? dates.tomorrow : dates.today;
};

function formatAdminEntryDate(dateKey) {
  return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getAdminEntryDataForDate(dateKey) {
  if (adminEntryDateRequests.has(dateKey)) {
    return adminEntryDateRequests.get(dateKey);
  }

  const request = Promise.all([
    api.getEntries(dateKey),
    api.getMealRecords(dateKey)
  ]).then(function (responses) {
    return {
      entries: responses[0],
      mealRecords: responses[1]
    };
  });
  adminEntryDateRequests.set(dateKey, request);
  request.then(
    function () {
      if (adminEntryDateRequests.get(dateKey) === request) {
        adminEntryDateRequests.delete(dateKey);
      }
    },
    function () {
      if (adminEntryDateRequests.get(dateKey) === request) {
        adminEntryDateRequests.delete(dateKey);
      }
    }
  );
  return request;
}

function cacheAdminEntriesForDate(dateKey, entryResponse, recordResponse) {
  const entries = (Array.isArray(entryResponse.entries) ? entryResponse.entries : []).map(function (entry) {
    return {
      ...entry,
      date: String(entry.date || dateKey).slice(0, 10),
      user: entry.user_id || entry.user,
      b: entry.breakfast == null ? Number(entry.b) || 0 : Number(entry.breakfast) || 0,
      l: entry.lunch == null ? Number(entry.l) || 0 : Number(entry.lunch) || 0,
      d: entry.dinner == null ? Number(entry.d) || 0 : Number(entry.dinner) || 0
    };
  });
  const history = store.get("messEntryHistory", []);
  const retainedEntries = Array.isArray(history)
    ? history.filter(function (entry) {
      return String(entry.date || "").slice(0, 10) !== dateKey;
    })
    : [];
  store.set("messEntryHistory", retainedEntries.concat(entries));

  const records = (Array.isArray(recordResponse.records) ? recordResponse.records : []).map(function (record) {
    return {
      ...record,
      date: String(record.date || dateKey).slice(0, 10),
      user: record.user_id || record.user
    };
  });
  const mealRecords = store.get("mealRecords", []);
  const retainedRecords = Array.isArray(mealRecords)
    ? mealRecords.filter(function (record) {
      return String(record.date || "").slice(0, 10) !== dateKey;
    })
    : [];
  store.set("mealRecords", retainedRecords.concat(records));

  const cancellations = store.get("mealCancellations", []);
  const retainedCancellations = Array.isArray(cancellations)
    ? cancellations.filter(function (item) {
      return String(item.date || "").slice(0, 10) !== dateKey;
    })
    : [];
  store.set("mealCancellations", retainedCancellations.concat(
    Array.isArray(recordResponse.cancellations)
      ? recordResponse.cancellations
      : Array.isArray(entryResponse.cancellations) ? entryResponse.cancellations : []
  ));
}

async function selectAdminEntryDate(period, dateKey) {
  const dates = getSelectedAdminEntryDates();
  const input = document.getElementById(
    period === "today" ? "entryTodayDateFilter" : "entryTomorrowDateFilter"
  );
  if (!Object.prototype.hasOwnProperty.call(dates, period) || !isValidAdminEntryDate(dateKey)) {
    renderEntries();
    return;
  }

  dates[period] = dateKey;
  const version = ++adminEntryDateRequestVersions[period];
  adminEntryDateLoading[period] = true;
  adminEntryDateErrors[period] = "";
  renderEntries();

  try {
    const dateData = await getAdminEntryDataForDate(dateKey);
    if (dates.today === dateKey || dates.tomorrow === dateKey) {
      cacheAdminEntriesForDate(dateKey, dateData.entries, dateData.mealRecords);
    }
  } catch (error) {
    if (adminEntryDateRequestVersions[period] === version) {
      adminEntryDateErrors[period] = error.message || "Unable to load entries.";
    }
  } finally {
    if (adminEntryDateRequestVersions[period] === version) {
      adminEntryDateLoading[period] = false;
      renderEntries();
    }
  }
}

window.selectAdminEntryDate = selectAdminEntryDate;

function renderEntries() {
  const body = document.getElementById("entriesBody");
  const totalsBox = document.getElementById("entriesTotals");
  if (!body) return;

  const dates = getSelectedAdminEntryDates();
  const todayDate = dates.today;
  const tomorrowDate = dates.tomorrow;
  const todayEntries = getEntriesForDate(todayDate);
  const tomorrowEntries = getEntriesForDate(tomorrowDate);
  const mealContext = createMealDisplayContext();
  const todayTotals = getEffectiveDayTotals(todayDate, mealContext);
  const tomorrowTotals = getEffectiveDayTotals(tomorrowDate, mealContext);
  const users = store.get("users", []);
  const findName = id => {
    const u = users.find(x => String(x.id || "").toUpperCase() === String(id || "").toUpperCase());
    return u ? (u.name || "-" ) : "-";
  };
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function table(title, dateKey, entries, totals, period) {
    const dateLabel = formatAdminEntryDate(dateKey);
    const sortedEntries = window.MMARoomSort.sortByRoom(entries);
    const rows = sortedEntries.length ? sortedEntries.map(entry => {
      const eb = getEffectiveMeal(entry.user, dateKey, entry, "b", mealContext);
      const el = getEffectiveMeal(entry.user, dateKey, entry, "l", mealContext);
      const ed = getEffectiveMeal(entry.user, dateKey, entry, "d", mealContext);
      const total = eb.value + el.value + ed.value;
      const cell = e => `<td class="${e.fine ? "monthly-fine" : ""}">${e.value}</td>`;
      return `<tr><td class="entry-name">${safe(entry.user_name || findName(entry.user))}</td><td>${safe(entry.room||"-")}</td>${cell(eb)}${cell(el)}${cell(ed)}<td><b>${total}</b></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="entries-empty">No mess entries for ${dateLabel}.</td></tr>`;
    const totalRow = `<tr class="entry-total-row"><td colspan="2"></td><td><b>${totals.breakfast}</b></td><td><b>${totals.lunch}</b></td><td><b>${totals.dinner}</b></td><td><b>${totals.breakfast+totals.lunch+totals.dinner}</b></td></tr>`;
    const inputId = period === "today" ? "entryTodayDateFilter" : "entryTomorrowDateFilter";
    const loading = adminEntryDateLoading[period];
    const error = adminEntryDateErrors[period];
    const stateRow = loading
      ? `<tr><td colspan="6" class="entries-empty">Refreshing entries…</td></tr>`
      : error
        ? `<tr><td colspan="6" class="entries-empty">Unable to refresh entries. Showing the last loaded data where available. ${safe(error)}</td></tr>`
        : "";
    const dataRows = loading || error ? (entries.length ? rows : "") : rows;
    return `<section class="entry-day-block"><div class="entry-day-title">${title} <span>(${dateLabel})</span></div><div class="entry-filter-tools"><label for="${inputId}">Select date<input type="date" id="${inputId}" value="${dateKey}" aria-label="Select ${period} mess entries date" onchange="selectAdminEntryDate('${period}', this.value)"></label></div><div class="table-wrap"><table class="dtable entry-table"><thead><tr><th>Name</th><th>Room</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Total</th></tr></thead><tbody>${stateRow}${dataRows}${loading || error ? "" : totalRow}</tbody></table></div></section>`;
  }

  body.innerHTML = table("Today's Mess Entries", todayDate, todayEntries, todayTotals, "today") + table("Tomorrow's Mess Entries", tomorrowDate, tomorrowEntries, tomorrowTotals, "tomorrow");

  if (totalsBox) {
    const todayTotalTitle = todayDate === getDateKey(getTargetDate(0))
      ? "Today's Meal Totals"
      : "Meal Totals for " + formatAdminEntryDate(todayDate);
    const tomorrowTotalTitle = tomorrowDate === getDateKey(getTargetDate(1))
      ? "Tomorrow's Meal Totals"
      : "Meal Totals for " + formatAdminEntryDate(tomorrowDate);
    const todayStatus = adminEntryDateLoading.today
      ? "Loading entries…"
      : adminEntryDateErrors.today
        ? safe(adminEntryDateErrors.today)
        : `${todayEntries.length} ${todayEntries.length === 1 ? "student" : "students"} submitted for this date.`;
    const tomorrowStatus = adminEntryDateLoading.tomorrow
      ? "Refreshing entries…"
      : adminEntryDateErrors.tomorrow
        ? "Refresh failed. Showing the last loaded values where available."
        : `${tomorrowEntries.length} ${tomorrowEntries.length === 1 ? "student" : "students"} submitted for this date.`;
    const todayHasDisplayValues = !adminEntryDateLoading.today && !adminEntryDateErrors.today ||
      todayEntries.length > 0;
    const tomorrowHasDisplayValues = !adminEntryDateLoading.tomorrow && !adminEntryDateErrors.tomorrow ||
      tomorrowEntries.length > 0;
    totalsBox.innerHTML = `<div class="entries-summary-grid">
      <div class="entries-summary-card"><strong>${todayTotalTitle}</strong>${todayHasDisplayValues ? `<div class="summary-meals"><span>Breakfast: <b>${todayTotals.breakfast}</b></span><span>Lunch: <b>${todayTotals.lunch}</b></span><span>Dinner: <b>${todayTotals.dinner}</b></span></div>` : ""}<div class="summary-sub">${todayStatus}</div></div>
      <div class="entries-summary-card"><strong>${tomorrowTotalTitle}</strong>${tomorrowHasDisplayValues ? `<div class="summary-meals"><span>Breakfast: <b>${tomorrowTotals.breakfast}</b></span><span>Lunch: <b>${tomorrowTotals.lunch}</b></span><span>Dinner: <b>${tomorrowTotals.dinner}</b></span></div>` : ""}<div class="summary-sub">${tomorrowStatus}</div></div>
    </div>`;
  }
}

/* =========================================================
   AUTO REFRESH MESS ENTRIES
   ========================================================= */

/* AUTO REFRESH MESS ENTRIES */

let adminEntryRefreshBusy = false;
let lastAdminRefreshTime = 0;
const ADMIN_REFRESH_COOLDOWN = 30000; // 30 seconds minimum between refreshes
const ADMIN_REFRESH_INTERVAL_MS = 60000;
let adminEntryRefreshPromise = null;

async function refreshAdminEntries(force) {
  const app = document.getElementById("app");
  const now = Date.now();

  if (!app || app.style.display === "none") return false;
  if (adminEntryRefreshPromise) {
    const activeRefresh = adminEntryRefreshPromise;
    if (!force) return activeRefresh;
    await activeRefresh;
    return refreshAdminEntries(true);
  }
  if (!force && now - lastAdminRefreshTime < ADMIN_REFRESH_COOLDOWN) return false;

  adminEntryRefreshBusy = true;
  lastAdminRefreshTime = now;
  const refresh = (async function() {
    try {
      const currentResponse = await api.getEntries();
      const todayKey = currentResponse.server_date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey || "") ||
          !Array.isArray(currentResponse.entries)) {
        throw new Error("The server returned invalid current-day meal entries.");
      }
      const tomorrowKey = addAdminCalendarDays(todayKey, 1);
      const [tomorrowResponse, todayRecords, tomorrowRecords] = await Promise.all([
        api.getEntries(tomorrowKey),
        api.getMealRecords(todayKey),
        api.getMealRecords(tomorrowKey)
      ]);
      if (!tomorrowResponse || !Array.isArray(tomorrowResponse.entries) ||
          !todayRecords || !Array.isArray(todayRecords.records) ||
          !tomorrowRecords || !Array.isArray(tomorrowRecords.records) ||
          !Array.isArray(todayRecords.cancellations) ||
          !Array.isArray(tomorrowRecords.cancellations) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(currentResponse.cooking_date || "")) {
        throw new Error("The server returned incomplete meal records for the cooking dates.");
      }

      const previousServerDate = adminServerDateKey;
      if (!selectedAdminEntryDates) {
        selectedAdminEntryDates = { today: todayKey, tomorrow: tomorrowKey };
      } else {
        if (selectedAdminEntryDates.today === previousServerDate ||
            selectedAdminEntryDates.today === getDateKey(getTargetDate(0))) {
          selectedAdminEntryDates.today = todayKey;
        }
        if (selectedAdminEntryDates.tomorrow === addAdminCalendarDays(previousServerDate || todayKey, 1) ||
            selectedAdminEntryDates.tomorrow === getDateKey(getTargetDate(1))) {
          selectedAdminEntryDates.tomorrow = tomorrowKey;
        }
      }
      window.mmaAdminSetCookingDate(todayKey, currentResponse.cooking_date);

      const refreshedEntries = currentResponse.entries
        .concat(tomorrowResponse.entries)
        .map(function(entry) {
        return {
          ...entry,
          user: entry.user_id || entry.user,
          b: entry.breakfast == null ? Number(entry.b) || 0 : Number(entry.breakfast) || 0,
          l: entry.lunch == null ? Number(entry.l) || 0 : Number(entry.lunch) || 0,
          d: entry.dinner == null ? Number(entry.d) || 0 : Number(entry.dinner) || 0
        };
      });
      const refreshedDates = new Set([todayKey, tomorrowKey]);
      const history = store.get("messEntryHistory", []);
      const retainedEntries = Array.isArray(history)
        ? history.filter(entry => !refreshedDates.has(String(entry.date || "").slice(0, 10)))
        : [];
      localStorage.setItem("mma_messEntryHistory", JSON.stringify(retainedEntries.concat(refreshedEntries)));

      const refreshedRecords = todayRecords.records.concat(tomorrowRecords.records).map(function(record) {
        return { ...record, user: record.user_id || record.user };
      });
      const records = store.get("mealRecords", []);
      const retainedRecords = Array.isArray(records)
        ? records.filter(record => !refreshedDates.has(String(record.date || "").slice(0, 10)))
        : [];
      localStorage.setItem("mma_mealRecords", JSON.stringify(retainedRecords.concat(refreshedRecords)));

      const cancellations = store.get("mealCancellations", []);
      const retainedCancellations = Array.isArray(cancellations)
        ? cancellations.filter(item => !refreshedDates.has(String(item.date || "").slice(0, 10)))
        : [];
      localStorage.setItem(
        "mma_mealCancellations",
        JSON.stringify(retainedCancellations.concat(todayRecords.cancellations, tomorrowRecords.cancellations))
      );

      renderEntries();
      renderRecords();
      renderDashboard();
      return true;
    } catch (error) {
      console.error("Unable to refresh today's and tomorrow's entries:", error);
      return false;
    }
  })();
  adminEntryRefreshPromise = refresh.finally(function() {
    adminEntryRefreshBusy = false;
    adminEntryRefreshPromise = null;
  });
  return adminEntryRefreshPromise;
}

// Avoid replacing the active page DOM while the admin is scrolling.
// Refresh only when the user returns to this browser tab.

// Refresh when returning to the admin tab
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    refreshAdminEntries();
  }
});

window.addEventListener("focus", refreshAdminEntries);
window.setInterval(function() {
  refreshAdminEntries();
}, ADMIN_REFRESH_INTERVAL_MS);


/* =========================================================
   BILLS
   ========================================================= */

/* Legacy bill functions removed: monthly billing is implemented below. */

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function renderNotifHistory() {

  notifHistory =
    store.get(
      "notifHistory",
      []
    );


  const container =
    document.getElementById(
      "notifHistory"
    );


  if (!container) {
    return;
  }


  container.innerHTML =
    notifHistory.length

      ? notifHistory.map(function(notification) {

          return `

            <div class="nh-item">

              <div class="nt">
                ${notification.t}
              </div>

              <div class="nm">
                ${notification.m}
              </div>

              <div class="nd">
                ${notification.d}
              </div>

            </div>

          `;

        }).join("")

      : `
          <div class="nh-item">
            No notifications sent yet.
          </div>
        `;

}


function sendNotif() {

  const title =
    document
      .getElementById(
        "notifTitle"
      )
      .value
      .trim();

  const message =
    document
      .getElementById(
        "notifMsg"
      )
      .value
      .trim();


  if (!title || !message) {
    return;
  }


  notifHistory.unshift({

    t: title,

    m: message,

    d: "Just now"

  });


  store.set(
    "notifHistory",
    notifHistory
  );


  document
    .getElementById(
      "notifTitle"
    )
    .value = "";

  document
    .getElementById(
      "notifMsg"
    )
    .value = "";


  renderNotifHistory();

  flash("notifConfirm");

}


/* =========================================================
   FEEDBACK
   ========================================================= */

function renderFeedback() {
  feedback = store.get("feedback", []);
  const container = document.getElementById("feedbackList");
  if (!container) return;
  const users = store.get("users", []);
  const safeText = function(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  const enriched = (Array.isArray(feedback) ? feedback : []).map(function(item) {
    const u = users.find(function(x) { return String(x.id || "").toUpperCase() === String(item.user || "").toUpperCase(); }) || {};
    return Object.assign({}, item, { displayName: item.name || u.name || u.fullName || item.user || "Unknown", displayRoom: item.room || u.room || "" });
  });
  const orderedFeedback = window.MMARoomSort.sortByRoom(enriched, function(a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
  container.innerHTML = orderedFeedback.length ? orderedFeedback.map(function(item) {
    const rating = Math.max(0, Math.min(5, Number(item.rating || 0)));
    return `<div class="fb-card"><div class="fb-head"><span>${safeText(item.date || "Date unavailable")} · ${safeText(item.displayName)}${item.displayRoom ? " · Room " + safeText(item.displayRoom) : ""}</span><span>${safeText(item.meal || "")} ${item.food ? "· " + safeText(item.food) : ""}</span></div><div class="fb-stars">${"★".repeat(rating)}${"☆".repeat(5-rating)}</div><div class="fb-comment">${safeText(item.comment || "—")}</div></div>`;
  }).join("") : '<div class="fb-card">No feedback yet.</div>';
}

/* =========================================================
   HELPER
   ========================================================= */

function flash(id) {

  const element =
    document.getElementById(id);

  if (!element) {
    return;
  }

  element.style.display =
    "block";


  setTimeout(function() {

    element.style.display =
      "none";

  }, 1800);

}


/* =========================================================
   PAGE LOAD
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    const login =
      document.getElementById(
        "login"
      );

    if (login) {

      login.classList.add(
        "active"
      );

    }

  }
);

/* =========================================================
   MEAL RECORDS (what students actually ate vs expected)
   Reads "mma_mealRecords" written by the student app and
   "messEntryHistory" (the expected quantities).
   ========================================================= */

const REC_MEALS = ["b", "l", "d"];
const REC_MEAL_NAMES = { b: "Breakfast", l: "Lunch", d: "Dinner" };

function recSelectedDateKey() {
  const input = document.getElementById("recDate");
  if (input && !input.value) input.value = getDateKey(getTargetDate(0));
  return input && input.value ? input.value : getDateKey(getTargetDate(0));
}

function recFillSelect(id, values) {
  const select = document.getElementById(id);
  if (!select) return;

  const current = select.value;
  const wanted = [""].concat(values);
  const existing = Array.prototype.map.call(select.options, function (o) { return o.value; });
  if (wanted.join("|") === existing.join("|")) return;

  select.innerHTML = wanted.map(function (v) {
    return `<option value="${v}">${v === "" ? "All" : v}</option>`;
  }).join("");
  select.value = wanted.indexOf(current) >= 0 ? current : "";
}

function recBuildRow(user, dateKey, expectedEntry, record, onlyMeal) {
  const meals = onlyMeal ? [onlyMeal] : REC_MEALS;
  const cells = {};

  REC_MEALS.forEach(function (m) {
    const cancelled = isMealCancelled(dateKey, m);
    const expected = Number(expectedEntry ? expectedEntry[m] : 0) || 0;
    const saved = record && record.meals ? record.meals[m] : null;
    cells[m] = {
      expected: expected,
      saved: saved ? Number(saved.q) : null,
      time: cancelled ? "" : saved ? saved.t : "",
      cancelled: cancelled,
      meal: saved,
      calculation: saved && saved.calculation,
      permission: saved && saved.permission
    };
  });

  const considered = meals.map(function (m) { return cells[m]; });
  const applicable = considered.filter(function (c) { return !c.cancelled; });
  const anySaved = applicable.some(function (c) { return c.saved !== null; });
  const anyExpected = applicable.some(function (c) { return c.expected > 0; });
  const hasPendingPermission = applicable.some(function (c) {
    return c.saved > c.expected && c.permission &&
      c.permission.status === "pending";
  });

  // Determine if this student has any confirmed food entries (not cancelled, not approved No Food)
  const hasConfirmedFood = applicable.some(function (c) {
    if (c.saved === null) return false;
    // An approved No Food request sets q=0 and has noFood.status=approved
    // Do not count this as confirmed food
    if (c.saved === 0 && c.meal && c.meal.noFood && c.meal.noFood.status === "approved") return false;
    // Any positive quantity is confirmed food
    return c.saved > 0;
  });

  let status;
  if (!applicable.length) status = "Cancelled";
  else if (!anySaved && !anyExpected) status = "No meals";
  else if (!anySaved) status = "Missing";
  else {
    const mismatch = applicable.some(function (c) {
      return c.saved !== null && c.saved > c.expected &&
        !(c.permission && c.permission.status === "pending");
    });
    const partial = applicable.some(function (c) {
      return c.saved === null ? c.expected > 0 : (c.saved === 0 && c.expected > 0);
    });
    status = mismatch ? "Mismatch" : partial
      ? "Partial"
      : hasPendingPermission ? "Pending" : "Completed";
  }

  // remarks
  let remarks = "-";
  const allZeroConfirmed =
    record && record.confirmed && REC_MEALS.every(function (m) {
      return cells[m].cancelled || cells[m].saved === 0;
    });

  if (status === "Missing") {
    remarks = "No entries saved";
  } else if (allZeroConfirmed) {
    remarks = "All meals 0 (confirmed)";
  } else {
    const notes = [];
    meals.forEach(function (m) {
      const c = cells[m];
      const name = REC_MEAL_NAMES[m];
      if (c.cancelled) {
        notes.push(name + " cancelled by administration");
        return;
      }
      if (c.saved === null) {
        if (c.expected > 0) notes.push(name + " not saved (expected " + c.expected + ")");
      } else if (c.saved === 0 && c.expected > 0) {
        notes.push(name + " 0 (missed) (expected " + c.expected + ")");
      } else if (c.saved !== c.expected) {
        const permissionNote = c.saved > c.expected && c.permission &&
          c.permission.status === "pending" ? "; permission pending" : "";
        notes.push(name + " " + c.saved + " (expected " + c.expected +
          permissionNote + ")");
      }
    });
    if (notes.length) remarks = notes.join("; ");
  }

  return {
    user: user,
    recordId: record && record._id,
    cells: cells,
    status: status,
    remarks: remarks,
    hasConfirmedFood: hasConfirmedFood
  };
}

function renderRecords() {
  const body = document.getElementById("recordsBody");
  if (!body) return;

  const dateKey = recSelectedDateKey();
  const allUsers = store.get("users", []).filter(function (u) {
    return u.status === "active" && u.role === "student";
  });

  const roomValues = window.MMARoomSort.sortRooms(
    Array.from(new Set(allUsers.map(function (u) { return String(u.room || ""); }).filter(Boolean)))
  );
  recFillSelect("fRoom", roomValues);

  const fBranch = "";
  const fRoom = document.getElementById("fRoom").value;
  const fMeal = document.getElementById("fMeal").value;
  const fStatus = document.getElementById("fStatus").value;

  const history = getEntriesForDate(dateKey);
  const records = store.get("mealRecords", []).filter(function (r) { return r.date === dateKey; });
  const studentIds = new Set(allUsers.map(function (user) {
    return String(user.id || "").toUpperCase();
  }));
  const identityErrors = records.filter(function (record) {
    const userId = String(record.user || record.user_id || "").toUpperCase();
    const meals = record.meals || {};
    return !studentIds.has(userId) &&
      Object.keys(meals).some(function (short) {
        return REC_MEALS.includes(short) && meals[short] && typeof meals[short] === "object";
      });
  });

  function byUser(list, id) {
    return list.find(function (x) {
      return String(x.user || "").toUpperCase() === String(id || "").toUpperCase();
    }) || null;
  }

  let rows = allUsers
    .filter(function (u) {
      return (!fRoom || String(u.room) === fRoom);
    })
    .map(function (u) {
      return recBuildRow(u, dateKey, byUser(history, u.id), byUser(records, u.id), fMeal);
    })
    .filter(function (r) {
      // Only show students who have at least one confirmed food entry for the selected date
      // Exclude students with no meal record, no saved quantities, or only approved No Food requests
      return r.hasConfirmedFood === true;
    });

  // Calculate counts only from filtered rows (students with confirmed food)
  const counts = { Completed: 0, Pending: 0, Partial: 0, Mismatch: 0, Missing: 0, "No meals": 0, Cancelled: 0 };
  rows.forEach(function (r) { counts[r.status]++; });

  if (fStatus) rows = rows.filter(function (r) { return r.status === fStatus; });
  rows = window.MMARoomSort.sortByRoom(rows);

  const cls = { Completed: "completed", Pending: "partial", Partial: "partial", Mismatch: "mismatch", Missing: "missing", "No meals": "nomeals", Cancelled: "nomeals" };

  const summary = document.getElementById("recSummary");
  if (summary) {
    summary.innerHTML = ["Completed", "Partial", "Mismatch", "Missing"].map(function (s) {
      return `<div class="card stat"><div class="num rs-${cls[s]}">${counts[s]}</div><div class="lbl">${s}</div></div>`;
    }).join("");
  }

  if (!rows.length && !identityErrors.length) {
    body.innerHTML = `<tr><td colspan="13" style="text-align:center;color:var(--sub);padding:24px">No records for this filter.</td></tr>`;
    return;
  }

  const dateText = dateKey.split("-").reverse().join("-");

  body.innerHTML = rows.map(function (r) {
    const u = r.user;
    const mealCells = REC_MEALS.map(function (m) {
      const c = r.cells[m];
      let savedClass = "";
      let savedText = "-";
      if (c.saved !== null) {
        savedText = String(c.saved);
        savedClass = c.saved === c.expected ? "ok" : (c.saved === 0 ? "zero" : "diff");
      }
      const calculation = c.calculation || {};
      const permission = c.permission || {};
      const choice = permission.choice || (c.meal && c.meal.permissionChoice);
      const choiceLabel = choice === "with_permission"
        ? "With Permission"
        : choice === "without_permission" ? "Without Permission" : "—";
      const status = c.cancelled
        ? "Cancelled"
        : ({
          pending: "Pending",
          approved: "Approved",
          rejected: "Rejected",
          not_required: "Not Required",
          not_requested: "Not Required"
        }[permission.status] || "Not Required");
      const normalPoints = Number(calculation.normal_meal_points || 0);
      const finePoints = Number(calculation.additional_fine || 0);
      const unauthorized = Number(calculation.unauthorized_quantity || 0);
      const unauthorizedFine = Number(calculation.unauthorized_fine_points || 0);
      const missingFine = Number(calculation.missing_fine_points || 0);
      const billablePoints = c.cancelled
        ? 0
        : Number(calculation.final_billable_points || 0);
      const details = c.cancelled
        ? "Cancelled · billable points 0 · fines 0"
        : "Permission: " + choiceLabel + " · " + status +
          " · Normal points: " + normalPoints +
          " · Unauthorized excess: " + unauthorized +
          " · Unauthorized fine: " + unauthorizedFine +
          " · Missing fine: " + missingFine +
          " · Total meal fines: " + finePoints +
          " · Billable points: " + billablePoints;
      const permissionActions = !c.cancelled &&
        permission.status === "pending" && r.recordId
        ? '<div class="permission-request-actions">' +
          '<button class="btn-primary small" type="button" data-permission-record="' +
          escapePermissionText(r.recordId) + '" data-permission-meal="' + m +
          '" data-permission-status="approved">Approve</button>' +
          '<button class="btn-secondary small" type="button" data-permission-record="' +
          escapePermissionText(r.recordId) + '" data-permission-meal="' + m +
          '" data-permission-status="rejected">Reject</button></div>'
        : "";
      return `<td class="c">${c.expected}</td>
              <td class="c sv ${savedClass}">${savedText}<div class="meal-record-details">${details}</div>${permissionActions}</td>
              <td class="c tm">${c.time || "-"}</td>`;
    }).join("");

    return `<tr>
      <td><b>${u.name || u.id}</b></td>
      <td>${u.room || "-"}</td>
      ${mealCells}
      <td><span class="rs-pill ${cls[r.status]}">${r.status}</span></td>
      <td class="remarks">${r.remarks}</td>
    </tr>`;
  }).join("") + identityErrors.map(function (record) {
    const userId = record.user || record.user_id || "unknown";
    return `<tr><td class="remarks" colspan="13">Data error: meal record is linked to non-student or unknown account <b>${escapePermissionText(userId)}</b>. It was not assigned to a student. Verify the signed-in account before correcting the record.</td></tr>`;
  }).join("");

  body.querySelectorAll("[data-permission-record]").forEach(function(button) {
    button.addEventListener("click", function() {
      MMAUI.run(button, function() {
        return decideMealPermission(
          button.dataset.permissionRecord,
          button.dataset.permissionMeal,
          button.dataset.permissionStatus
        );
      }, {
        label: button.dataset.permissionStatus === "approved" ? "Approving…" : "Rejecting…",
        minMs: 200
      });
    });
  });
}
function escapePermissionText(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

async function decideMealPermission(recordId, short, status) {
  const response = await api.decideMealPermission(recordId, short, status);
  if (typeof window.mmaMarkAdminTargetRead === "function") {
    await window.mmaMarkAdminTargetRead("records");
  }
  const date = document.getElementById("recDate")?.value;
  const records = await api.getMealRecords(date || undefined);
  const refreshed = (records.records || []).map(function(record) {
    return { ...record, user: record.user_id || record.user };
  });
  const retained = store.get("mealRecords", []).filter(function(record) {
    return record.date !== date;
  });
  store.set("mealRecords", retained.concat(refreshed));
  renderRecords();
  if (typeof window.refreshAdminRequestNavigation === "function") {
    await window.refreshAdminRequestNavigation();
  }
  if (window.MMAUI) {
    window.MMAUI.toast(
      status === "approved" ? "Permission approved; meal points recalculated." : "Permission rejected; meal points recalculated.",
      "success"
    );
  }
  return response;
}
window.decideMealPermission = decideMealPermission;


/* =========================================================
   SAFE USER CRUD + MONTHLY BILLING (persistent mma_ storage)
   ========================================================= */
let userEditingId = null;
/* Billing (points, Per Point, Fixed Cost, Excel viewer, PDF, Print) now lives in
   admin-bills.js. It defines renderBills() and renderBillCalculator(); the old
   rate-based calculator was replaced. */
function money(value) {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function escBill(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
    return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch];
  });
}
function markPaidByKey(userId, month) {
  const all = store.get("adminBills", []);
  const matches = all.filter(b =>
    String(b.user_id || b.user || "").toUpperCase() === String(userId).toUpperCase() &&
    (b.billing_month === month || b.billingMonth === month || b.month === month)
  );
  if (matches.length !== 1) {
    const message = matches.length
      ? "Multiple bills match this resident and month. Resolve the duplicate before marking it paid."
      : "This bill is no longer available for the selected resident and month.";
    if (window.MMAUI && typeof window.MMAUI.toast === "function") window.MMAUI.toast(message, "error");
    return;
  }
  const bill = matches[0];
  bill.status = "paid";
  bill.paidAt = new Date().toISOString();
  store.set("adminBills", all);
  bills = all;
  renderBills();
  renderDashboard();
}
function markPaid(index) {
  const all = store.get("adminBills", []);
  const bill = all[index];
  if (bill) {
    bill.status = "paid";
    bill.paidAt = new Date().toISOString();
    store.set("adminBills", all);
    renderBills();
    renderDashboard();
  }
}

/* User CRUD */
function renderUsers() {
  users = store.get("users", []);
  const body = document.getElementById("usersBody");
  if (!body) return;
  if (!users.length) { body.innerHTML = '<tr><td colspan="5">No approved users yet.</td></tr>'; return; }
  body.innerHTML = sortUsersByRoom(users).map(function(user) {
    const id = String(user.id || "");
    return '<tr><td>' + escBill(user.name || "") + '</td><td>' + escBill(user.room || "-") + '</td><td><button class="link-btn" onclick="editUser(\'' + escBill(id) + '\')">Edit</button></td><td><button class="link-btn danger-link" onclick="deleteUser(\'' + escBill(id) + '\')">Delete</button></td><td><button class="link-btn" onclick="viewUser(\'' + escBill(id) + '\')">View</button></td></tr>';
  }).join("");
}
function openUserForm() {
  userEditingId = null;
  ["nuId","nuName","nuPw","nuRoom","nuEmail"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  document.getElementById("nuBranch").value = "Mount Road";
  document.getElementById("nuType").value = "student";
  document.getElementById("nuStatus").value = "active";
  document.getElementById("userModalTitle").textContent = "Create User";
  document.getElementById("saveUserButton").textContent = "Create User";
  document.getElementById("userModalBg").classList.add("open");
}
function editUser(id) {
  const user = store.get("users", []).find(u => String(u.id).toUpperCase() === String(id).toUpperCase());
  if (!user) return alert("User not found.");
  userEditingId = user.id;
  document.getElementById("nuId").value = user.id || "";
  document.getElementById("nuName").value = user.name || "";
  document.getElementById("nuPw").value = "";
  document.getElementById("nuRoom").value = user.room || "";
  document.getElementById("nuEmail").value = user.email || "";
  document.getElementById("nuBranch").value = user.branch || "Mount Road";
  document.getElementById("nuType").value = user.type || user.role || "student";
  document.getElementById("nuStatus").value = user.status || "active";
  document.getElementById("userModalTitle").textContent = "Edit User · " + (user.name || user.id);
  document.getElementById("saveUserButton").textContent = "Save User";
  document.getElementById("userModalBg").classList.add("open");
}
function viewUser(id) {
  const user = store.get("users", []).find(u => String(u.id).toUpperCase() === String(id).toUpperCase());
  if (!user) return alert("User not found.");
  alert("User details\n\nName: " + (user.name || "-") + "\nRoom No: " + (user.room || "-") + "\nEmail: " + (user.email || "-"));
}
function saveUser() {
  const name = document.getElementById("nuName").value.trim();
  const pw = document.getElementById("nuPw").value;
  const room = document.getElementById("nuRoom").value.trim();
  const email = document.getElementById("nuEmail").value.trim();
  const branch = "Mount Road", type = "student", status = "active";
  if (!name || !room) return alert("Name and room number are required.");
  if (!userEditingId && !pw.trim()) return alert("Enter a permanent password for the new account.");
  const all = store.get("users", []);
  let id = userEditingId;
  if (!userEditingId) {
    const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "USER";
    const roomSlug = room.toUpperCase().replace(/[^A-Z0-9]/g, "");
    id = (roomSlug + "-" + slug).slice(0, 20);
    let suffix = 2, baseId = id;
    while (all.some(u => String(u.id).toUpperCase() === id.toUpperCase())) id = baseId + suffix++;
  }
  if (userEditingId) {
    const user = all.find(u => String(u.id).toUpperCase() === String(userEditingId).toUpperCase());
    if (!user) return alert("This account no longer exists.");
    user.name = name; user.room = room; user.email = email; user.branch = branch; user.type = type; user.role = type; user.status = status;
    if (pw.trim()) user.pw = pw;
  } else {
    all.push({id:id, name:name, pw:pw, room:room, email:email, branch:branch, type:type, role:type, status:status});
  }
  store.set("users", all); users = all;
  renderUsers(); renderDashboard(); renderBillCalculator(); closeUserForm();
}
function deleteUser(id) {
  const all = store.get("users", []);
  const user = all.find(u => String(u.id).toUpperCase() === String(id).toUpperCase());
  if (!user) return alert("User not found.");
  if (!confirm("Delete account " + user.id + " (" + (user.name || "user") + ")? This removes the login account. Existing generated bills and meal history will be retained.")) return;
  store.set("users", all.filter(u => String(u.id).toUpperCase() !== String(id).toUpperCase()));
  users = store.get("users", []);
  renderUsers(); renderDashboard(); renderBillCalculator();
}
function toggleUserStatusById(id) {
  const all = store.get("users", []);
  const user = all.find(u => String(u.id).toUpperCase() === String(id).toUpperCase());
  if (!user) return;
  user.status = String(user.status || "active").toLowerCase() === "active" ? "inactive" : "active";
  store.set("users", all);
  users = all; renderUsers(); renderDashboard(); renderBillCalculator();
}
function toggleUserStatus(index) {
  const all = store.get("users", []);
  if (!all[index]) return;
  toggleUserStatusById(all[index].id);
}
function closeUserForm() {
  const modal = document.getElementById("userModalBg");
  if (modal) modal.classList.remove("open");
  const id = document.getElementById("nuId");
  if (id) id.disabled = false;
  userEditingId = null;
}

/* initApp: billing UI is initialised by admin-bills.js (wraps this function). */
function initApp() {
  const initialization = baseInitApp();
  const monthEl = document.getElementById("billMonth");
  if (monthEl && !monthEl.value) {
    monthEl.value = window.mmaMessDate.monthKey();
  }
  return initialization;
}


/* =========================================================
   1. STORAGE
   ========================================================= */

const STORAGE_PREFIX = "mma_";

function getData(key, defaultValue = []) {
    const data = localStorage.getItem(STORAGE_PREFIX + key);

    if (!data) {
        return defaultValue;
    }

    try {
        return JSON.parse(data);
    } catch (error) {
        console.error("Storage read error:", error);
        return defaultValue;
    }
}

function saveData(key, data) {
    localStorage.setItem(
        STORAGE_PREFIX + key,
        JSON.stringify(data)
    );
}


/* =========================================================
   2. HTML SECURITY
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   3. CURRENT USER
   ========================================================= */

function getCurrentUser() {
    return getData("currentUser", null);
}


/* =========================================================
   4. ADMIN NAVIGATION
   ========================================================= */

function addAdminNavigation() {

    const navigation = document.querySelector(".sidebar");

    if (!navigation) {
        return;
    }

    navigation.innerHTML += `
        <button onclick="showSection('requests')">
            Requests
        </button>

        <button onclick="showSection('userAccess')">
            User Access
        </button>

        <button onclick="showSection('foodLimits')">
            Food Limits
        </button>

        <button onclick="showSection('invitations')">
            Invitations
        </button>
    `;
}


/* =========================================================
   5. ADMIN SECTIONS
   ========================================================= */

function createAdminSections() {

    const container = document.querySelector(".main-content");

    if (!container) {
        return;
    }

    container.innerHTML += `

        <section id="requests" class="admin-section">
            <h2>Requests</h2>
            <div id="requestsList"></div>
        </section>

        <section id="userAccess" class="admin-section">
            <h2>User Access</h2>
            <div id="userAccessList"></div>
        </section>

        <section id="foodLimits" class="admin-section">
            <h2>Food Limits</h2>
            <div id="foodLimitsList"></div>
        </section>

        <section id="invitations" class="admin-section">
            <h2>Invitations</h2>

            <button onclick="generateInvitation()">
                Generate Invitation
            </button>

            <div id="invitationList"></div>
        </section>
    `;
}


/* =========================================================
   6. REQUESTS
   ========================================================= */

function renderRequests() {

    const container = document.getElementById("requestsList");

    if (!container) {
        return;
    }

    const requests = getData("requests", []);

    if (requests.length === 0) {
        container.innerHTML = `
            <p>No pending requests.</p>
        `;
        return;
    }

    container.innerHTML = requests.map(request => `

        <div class="request-card">

            <h3>
                ${escapeHTML(request.type)}
            </h3>

            <p>
                User:
                ${escapeHTML(request.userId)}
            </p>

            <p>
                Date:
                ${escapeHTML(request.date)}
            </p>

            <button
                onclick="approveRequest('${request.id}')">
                Approve
            </button>

            <button
                onclick="rejectRequest('${request.id}')">
                Reject
            </button>

        </div>

    `).join("");
}


function approveRequest(requestId) {

    const requests = getData("requests", []);

    const request = requests.find(
        item => item.id === requestId
    );

    if (!request) {
        return;
    }

    request.status = "approved";

    saveData("requests", requests);

    renderRequests();
}


function rejectRequest(requestId) {

    const requests = getData("requests", []);

    const request = requests.find(
        item => item.id === requestId
    );

    if (!request) {
        return;
    }

    request.status = "rejected";

    saveData("requests", requests);

    renderRequests();
}


/* =========================================================
   7. USER ACCESS / ACTIVITY
   ========================================================= */

function renderUserAccess() {

    const container = document.getElementById("userAccessList");

    if (!container) {
        return;
    }

    const users = getData("users", []);

    if (users.length === 0) {
        container.innerHTML = `
            <p>No users found.</p>
        `;
        return;
    }

    container.innerHTML = `

        <div class="table-wrapper">

            <table>

                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Room</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Last Activity</th>
                    </tr>
                </thead>

                <tbody>

                    ${users.map(user => `

                        <tr>

                            <td>
                                ${escapeHTML(user.id)}
                            </td>

                            <td>
                                ${escapeHTML(user.name)}
                            </td>

                            <td>
                                ${escapeHTML(user.type)}
                            </td>

                            <td>
                                ${escapeHTML(user.room)}
                            </td>

                            <td>
                                ${escapeHTML(user.status)}
                            </td>

                            <td>
                                ${user.lastLoginAt || "-"}
                            </td>

                            <td>
                                ${user.lastActivityAt || "-"}
                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* =========================================================
   8. FOOD LIMITS
   ========================================================= */

const DEFAULT_FOOD_LIMITS = {

    Puri: 4,
    Dosa: 4,
    Idly: 4,

    "Chicken Piece": 1,
    Egg: 1,
    "Fish Fry": 1,

    Banana: 1,
    Poriyal: 1
};


function loadFoodLimits() {

    const savedLimits = getData(
        "foodLimits",
        DEFAULT_FOOD_LIMITS
    );

    return savedLimits;
}


function renderFoodLimits() {

    const container = document.getElementById(
        "foodLimitsList"
    );

    if (!container) {
        return;
    }

    const limits = loadFoodLimits();

    container.innerHTML = Object.entries(limits)
        .map(([food, limit]) => `

            <div class="food-limit-row">

                <label>
                    ${escapeHTML(food)}
                </label>

                <input
                    type="number"
                    min="0"
                    value="${limit}"
                    data-food="${escapeHTML(food)}"
                >

            </div>

        `)
        .join("");
}


function saveFoodLimits() {

    const inputs = document.querySelectorAll(
        "#foodLimitsList input"
    );

    const limits = {};

    inputs.forEach(input => {

        const food = input.dataset.food;
        const limit = Number(input.value);

        limits[food] = limit;

    });

    saveData("foodLimits", limits);

    alert("Food limits saved.");
}


/* =========================================================
   9. INVITATION
   ========================================================= */

function generateInvitation() {

    const invitationCode =
        Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();

    const invitations = getData(
        "invitations",
        []
    );

    const invitation = {

        id: Date.now(),

        code: invitationCode,

        createdAt: new Date().toISOString(),

        status: "active"

    };

    invitations.push(invitation);

    saveData(
        "invitations",
        invitations
    );

    renderInvitations();
}


function renderInvitations() {

    const container = document.getElementById(
        "invitationList"
    );

    if (!container) {
        return;
    }

    const invitations = getData(
        "invitations",
        []
    );

    container.innerHTML = invitations.map(
        invitation => `

        <div class="invitation-card">

            <p>
                Code:
                <strong>
                    ${escapeHTML(invitation.code)}
                </strong>
            </p>

            <button
                onclick="copyInvitation('${invitation.code}')">
                Copy
            </button>

        </div>

    `).join("");
}


function copyInvitation(code) {

    const url =
        `${window.location.origin}/register.html?invite=${code}`;

    navigator.clipboard.writeText(url);

    alert("Invitation link copied.");
}


/* =========================================================
   10. REGISTRATION REQUEST
   ========================================================= */

function submitRegistration(event) {

    event.preventDefault();

    const name =
        document.getElementById("name").value.trim();

    const room =
        document.getElementById("room").value.trim();

    const type =
        document.getElementById("type").value;

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;


    if (password !== confirmPassword) {

        alert("Passwords do not match.");

        return;
    }


    const registrations =
        getData(
            "registrationRequests",
            []
        );


    registrations.push({

        id: Date.now(),

        name,

        room,

        type,

        password,

        status: "pending",

        createdAt:
            new Date().toISOString()

    });


    saveData(
        "registrationRequests",
        registrations
    );


    alert(
        "Registration submitted. Wait for admin approval."
    );

}


/* =========================================================
   11. APPROVE REGISTRATION
   ========================================================= */

function approveRegistration(registrationId) {

    const registrations =
        getData(
            "registrationRequests",
            []
        );


    const registration =
        registrations.find(
            item => item.id === registrationId
        );


    if (!registration) {
        return;
    }


    const users =
        getData("users", []);


    const prefix =
        registration.type === "student"
            ? "STU"
            : "WRK";


    const userId =
        prefix +
        String(users.length + 1)
            .padStart(3, "0");


    const newUser = {

        id: userId,

        name: registration.name,

        room: registration.room,

        type: registration.type,

        status: "active",

        lastLoginAt: null,

        lastActivityAt: null

    };


    users.push(newUser);

    saveData("users", users);


    registration.status = "approved";

    saveData(
        "registrationRequests",
        registrations
    );


    renderUserAccess();
}


/* =========================================================
   12. LOGIN ACTIVITY
   ========================================================= */

function recordLogin(userId) {

    const users =
        getData("users", []);


    const user =
        users.find(
            item => item.id === userId
        );


    if (!user) {
        return;
    }


    const now =
        new Date().toISOString();


    user.lastLoginAt = now;

    user.lastActivityAt = now;


    saveData("users", users);
}


/* =========================================================
   13. USER ACTIVITY
   ========================================================= */

function recordActivity(userId) {

    const users =
        getData("users", []);


    const user =
        users.find(
            item => item.id === userId
        );


    if (!user) {
        return;
    }


    user.lastActivityAt =
        new Date().toISOString();


    saveData("users", users);
}


/* =========================================================
   14. INITIALIZATION
   ========================================================= */

function initializeAdmin() {

    addAdminNavigation();

    createAdminSections();

    renderRequests();

    renderUserAccess();

    renderFoodLimits();

    renderInvitations();

}


/* =========================================================
   15. START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeAdmin
);
/* =========================================================
   MMA MANUAL MESS ENTRY + WHATSAPP SUMMARY EXTENSION
   Keeps the existing UI/data model and only adds targeted controls.
   ========================================================= */
(function(){
  'use strict';
  const P='mma_';
  const read=(k,d)=>{try{const v=localStorage.getItem(P+k);return v===null?d:JSON.parse(v);}catch(e){return d;}};
  const write=(k,v)=>{try{localStorage.setItem(P+k,JSON.stringify(v));}catch(e){}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const users=()=>Array.isArray(read('users',[]))?read('users',[]):[];
  const key=d=>window.mmaMessDate.calendarKey(new Date(d));
  const dateFor=n=>window.mmaMessDate.targetDate(n);
  const fmtDate=d=>d.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'short',year:'numeric'});
  const normalizePhone=v=>{let n=String(v||'').replace(/\D/g,'');if(n.length===10)n='91'+n;return n;};

  async function addAdminEntry(userId,dateKey,b,l,d){
    const u=users().find(x=>String(x.id||'').toUpperCase()===String(userId||'').toUpperCase());
    if(!u)return false;
    const response=await api.saveAdminEntry({user_id:u.id,date:dateKey,breakfast:Number(b)||0,lunch:Number(l)||0,dinner:Number(d)||0});
    const saved=response.entry||{};
    const entry={...saved,user:u.id,room:saved.room||u.room||'',date:dateKey,b:Number(saved.breakfast??b)||0,l:Number(saved.lunch??l)||0,d:Number(saved.dinner??d)||0,adminApproved:true,adminUpdatedAt:new Date().toISOString()};
    // Keep the legacy tomorrow list synchronized for the user app/admin summaries.
    if(dateKey===key(dateFor(1))){
      let t=read('tomorrowEntries',[]);if(!Array.isArray(t))t=[];
      const ti=t.findIndex(x=>String(x.user||'').toUpperCase()===String(u.id).toUpperCase());
      const te={user:u.id,room:u.room||'',b:entry.b,l:entry.l,d:entry.d,adminApproved:true,adminUpdatedAt:entry.adminUpdatedAt};
      if(ti>=0)t[ti]=te;else t.push(te);write('tomorrowEntries',t);
    }
    if(typeof window.mmaAdminNotify==='function')window.mmaAdminNotify('Mess entry updated',`${u.name||u.id} · ${dateKey} · B${entry.b} L${entry.l} D${entry.d}`,'entries',`manual-entry-${u.id}-${dateKey}-${entry.b}-${entry.l}-${entry.d}`);
    return true;
  }
  window.mmaAdminSaveMessEntry=addAdminEntry;

  function ensureEntryTools(){
    const body=document.getElementById('entriesBody');if(!body)return;
    document.querySelectorAll('.entry-day-block').forEach(block=>{
      const title=block.querySelector('.entry-day-title'); if(!title)return;
      const isTomorrow=/Tomorrow/i.test(title.textContent||'');
      const isToday=/Today/i.test(title.textContent||'');
      if(!isTomorrow&&!isToday)return;
      let bar=block.querySelector('.manual-entry-bar');
      if(!bar){
        bar=document.createElement('div');bar.className='manual-entry-bar';
        bar.innerHTML=`<button type="button" class="btn-secondary small manual-entry-btn">${isToday?'＋ Add / Edit Today':'＋ Add / Edit Tomorrow'}</button><button type="button" class="btn-secondary small whatsapp-entry-btn">WhatsApp Summary</button>`;
        block.insertBefore(bar,block.querySelector('.table-wrap'));
        bar.querySelector('.manual-entry-btn').addEventListener('click',()=>openEntryEditor(isTomorrow?'tomorrow':'today'));
        bar.querySelector('.whatsapp-entry-btn').addEventListener('click',function(){const per=isTomorrow?'tomorrow':'today';MMAUI.run(this,()=>generateAndShareSummary(per),{label:'Preparing image…',success:'Image ready.',minMs:300});});
      }
    });
  }

  function openEntryEditor(period){
    const dateKey=typeof window.mmaAdminGetEntryDateKey==='function'
      ? window.mmaAdminGetEntryDateKey(period)
      : key(period==='tomorrow'?dateFor(1):dateFor(0));
    const date=new Date(dateKey+'T12:00:00Z');
    let modal=document.getElementById('manualEntryModal');
    if(!modal){
      modal=document.createElement('div');modal.id='manualEntryModal';modal.className='modal-bg';
      modal.innerHTML=`<div class="modal manual-entry-modal"><h3 id="manualEntryTitle">Manual Mess Entry</h3><div class="field"><label>Room Number</label><select id="manualRoom"></select></div><div class="field"><label>Name</label><select id="manualUser"></select></div><div class="manual-entry-meals"><div class="field"><label>Breakfast</label><input id="manualB" type="number" min="0" max="99" step="1" value="0"></div><div class="field"><label>Lunch</label><input id="manualL" type="number" min="0" max="99" step="1" value="0"></div><div class="field"><label>Dinner</label><input id="manualD" type="number" min="0" max="99" step="1" value="0"></div></div><p id="manualEntryHelp" class="bill-help">Admin entries are approved and will not be treated as missed confirmations.</p><div class="row"><button class="cancel" type="button" onclick="closeManualEntry()">Cancel</button><button class="confirm add" type="button" onclick="saveManualEntry()">Save Entry</button></div></div>`;
      document.body.appendChild(modal);
    }
    modal.dataset.date=dateKey;
    modal.dataset.period=period;
    document.getElementById('manualEntryTitle').textContent=`${period==='tomorrow'?'Tomorrow':'Today'}'s Mess Entry · ${fmtDate(date)}`;
    const sorted=window.MMARoomSort.sortByRoom(users().filter(u=>String(u.status||'active').toLowerCase()==='active'));
    const rooms=window.MMARoomSort.sortRooms([...new Set(sorted.map(u=>String(u.room||'').trim()).filter(Boolean))]);
    const roomSel=document.getElementById('manualRoom'),userSel=document.getElementById('manualUser');
    roomSel.innerHTML='<option value="">Select room</option>'+rooms.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    userSel.innerHTML='<option value="">Select name</option>';
    roomSel.onchange=()=>{const room=roomSel.value;const us=sorted.filter(u=>String(u.room||'').trim()===room);userSel.innerHTML='<option value="">Select name</option>'+us.map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.id)}</option>`).join('');userSel.onchange=loadExisting;};
    userSel.onchange=loadExisting;
    function loadExisting(){const uid=userSel.value;const hist=read('messEntryHistory',[]);const e=hist.find(x=>String(x.user||'').toUpperCase()===String(uid).toUpperCase()&&x.date===dateKey);document.getElementById('manualB').value=e?Number(e.b)||0:0;document.getElementById('manualL').value=e?Number(e.l)||0:0;document.getElementById('manualD').value=e?Number(e.d)||0:0;}
    modal.classList.add('open');
  }
  window.openManualEntry=openEntryEditor;
  window.closeManualEntry=function(){document.getElementById('manualEntryModal')?.classList.remove('open');};
  window.saveManualEntry=async function(){
    const modal=document.getElementById('manualEntryModal');if(!modal)return;
    const uid=document.getElementById('manualUser')?.value;if(!uid){MMAUI.toast('Please select a room and name.','error');return;}
    try{
      const ok=await addAdminEntry(uid,modal.dataset.date,document.getElementById('manualB').value,document.getElementById('manualL').value,document.getElementById('manualD').value);
      if(ok){
        const refreshed=typeof window.refreshAdminEntries==='function'
          ? await window.refreshAdminEntries(true)
          : false;
        if(typeof window.mmaBillsRefresh==='function')window.mmaBillsRefresh();
        closeManualEntry();
        if(typeof window.refreshEntryReports==='function')window.refreshEntryReports();
        if(typeof window.renderMonthly==='function')window.renderMonthly();
        if(refreshed){
          MMAUI.toast('Mess entry saved.','success');
          if(typeof window.renderEntries==='function')window.renderEntries();
          if(typeof window.renderRecords==='function')window.renderRecords();
          if(typeof window.renderDashboard==='function')window.renderDashboard();
        }else{
          MMAUI.toast('Mess entry saved, but cooking totals could not be refreshed. The displayed counts were left unchanged.','error');
        }
      }
      else MMAUI.toast('Student could not be found.','error');
    }catch(error){console.error('Error saving manual mess entry:',error);MMAUI.toast(error.message||'Mess entry could not be saved.','error');}
  };

  function buildSummaryData(period){
    const date=period==='tomorrow'?dateFor(1):dateFor(0),dateKey=key(date),hist=read('messEntryHistory',[]);const list=Array.isArray(hist)?hist.filter(e=>e.date===dateKey):[];const us=users();
    const rows=window.MMARoomSort.sortByRoom(list.map(e=>{const u=us.find(x=>String(x.id||'').toUpperCase()===String(e.user||'').toUpperCase());return {name:u?.name||e.user||'-',room:u?.room||e.room||'-',b:Number(e.b)||0,l:Number(e.l)||0,d:Number(e.d)||0};}));
    const total=rows.reduce((a,r)=>{a.b+=r.b;a.l+=r.l;a.d+=r.d;return a;},{b:0,l:0,d:0});return {date,dateKey,rows,total};
  }

  function makeSummaryBlob(period){
    const data=buildSummaryData(period);const width=1000,rowH=58,headH=150,footH=70,height=Math.max(300,headH+Math.max(1,data.rows.length)*rowH+footH);const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');
    x.fillStyle='#ffffff';x.fillRect(0,0,width,height);x.fillStyle='#2f2352';x.fillRect(0,0,width,72);x.fillStyle='#ffffff';x.font='bold 28px Arial';x.fillText('MMA MESS - MOUNT ROAD',28,45);x.fillStyle='#24202d';x.font='bold 22px Arial';x.fillText(period==='tomorrow'?"Tomorrow's Mess Entries":"Today's Mess Entries",28,108);x.font='16px Arial';x.fillText(data.date.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short',year:'numeric'}),28,132);
    const cols=[30,420,560,670,780,890], labels=['Name','Room','Breakfast','Lunch','Dinner','Total'];x.fillStyle='#f1edf8';x.fillRect(20,150,960,48);x.fillStyle='#4d4659';x.font='bold 15px Arial';labels.forEach((l,i)=>x.fillText(l,cols[i],181));
    x.font='15px Arial';data.rows.forEach((r,i)=>{const y=218+i*rowH;x.fillStyle=i%2?'#fbfaff':'#ffffff';x.fillRect(20,y-35,960,rowH);x.fillStyle='#25212c';x.fillText(String(r.name).slice(0,28),cols[0],y);x.fillText(String(r.room),cols[1],y);x.fillText(String(r.b),cols[2],y);x.fillText(String(r.l),cols[3],y);x.fillText(String(r.d),cols[4],y);x.font='bold 15px Arial';x.fillText(String(r.b+r.l+r.d),cols[5],y);x.font='15px Arial';});
    const fy=218+Math.max(1,data.rows.length)*rowH;x.fillStyle='#eee9f6';x.fillRect(20,fy-35,960,52);x.fillStyle='#2f2352';x.font='bold 16px Arial';x.fillText('TOTAL',30,fy);x.fillText(String(data.total.b),560,fy);x.fillText(String(data.total.l),670,fy);x.fillText(String(data.total.d),780,fy);x.fillText(String(data.total.b+data.total.l+data.total.d),890,fy);return new Promise(resolve=>c.toBlob(resolve,'image/png'));
  }

  async function generateAndShareSummary(period){
    const blob=await makeSummaryBlob(period);if(!blob)return false;const dateKey=key(period==='tomorrow'?dateFor(1):dateFor(0));const file=new File([blob],`MMA-${period}-${dateKey}.png`,{type:'image/png'});const contacts=Array.isArray(read('whatsappContacts',[]))?read('whatsappContacts',[]):[];
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:`MMA Mess - Mount Road ${period} mess entries`,text:`${period==='tomorrow'?'Tomorrow':'Today'}'s mess entries - ${dateKey}`});return true;}catch(e){if(e?.name==='AbortError')return false;}}
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    if(contacts.length){const first=normalizePhone(contacts[0].phone);window.open(`https://wa.me/${first}?text=${encodeURIComponent(`${period==='tomorrow'?'Tomorrow':'Today'}'s MMA Mess - Mount Road mess entries image is ready. Please attach the downloaded image.`)}`,'_blank');}
    return true;
  }
  window.mmaGenerateWhatsAppSummary=generateAndShareSummary;

  function ensureWhatsAppUI(){
    const card=document.querySelector('#dash .dash-meals')?.closest('.card');if(!card)return;
    if(document.getElementById('whatsappContactTools'))return;
    const box=document.createElement('div');box.id='whatsappContactTools';box.className='whatsapp-tools';box.innerHTML=`<div class="whatsapp-tools-head"><b>Mess Record WhatsApp</b><button type="button" class="btn-secondary small" id="addWhatsappContact">＋ Add Number</button></div><div id="whatsappContactsList"></div><div class="whatsapp-actions"><button type="button" class="btn-secondary small" id="sendTomorrowWhatsApp">Tomorrow Image</button><button type="button" class="btn-secondary small" id="sendTodayWhatsApp">Today Image</button></div><small class="whatsapp-note">The image is generated from the same mess-entry records. Automatic WhatsApp delivery requires a WhatsApp Business API/backend; on supported phones this button can share the image directly.</small>`;
    card.appendChild(box);box.querySelector('#addWhatsappContact').onclick=openContactModal;box.querySelector('#sendTomorrowWhatsApp').onclick=function(){MMAUI.run(this,()=>generateAndShareSummary('tomorrow'),{label:'Preparing image…',success:'Tomorrow image ready.',minMs:300});};box.querySelector('#sendTodayWhatsApp').onclick=function(){MMAUI.run(this,()=>generateAndShareSummary('today'),{label:'Preparing image…',success:'Today image ready.',minMs:300});};renderContacts();
  }
  function renderContacts(){const box=document.getElementById('whatsappContactsList');if(!box)return;const list=Array.isArray(read('whatsappContacts',[]))?read('whatsappContacts',[]):[];box.innerHTML=list.length?list.map((c,i)=>`<div class="wa-contact"><span><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></span><button type="button" class="link-btn" data-i="${i}">Delete</button></div>`).join(''):'<div class="admin-empty">No WhatsApp numbers added.</div>';box.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{const a=read('whatsappContacts',[]);a.splice(Number(b.dataset.i),1);write('whatsappContacts',a);renderContacts();});}
  function openContactModal(){let m=document.getElementById('waContactModal');if(!m){m=document.createElement('div');m.id='waContactModal';m.className='modal-bg';m.innerHTML=`<div class="modal"><h3>Add WhatsApp Number</h3><div class="field"><label>Name</label><input id="waName" type="text" placeholder="Maintenance member"></div><div class="field"><label>Indian Mobile Number</label><input id="waPhone" type="tel" maxlength="10" placeholder="10-digit number"></div><div class="row"><button class="cancel" type="button" onclick="document.getElementById('waContactModal').classList.remove('open')">Cancel</button><button class="confirm add" type="button" id="saveWaContact">Save</button></div></div>`;document.body.appendChild(m);m.querySelector('#saveWaContact').onclick=()=>{const name=m.querySelector('#waName').value.trim(),phone=normalizePhone(m.querySelector('#waPhone').value);if(!name||phone.length!==12){MMAUI.toast('Enter a name and valid 10-digit Indian mobile number.','error');return;}const a=read('whatsappContacts',[]);a.push({name,phone:'+'+phone});write('whatsappContacts',a);MMAUI.toast('WhatsApp number added.','success');m.classList.remove('open');m.querySelector('#waName').value='';m.querySelector('#waPhone').value='';renderContacts();};}m.classList.add('open');}

  function checkAutomaticReady(){
    const todayKey=key(dateFor(0)),tomKey=key(dateFor(1)),state=read('whatsappDispatchState',{});const now=window.mmaMessDate.timeKey();const s=read('generalSettings',{});const cutoff=s.tomorrowCutoff||'23:00';
    const cutoffPassed=now>=cutoff;
    if(cutoffPassed&&!state.tomorrow){state.tomorrow={date:tomKey,readyAt:new Date().toISOString(),sent:false};write('whatsappDispatchState',state);if(typeof window.mmaAdminNotify==='function')window.mmaAdminNotify('Tomorrow mess image ready','Tomorrow entries have passed the cutoff. WhatsApp summary is ready to share.','entries','wa-tomorrow-'+tomKey);}
    const dinnerPassed=now>=(s.dinnerClose||'23:30');if(dinnerPassed&&!state.today){state.today={date:todayKey,readyAt:new Date().toISOString(),sent:false};write('whatsappDispatchState',state);if(typeof window.mmaAdminNotify==='function')window.mmaAdminNotify('Today mess image ready','Today\'s after-mess summary is ready to share.','entries','wa-today-'+todayKey);}
  }

  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{ensureWhatsAppUI();ensureEntryTools();},250);});
  const oldRenderEntries=window.renderEntries;window.renderEntries=function(){if(typeof oldRenderEntries==='function')oldRenderEntries();setTimeout(()=>{ensureEntryTools();ensureWhatsAppUI();},0);};
  setInterval(()=>{ensureEntryTools();ensureWhatsAppUI();checkAutomaticReady();},20000);
})();


/* MMA Mess - Mount Road admin/management enhancements - consolidated fixes */
(function(){
  "use strict";
  const P="mma_";
  const read=(k,f)=>{try{const r=localStorage.getItem(P+k);return r==null?f:JSON.parse(r);}catch(_){return f;}};
  const write=(k,v)=>{
    try{localStorage.setItem(P+k,JSON.stringify(v));}
    catch(error){console.error("Admin storage write error:",error);return;}
    if(typeof window.mmaPersistBusinessData==="function"){
      const result=window.mmaPersistBusinessData(k,v);
      if(result&&typeof result.catch==="function")result.catch(error=>{
        console.error("Unable to persist admin business data:",error);
        if(window.MMAUI&&typeof window.MMAUI.toast==="function")window.MMAUI.toast(error.message||"The change could not be saved to the server.","error");
      });
    }
  };
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const adminSession=()=>read("adminSession",null);
  const now=()=>new Date().toLocaleString("en-IN");

  function applyTheme(){const t=read("adminTheme","dark");document.documentElement.dataset.theme=t==="dark"?"dark":"light";const b=document.getElementById("adminThemeBtn");if(b)b.textContent=t==="dark"?"☀️ Light":"🌙 Dark";}
  function toggleTheme(){write("adminTheme",read("adminTheme","dark")==="dark"?"light":"dark");applyTheme();}

  let viewerTabId = "";
  try { viewerTabId = sessionStorage.getItem("mma_admin_viewer_tab_id") || ""; } catch (_) {}
  if (!viewerTabId) {
    viewerTabId = "tab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem("mma_admin_viewer_tab_id", viewerTabId); } catch (_) {}
  }
  let presenceRequestPending = false;
  function renderViewerCount(){
    const el=document.getElementById("adminViewerCount");
    if(!el)return;
    const chip=document.getElementById("adminViewerChip");
    if(chip)chip.title="Distinct admin accounts active across this application";
  }
  async function updateViewerPresence(){
    const app=document.getElementById("app"), login=document.getElementById("login");
    const account=read("currentUser",null);
    const loggedIn=!!(account&&account.role==="admin"&&app&&app.style.display!=="none"&&login&&!login.classList.contains("active"));
    const el=document.getElementById("adminViewerCount");
    if(!window.__mmaAdminSessionReady||document.visibilityState==="hidden"||!loggedIn||presenceRequestPending||typeof api==="undefined")return;
    presenceRequestPending=true;
    try{
      const response=await api.updateAdminPresence(viewerTabId);
      if(el)el.textContent=String(response.activeAdmins);
    }catch(error){
      console.error("Unable to refresh the active admin count:",error);
      if(el)el.textContent="—";
    }finally{
      presenceRequestPending=false;
    }
  }

  function adminNotifications(){const a=read("adminNotifications",[]);return Array.isArray(a)?a:[];}
  function adminRead(){return read("adminReadNotifications",[]);}
  function saveAdminNotifications(list){
    localStorage.setItem("mma_adminNotifications",JSON.stringify(list));
  }
  function updateAdminSectionBadges(){
    const readIds=adminRead();
    const targets=["requests","records","feedback","notif"];
    targets.forEach(function(target){
      const unread=adminNotifications().filter(function(item){
        return item.target===target&&item.read!==true&&!readIds.includes(item.id);
      }).length;
      setRequestBadge(target,unread);
    });
    const noFoodBadge=document.getElementById("noFoodNavBadge");
    if(noFoodBadge){
      const unread=adminNotifications().filter(function(item){
        return item.target==="entries"&&item.title==="No-food request pending"&&
          item.read!==true&&!readIds.includes(item.id);
      }).length;
      noFoodBadge.textContent=unread>99?"99+":String(unread);
      noFoodBadge.style.display=unread?"inline-flex":"none";
      noFoodBadge.setAttribute("aria-label",unread+" unread no-food notifications");
    }
  }
  function renderAdminBell(){
    const list=adminNotifications(), readIds=adminRead(), unread=list.filter(n=>n.read!==true&&!readIds.includes(n.id)).length;
    const badge=document.getElementById("adminNotifBadge");if(badge){badge.textContent=unread;badge.style.display=unread?"flex":"none";}
    const count=document.getElementById("adminUnreadCount");if(count)count.textContent=unread?`${unread} unread`:"All caught up";
    updateAdminSectionBadges();
  }
  async function markAdminRead(id){
    const list=adminNotifications(), notification=list.find(item=>item.id===id);
    const readIds=adminRead();
    if(!readIds.includes(id)){readIds.push(id);write("adminReadNotifications",readIds);}
    if(notification)notification.read=true;
    saveAdminNotifications(list);renderAdminBell();renderAdminNotifications();
    if(/^[a-f\d]{24}$/i.test(id)&&typeof api!=="undefined"){
      try{await api.markNotificationRead(id);}
      catch(error){
        console.error("Unable to mark admin notification as read:",error);
        const updated=adminRead().filter(value=>value!==id);
        write("adminReadNotifications",updated);
        if(notification)notification.read=false;
        saveAdminNotifications(list);renderAdminBell();renderAdminNotifications();
        if(window.MMAUI&&typeof window.MMAUI.toast==="function")window.MMAUI.toast(error.message||"Notification read state could not be saved.","error");
      }
    }
  }
  async function markAdminTargetRead(target){
    const list=adminNotifications(), readIds=adminRead();
    list.forEach(function(item){
      if(!target||item.target===target){
        item.read=true;
        if(!readIds.includes(item.id))readIds.push(item.id);
      }
    });
    write("adminReadNotifications",readIds);
    saveAdminNotifications(list);renderAdminBell();renderAdminNotifications();
    if(typeof api!=="undefined"&&typeof api.markNotificationsRead==="function"){
      try{await api.markNotificationsRead(target||undefined);}
      catch(error){
        console.error("Unable to mark admin section notifications as read:",error);
        const targets=adminNotifications();
        const currentRead=adminRead();
        targets.forEach(function(item){
          if(!target||item.target===target){
            item.read=false;
            const index=currentRead.indexOf(item.id);
            if(index>=0)currentRead.splice(index,1);
          }
        });
        write("adminReadNotifications",currentRead);
        saveAdminNotifications(targets);renderAdminBell();renderAdminNotifications();
        if(window.MMAUI&&typeof window.MMAUI.toast==="function")window.MMAUI.toast(error.message||"Notifications could not be marked as read.","error");
      }
    }
    window.mmaMarkAdminTargetRead=markAdminTargetRead;
  }
  function renderAdminNotifications(){
    const list=adminNotifications(), r=adminRead();
    [document.getElementById("adminBellPanelList"),document.getElementById("adminNotificationList")].forEach(function(box){
      if(!box)return;
      box.innerHTML=list.length?list.slice(0,50).map(n=>`<button type="button" class="admin-notif-item ${n.read===true||r.includes(n.id)?"":"unread"}" data-id="${esc(n.id)}" data-target="${esc(n.target||"dash")}"><b>${esc(n.title||"Update")}</b><span>${esc(n.message||"")}</span><small>${esc(n.createdAt?new Date(n.createdAt).toLocaleString("en-IN"):now())}</small></button>`).join(""):'<div class="admin-empty">No new activity.</div>';
      box.querySelectorAll("button[data-id]").forEach(b=>b.addEventListener("click",async()=>{await markAdminRead(b.dataset.id);window.openScreen(b.dataset.target||"dash");closeAdminNotifPanel();}));
    });
  }
  async function markAllAdminRead(){await markAdminTargetRead();}
  async function clearAllAdminNotifications(){
    if(!confirm("Clear all Admin notifications? Pending requests will remain available for review."))return;
    try{
      if(typeof api==="undefined"||typeof api.clearNotifications!=="function")throw new Error("Notification clearing is unavailable.");
      await api.clearNotifications();
      saveAdminNotifications([]);
      write("adminReadNotifications",[]);
      write("adminRequestNotificationSeen",[]);
      renderAdminBell();renderAdminNotifications();
      if(window.MMAUI&&typeof window.MMAUI.toast==="function")window.MMAUI.toast("Notifications cleared.","success");
    }catch(error){
      console.error("Unable to clear Admin notifications:",error);
      if(window.MMAUI&&typeof window.MMAUI.toast==="function")window.MMAUI.toast(error.message||"Notifications could not be cleared.","error");
    }
  }
  function closeAdminNotifPanel(){document.getElementById("adminNotifPanel")?.classList.remove("open");}

  function addAdminActivity(title,message,target,dedupeKey){
    const list=adminNotifications();if(dedupeKey&&list.some(n=>n.dedupeKey===dedupeKey))return;
    list.unshift({id:"AN-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),title,message,target:target||"dash",createdAt:new Date().toISOString(),dedupeKey:dedupeKey||null});write("adminNotifications",list);renderAdminBell();
  }
  window.mmaAdminNotify=addAdminActivity;

  function setRequestBadge(screen,count){
    const button=document.querySelector('.side .navbtn[data-s="'+screen+'"]');
    if(!button)return;
    let badge=button.querySelector(".request-count-badge");
    if(!badge){badge=document.createElement("span");badge.className="request-count-badge";badge.setAttribute("role","status");badge.setAttribute("aria-live","polite");button.appendChild(badge);}
    const value=Math.max(0,Number(count)||0);
    badge.textContent=value>99?"99+":String(value);
    badge.setAttribute("aria-label",value+" unread notifications");
    badge.style.display=value?"inline-flex":"none";
  }
  function requestNotificationKey(item){
    return String(item&& (item.dedupeKey||item.id) || "");
  }
  function syncAdminRequestNotifications(notifications){
    const list=(Array.isArray(notifications)?notifications:[]).filter(function(item){
      return item&&item.audience==="admins"&&
        (item.title==="New enrollment request"||
         item.title==="Extra meal permission request"||
         item.title==="New student feedback"||
         item.title==="No-food request pending");
    });
    let seen=read("adminRequestNotificationSeen",null);
    const firstSync=!Array.isArray(seen);
    seen=Array.isArray(seen)?seen:[];
    const seenSet=new Set(seen);
    const local=adminNotifications();
    const merged=new Map();
    const serverKeys=new Set(list.map(requestNotificationKey));
    local.forEach(function(item){
      const key=requestNotificationKey(item)||String(item.title||"")+"|"+String(item.message||"");
      if(["New enrollment request","Extra meal permission request","New student feedback","No-food request pending"].includes(item.title)&&
        item.dedupeKey&&!serverKeys.has(item.dedupeKey))return;
      if(key)merged.set(key,item);
    });
    list.forEach(function(item){
      const key=requestNotificationKey(item);
      if(!key)return;
      const title=item.title||item.t||"Update";
      const message=item.message||item.m||"";
      const notification={
        id:item.id||key,
        title:title,
        message:message,
        target:item.target||"dash",
        createdAt:item.createdAt||item.d,
        dedupeKey:item.dedupeKey||null,
        read:item.read===true
      };
      const duplicateKey=notification.dedupeKey||key;
      merged.set(duplicateKey,notification);
      const localRead=adminRead();
      const readIndex=localRead.indexOf(notification.id);
      if(notification.read&&readIndex<0)localRead.push(notification.id);
      else if(!notification.read&&readIndex>=0)localRead.splice(readIndex,1);
      write("adminReadNotifications",localRead);
      if(!seenSet.has(key)){
        if(!firstSync&&
          (title==="New enrollment request"||title==="Extra meal permission request"||title==="New student feedback")&&
          window.MMAUI&&typeof window.MMAUI.toast==="function"){
          const type=title==="New enrollment request"?"New join request":title==="New student feedback"?"New student feedback":"New meal request";
          window.MMAUI.toast(type+": "+message,"info");
        }
        seenSet.add(key);
      }
    });
    saveAdminNotifications(Array.from(merged.values()).slice(-100).reverse());
    localStorage.setItem("mma_adminRequestNotificationSeen",JSON.stringify(
      Array.from(seenSet).slice(-500)
    ));
    renderAdminBell();
    renderAdminNotifications();
  }

  let requestStateRefreshPending=false,requestStateRefreshAgain=false;
  async function refreshAdminRequestNavigation(){
    if(!window.__mmaAdminSessionReady||typeof api==="undefined")return;
    if(requestStateRefreshPending){requestStateRefreshAgain=true;return;}
    requestStateRefreshPending=true;
    try{
      do{
        requestStateRefreshAgain=false;
        const requests=api.getRegistrations().then(function(response){
          const list=Array.isArray(response.registrations)?response.registrations:[];
          renderRegistrationRequests(list);
        }).catch(function(error){
          console.error("Unable to refresh pending join requests:",error);
        });
        const notifications=api.getNotifications().then(function(response){
          syncAdminRequestNotifications(response.notifications);
        }).catch(function(error){
          console.error("Unable to refresh admin request notifications:",error);
        });
        await Promise.all([requests,notifications]);
      }while(requestStateRefreshAgain);
    }finally{requestStateRefreshPending=false;}
  }
  window.refreshAdminRequestNavigation=refreshAdminRequestNavigation;

  function addUserNotification(title,message,target,userId,dedupeKey){
    const list=read("notifHistory",[]);const arr=Array.isArray(list)?list:[];if(dedupeKey&&arr.some(n=>n.dedupeKey===dedupeKey&&n.userId===userId))return;
    arr.unshift({id:"NTF-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),t:title,m:message,d:now(),target:target||"home",userId:userId||null,audience:userId?"user":"users",dedupeKey:dedupeKey||null,createdAt:new Date().toISOString()});write("notifHistory",arr);
  }
  function allUsers(){return read("users",[]);}

  function ensureAdminUI(){
    const top=document.querySelector("header.top");
    if(top&&!document.getElementById("adminTools")){
      const tools=document.createElement("div");tools.id="adminTools";tools.className="admin-tools";
      tools.innerHTML='<div id="adminViewerChip" class="admin-viewer-chip" title="Active admin viewers"><span aria-hidden="true">👁</span><span>Admins</span><b id="adminViewerCount">0</b></div><button id="adminThemeBtn" class="top-tool" type="button" aria-label="Toggle theme">🌙 Dark</button><button id="adminBellBtn" class="top-tool bell-tool" type="button" aria-label="Notifications">🔔<span id="adminNotifBadge" class="admin-badge" style="display:none">0</span></button>';
      top.appendChild(tools);tools.querySelector("#adminThemeBtn").addEventListener("click",toggleTheme);tools.querySelector("#adminBellBtn").addEventListener("click",()=>{const p=document.getElementById("adminNotifPanel");p?.classList.toggle("open");renderAdminNotifications();});
      const panel=document.createElement("div");panel.id="adminNotifPanel";panel.className="admin-notif-panel";panel.innerHTML='<div class="admin-notif-head"><b>Notifications</b><button id="adminMarkAll" type="button">Mark all read</button></div><div id="adminUnreadCount" class="admin-unread-count"></div><div id="adminBellPanelList"></div>';document.body.appendChild(panel);panel.querySelector("#adminMarkAll").addEventListener("click",markAllAdminRead);
    }
    const clear=document.getElementById("adminClearNotifications");
    if(clear&&!clear.__mmaBound){clear.addEventListener("click",clearAllAdminNotifications);clear.__mmaBound=true;}
    applyTheme();renderAdminBell();renderAdminNotifications();renderViewerCount();
  }

  function goBackAdmin(){
    const current=document.querySelector("main .screen.active")?.id;
    const previous=window.__mmaAdminPrev||[];
    let target="";
    while(previous.length&&!target){
      const candidate=previous.pop();
      if(candidate!==current&&document.getElementById(candidate))target=candidate;
    }
    window.__mmaAdminBack=true;
    window.openScreen(target||"dash");
  }

  function addBackButtons(){
    document.querySelectorAll("main .screen").forEach(section=>{
      if(section.id==="dash"||section.querySelector(".mma-admin-back"))return;
      const b=document.createElement("button");b.className="back mma-admin-back";b.type="button";b.textContent="← Back";b.addEventListener("click",goBackAdmin);section.insertBefore(b,section.firstChild);
    });
  }
  function patchNavigation(){
    const original=window.openScreen;if(typeof original!=="function"||original.__mmaEnhanced)return;
    let prev=[];
    const wrapped=function(id){const current=document.querySelector("main .screen.active")?.id;if(!window.__mmaAdminBack&&current&&current!==id)prev.push(current);if(window.__mmaAdminBack)window.__mmaAdminBack=false;original(id);if(["requests","records","feedback","entries"].includes(id))markAdminTargetRead(id);if(id==="notif"){markAdminTargetRead();renderAdminNotifications();}};wrapped.__mmaEnhanced=true;window.openScreen=wrapped;
    window.__mmaAdminPrev=prev;
  }

  function patchLogout(){
    const original=window.doLogout;if(typeof original!=="function"||original.__mmaEnhanced)return;window.doLogout=async function(){try{if(typeof api!=="undefined")await api.clearAdminPresence(viewerTabId);}catch(error){console.error("Unable to clear admin presence:",error);}write("adminSession",null);return original.apply(this,arguments);};window.doLogout.__mmaEnhanced=true;
  }

  function patchCutoff(){
    const original=window.saveCutoff;if(typeof original!=="function"||original.__mmaEnhanced)return;window.saveCutoff=function(){const input=document.getElementById("cutoffTime");const value=input?.value||"";if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)){alert("Choose a valid cutoff time.");return;}write("cutoffTime",value);if(typeof cutoff!=="undefined")cutoff=value;const msg=document.getElementById("cutoffConfirm");if(msg){msg.textContent=`Cutoff saved: ${formatTime(value)}.`;msg.style.display="block";}addAdminActivity("Mess entry cutoff updated",`Tomorrow's mess entry now closes at ${formatTime(value)}.`,"menu","cutoff-"+value+"-"+new Date().toISOString().slice(0,10));allUsers().filter(u=>String(u.status||"").toLowerCase()==="active").forEach(u=>addUserNotification("Mess entry cutoff updated",`Tomorrow's mess entry closes at ${formatTime(value)}.`,"home",u.id,"cutoff-"+value+"-"+new Date().toISOString().slice(0,10)));};window.saveCutoff.__mmaEnhanced=true;}
  const formatTime=v=>{const p=String(v).split(":");let h=Number(p[0]||0);const m=p[1]||"00";const s=h>=12?"PM":"AM";h=h%12||12;return `${h}:${m} ${s}`;};

  function patchMenus(){
    const oldToday=window.saveTodayMenu;if(typeof oldToday==='function'&&!oldToday.__mmaEnhanced){window.saveTodayMenu=function(){oldToday.apply(this,arguments);const m=read("todayMenu",{});addAdminActivity("Today's menu updated","Breakfast, lunch and dinner were updated.","menu","today-menu-"+JSON.stringify(m));allUsers().filter(u=>String(u.status||"").toLowerCase()==="active").forEach(u=>addUserNotification("Today's menu updated","The mess menu has been updated.","home",u.id,"today-menu-"+new Date().toISOString().slice(0,10)));};window.saveTodayMenu.__mmaEnhanced=true;}
    const oldWeek=window.saveWeekMenu;if(typeof oldWeek==='function'&&!oldWeek.__mmaEnhanced){window.saveWeekMenu=function(){oldWeek.apply(this,arguments);addAdminActivity("Weekly menu updated","The weekly mess menu was updated.","menu","week-menu-"+new Date().toISOString().slice(0,10));allUsers().filter(u=>String(u.status||"").toLowerCase()==="active").forEach(u=>addUserNotification("Weekly menu updated","The weekly mess menu has been updated.","home",u.id,"week-menu-"+new Date().toISOString().slice(0,10)));};window.saveWeekMenu.__mmaEnhanced=true;}
  }

  function patchInvitation(){
    window.copyInvitation=function(code){
      const url=new URL("/student",window.location.href);
      url.searchParams.set("register",code);
      const text=url.href;
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>alert("Invitation link copied."),()=>prompt("Copy this invitation link:",text));}
      else prompt("Copy this invitation link:",text);
    };
  }

  function patchSendNotification(){
    const old=window.sendNotif;if(typeof old!=='function'||old.__mmaEnhanced)return;window.sendNotif=function(){const title=document.getElementById("notifTitle")?.value.trim(),msg=document.getElementById("notifMsg")?.value.trim();old.apply(this,arguments);if(title&&msg){const list=read("notifHistory",[]);if(Array.isArray(list)&&list[0]){list[0].id=list[0].id||("NTF-"+Date.now());list[0].target="home";list[0].audience="users";list[0].createdAt=new Date().toISOString();write("notifHistory",list);}addAdminActivity("Notification sent",title,"notif","manual-notif-"+title+"-"+msg);}};window.sendNotif.__mmaEnhanced=true;}

  async function renderRegistrationRequests(requests){
    const box=document.getElementById("registrationRequestsList");if(!box)return;
    const login=document.getElementById("login");
    if(login&&login.classList.contains("active"))return;
    try {
      const response=Array.isArray(requests)?{registrations:requests}:await api.getRegistrations();
      const list=window.MMARoomSort.sortByRoom((response.registrations||[]).filter(function(request){return request.status==="pending";}));
      box.innerHTML=list.length?list.map(r=>`<div class="request-card"><b>${esc(r.name)}</b><span>Room ${esc(r.room)}</span><small>Phone: ${esc(r.phone||"-")}<br>Gmail: ${esc(r.email||"-")}<br>Submitted: ${esc(r.created_at?new Date(r.created_at).toLocaleString("en-IN"):"-")}</small><div class="request-actions"><button class="btn-primary small" onclick="approveRegistration('${esc(r._id)}')">Approve</button><button class="btn-secondary small" onclick="rejectRegistration('${esc(r._id)}')">Reject</button></div></div>`).join(""):'<div class="admin-empty">No pending enrollment requests.</div>';
    } catch(error) {
      console.error("Unable to load enrollment requests:",error);
      box.innerHTML=`<div class="admin-empty">${esc(error.message||"Unable to load enrollment requests.")}</div>`;
    }
  }
  window.renderRegistrationRequests=renderRegistrationRequests;
  window.approveRegistration=async function(id){
    try {
      await api.approveRegistration(id);
      await markAdminTargetRead("requests");
      await refreshAdminRequestNavigation();
      if(typeof renderUsers==='function')await renderUsers();
      if(typeof renderDashboard==='function')renderDashboard();
    } catch(error) {
      console.error("Unable to approve enrollment:",error);
      alert(error.message||"Unable to approve enrollment.");
    }
  };
  window.rejectRegistration=async function(id){
    try {
      await api.rejectRegistration(id);
      await markAdminTargetRead("requests");
      await refreshAdminRequestNavigation();
    } catch(error) {
      console.error("Unable to reject enrollment:",error);
      alert(error.message||"Unable to reject enrollment.");
    }
  };

  function renderExtraSections(){
    const main=document.querySelector("main");if(!main)return;
    if(!document.getElementById("requests")){const s=document.createElement("section");s.id="requests";s.className="screen";s.innerHTML='<div class="section-title" style="margin-top:0">Requests & Registration</div><div class="card"><h3>Pending registration requests</h3><div id="registrationRequestsList"></div></div>';main.appendChild(s);}
    if(!document.getElementById("userAccess")){const s=document.createElement("section");s.id="userAccess";s.className="screen";s.innerHTML='<div class="section-title" style="margin-top:0">User Activity</div><div class="card"><div class="cfg-charge"><div class="field"><label for="activityRoomFilter">Filter by room</label><select id="activityRoomFilter"><option value="">All rooms</option></select></div></div><div class="table-wrap"><table class="dtable"><thead><tr><th>Name</th><th>Room</th><th>Status</th><th>Last login</th><th>Last activity</th></tr></thead><tbody id="userAccessList"></tbody></table></div></div>';main.appendChild(s);}
    const side=document.querySelector(".side");if(side&&!side.querySelector('[data-extra="requests"]')){const refs=[['requests','📝 Requests'],['userAccess','🕒 User Activity']];const logout=side.querySelector(".navbtn.logout");refs.forEach(([id,label])=>{const b=document.createElement("button");b.className="navbtn";b.dataset.s=id;b.dataset.extra="requests";b.textContent=label;b.onclick=()=>window.openScreen(id);if(logout)side.insertBefore(b,logout);else side.appendChild(b);});}
    renderRegistrationRequests();renderRequestList();renderAccess();addBackButtons();
  }
  function renderRequestList(){const box=document.getElementById("requestsList");if(!box)return;const rs=window.MMARoomSort.sortByRoom(read("requests",[]).filter(r=>r.status==="pending"));box.innerHTML=rs.length?rs.map(r=>`<div class="request-card"><b>${esc(r.type||"Request")}</b><span>${esc(r.user||r.userId||"")} · ${esc(r.room||"")}</span><small>${esc(r.message||r.date||"")}</small><div class="request-actions"><button class="btn-primary small" onclick="updateUserRequest('${esc(r.id)}','approved')">Approve</button><button class="btn-secondary small" onclick="updateUserRequest('${esc(r.id)}','rejected')">Reject</button></div></div>`).join(""):'<div class="admin-empty">No pending requests.</div>';}
  window.updateUserRequest=function(id,status){const rs=read("requests",[]),r=rs.find(x=>x.id===id);if(!r)return;r.status=status;r.reviewedAt=new Date().toISOString();write("requests",rs);addAdminActivity(`Request ${status}`,`${r.user||r.userId||"User"}: ${r.type||"request"}.`,"requests","request-"+id+"-"+status);if(r.user)addUserNotification(`Request ${status}`,`Your ${r.type||"request"} was ${status}.`,"clientRequests",r.user,"request-"+id+"-"+status);renderRequestList();};
  function renderAccess(){
    const box=document.getElementById("userAccessList"); if(!box)return;
    const users=allUsers(); const sel=document.getElementById("activityRoomFilter");
    if(sel){window.MMAAdminRoomFilter.populateSelect(sel,users);if(!sel.dataset.wired){sel.addEventListener('change',renderAccess);sel.dataset.wired='1';}}
    const chosen=sel?sel.value:"";const rows=window.MMARoomSort.sortByRoom(window.MMAAdminRoomFilter.filterUsers(users,chosen));
    box.innerHTML=rows.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.room||"-")}</td><td>${esc(u.status||"active")}</td><td>${esc(u.lastLoginAt?new Date(u.lastLoginAt).toLocaleString("en-IN"):"-")}</td><td>${esc(u.lastActivityAt?new Date(u.lastActivityAt).toLocaleString("en-IN"):"-")}</td></tr>`).join("")||'<tr><td colspan="5">No users.</td></tr>';
  }
  window.renderAdminUserActivity=renderAccess;

  function enforceRole(){const s=adminSession();if(!s)return;const secretary=s.role==="secretary";document.querySelectorAll('.side .navbtn').forEach(b=>{const id=b.dataset.s;if(secretary&&["users","bills","userAccess"].includes(id))b.style.display="none";});const name=document.querySelector(".admin-name");if(name)name.textContent=s.name||"Admin";}

  function init(){applyTheme();ensureAdminUI();patchNavigation();patchLogout();patchCutoff();patchMenus();patchInvitation();patchSendNotification();renderExtraSections();enforceRole();updateViewerPresence();setInterval(()=>{if(!window.__mmaAdminSessionReady||document.visibilityState==="hidden")return;renderAdminBell();renderAdminNotifications();renderRequestList();refreshAdminRequestNavigation();renderAccess();updateViewerPresence();if(typeof window.refreshNoFoodRequests==='function')window.refreshNoFoodRequests();},60000);}
  document.addEventListener("DOMContentLoaded",init);
  window.addEventListener("storage",()=>{renderAdminBell();renderAdminNotifications();renderRequestList();renderRegistrationRequests();renderAccess();updateViewerPresence();});
})();


/* =========================================================
   MMA STEP 2 - ADMIN GENERAL SETTINGS
   ========================================================= */
(function(){
  const read=(k,d)=>{try{const v=localStorage.getItem("mma_"+k);return v===null?d:JSON.parse(v);}catch(e){return d;}};
  const write=(k,v)=>{try{localStorage.setItem("mma_"+k,JSON.stringify(v));}catch(e){}};
  const defaults={tomorrowCutoff:"23:00",breakfastOpen:"07:00",breakfastClose:"11:00",lunchOpen:"07:00",lunchClose:"15:00",dinnerOpen:"19:30",dinnerClose:"23:30"};
  const settings=()=>Object.assign({},defaults,read("generalSettings",{}));
  function load(){const s=settings();Object.keys(s).forEach(k=>{const e=document.getElementById("general"+k.charAt(0).toUpperCase()+k.slice(1));if(e)e.value=s[k];});}
  window.saveGeneralSettings=async function(){
    const ids=["TomorrowCutoff","BreakfastOpen","BreakfastClose","LunchOpen","LunchClose","DinnerOpen","DinnerClose"];
    const keys=["tomorrowCutoff","breakfastOpen","breakfastClose","lunchOpen","lunchClose","dinnerOpen","dinnerClose"];
    const out={}; for(let i=0;i<keys.length;i++){const e=document.getElementById("general"+ids[i]);if(!e||!/^([01]\d|2[0-3]):[0-5]\d$/.test(e.value)){alert("Please choose a valid time for every setting.");return;}out[keys[i]]=e.value;}
    let response;
    try {
      response=await api.saveSettings(out);
    } catch(error) {
      console.error("Unable to save general settings:",error);
      alert(error.message||"Settings could not be saved to the server.");
      return;
    }
    const saved=response&&response.settings?response.settings:out;
    write("generalSettings",saved);write("cutoffTime",saved.tomorrowCutoff||saved.cutoffTime||out.tomorrowCutoff);
    const msg=document.getElementById("generalConfirm");if(msg){msg.textContent="General settings updated successfully.";msg.style.display="block";setTimeout(()=>msg.style.display="none",2500);}
    if(typeof window.mmaAdminNotify==="function")window.mmaAdminNotify("General settings updated","Tomorrow cutoff and meal time windows were changed.","general","general-settings-"+Date.now());
  };
  function hideOldCutoff(){const labels=[...document.querySelectorAll(".section-title")];labels.forEach(t=>{if((t.textContent||"").toLowerCase().includes("mess entry cutoff")){const card=t.nextElementSibling;if(card)card.style.display="none";t.style.display="none";}});}
  document.addEventListener("DOMContentLoaded",()=>{load();hideOldCutoff();setTimeout(load,100);});
})();


(function(){function updateMmaActiveCount(){try{var users=JSON.parse(localStorage.getItem("mma_users")||localStorage.getItem("users")||"[]");if(!Array.isArray(users))users=[];var seen=new Set();var n=users.filter(function(u){var status=String(u.status||"active").toLowerCase();var role=String(u.role||u.type||"student").toLowerCase();if(status!=="active"||role==="admin")return false;var id=String(u.id||"").trim();if(!id)return false;var key=id.toUpperCase();if(seen.has(key))return false;seen.add(key);return true;}).length;var el=document.getElementById("activeUserCount");if(el)el.textContent=n+" users";}catch(e){}}document.addEventListener("DOMContentLoaded",updateMmaActiveCount);window.addEventListener("storage",updateMmaActiveCount);})();

/* =========================================================
   MMA ADMIN - POINT-BASED BILLS
   ---------------------------------------------------------
   Published bills are stored in the backend MongoDB "bills"
   collection. localStorage is only a browser cache. Excel Viewer
   drafts are stored separately and do not publish student bills.

   Bill calculation (per user):
     Total Points   = sum over the month's saved mess entries of
                      (meals counted x point weight of that day's dish)
     Points in Rs   = Total Points x Per Point
     Fixed/Water/Reserved = each common cost split equally among
                      the billed users (or charged per user, see mode)
     Fixed discount = a new / mid-month user pays less Fixed Cost;
                      the discount is re-spread over the other users
     Grand Total    = Points in Rs + Fixed + Water + Reserved

   Needs (loaded before): app.js, mma-points.js, ui-buttons.js
   ========================================================= */
(function () {
  "use strict";

  var P = window.MMAPoints;
  var UI = window.MMAUI;
  var pointRateState = { month: "", status: "loading", data: null, error: null };
  var pointRateRequest = 0;
  var billingSourceRequest = 0;
  var customChargeDrafts = [];
  var customChargeEdits = Object.create(null);
  var CHARGE_IDS = ["fixed", "water", "reserve"];
  var CHARGE_FIELD = { fixed: "fixedCost", water: "waterCharges", reserve: "reservedFund" };
  var DEFAULT_CFG = {
    perPoint: 0,
    charges: {
      fixed: { name: "Fixed Cost", amount: 0, mode: "split" },
      water: { name: "Water Charges", amount: 0, mode: "split" },
      reserve: { name: "Reserved Fund", amount: 0, mode: "split" }
    },
    discounts: {},
    customCharges: [],
    expenses: [
      { id: "provision", name: "Provision", amount: 0 },
      { id: "vegetables", name: "Vegetables", amount: 0 },
      { id: "gas", name: "Gas", amount: 0 },
      { id: "other", name: "Other Expense", amount: 0 }
    ]
  };

  /* ---------------------------------------------------------
     small helpers
     --------------------------------------------------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function r2(n) { return P.round(n, 2); }
  function toPaise(n) { return Math.round((Number(n) || 0) * 100); }
  function fromPaise(p) { return p / 100; }
  function inr(n) {
    var v = r2(n);
    return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  }
  function money(n) {          // amounts without the symbol: 3,277 or 180.80
    var v = r2(n);
    return v.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
  }
  function num(n) {
    var v = r2(n);
    return v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function uidKey(id) { return String(id || "").toUpperCase(); }
  function currentMonthKey() {
    return window.mmaMessDate.monthKey();
  }
  function selectedMonth() {
    var el = $("billMonth");
    if (el && /^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)) return el.value;
    return currentMonthKey();
  }
  function monthLabel(m) {
    var d = new Date(m + "-01T00:00:00");
    return isNaN(d.getTime()) ? m : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  function isV3(b) { return b && Number(b.calcVersion) >= 3; }
  function billUserId(b) { return uidKey(b && (b.user_id || b.user)); }
  function billMonthOf(b) { return String(b && (b.billing_month || b.billingMonth || b.month) || ""); }
  function readNumber(el) {
    if (!el) return NaN;
    var s = String(el.value).trim();
    if (s === "") return NaN;
    return Number(s);
  }

  /* ---------------------------------------------------------
     config (Per Point, common costs, discounts)
     --------------------------------------------------------- */
  function getCfg() {
    var saved = P.read("billConfig", {});
    var cfg = JSON.parse(JSON.stringify(DEFAULT_CFG));
    if (saved && typeof saved === "object") {
      if (Number.isFinite(Number(saved.perPoint))) cfg.perPoint = Number(saved.perPoint);
      CHARGE_IDS.forEach(function (id) {
        var s = saved.charges && saved.charges[id];
        if (s) {
          if (typeof s.name === "string" && s.name.trim()) cfg.charges[id].name = s.name.trim().slice(0, 40);
          if (Number.isFinite(Number(s.amount))) cfg.charges[id].amount = Number(s.amount);
          if (s.mode === "each" || s.mode === "split") cfg.charges[id].mode = s.mode;
        }
      });
      if (saved.discounts && typeof saved.discounts === "object") cfg.discounts = saved.discounts;
      if (Array.isArray(saved.customCharges)) cfg.customCharges = saved.customCharges.filter(function (c) { return c && typeof c.name === "string" && String(c.id || "").trim(); }).map(function (c, i) {
        return { id: String(c.id || ("cc_" + i)).replace(/[^a-zA-Z0-9_-]/g, "_"), name: c.name.trim().slice(0, 60), amount: Math.max(0, Number(c.amount) || 0), mode: c.mode === "each" ? "each" : "split" };
      });
      if (Array.isArray(saved.expenses)) cfg.expenses = saved.expenses.filter(function(e){return e && typeof e.name === "string";}).map(function(e,i){return {id:String(e.id || ("expense"+i)),name:e.name.slice(0,60),amount:Math.max(0,Number(e.amount)||0)};});
    }
    var expenseTotal = cfg.expenses.reduce(function(sum,e){return sum + Math.max(0,Number(e.amount)||0);},0);
    var users = activeUsers(); var pointsTotal = 0;
    if (users.length && P && typeof P.monthPoints === "function") {
      var month = selectedMonth(); var entries = P.read("messEntryHistory", []); effMeals._records = P.read("mealRecords", []);
      users.forEach(function(u){ var mp=P.monthPoints(uidKey(u.id),month,entries,effMeals,billingMenuForDate); pointsTotal += Number(mp.total)||0; });
    }
    cfg.perPoint = pointsTotal > 0 ? r2(expenseTotal / pointsTotal) : 0;
    cfg.totalExpensePoints = r2(pointsTotal); cfg.totalExpenses = r2(expenseTotal);
    if (pointRateState.month === selectedMonth() && pointRateState.status === "ready") {
      cfg.perPoint = Number(pointRateState.data.perPoint) || 0;
      cfg.totalExpensePoints = Number(pointRateState.data.totalUserPoints) || 0;
      cfg.totalExpenses = Number(pointRateState.data.totalExpenses) || 0;
    }
    return cfg;
  }
  function saveCfg(cfg) { return P.write("billConfig", cfg); }

  function renderPointRateState() {
    var sameMonth = pointRateState.month === selectedMonth();
    var ready = sameMonth && pointRateState.status === "ready";
    var noPoints = ready && !pointRateState.data.hasPoints;
    var error = sameMonth && pointRateState.status === "error";
    var rate = $("calculatedPerPoint");
    var points = $("expenseTotalPoints");
    var expenses = $("expenseGrandTotal");
    if (rate) rate.value = ready && !noPoints ? Number(pointRateState.data.perPoint).toFixed(2) : "";
    if (points) {
      points.textContent = ready ? noPoints ? "No eligible points" : num(pointRateState.data.totalUserPoints) : error ? "Unavailable" : "Loading…";
      points.title = noPoints
        ? (pointRateState.data.missingFoodPoints && pointRateState.data.missingFoodPoints.length
          ? "No points could be calculated. Configure food points for: " + pointRateState.data.missingFoodPoints.join(", ")
          : "No billable meal points were found for " + monthLabel(pointRateState.month) + ".")
        : "";
    }
    if (expenses) expenses.textContent = ready ? inr(pointRateState.data.totalExpenses) : error ? "Unavailable" : "Loading…";
  }

  async function refreshServerPointRate(month) {
    var requestId = ++pointRateRequest;
    pointRateState = { month: month, status: "loading", data: null, error: null };
    renderPointRateState();
    try {
      var response = await api.getPointRate(month);
      if (requestId !== pointRateRequest) return false;
      if (!response || response.success !== true || response.month !== month ||
        !Number.isFinite(response.totalUserPoints) || response.totalUserPoints < 0 ||
        !Number.isFinite(response.totalExpenses) || response.totalExpenses < 0 ||
        typeof response.hasPoints !== "boolean" ||
        response.hasPoints !== (response.totalUserPoints > 0) ||
        (response.hasPoints
          ? !Number.isFinite(response.perPoint) || response.perPoint < 0
          : response.perPoint !== null)) {
        throw new Error("The server returned an invalid point-rate response.");
      }

      pointRateState = { month: month, status: "ready", data: response, error: null };
      renderPointRateState();
      if ($("billsBody")) render();
      return true;
    } catch (error) {
      if (requestId === pointRateRequest) {
        pointRateState = { month: month, status: "error", data: null, error: error };
        renderPointRateState();
      }
      throw error;
    }
  }

  function replaceMonthData(key, month, freshItems) {
    var existing = P.read(key, []);
    var retained = (Array.isArray(existing) ? existing : []).filter(function (item) {
      return String(item && item.date || "").slice(0, 7) !== month;
    });
    localStorage.setItem("mma_" + key, JSON.stringify(retained.concat(freshItems)));
  }

  async function refreshBillingMonthSources(month) {
    var requestId = ++billingSourceRequest;
    var responses = await Promise.all([
      api.getAllEntriesForMonth(month),
      api.getMealRecordsForMonth(month)
    ]);
    if (requestId !== billingSourceRequest) return false;

    var entryResponse = responses[0], recordResponse = responses[1];
    if (!entryResponse || !Array.isArray(entryResponse.entries) ||
        !recordResponse || !Array.isArray(recordResponse.records) ||
        !Array.isArray(recordResponse.cancellations)) {
      throw new Error("The selected month's meal entries, records, or cancellations could not be loaded.");
    }

    var entries = entryResponse.entries.map(function (entry) {
      return Object.assign({}, entry, {
        user: entry.user_id || entry.user,
        b: entry.breakfast == null ? Number(entry.b) || 0 : Number(entry.breakfast) || 0,
        l: entry.lunch == null ? Number(entry.l) || 0 : Number(entry.lunch) || 0,
        d: entry.dinner == null ? Number(entry.d) || 0 : Number(entry.dinner) || 0
      });
    });
    var records = recordResponse.records.map(function (record) {
      return Object.assign({}, record, { user: record.user_id || record.user });
    });
    replaceMonthData("messEntryHistory", month, entries);
    replaceMonthData("mealRecords", month, records);
    replaceMonthData("mealCancellations", month, recordResponse.cancellations);
    return true;
  }

  async function prepareBillingMonth(month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new Error("Billing month must use YYYY-MM format.");
    }
    var results = await Promise.all([
      refreshBillingMonthSources(month),
      refreshServerPointRate(month)
    ]);
    if (!results[0] || !results[1]) {
      throw new Error("The selected month's billing data could not be refreshed.");
    }
  }

  async function persistExpenseConfig(cfg, month) {
    pointRateState = { month: month, status: "loading", data: null, error: null };
    renderPointRateState();
    var settingsSaved = false;
    var billsRecalculationFailed = false;
    try {
      var saveResult = await api.saveSettings({ billConfig: cfg });
      // Read the persisted settings back from the backend before calculating
      // the rate. This keeps the calculation tied to Mongo's saved values,
      // not the pre-save browser object.
      var savedSettingsResult = await api.getSettings();
      var savedConfig = savedSettingsResult && savedSettingsResult.settings && savedSettingsResult.settings.billConfig;
      var savedExpenses = savedConfig && savedConfig.expenses;
      if (!saveResult || saveResult.success !== true || !Array.isArray(savedExpenses) ||
        savedExpenses.length !== cfg.expenses.length ||
        !cfg.expenses.every(function(expense, index) {
          var saved = savedExpenses[index];
          return saved && saved.id === expense.id && saved.name === expense.name &&
            Number(saved.amount) === Number(expense.amount);
        })) {
        throw new Error("The server did not confirm the saved expense records.");
      }
      settingsSaved = true;
      localStorage.setItem("mma_billConfig", JSON.stringify(savedConfig));
      if (!await refreshBillingMonthSources(month)) {
        throw new Error("The selected month's meal data could not be refreshed.");
      }
      if (!await refreshServerPointRate(month)) throw new Error("The server point rate could not be refreshed.");
      if (generatedRows(month).length) {
        billsRecalculationFailed = true;
        if (await applyAuto(month, true) === false) throw new Error("Existing bills could not be recalculated.");
        billsRecalculationFailed = false;
      }
      render();
    } catch (error) {
      if (!settingsSaved) {
        try {
          var saved = await api.getSettings();
          var billConfig = saved.settings && saved.settings.billConfig;
          if (billConfig) localStorage.setItem("mma_billConfig", JSON.stringify(billConfig));
        } catch (refreshError) {
          console.error("Unable to reload saved billing settings:", refreshError);
        }
      }
      if (pointRateState.month === month && pointRateState.status === "loading") {
        pointRateState = { month: month, status: "error", data: null, error: error };
        renderPointRateState();
      }
      if (settingsSaved) {
        if (pointRateState.status === "ready") {
          if (billsRecalculationFailed) {
            throw new Error("The expense was saved and the point rate refreshed, but existing bills were not recalculated and remain at their previously saved values. " + error.message);
          }
          throw new Error("The expense was saved and the point rate refreshed, but the billing screen could not be updated. " + error.message);
        }
        throw new Error("The expense was saved, but the selected month's billing data or point rate could not be refreshed. Existing bills were not recalculated. " + error.message);
      }
      throw error;
    }
  }
  function chargeNames(cfg) {
    return { fixed: cfg.charges.fixed.name, water: cfg.charges.water.name, reserve: cfg.charges.reserve.name,
      customCharges: (cfg.customCharges || []).map(function (c) { return { id: c.id, name: c.name, mode: c.mode }; }) };
  }
  function customFieldKey(id) { return "customCharge_" + String(id || "").replace(/[^a-zA-Z0-9_-]/g, "_"); }
  function customChargeDefs(cfg) { return Array.isArray(cfg.customCharges) ? cfg.customCharges : []; }
  function chargeDefinitions(cfg) {
    return CHARGE_IDS.map(function (id) { return { id: id, name: cfg.charges[id].name, amount: cfg.charges[id].amount, mode: cfg.charges[id].mode, field: CHARGE_FIELD[id] }; })
      .concat(customChargeDefs(cfg).map(function (c) { return { id: c.id, name: c.name, amount: c.amount, mode: c.mode, field: customFieldKey(c.id), custom: true }; }));
  }

  /* ---------------------------------------------------------
     data access
     --------------------------------------------------------- */
  function allBills() {
    var b = P.read("adminBills", []);
    return Array.isArray(b) ? b : [];
  }
  function activeBillIds() {
    var ids = Object.create(null);
    activeUsers().forEach(function (user) { ids[uidKey(user.id)] = true; });
    return ids;
  }
  function activeBillsForMonth(list, month) {
    var ids = activeBillIds();
    return list.filter(function (bill) {
      return billMonthOf(bill) === month && !!ids[billUserId(bill)];
    });
  }
  function saveBills(list, month) {
    window.bills = list;
    if (!month) return P.write("adminBills", list);

    // Snapshot validation is intentionally all-or-nothing. Recalculation of
    // one billing month must not submit unrelated, possibly legacy snapshots
    // from other months in the same request.
    var selected = activeBillsForMonth(list, month);
    return api.saveBillSnapshots(selected).then(function (response) {
      var saved = response && Array.isArray(response.bills) ? response.bills : [];
      var savedByKey = {};
      saved.forEach(function (bill) {
        savedByKey[billUserId(bill) + "|" + billMonthOf(bill)] = bill;
      });
      var merged = list.map(function (bill) {
        return savedByKey[billUserId(bill) + "|" + billMonthOf(bill)] || bill;
      });
      window.bills = merged;
      localStorage.setItem("mma_adminBills", JSON.stringify(merged));
      return merged;
    });
  }
  function findBillIndex(list, uid, month) {
    var found = -1;
    list.forEach(function (bill, index) {
      if (billUserId(bill) !== uidKey(uid) || billMonthOf(bill) !== month) return;
      found = found === -1 ? index : -2;
    });
    return found;
  }
  function activeUsers() {
    var list = P.read("users", []);
    list = (Array.isArray(list) ? list : []).filter(function (u) {
      return String(u.status || "active").toLowerCase() === "active" &&
        String(u.role || u.type || "student").toLowerCase() !== "admin";
    });
    return typeof window.sortUsersByRoom === "function" ? window.sortUsersByRoom(list) : list;
  }
  function effMeals(userId, key, entry, short) {
    var fn = window.getEffectiveMeal;
    if (typeof fn !== "function") return Number(entry && entry[short]) || 0;
    return fn(userId, key, entry, short, effMeals._records).value;
  }

  function billingMenuForDate(key) {
    var snapshots = P.read("menuSnapshots", {});
    var snapshot = snapshots && snapshots[key];
    if (key < P.todayKey() && snapshot && typeof snapshot === "object") {
      return { b: snapshot.b || "", l: snapshot.l || "", d: snapshot.d || "" };
    }
    return P.weeklyMenuForDate(key);
  }

  /* ---------------------------------------------------------
     CALCULATION
     --------------------------------------------------------- */
  function splitEqualPaise(totalPaise, n) {
    var out = [];
    if (n <= 0) return out;
    var base = Math.floor(totalPaise / n);
    var rem = totalPaise - base * n;
    for (var i = 0; i < n; i++) out.push(base + (i < rem ? 1 : 0));
    return out;
  }

  /* Returns per-user shares in integer paise. Fixed-cost discounts are derived from
     the joining date on every calculation, so changing the total Fixed Cost or
     active-user count automatically recalculates the proration. */
  function shareCharge(users, month, id, cfg, chargeOverride) {
    var c = chargeOverride || cfg.charges[id];
    var res = {}, n = users.length;
    if (!n) return res;
    var shares = c.mode === "each"
      ? users.map(function () { return toPaise(c.amount); })
      : splitEqualPaise(toPaise(c.amount), n);
    var discounts = users.map(function (u, i) {
      if (id !== "fixed") return 0;
      var d = cfg.discounts[month + "|" + uidKey(u.id)];
      if (!d) return 0;
      var base = shares[i], discount = 0;
      if (d.joiningDate) {
        var jd = new Date(String(d.joiningDate) + "T00:00:00");
        if (!isNaN(jd.getTime()) && String(d.joiningDate).slice(0, 7) === month) {
          var days = new Date(jd.getFullYear(), jd.getMonth() + 1, 0).getDate();
          var remaining = Math.max(0, days - jd.getDate());
          var prorated = Math.round(base * remaining / days);
          discount = base - prorated;
        } else {
          discount = toPaise(d.amount);
        }
      } else {
        // Backward compatibility for discounts created by older project versions.
        discount = toPaise(d.amount);
      }
      return Math.max(0, Math.min(base, discount));
    });
    var received = users.map(function () { return 0; });
    var totalDisc = discounts.reduce(function (a, b) { return a + b; }, 0);
    if (n > 1 && totalDisc > 0) {
      var regularRecipients = users.map(function (_, i) { return i; }).filter(function (i) { return discounts[i] === 0; });
      if (regularRecipients.length) {
        // A resident with a mid-month discount pays the prorated amount; the
        // entire reduction is split equally only among the other full-paying users.
        splitEqualPaise(totalDisc, regularRecipients.length).forEach(function (p, i) { received[regularRecipients[i]] += p; });
      } else {
        // If every user has a discount, share each reduction among everyone else;
        // the total still reconciles to the original Fixed Cost allocation.
        discounts.forEach(function (disc, donorIndex) {
          if (!disc) return;
          var others = [];
          for (var j = 0; j < n; j++) if (j !== donorIndex) others.push(j);
          var split = splitEqualPaise(disc, others.length);
          others.forEach(function (targetIndex, splitIndex) { received[targetIndex] += split[splitIndex]; });
        });
      }
    }
    users.forEach(function (u, i) {
      var key = uidKey(u.id);
      // With one active resident there is nobody else to receive a redistribution;
      // waive no amount in that case so the overall Fixed Cost remains reconciled.
      var ownDiscount = n > 1 ? discounts[i] : 0;
      res[key] = { amount: fromPaise(shares[i] - ownDiscount + received[i]), discount: fromPaise(ownDiscount) };
    });
    return res;
  }

  function userAdjustments(month) { var a = P.read("userBillAdjustments", {}); return a && typeof a === "object" ? a : {}; }
  function adjustmentFor(month, uid) { return userAdjustments(month)[month + "|" + uidKey(uid)] || { fine: 0, discount: 0, fineReason: "", discountReason: "" }; }
  function wireIndividualAdjustments() {
    var room = $("adjRoom"), user = $("adjUser"), save = $("saveUserAdjustment"); if (!room || !user || !save || save.dataset.wired) return;
    save.dataset.wired = "1";
    function refillUsers() { var users = window.MMARoomSort.sortByRoom(activeUsers()); var old=user.value; user.innerHTML='<option value="">Select name</option>'+users.filter(function(u){return !room.value||String(u.room||"")===room.value;}).map(function(u){return '<option value="'+esc(u.id)+'">'+esc(u.name||u.id)+'</option>';}).join(""); if(users.some(function(u){return String(u.id)===old;}))user.value=old; }
    var rooms=window.MMARoomSort.sortRooms([...new Set(activeUsers().map(function(u){return String(u.room||"").trim();}).filter(Boolean))]); room.innerHTML='<option value="">Select room</option>'+rooms.map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('');
    room.addEventListener("change",function(){refillUsers();});
    user.addEventListener("change",function(){var a=adjustmentFor(selectedMonth(),user.value);$("adjFine").value=a.fine||0;$("adjDiscount").value=a.discount||0;$("adjFineReason").value=a.fineReason||"";$("adjDiscountReason").value=a.discountReason||"";});
    save.addEventListener("click",function(){var uid=user.value;if(!uid){UI.toast("Select a room and resident.","error");return;}var fine=Number($("adjFine").value||0),discount=Number($("adjDiscount").value||0);if(!Number.isFinite(fine)||fine<0||!Number.isFinite(discount)||discount<0){UI.toast("Fine and discount must be zero or greater.","error");return;}var all=userAdjustments(selectedMonth());all[selectedMonth()+"|"+uidKey(uid)]={fine:r2(fine),discount:r2(discount),fineReason:($("adjFineReason").value||"").trim(),discountReason:($("adjDiscountReason").value||"").trim(),savedAt:new Date().toISOString()};P.write("userBillAdjustments",all);if(generatedRows(selectedMonth()).length)applyAuto(selectedMonth());render();UI.toast("Fine and discount saved for this month.","success");});
    var month=$("billMonth");if(month)month.addEventListener("change",function(){var a=adjustmentFor(selectedMonth(),user.value);$("adjFine").value=a.fine||0;$("adjDiscount").value=a.discount||0;$("adjFineReason").value=a.fineReason||"";$("adjDiscountReason").value=a.discountReason||"";});
    refillUsers();
  }

  /* Calculated ("base") values for every active user of a month. */
  function computeBase(month) {
    var cfg = getCfg();
    var users = activeUsers();
    effMeals._records = P.read("mealRecords", []);
    var entries = P.read("messEntryHistory", []);
    var shares = {};
    CHARGE_IDS.forEach(function (id) { shares[id] = shareCharge(users, month, id, cfg); });
    customChargeDefs(cfg).forEach(function (c) { shares[c.id] = shareCharge(users, month, c.id, cfg, c); });
    var customDefs = customChargeDefs(cfg);
    var out = users.map(function (u) {
      var k = uidKey(u.id);
      var mp = P.monthPoints(k, month, entries, effMeals, billingMenuForDate);
      var mealRecords = P.read("mealRecords", []);
      var cancellationFinePoints = (Array.isArray(mealRecords) ? mealRecords : []).reduce(function (sum, rec) {
        if (uidKey(rec.user) !== k || String(rec.date || "").slice(0, 7) !== month) return sum;
        var meals = rec.meals || {};
        ["b", "l", "d"].forEach(function (short) {
          var meal = meals[short];
          if (!(typeof window.isMealCancelled === "function" && window.isMealCancelled(rec.date, short)) &&
              meal && meal.optOut && Number(meal.finePoints) > 0) sum += Number(meal.finePoints);
        });
        return sum;
      }, 0);
      mp.total = r2(Number(mp.total || 0) + cancellationFinePoints);
      var pa = r2(mp.total * cfg.perPoint);
      var f = shares.fixed[k].amount, w = shares.water[k].amount, r = shares.reserve[k].amount;
      var extras = customDefs.map(function (c) { return { id: c.id, name: c.name, mode: c.mode, amount: shares[c.id][k].amount }; });
      var extraTotal = extras.reduce(function (sum, c) { return sum + Number(c.amount || 0); }, 0);
      var adj = adjustmentFor(month, u.id), fine = r2(adj.fine || 0), discount = r2(adj.discount || 0);
      return {
        user: u.id, name: u.name || u.id, room: u.room || "", branch: u.branch || "Mount Road",
        accountType: u.type || u.role || "student", individualFine: fine, individualDiscount: discount,
        fineReason: adj.fineReason || "", discountReason: adj.discountReason || "",
        customCharges: extras,
        base: {
          totalPoints: mp.total, pointsAmount: pa, fixedCost: f, waterCharges: w, reservedFund: r,
          customCharges: extras.map(function (c) { return { id: c.id, name: c.name, mode: c.mode, amount: c.amount }; }),
          fine: fine, discount: discount,
          grandTotal: r2(pa + f + w + r + extraTotal + fine - discount)
        },
        fixedDiscount: shares.fixed[k].discount,
        entryDays: mp.days, missing: mp.missing, perPoint: cfg.perPoint
      };
    });
    return out;
  }

  /* Base + manual overrides -> final numbers, including user-defined charges. */
  function resolveValues(base, ov, perPoint) {
    ov = ov || {};
    function pick(f, fallback) { return ov[f] != null && Number.isFinite(Number(ov[f])) ? Number(ov[f]) : fallback; }
    // Admin may correct Total Points in the Excel viewer. Points in Rupees
    // are always derived from the selected monthly expense-based point rate.
    var tp = pick("totalPoints", Number(base.totalPoints));
    if (!Number.isFinite(tp)) tp = 0;
    var pp = pick("perPoint", Number(perPoint || base.perPoint || 0));
    if (!Number.isFinite(pp)) pp = 0;
    var pa = r2(tp * pp);
    var f = pick("fixedCost", base.fixedCost);
    var w = pick("waterCharges", base.waterCharges);
    var r = pick("reservedFund", base.reservedFund);
    var fine = pick("fine", base.fine || 0), discount = pick("discount", base.discount || 0);
    var customBase = Array.isArray(base.customCharges) ? base.customCharges : [];
    var customCharges = customBase.map(function (c) {
      var field = customFieldKey(c.id), amount = pick(field, Number(c.amount) || 0);
      return { id: c.id, name: c.name, mode: c.mode || "split", amount: r2(amount) };
    });
    var out = { totalPoints: r2(tp), perPoint: r2(pp), pointsAmount: r2(pa), fixedCost: r2(f), waterCharges: r2(w), reservedFund: r2(r), fine: r2(fine), discount: r2(discount), customCharges: customCharges };
    var extraTotal = 0;
    customCharges.forEach(function (c) { var field = customFieldKey(c.id); out[field] = c.amount; extraTotal += c.amount; });
    var gt = pick("grandTotal", r2(pa + f + w + r + extraTotal + fine - discount));
    out.grandTotal = r2(gt);
    return out;
  }

  function snapshotNumber(bill, fields, fallback) {
    for (var i = 0; i < fields.length; i++) {
      var value = bill[fields[i]];
      if (value == null || value === "") continue;
      var number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return fallback;
  }

  function savedBillValues(bill, fallbackBase, fallbackPerPoint, customDefs) {
    var base = bill.base && typeof bill.base === "object" ? bill.base : fallbackBase;
    var perPoint = snapshotNumber(bill, ["perPoint", "per_point_rate"], fallbackPerPoint);
    var values = resolveValues(base, bill.overrides || {}, perPoint);
    values.totalPoints = snapshotNumber(bill, ["totalPoints", "total_points"], values.totalPoints);
    values.pointsAmount = snapshotNumber(bill, ["pointsAmount", "mess_charges"], values.pointsAmount);
    values.fixedCost = snapshotNumber(bill, ["fixedCost", "fixed_cost"], values.fixedCost);
    values.waterCharges = snapshotNumber(bill, ["waterCharges", "water_charges"], values.waterCharges);
    values.reservedFund = snapshotNumber(bill, ["reservedFund", "reserved_fund"], values.reservedFund);
    values.fine = snapshotNumber(bill, ["individualFine", "fine"], values.fine);
    values.discount = snapshotNumber(bill, ["individualDiscount", "discount"], values.discount);
    values.grandTotal = snapshotNumber(
      bill,
      ["grandTotal", "finalTotal", "final_total", "amount"],
      values.grandTotal
    );
    values.customCharges = [];
    (customDefs || []).forEach(function (definition) {
      var key = customFieldKey(definition.id);
      var saved = (Array.isArray(bill.customCharges) ? bill.customCharges : []).filter(function (charge) {
        return charge && String(charge.id) === String(definition.id);
      })[0];
      var amount = snapshotNumber(saved || {}, ["amount"], values[key] == null ? 0 : values[key]);
      var charge = {
        id: definition.id,
        name: definition.name,
        mode: definition.mode,
        amount: r2(amount)
      };
      values[key] = charge.amount;
      values.customCharges.push(charge);
    });
    return { base: base, perPoint: perPoint, values: values };
  }

  function applyToBill(bill, calc, ov, names) {
    var v = resolveValues(calc.base, ov, calc.perPoint);
    bill.user = calc.user; bill.user_id = calc.user;
    bill.name = calc.name; bill.room = calc.room; bill.branch = calc.branch;
    bill.accountType = calc.accountType;
    bill.base = calc.base; bill.overrides = ov || {};
    bill.perPoint = calc.perPoint;
    bill.totalPoints = v.totalPoints; bill.pointsAmount = v.pointsAmount;
    bill.fixedCost = v.fixedCost; bill.waterCharges = v.waterCharges; bill.reservedFund = v.reservedFund;
    bill.customCharges = v.customCharges;
    bill.individualFine = v.fine; bill.individualDiscount = v.discount;
    bill.fineReason = calc.fineReason || ""; bill.discountReason = calc.discountReason || "";
    bill.grandTotal = v.grandTotal;
    bill.finalTotal = v.grandTotal; bill.amount = v.grandTotal;
    bill.fixedDiscount = calc.fixedDiscount;
    bill.chargeNames = names;
    bill.entryDays = calc.entryDays; bill.missingPoints = calc.missing;
    bill.calcVersion = 3;
    return bill;
  }

  function sameValues(a, b) {
    var standard = ["totalPoints", "pointsAmount", "fixedCost", "waterCharges", "reservedFund", "fine", "discount", "grandTotal"];
    if (!standard.every(function (f) { return r2(a[f]) === r2(b[f]); })) return false;
    function normCharges(list) { return (Array.isArray(list) ? list : []).map(function (c) { return [String(c.id), String(c.name), r2(c.amount), String(c.mode || "split")]; }); }
    return JSON.stringify(normCharges(a.customCharges)) === JSON.stringify(normCharges(b.customCharges)) &&
      JSON.stringify(a.chargeNames || {}) === JSON.stringify(b.chargeNames || {});
  }

  function archive(bill, reason) {
    var hist = P.read("adminBillHistory", []);
    if (!Array.isArray(hist)) hist = [];
    hist.push(Object.assign({}, bill, { archivedAt: new Date().toISOString(), archivedReason: reason }));
    return P.write("adminBillHistory", hist);
  }

  /* ---------------------------------------------------------
     notifications
     --------------------------------------------------------- */
  function notifyUsers(uids, title, message) {
    var list = P.read("notifHistory", []);
    if (!Array.isArray(list)) list = [];
    var stamp = new Date().toISOString();
    uids.forEach(function (uid) {
      list.unshift({
        id: "NTF-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        t: title, m: message, d: new Date().toLocaleString("en-IN"),
        target: "bill", userId: uid, audience: "user", createdAt: stamp
      });
    });
    P.write("notifHistory", list);
  }

  /* Save manual edits for many users in one go (Excel viewer + Edit button). */
  async function commitOverrides(month, changes, publish) {
    var calcs = computeBase(month);
    var cfg = getCfg(), names = chargeNames(cfg);
    var validCustomFields = {};
    customChargeDefs(cfg).forEach(function (charge) { validCustomFields[customFieldKey(charge.id)] = true; });
    var list = allBills();
    var stamp = new Date().toISOString();
    var changed = 0, created = 0, who = [], archiveWrites = [];
    changes.forEach(function (ch) {
      var c = calcs.filter(function (x) { return uidKey(x.user) === uidKey(ch.uid); })[0];
      if (!c) return;
      var overrides = Object.assign({}, ch.ov || {});
      if (publish) {
        Object.keys(overrides).forEach(function (field) {
          if (field.indexOf("customCharge_") === 0 && !validCustomFields[field]) delete overrides[field];
        });
      }
      var i = findBillIndex(list, ch.uid, month);
      if (i === -2) throw new Error("Duplicate resident bills were found for " + uidKey(ch.uid) + " in " + month + ".");
      if (i < 0) {
        var fresh = applyToBill({}, c, overrides, names);
        fresh.month = month; fresh.status = "pending"; fresh.paidAt = null;
        fresh.generatedAt = stamp; fresh.revision = 1; fresh.generationStatus = "Generated";
        list.push(fresh); created++; who.push(c.user);
        return;
      }
      var old = list[i];
      var next = applyToBill(Object.assign({}, old), isV3(old) ? Object.assign({}, c, { base: c.base }) : c, overrides,
        isV3(old) && !publish && old.chargeNames ? old.chargeNames : names);
      // keep the figures the bill was generated with unless the admin edited that cell
      if (isV3(old) && !publish) {
        var keepBase = old.base || c.base;
        var v = resolveValues(keepBase, overrides, old.perPoint != null ? old.perPoint : c.perPoint);
        next.base = keepBase; next.perPoint = old.perPoint != null ? old.perPoint : c.perPoint;
        next.totalPoints = v.totalPoints; next.pointsAmount = v.pointsAmount; next.fixedCost = v.fixedCost;
        next.waterCharges = v.waterCharges; next.reservedFund = v.reservedFund; next.customCharges = v.customCharges; next.grandTotal = v.grandTotal;
        next.finalTotal = v.grandTotal; next.amount = v.grandTotal;
        next.fixedDiscount = old.fixedDiscount;
        next.individualFine = v.fine; next.individualDiscount = v.discount;
        next.fineReason = c.fineReason || ""; next.discountReason = c.discountReason || "";
      }
      if (!isV3(old)) { ["foodSubtotal", "foodCharges", "quantities", "rates", "fine", "maintenanceFee", "cookingFee", "otherCharge", "discount"].forEach(function (k) { delete next[k]; }); }
      if (isV3(old) && sameValues(old, next) && JSON.stringify(old.overrides || {}) === JSON.stringify(overrides)) return;
      archiveWrites.push(archive(old, isV3(old) ? "Edited by admin" : "Old-format bill replaced"));
      next.month = month; next.revision = Number(old.revision || 1) + 1;
      next.updatedAt = stamp; next.generationStatus = "Edited";
      next.status = old.status || "pending"; next.paidAt = old.paidAt || null;
      list[i] = next; changed++; who.push(c.user);
    });
    if (who.length || publish) {
      var saveOperation = publish ? publish(list, month) : saveBills(list, month);
      var saveResults = await Promise.all([saveOperation].concat(archiveWrites));
      if (Array.isArray(saveResults[0])) list = saveResults[0];
    }
    if (who.length) {
      notifyUsers(who, "Monthly bill updated", "Your bill for " + monthLabel(month) + " was updated by the admin.");
      if (typeof window.mmaAdminNotify === "function") window.mmaAdminNotify("Bills edited", monthLabel(month) + ": " + (changed + created) + " bill(s) saved.", "bills", "billedit-" + month + "-" + Date.now());
    }
    render();
    if (typeof window.renderDashboard === "function") window.renderDashboard();
    return { changed: changed, created: created, bills: list };
  }

  /* ---------------------------------------------------------
     rows shown for a month (stored bills + previews for the rest)
     --------------------------------------------------------- */
  function rowsForMonth(month) {
    var list = allBills();
    var calcs = computeBase(month);
    var cfg = getCfg();
    var customDefs = customChargeDefs(cfg);
    var monthBills = list.filter(function (bill) { return billMonthOf(bill) === month; });
    var matched = Object.create(null);
    var rows = calcs.map(function (c) {
      var i = findBillIndex(list, c.user, month);
      var bill = i >= 0 && isV3(list[i]) ? list[i] : null;
      if (bill) {
        matched[billUserId(bill)] = true;
        var saved = savedBillValues(bill, c.base, cfg.perPoint, customDefs);
        var overrides = Object.assign({}, bill.overrides || {});
        return { uid: c.user, name: bill.name || c.name, room: bill.room || c.room, bill: bill, calc: c,
          v: saved.values, ov: overrides, base: saved.base, perPoint: saved.perPoint };
      }
      return { uid: c.user, name: c.name, room: c.room, bill: null, calc: c,
        v: resolveValues(c.base, {}, cfg.perPoint), ov: {}, base: c.base, perPoint: cfg.perPoint };
    });
    monthBills.forEach(function (bill) {
      var id = billUserId(bill);
      if (matched[id] || !isV3(bill)) return;
      var duplicates = monthBills.filter(function (item) {
        return billUserId(item) === id;
      }).length > 1;
      var saved = savedBillValues(bill, bill.base || {}, cfg.perPoint, customDefs);
      rows.push({
        uid: id,
        name: bill.name || id,
        room: bill.room || "",
        bill: bill,
        calc: { missing: [], fixedDiscount: 0 },
        v: saved.values,
        ov: Object.assign({}, bill.overrides || {}),
        base: saved.base,
        perPoint: saved.perPoint,
        orphan: true,
        duplicate: duplicates
      });
    });
    return window.MMARoomSort.sortByRoom(rows);
  }
  function generatedRows(month) { return rowsForMonth(month).filter(function (r) { return r.bill; }); }

  function billFields(cfg) {
    cfg = cfg || getCfg();
    return ["totalPoints", "pointsAmount", "fixedCost", "waterCharges", "reservedFund"]
      .concat(customChargeDefs(cfg).map(function (c) { return customFieldKey(c.id); }))
      .concat(["fine", "discount", "grandTotal"]);
  }
  function fieldLabel(field, names) {
    names = names || chargeNames(getCfg());
    if (field === "totalPoints") return "Total Points";
    if (field === "pointsAmount") return "Points in Rupees";
    if (field === "fixedCost") return names.fixed || "Fixed Cost";
    if (field === "waterCharges") return names.water || "Water Charges";
    if (field === "reservedFund") return names.reserve || "Reserved Fund";
    if (field === "fine") return "Fine";
    if (field === "discount") return "Discount";
    if (field === "grandTotal") return "Grand Total";
    var custom = (names.customCharges || []).filter(function (c) { return customFieldKey(c.id) === field; })[0];
    return custom ? custom.name : field;
  }
  function headers(month) {
    return ["S.No", "Name", "Room No"].concat(billFields(getCfg()).map(function (f) { return fieldLabel(f, chargeNames(getCfg())); }));
  }

  /* ---------------------------------------------------------
     RENDER the Bills screen
     --------------------------------------------------------- */
  function staleInfo(month) {
    var cfg = getCfg();
    var calcs = computeBase(month), list = allBills(), stale = 0, missingBills = 0;
    calcs.forEach(function (c) {
      var i = findBillIndex(list, c.user, month);
      if (i < 0 || !isV3(list[i])) { missingBills++; return; }
      var b = list[i];
      if (!b.base || Number(b.perPoint) !== Number(cfg.perPoint) || !sameValues(b.base, c.base) ||
        JSON.stringify(b.chargeNames || {}) !== JSON.stringify(chargeNames(cfg))) stale++;
    });
    return { stale: stale, missing: missingBills, total: calcs.length };
  }

  function customChargeRowMarkup(charge) {
    return '<div class="cfg-charge custom-charge-row" data-charge-id="' + esc(charge.id) + '">' +
      '<div class="field"><label>Heading</label><input class="custom-charge-name" type="text" maxlength="60" value="' + esc(charge.name) + '" placeholder="Charge heading"></div>' +
      '<div class="field"><label>Amount (₹)</label><input class="custom-charge-amount" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(charge.amount) + '"></div>' +
      '<div class="field"><label>How to charge</label><select class="custom-charge-mode"><option value="split"' + (charge.mode === "split" ? " selected" : "") + '>Split equally</option><option value="each"' + (charge.mode === "each" ? " selected" : "") + '>Charge each user</option></select></div>' +
      '<button type="button" class="btn-primary small custom-charge-save">Save</button>' +
      '<button type="button" class="btn-secondary small custom-charge-edit">Edit</button>' +
      '<button type="button" class="btn-secondary small custom-charge-delete">Delete</button>' +
      '</div>';
  }

  async function persistCustomChargeConfig(cfg) {
    var response = await api.saveSettings({ billConfig: cfg });
    if (!response || response.success !== true || !response.settings || !response.settings.billConfig ||
        !Array.isArray(response.settings.billConfig.customCharges)) {
      throw new Error("The server did not confirm the saved custom charge configuration.");
    }
    var savedConfig = response.settings.billConfig;
    cfg.customCharges.forEach(function (wanted) {
      var saved = savedConfig.customCharges.filter(function (item) { return item.id === wanted.id; })[0];
      if (!saved || saved.name !== wanted.name || Number(saved.amount) !== Number(wanted.amount) || saved.mode !== wanted.mode) {
        throw new Error("The server did not confirm the custom charge values.");
      }
    });
    localStorage.setItem("mma_billConfig", JSON.stringify(savedConfig));
  }

  function renderCustomCharges(cfg) {
    var host = $("customChargeRows"), add = $("addCustomChargeField");
    if (!host) return;
    var charges = customChargeDefs(cfg).map(function (charge) {
      return customChargeEdits[charge.id] || charge;
    }).concat(customChargeDrafts);
    host.innerHTML = charges.map(customChargeRowMarkup).join("");
    host.querySelectorAll(".custom-charge-row").forEach(function (row) {
      var id = row.getAttribute("data-charge-id");
      function rememberValues() {
        var current = customChargeDrafts.filter(function (charge) { return charge.id === id; })[0];
        if (!current) {
          current = customChargeEdits[id] || { id: id };
          customChargeEdits[id] = current;
        }
        current.name = row.querySelector(".custom-charge-name").value;
        current.amount = row.querySelector(".custom-charge-amount").value;
        current.mode = row.querySelector(".custom-charge-mode").value;
      }
      row.querySelector(".custom-charge-name").addEventListener("input", rememberValues);
      row.querySelector(".custom-charge-amount").addEventListener("input", rememberValues);
      row.querySelector(".custom-charge-mode").addEventListener("change", rememberValues);
      row.querySelector(".custom-charge-save").addEventListener("click", function () {
        var button = this;
        var name = row.querySelector(".custom-charge-name").value.trim();
        var amount = readNumber(row.querySelector(".custom-charge-amount"));
        var mode = row.querySelector(".custom-charge-mode").value === "each" ? "each" : "split";
        if (!name || name.length > 60) { UI.toast("Enter a charge heading of 1 to 60 characters.", "error"); return; }
        if (!Number.isFinite(amount) || amount < 0) { UI.toast("Enter a valid charge amount (0 or more).", "error"); return; }
        UI.run(button, async function () {
          var latest = getCfg();
          var item = latest.customCharges.filter(function (charge) { return charge.id === id; })[0];
          if (item) {
            item.name = name;
            item.amount = r2(amount);
            item.mode = mode;
          } else if (customChargeDrafts.some(function (charge) { return charge.id === id; })) {
            latest.customCharges.push({ id: id, name: name, amount: r2(amount), mode: mode });
          } else {
            throw new Error("This custom charge no longer exists. Refresh the billing settings and try again.");
          }
          await persistCustomChargeConfig(latest);
          customChargeDrafts = customChargeDrafts.filter(function (charge) { return charge.id !== id; });
          delete customChargeEdits[id];
          render();
          return true;
        }, { label: "Saving…", success: "Custom charge saved. Existing bills were not changed or published." });
      });
      row.querySelector(".custom-charge-edit").addEventListener("click", function () {
        var input = row.querySelector(".custom-charge-name");
        input.focus();
        input.select();
      });
      row.querySelector(".custom-charge-delete").addEventListener("click", function () {
        var item = charges.filter(function (charge) { return charge.id === id; })[0];
        if (!item || !confirm('Delete custom charge "' + item.name + '"? This will not change bills already generated.')) return;
        if (customChargeDrafts.some(function (charge) { return charge.id === id; })) {
          customChargeDrafts = customChargeDrafts.filter(function (charge) { return charge.id !== id; });
          delete customChargeEdits[id];
          renderConfig();
          return;
        }
        UI.run(this, async function () {
          var latest = getCfg();
          latest.customCharges = latest.customCharges.filter(function (charge) { return charge.id !== id; });
          await persistCustomChargeConfig(latest);
          delete customChargeEdits[id];
          render();
          return true;
        }, { label: "Deleting…", success: "Custom charge deleted. Existing bills were not changed or published." });
      });
    });
    if (add && !add.dataset.wired) {
      add.dataset.wired = "1";
      add.addEventListener("click", function () {
        var latest = getCfg();
        var ids = latest.customCharges.map(function (charge) { return charge.id; }).concat(customChargeDrafts.map(function (charge) { return charge.id; }));
        var id;
        do {
          id = "cc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
        } while (ids.indexOf(id) >= 0);
        customChargeDrafts.push({ id: id, name: "", amount: 0, mode: "split" });
        renderConfig();
        var input = host.querySelector('[data-charge-id="' + id + '"] .custom-charge-name');
        if (input) input.focus();
      });
    }
  }

  function renderConfig() {
    var cfg = getCfg();
    var pp = $("cfgPerPoint");
    if (pp && document.activeElement !== pp) pp.value = cfg.perPoint || "";
    CHARGE_IDS.forEach(function (id) {
      var n = $("cfgName_" + id), a = $("cfgAmt_" + id), m = $("cfgMode_" + id);
      if (n && document.activeElement !== n) n.value = cfg.charges[id].name;
      if (a && document.activeElement !== a) a.value = cfg.charges[id].amount || "";
      if (m && document.activeElement !== m) m.value = cfg.charges[id].mode;
    });
    var expenseRows = $("expenseRows");
    if (expenseRows) {
      expenseRows.innerHTML = cfg.expenses.map(function(e){return '<div class="cfg-charge expense-row" data-expense-id="'+esc(e.id)+'"><div class="field"><label>Expense name</label><input class="expense-name" maxlength="60" value="'+esc(e.name)+'"></div><div class="field"><label>Amount (₹)</label><input class="expense-amount" type="number" min="0" step="0.01" value="'+esc(e.amount)+'"></div><button type="button" class="btn-primary small expense-save">Save</button><button type="button" class="btn-secondary small expense-edit">Edit</button><button type="button" class="btn-secondary small expense-delete">Delete</button></div>';}).join("");
      expenseRows.querySelectorAll(".expense-row").forEach(function(row){
        var id=row.getAttribute("data-expense-id");
        row.querySelector(".expense-save").addEventListener("click",function(){var button=this,name=row.querySelector(".expense-name").value.trim(),amount=Number(row.querySelector(".expense-amount").value);if(!name||!Number.isFinite(amount)||amount<0){UI.toast("Enter an expense name and a valid amount.","error");return;}var c=getCfg();var item=c.expenses.find(function(x){return x.id===id;});if(!item){UI.toast("This expense is no longer available. Refresh the page and try again.","error");return;}item.name=name;item.amount=r2(amount);UI.run(button,function(){return persistExpenseConfig(c,selectedMonth());},{label:"Saving…",success:"Expense saved and point rate recalculated.",error:function(error){return error.message||"Expense could not be saved.";}});});
        row.querySelector(".expense-edit").addEventListener("click",function(){row.querySelector(".expense-name").focus();row.querySelector(".expense-name").select();});
        row.querySelector(".expense-delete").addEventListener("click",function(){var button=this;if(!confirm("Delete this expense?"))return;var c=getCfg();c.expenses=c.expenses.filter(function(x){return x.id!==id;});UI.run(button,function(){return persistExpenseConfig(c,selectedMonth());},{label:"Deleting…",success:"Expense deleted and point rate recalculated.",error:function(error){return error.message||"Expense could not be deleted.";}});});
      });
    }
    renderPointRateState();
    var addExpense=$("addExpenseField");if(addExpense&&!addExpense.dataset.wired){addExpense.dataset.wired="1";addExpense.addEventListener("click",function(){var button=this,c=getCfg(),month=selectedMonth();c.expenses.push({id:"exp_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),name:"New Expense",amount:0});UI.run(button,async function(){await persistExpenseConfig(c,month);var last=$("expenseRows").lastElementChild;if(last){last.querySelector(".expense-name").focus();last.querySelector(".expense-name").select();}return true;},{label:"Adding…",success:"Expense added.",error:function(error){return error.message||"Expense could not be added.";}});});}
    var countEl=$("activeUserCount");if(countEl)countEl.textContent=usersCountText();
    var users = activeUsers();
    var hint = $("cfgShareHint");
    if (hint) {
      hint.textContent = users.length
        ? chargeDefinitions(cfg).map(function (c) {
          return c.name + ": " + (c.mode === "split" ? inr(c.amount / users.length) + " each (" + inr(c.amount) + " ÷ " + users.length + " users)" : inr(c.amount) + " per user");
        }).join("  •  ")
        : "No active users yet.";
    }
    renderCustomCharges(cfg);
    var sel = $("discUser");
    if (sel) {
      var keep = sel.value;
      sel.innerHTML = '<option value="">Select user</option>' + users.map(function (u) {
        return '<option value="' + esc(u.id) + '">' + esc((u.room ? u.room + " · " : "") + (u.name || u.id)) + "</option>";
      }).join("");
      sel.value = keep;
    }
    var month = selectedMonth();
    var box = $("discList");
    if (box) {
      var rows = Object.keys(cfg.discounts).filter(function (k) { return k.indexOf(month + "|") === 0; });
      box.innerHTML = rows.length ? rows.map(function (k) {
        var uid = k.split("|")[1];
        var u = users.filter(function (x) { return uidKey(x.id) === uid; })[0];
        var d = cfg.discounts[k];
        var calc = discountCalculation(cfg, month, uid, users);
        return '<div class="disc-item"><span><b>' + esc(u ? u.name : uid) + "</b> — " + esc(cfg.charges.fixed.name) + " discount " + inr(calc.discount) +
          " · Fixed Cost after discount " + inr(calc.prorated) + (d.note ? " <small>(" + esc(d.note) + ")</small>" : "") + '</span><button type="button" class="link-btn danger-link" onclick="removeFixedDiscount(' + "'" + esc(uid) + "'" + ')">Remove</button></div>';
      }).join("") : '<div class="admin-empty">No discounts for ' + esc(monthLabel(month)) + ".</div>";
    }
  }

  function renderTable() {
    var month = selectedMonth();
    var body = $("billsBody"), foot = $("billsFoot");
    if (!body) return;
    var rows = rowsForMonth(month), cfg = getCfg(), names = chargeNames(cfg), fields = billFields(cfg);
    var labels = ["S.No", "Name", "Room No"].concat(fields.map(function (f) { return fieldLabel(f, names); }));
    var head = $("billsHead");
    if (head) head.innerHTML = "<tr>" + labels.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "<th>Status</th><th>Action</th></tr>";
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="' + (labels.length + 2) + '" class="admin-empty">No active users found. Create or activate a user first.</td></tr>';
      if (foot) foot.innerHTML = "";
      return;
    }
    var totals = {}; fields.forEach(function (f) { totals[f] = 0; });
    body.innerHTML = rows.map(function (r, i) {
      fields.forEach(function (f) { totals[f] += Number(r.v[f]) || 0; });
      var gen = !!r.bill, edited = gen && Object.keys(r.ov || {}).length;
      function ovMark(f) { return gen && r.ov && r.ov[f] != null ? ' class="ov" title="Manually edited"' : ""; }
      var status = r.orphan
        ? '<span class="status-pill pending" title="' + esc(r.duplicate
          ? "Multiple saved bills share this resident ID and month."
          : "This saved bill ID does not match an active resident account.") + '">' +
          (r.duplicate ? "Duplicate ID" : "Unmatched ID") + " · " +
          (r.bill.status === "paid" ? "Paid" : "Pending") + "</span>"
        : !gen ? '<span class="status-pill nomeals">Not generated</span>'
        : '<span class="status-pill ' + (r.bill.status === "paid" ? "paid" : "pending") + '">' + (r.bill.status === "paid" ? "Paid" : "Pending") + "</span>" + (edited ? ' <small class="edited-tag">edited</small>' : "");
      var action = !gen || r.orphan ? "—"
        : '<button type="button" class="link-btn" onclick="openBillEdit(\'' + esc(r.uid) + '\')">Edit</button>' +
          (r.bill.status !== "paid" ? ' <button type="button" class="link-btn" onclick="markPaidByKey(\'' + esc(r.uid) + '\',\'' + esc(month) + '\')">Mark Paid</button>' : "");
      var cells = fields.map(function (f) {
        var val = f === "totalPoints" ? num(r.v[f]) : inr(r.v[f] || 0);
        if (f === "fixedCost" && r.calc.fixedDiscount > 0) val += '<small>discount ' + inr(r.calc.fixedDiscount) + '</small>';
        if (f === "grandTotal") val = "<strong>" + inr(r.v[f]) + "</strong>";
        return "<td" + ovMark(f) + ">" + val + "</td>";
      }).join("");
      var nameCell = "<strong>" + esc(r.name) + "</strong>" + (r.orphan
        ? '<small>Saved ID: ' + esc(r.uid) + "</small>"
        : "");
      return '<tr class="' + (r.orphan ? "unmatched-bill-row" : gen ? "" : "preview-row") + '"><td>' + (i + 1) + "</td><td>" + nameCell + "</td><td>" + esc(r.room || "-") + "</td>" +
        cells + "<td>" + status + '</td><td class="user-actions">' + action + "</td></tr>";
    }).join("");
    if (foot) foot.innerHTML = '<tr class="entry-total-row"><td colspan="3"><b>Total</b></td>' + fields.map(function (f) {
      var val = f === "totalPoints" ? num(totals[f]) : inr(totals[f] || 0);
      return "<td><b>" + val + "</b></td>";
    }).join("") + '<td colspan="2"></td></tr>';
    var generated = rows.filter(function (r) { return r.bill; }).length;
    var unmatched = rows.filter(function (r) { return r.orphan; }).length;
    var note = $("billTableNote");
    if (note) note.textContent = generated
      ? generated + " saved bill(s) loaded for " + monthLabel(month) + "." +
        (unmatched ? " " + unmatched + " bill(s) have unmatched or duplicate resident IDs and are read-only." : "") +
        " Totals include visible previews and saved bills."
      : "Nothing generated yet for " + monthLabel(month) + ". The rows below are a live preview of the points calculation.";
    var miss = [];
    rows.forEach(function (r) { r.calc.missing.forEach(function (n) { if (miss.indexOf(n) < 0) miss.push(n); }); });
    var w = $("billWarn");
    if (w) { w.style.display = miss.length ? "block" : "none"; w.textContent = miss.length ? "No point set for: " + miss.join(", ") + ". These meals count as 0 points. Set them under Food Menu › Food Points." : ""; }
  }

  function renderStale() {
    var el = $("billStale");
    if (!el) return;
    var s = staleInfo(selectedMonth());
    var msgs = [];
    if (s.total && s.stale) msgs.push(s.stale + " generated bill(s) no longer match the latest mess entries, food points or costs.");
    if (s.total && s.missing && s.missing < s.total) msgs.push(s.missing + " active user(s) have no bill yet.");
    el.style.display = msgs.length ? "block" : "none";
    el.innerHTML = msgs.length ? esc(msgs.join(" ")) : "";
  }

  function discountCalculation(cfg, month, uid, users) {
    var list = users || activeUsers();
    var normal = cfg.charges.fixed.mode === "split"
      ? (list.length ? Number(cfg.charges.fixed.amount || 0) / list.length : 0)
      : Number(cfg.charges.fixed.amount || 0);
    var record = cfg.discounts[month + "|" + uidKey(uid)];
    if (!record) return { normal: normal, prorated: normal, discount: 0, remaining: 0, days: 0 };
    var date = record.joiningDate ? new Date(String(record.joiningDate) + "T00:00:00") : null;
    if (date && !isNaN(date.getTime()) && String(record.joiningDate).slice(0, 7) === month) {
      var days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      var remaining = Math.max(0, days - date.getDate());
      var prorated = r2(normal * remaining / days);
      return { normal: normal, prorated: prorated, discount: r2(normal - prorated), remaining: remaining, days: days };
    }
    var legacyDiscount = Math.min(normal, Math.max(0, Number(record.amount) || 0));
    return { normal: normal, prorated: r2(normal - legacyDiscount), discount: legacyDiscount, remaining: 0, days: 0 };
  }

  function wireDiscountPreview() {
    var date = $("discJoinDate"), user = $("discUser"), amount = $("discAmount"), preview = $("discPreview");
    if (!date || date.dataset.wired) return;
    date.dataset.wired = "1";
    function update() {
      var d = date.value, month = selectedMonth(), uid = user ? user.value : "", cfg = getCfg();
      if (!d || d.slice(0, 7) !== month || !uid) {
        if (amount) amount.value = "";
        if (preview) preview.textContent = "Choose a user and a joining date in the selected billing month.";
        return;
      }
      var dt = new Date(d + "T00:00:00");
      if (isNaN(dt.getTime())) { if (amount) amount.value = ""; return; }
      var days = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
      var remaining = Math.max(0, days - dt.getDate());
      var users = activeUsers();
      var normal = cfg.charges.fixed.mode === "split" && users.length ? cfg.charges.fixed.amount / users.length : cfg.charges.fixed.amount;
      var prorated = r2(normal * remaining / days), discount = r2(normal - prorated);
      if (amount) amount.value = discount.toFixed(2);
      if (preview) preview.textContent = "Fixed Cost share: " + inr(normal) + " · Remaining days: " + remaining + "/" + days + " · New user's prorated Fixed Cost: " + inr(prorated) + " · Discount redistributed equally to other users: " + inr(discount);
    }
    date.addEventListener("input", update); date.addEventListener("change", update);
    if (user) user.addEventListener("change", update);
    var m = $("billMonth"); if (m) m.addEventListener("change", update);
    update();
  }

  function render() {
    wireDiscountPreview();
    wireIndividualAdjustments();
    if (!$("billsBody")) return;
    var m = $("billMonth");
    if (m && !m.value) m.value = currentMonthKey();
    renderConfig();
    renderTable();
    renderStale();
  }

  /* ---------------------------------------------------------
     CONFIG ACTIONS
     --------------------------------------------------------- */
  function clearFixedCostOverrides(month) {
    var list = allBills(), changed = false;
    list.forEach(function (bill) {
      if (!isV3(bill) || billMonthOf(bill) !== month) return;
      if (!bill.overrides) bill.overrides = {};
      // A manually overridden Fixed Cost or Grand Total must not freeze the old
      // calculation after a join-date discount or Fixed Cost configuration change.
      if (bill.overrides.fixedCost != null) { delete bill.overrides.fixedCost; changed = true; }
      if (bill.overrides.grandTotal != null) { delete bill.overrides.grandTotal; changed = true; }
    });
    if (changed) saveBills(list, month);
  }
  function clearGrandTotalOverrides(month) {
    var list = allBills(), changed = false;
    list.forEach(function (bill) {
      if (!isV3(bill) || billMonthOf(bill) !== month || !bill.overrides || bill.overrides.grandTotal == null) return;
      delete bill.overrides.grandTotal; changed = true;
    });
    if (changed) saveBills(list, month);
  }
  function afterConfigChange() { clearGrandTotalOverrides(selectedMonth()); refreshAutoBills(); render(); }
  function refreshAutoBills(){ var m=selectedMonth(); if(generatedRows(m).length) return applyAuto(m); return Promise.resolve(true); }
  function usersCountText(){ return activeUsers().length + " users"; }

  function savePerPoint(btn) {
    return UI.run(btn, function () {
      var v = readNumber($("cfgPerPoint"));
      if (!Number.isFinite(v) || v < 0) { UI.toast("Enter a valid Per Point amount (0 or more).", "error"); return false; }
      var cfg = getCfg(); cfg.perPoint = r2(v); saveCfg(cfg); afterConfigChange();
    }, { label: "Saving…", success: "Per Point saved." });
  }

  function saveCharge(id, btn) {
    return UI.run(btn, function () {
      var name = ($("cfgName_" + id).value || "").trim();
      var amt = readNumber($("cfgAmt_" + id));
      if (!name) { UI.toast("Enter a heading name.", "error"); return false; }
      if (!Number.isFinite(amt) || amt < 0) { UI.toast("Enter a valid amount (0 or more).", "error"); return false; }
      var cfg = getCfg();
      cfg.charges[id] = { name: name.slice(0, 40), amount: r2(amt), mode: $("cfgMode_" + id).value === "each" ? "each" : "split" };
      saveCfg(cfg);
      if (id === "fixed") clearFixedCostOverrides(selectedMonth());
      afterConfigChange();
    }, { label: "Saving…", success: "Saved." });
  }

  function saveFixedDiscount(btn) {
    return UI.run(btn, function () {
      var uid = $("discUser").value, month = selectedMonth();
      var joinDate = $("discJoinDate") ? $("discJoinDate").value : "";
      var cfg = getCfg();
      if (!uid) { UI.toast("Select the user who gets the discount.", "error"); return false; }
      if (!joinDate) { UI.toast("Select the user's joining date.", "error"); return false; }
      var jd = new Date(joinDate + "T00:00:00");
      if (isNaN(jd.getTime()) || joinDate.slice(0, 7) !== month) { UI.toast("Joining date must be inside the selected billing month.", "error"); return false; }
      var users = activeUsers();
      if (!users.some(function (u) { return uidKey(u.id) === uidKey(uid); })) { UI.toast("The selected user is not active.", "error"); return false; }
      var daysInMonth = new Date(jd.getFullYear(), jd.getMonth() + 1, 0).getDate();
      var remainingDays = Math.max(0, daysInMonth - jd.getDate());
      var normal = cfg.charges.fixed.mode === "split" && users.length ? cfg.charges.fixed.amount / users.length : cfg.charges.fixed.amount;
      var prorated = r2(normal * remainingDays / daysInMonth);
      var amt = r2(normal - prorated);
      $("discAmount").value = amt.toFixed(2);
      if (!Number.isFinite(amt) || amt <= 0) { UI.toast("This joining date produces no discount.", "error"); return false; }
      if (users.length < 2) { UI.toast("At least two active users are required to redistribute this discount equally.", "error"); return false; }
      cfg.discounts[month + "|" + uidKey(uid)] = {
        amount: amt, joiningDate: joinDate, proratedFixedCost: prorated,
        remainingDays: remainingDays, daysInMonth: daysInMonth,
        note: ($("discNote").value || "").trim().slice(0, 120), savedAt: new Date().toISOString()
      };
      saveCfg(cfg);
      clearFixedCostOverrides(month);
      $("discAmount").value = ""; $("discJoinDate").value = ""; $("discNote").value = "";
      if (generatedRows(month).length) applyAuto(month);
      afterConfigChange();
    }, { label: "Saving…", success: "Discount saved. The selected user's Fixed Cost is prorated and the discount is split equally among the other active users." });
  }

  /* A date-based discount or Fixed Cost change recalculates all affected saved bills. */
  async function applyAuto(month, propagateFailure) {
    var list = allBills();
    var existing = generatedRows(month).filter(function (row) { return isV3(row.bill); });
    if (!existing.length) return true;
    var userIds = existing.map(function (row) { return billUserId(row.bill); });
    var response;
    try {
      response = await api.recalculateBillSnapshots(month, userIds);
      if (!response || response.success !== true || response.month !== month ||
          response.saved !== userIds.length || !Array.isArray(response.bills) ||
          response.bills.length !== userIds.length) {
        throw new Error(response && response.message || "The server did not confirm recalculation of every existing bill.");
      }
      var savedByKey = Object.create(null);
      response.bills.forEach(function (bill) {
        savedByKey[billUserId(bill) + "|" + billMonthOf(bill)] = bill;
      });
      var who = [], archiveWrites = [];
      var merged = list.map(function (old) {
        var key = billUserId(old) + "|" + billMonthOf(old);
        var next = savedByKey[key];
        if (!next) return old;
        if (!sameValues(old, next)) {
          archiveWrites.push(archive(old, "Recalculated after billing configuration change"));
          who.push(billUserId(next));
        }
        return next;
      });
      window.bills = merged;
      localStorage.setItem("mma_adminBills", JSON.stringify(merged));
    } catch (error) {
      console.error("Unable to persist recalculated bills:", error);
      if (propagateFailure) throw error;
      UI.toast(error.message || "Recalculated bills could not be saved.", "error");
      return false;
    }
    try {
      await Promise.all(archiveWrites);
    } catch (error) {
      console.error("Recalculated bills were saved, but prior bill versions could not be archived:", error);
      UI.toast("Bills were recalculated, but their previous versions could not be archived.", "error");
    }
    if (who.length) notifyUsers(who, "Monthly bill updated", "Your bill for " + monthLabel(month) + " was updated.");
    return true;
  }
  function removeFixedDiscount(uid) {
    var cfg = getCfg(), month = selectedMonth();
    delete cfg.discounts[month + "|" + uidKey(uid)];
    saveCfg(cfg); clearFixedCostOverrides(month);
    if (generatedRows(month).length) applyAuto(month);
    render();
    UI.toast("Discount removed and the bill calculation updated.", "success");
  }

  /* ---------------------------------------------------------
     EXCEL-STYLE VIEWER / EDITOR
     --------------------------------------------------------- */
  var XL = null;   // {month, rows:[{uid,name,room,hasBill,base,ov,perPoint,calc}], dirty:boolean}
  var CORE_XL_FIELDS = ["totalPoints", "pointsAmount", "fixedCost", "waterCharges", "reservedFund", "fine", "discount", "grandTotal"];
  function xlFields(names) {
    names = names || chargeNames(getCfg());
    return ["totalPoints", "pointsAmount", "fixedCost", "waterCharges", "reservedFund"]
      .concat((names.customCharges || []).map(function (c) { return customFieldKey(c.id); }))
      .concat(["fine", "discount", "grandTotal"]);
  }
  function excelColumn(index) {
    var n = index + 1, out = "";
    while (n > 0) { var rem = (n - 1) % 26; out = String.fromCharCode(65 + rem) + out; n = Math.floor((n - 1) / 26); }
    return out;
  }

  function xlModal() {
    var m = $("excelModal");
    if (m) return m;
    m = document.createElement("div");
    m.id = "excelModal";
    m.className = "modal-bg";
    m.innerHTML =
      '<div class="modal xl-modal" role="dialog" aria-modal="true" aria-labelledby="xlTitle">' +
      '<div class="xl-head"><div><h3 id="xlTitle">Bills</h3><div class="xl-sub" id="xlSub"></div></div>' +
      '<div class="xl-actions">' +
      '' +
      '<button type="button" class="btn-secondary small" id="xlReset">Reset my edits</button>' +
      '<button type="button" class="btn-secondary small" id="xlCancel">Close</button>' +
      '<button type="button" class="btn-secondary small" id="xlSave">Save</button>' +
      '<button type="button" class="btn-primary small" id="xlGenerate">Generate</button></div></div>' +
      '<div class="xl-tip">Click a white cell to edit. Totals update as you type. Name and Room are read-only. Orange cells are edited by hand.</div>' +
      '<div class="xl-scroll"><table class="xl-grid" id="xlGrid"></table></div></div>';
    document.body.appendChild(m);
    m.querySelector("#xlCancel").addEventListener("click", closeExcel);
    m.querySelector("#xlSave").addEventListener("click", function () { saveExcel(this); });
    m.querySelector("#xlGenerate").addEventListener("click", function () { generateExcel(this); });
    m.querySelector("#xlReset").addEventListener("click", resetExcelEdits);
    m.addEventListener("mousedown", function (e) { if (e.target === m) closeExcel(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && m.classList.contains("open")) closeExcel(); });
    return m;
  }

  function openExcel(btn) {
    UI.run(btn, async function () {
      var month = selectedMonth();
      await prepareBillingMonth(month);
      var responses = await Promise.all([api.getBills(month), api.getBillDrafts(month)]);
      if (!responses[0] || !Array.isArray(responses[0].bills)) {
        throw new Error("The month's bills could not be loaded from the server.");
      }
      if (!responses[1] || responses[1].success !== true || responses[1].month !== month ||
          !Array.isArray(responses[1].drafts)) {
        throw new Error("Saved Excel drafts could not be loaded from the server.");
      }
      var currentBills = allBills().filter(function (bill) { return billMonthOf(bill) !== month; });
      var monthBills = responses[0].bills.map(function (bill) {
        return Object.assign({}, bill, {
          user: bill.user || bill.user_id,
          month: bill.month || bill.billingMonth || bill.billing_month,
          billingMonth: bill.billingMonth || bill.billing_month || bill.month
        });
      });
      var loadedBills = currentBills.concat(monthBills);
      window.bills = loadedBills;
      localStorage.setItem("mma_adminBills", JSON.stringify(loadedBills));
      var monthRows = rowsForMonth(month);
      var unmatchedCount = monthRows.filter(function (row) { return row.orphan; }).length;
      var rows = monthRows.filter(function (row) { return !row.orphan; });
      if (!rows.length) { UI.toast("No active users to show.", "error"); return false; }
      var monthDraft = {};
      responses[1].drafts.forEach(function (draft) {
        if (draft && draft.user_id && draft.overrides && typeof draft.overrides === "object") {
          monthDraft[uidKey(draft.user_id)] = draft.overrides;
        }
      });
      XL = { month: month, dirty: false, perPoint: getCfg().perPoint,
        unmatchedCount: unmatchedCount,
        rows: rows.map(function (r) {
          var draft = monthDraft[uidKey(r.uid)];
          return { uid: r.uid, name: r.name, room: r.room, hasBill: !!r.bill, base: r.base,
            ov: Object.assign({}, r.ov || {}, draft && typeof draft === "object" ? draft : {}),
            perPoint: r.perPoint, calc: r.calc, names: chargeNames(getCfg()) };
        }) };
      XL.fixedCostPoolPaise = XL.rows.reduce(function (sum, r) { return sum + toPaise(xlValue(r).fixedCost); }, 0);
      buildExcelGrid();
      xlModal().classList.add("open");
      document.body.classList.add("modal-open");
    }, { label: "Opening…", minMs: 200 });
  }

  function xlValue(row) { return resolveValues(row.base, row.ov, row.perPoint); }

  function buildExcelGrid() {
    var m = xlModal(), grid = m.querySelector("#xlGrid"), names = XL.rows[0].names;
    var fields = xlFields(names);
    var heads = ["S.No", "Name", "Room"].concat(fields.map(function (f) { return fieldLabel(f, names); }));
    var generated = XL.rows.filter(function (r) { return r.hasBill; }).length;
    var unmatchedNote = XL.unmatchedCount
      ? " " + XL.unmatchedCount + " bill(s) with unmatched or duplicate resident IDs remain read-only on the main table."
      : "";
    m.querySelector("#xlTitle").textContent = "Bills — " + monthLabel(XL.month);
    m.querySelector("#xlSub").textContent = generated
      ? generated + " of " + XL.rows.length + " bills published. Save stores the draft in the database; Generate publishes it to resident bills." + unmatchedNote
      : "Bills are not generated yet. Save stores the draft in the database; Generate publishes it to resident bills." + unmatchedNote;
    m.querySelector("#xlSave").textContent = "Save";
    var html = '<thead><tr class="xl-letters"><th class="xl-corner"></th>' + heads.map(function (_, i) { return "<th>" + excelColumn(i) + "</th>"; }).join("") + "</tr>" +
      '<tr class="xl-names"><th class="xl-rn">1</th>' + heads.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>";
    XL.rows.forEach(function (r, i) {
      var v = xlValue(r);
      function cell(field) {
        if (field === "pointsAmount") {
          return '<td class="xl-ro xl-derived" data-derived="' + i + ':' + field + '" title="Automatically calculated: Total Points × 1 Point rate">' + esc(inr(v[field])) + '</td>';
        }
        return '<td class="xl-edit' + (r.ov[field] != null ? " xl-ov" : "") + '"><input type="number" min="0" step="any" inputmode="decimal" data-i="' + i + '" data-f="' + field + '" value="' + esc(v[field] == null ? 0 : v[field]) + '" aria-label="' + esc(r.name + " " + fieldLabel(field, names)) + '"></td>';
      }
      html += '<tr><th class="xl-rn">' + (i + 2) + '</th><td class="xl-ro">' + (i + 1) + '</td><td class="xl-ro xl-name">' + esc(r.name) + '</td><td class="xl-ro">' + esc(r.room || "-") + "</td>" +
        fields.map(cell).join("") + "</tr>";
    });
    html += '</tbody><tfoot><tr class="xl-total"><th class="xl-rn">' + (XL.rows.length + 2) + '</th><td colspan="3"><b>Total</b></td>' +
      fields.map(function (f) { return '<td data-total="' + f + '"></td>'; }).join("") + "</tr></tfoot>";
    grid.innerHTML = html;
    grid.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", function () { onXlInput(inp); });
      inp.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        var next = grid.querySelector('input[data-i="' + (Number(inp.dataset.i) + (e.shiftKey ? -1 : 1)) + '"][data-f="' + inp.dataset.f + '"]');
        if (next) { next.focus(); next.select(); }
      });
      inp.addEventListener("focus", function () { inp.select(); });
    });
    refreshXlTotals();
  }

  function redistributeFixedCostInExcel(targetIndex, targetAmount) {
    if (!XL) return false;
    var targetPaise = toPaise(targetAmount), pool = XL.fixedCostPoolPaise;
    if (targetPaise > pool) return false;
    if (XL.rows.length < 2) { XL.rows[targetIndex].ov.fixedCost = fromPaise(targetPaise); return true; }
    var others = XL.rows.map(function (_, i) { return i; }).filter(function (i) { return i !== targetIndex; });
    var split = splitEqualPaise(pool - targetPaise, others.length);
    // Grand Total is derived from Fixed Cost. Clear a prior manual total override
    // so it cannot mask this change or leave the Excel totals inconsistent.
    XL.rows.forEach(function (row) { delete row.ov.grandTotal; });
    XL.rows[targetIndex].ov.fixedCost = fromPaise(targetPaise);
    others.forEach(function (rowIndex, i) {
      XL.rows[rowIndex].ov.fixedCost = fromPaise(split[i]);
      var otherInput = $("xlGrid").querySelector('input[data-i="' + rowIndex + '"][data-f="fixedCost"]');
      if (otherInput) {
        otherInput.value = fromPaise(split[i]).toFixed(2);
        otherInput.parentNode.classList.add("xl-ov");
        otherInput.classList.remove("xl-bad");
      }
    });
    return true;
  }

  function onXlInput(inp) {
    var rowIndex = Number(inp.dataset.i), row = XL.rows[rowIndex], f = inp.dataset.f;
    var raw = inp.value.trim(), v = Number(raw);
    if (raw === "" || !Number.isFinite(v) || v < 0) { inp.classList.add("xl-bad"); return; }
    if (f === "fixedCost") {
      if (!redistributeFixedCostInExcel(rowIndex, v)) {
        inp.classList.add("xl-bad");
        UI.toast("The edited Fixed Cost cannot exceed the current total Fixed Cost pool.", "error");
        return;
      }
    } else if (f === "totalPoints") {
      row.ov.totalPoints = r2(v);
      delete row.ov.pointsAmount;
      delete row.ov.grandTotal;
    } else if (f === "pointsAmount") {
      // This column is derived from Total Points and the monthly point rate.
      inp.value = inr(xlValue(row).pointsAmount);
      return;
    } else {
      row.ov[f] = r2(v);
    }
    inp.classList.remove("xl-bad"); XL.dirty = true; inp.parentNode.classList.add("xl-ov");
    XL.rows.forEach(function (r, i) {
      var vals = xlValue(r), fields = xlFields(r.names);
      var pointsAmount = $("xlGrid").querySelector('[data-derived="' + i + ':pointsAmount"]');
      if (pointsAmount) pointsAmount.textContent = inr(vals.pointsAmount);
      fields.forEach(function (k) {
        var other = $("xlGrid").querySelector('input[data-i="' + i + '"][data-f="' + k + '"]');
        if (other && other !== inp) other.value = vals[k];
      });
    });
    refreshXlTotals();
  }

  function refreshXlTotals() {
    if (!XL || !XL.rows.length) return;
    var fields = xlFields(XL.rows[0].names), t = {};
    fields.forEach(function (f) { t[f] = 0; });
    XL.rows.forEach(function (r) { var v = xlValue(r); fields.forEach(function (f) { t[f] += Number(v[f]) || 0; }); });
    fields.forEach(function (f) {
      var c = $("xlGrid").querySelector('[data-total="' + f + '"]');
      if (c) c.innerHTML = "<b>" + esc(f === "totalPoints" ? num(t[f]) : inr(t[f])) + "</b>";
    });
  }

  function resetExcelEdits() {
    if (!XL) return;
    if (!confirm("Remove ALL manual edits in this view and go back to the calculated values? (Nothing is saved until you click Save.)")) return;
    XL.rows.forEach(function (r) { r.ov = {}; });
    XL.dirty = true;
    buildExcelGrid();
  }

  function closeExcel() {
    if (XL && XL.dirty && !confirm("You have unsaved changes. Close without saving?")) return;
    var m = $("excelModal");
    if (m) m.classList.remove("open");
    document.body.classList.remove("modal-open");
    XL = null;
  }

  function saveExcel(btn) {
    if (!XL) return;
    if ($("xlGrid").querySelector(".xl-bad")) { UI.toast("Fix the highlighted cells first (numbers 0 or more).", "error"); return; }
    UI.run(btn, async function () {
      await saveExcelDraft();
      XL.dirty = false;
      return true;
    }, { label: "Saving…", success: "Draft saved to the database. Resident bills have not been published." });
  }

  async function saveExcelDraft() {
    var month = XL.month;
    var drafts = XL.rows.map(function (row) {
      return { user_id: uidKey(row.uid), overrides: Object.assign({}, row.ov || {}) };
    });
    var response = await api.saveBillDrafts(month, drafts);
    if (!response || response.success !== true || response.month !== month ||
        response.saved !== drafts.length || !Array.isArray(response.drafts)) {
      throw new Error(response && response.message || "The bill edits could not be saved to the database.");
    }
  }

  function generationRequests(monthBills, month) {
    return monthBills.map(function (bill) {
      return {
        user_id: billUserId(bill),
        month: month,
        overrides: Object.assign({}, bill.overrides || {})
      };
    });
  }

  function generateExcel(btn) {
    if (!XL) return;
    if ($("xlGrid").querySelector(".xl-bad")) { UI.toast("Fix the highlighted cells first (numbers 0 or more).", "error"); return; }
    UI.run(btn, async function () {
      var month = XL.month;
      await prepareBillingMonth(month);
      var names = chargeNames(getCfg());
      var calcsByUser = Object.create(null);
      computeBase(month).forEach(function (calc) {
        calcsByUser[uidKey(calc.user)] = calc;
      });
      XL.rows.forEach(function (row) {
        var calc = calcsByUser[uidKey(row.uid)];
        if (!calc) throw new Error("A selected bill no longer matches an active student.");
        row.base = calc.base;
        row.perPoint = calc.perPoint;
        row.calc = calc;
        row.names = names;
      });
      XL.fixedCostPoolPaise = XL.rows.reduce(function (sum, row) {
        return sum + toPaise(xlValue(row).fixedCost);
      }, 0);
      buildExcelGrid();
      await saveExcelDraft();
      XL.dirty = false;
      var changes = XL.rows.map(function (row) { return { uid: row.uid, ov: row.ov }; });
      var result = await commitOverrides(month, changes, async function (list) {
        var monthBills = activeBillsForMonth(list, month);
        var seen = {};
        monthBills.forEach(function (bill) {
          var key = billUserId(bill) + "|" + month;
          if (seen[key]) throw new Error("Duplicate resident bills were found for this month. Resolve them before generating.");
          seen[key] = true;
        });
        var billRequests = generationRequests(monthBills, month);
        var response = await api.generateBills(month, billRequests);
        if (!response || response.success !== true || !Array.isArray(response.bills) ||
            response.saved !== monthBills.length || response.bills.length !== monthBills.length) {
          throw new Error(response && response.message || "Bills could not be generated for this month.");
        }
        var savedByKey = {};
        response.bills.forEach(function (bill) {
          savedByKey[billUserId(bill) + "|" + billMonthOf(bill)] = bill;
        });
        var merged = list.map(function (bill) {
          return savedByKey[billUserId(bill) + "|" + billMonthOf(bill)] || bill;
        });
        window.bills = merged;
        localStorage.setItem("mma_adminBills", JSON.stringify(merged));
        return merged;
      });
      XL.rows.forEach(function (row) { row.hasBill = true; });
      XL.dirty = false;
      buildExcelGrid();
      return result;
    }, { label: "Generating…", success: function (result) {
      return result.created
        ? result.created + " resident bill(s) generated and published; " + result.changed + " existing bill(s) updated."
        : result.changed
          ? result.changed + " resident bill(s) updated and published."
          : "Saved bill values generated. Existing resident bills were not duplicated.";
    } });
  }

  /* ---------------------------------------------------------
     EDIT ONE BILL (modal)
     --------------------------------------------------------- */
  var EDIT = null;
  function editModal() {
    var m = $("billEditModal");
    if (m) return m;
    m = document.createElement("div");
    m.id = "billEditModal";
    m.className = "modal-bg";
    m.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><h3 id="beTitle">Edit Bill</h3><div class="xl-tip" id="beSub"></div>' +
      '<div id="beFields"></div><div class="row"><button type="button" class="cancel" id="beCancel">Cancel</button><button type="button" class="confirm add" id="beSave">Save Bill</button></div>' +
      '<button type="button" class="link-btn" id="beReset" style="margin-top:10px">Reset to calculated values</button></div>';
    document.body.appendChild(m);
    m.querySelector("#beCancel").addEventListener("click", function () { m.classList.remove("open"); EDIT = null; });
    m.addEventListener("mousedown", function (e) { if (e.target === m) { m.classList.remove("open"); EDIT = null; } });
    m.querySelector("#beReset").addEventListener("click", function () { if (EDIT) { EDIT.ov = {}; buildEditFields(); } });
    m.querySelector("#beSave").addEventListener("click", function () {
      var btn = this;
      if (!EDIT) return;
      if (m.querySelector(".xl-bad")) { UI.toast("Enter numbers (0 or more) in every field.", "error"); return; }
      UI.run(btn, async function () {
        var res = await commitOverrides(EDIT.month, [{ uid: EDIT.uid, ov: EDIT.ov }]);
        m.classList.remove("open"); EDIT = null; return res;
      }, { label: "Saving…", success: function (r) { return r.changed ? "Bill saved. Admin, User, PDF and Print are updated." : "No changes to save."; } });
    });
    return m;
  }
  function buildEditFields() {
    var v = EDIT.values || resolveValues(EDIT.base, EDIT.ov, EDIT.perPoint), n = EDIT.names;
    var fields = xlFields(n);
    $("beFields").innerHTML = fields.map(function (f) {
      if (f === "totalPoints") {
        return '<div class="field"><label>' + esc(fieldLabel(f, n)) + '</label><input type="number" readonly aria-readonly="true" value="' + esc(num(v[f])) + '"></div>';
      }
      return '<div class="field"><label>' + esc(fieldLabel(f, n) + " (₹)") + '</label><input type="number" min="0" step="any" inputmode="decimal" data-f="' + f + '" value="' + esc(v[f] == null ? 0 : v[f]) + '"' + (EDIT.ov[f] != null ? ' class="be-ov"' : "") + "></div>";
    }).join("");
    $("beFields").querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var raw = inp.value.trim(), x = Number(raw);
        if (raw === "" || !Number.isFinite(x) || x < 0) { inp.classList.add("xl-bad"); return; }
        inp.classList.remove("xl-bad"); inp.classList.add("be-ov");
        if (inp.dataset.f !== "grandTotal") delete EDIT.ov.grandTotal;
        EDIT.ov[inp.dataset.f] = r2(x);
        var nv = resolveValues(EDIT.base, EDIT.ov, EDIT.perPoint);
        EDIT.values = nv;
        $("beFields").querySelectorAll("input").forEach(function (o) { if (o !== inp && !o.matches(":focus")) o.value = nv[o.dataset.f]; });
      });
    });
  }

  function openBillEdit(uid) {
    var month = selectedMonth();
    var row = rowsForMonth(month).filter(function (r) { return uidKey(r.uid) === uidKey(uid) && r.bill && !r.orphan; })[0];
    if (!row) { UI.toast("Generate the bill first, then edit it.", "info"); return; }
    EDIT = { uid: row.uid, month: month, base: row.base, ov: Object.assign({}, row.ov), perPoint: row.perPoint,
      values: Object.assign({}, row.v), names: row.bill.chargeNames || chargeNames(getCfg()) };
    var m = editModal();
    m.querySelector("#beTitle").textContent = "Edit Bill — " + row.name;
    m.querySelector("#beSub").textContent = monthLabel(month) + " · Room " + (row.room || "-") + ". Editing one value updates the Grand Total unless you edit the Grand Total itself.";
    buildEditFields();
    m.classList.add("open");
  }

  /* ---------------------------------------------------------
     EXPORT: CSV (inside the Excel viewer), PDF, PRINT
     --------------------------------------------------------- */
  function tableData(month, source) {
    var names, rows, fields;
    if (source && source.rows) {
      names = source.rows[0].names;
      rows = window.MMARoomSort.sortByRoom(source.rows.map(function (r) { return { name: r.name, room: r.room, v: xlValue(r) }; }));
      fields = xlFields(names);
    } else {
      names = chargeNames(getCfg());
      fields = xlFields(names);
      rows = window.MMARoomSort.sortByRoom(generatedRows(month).map(function (r) { return { name: r.name, room: r.room, v: r.v }; }));
    }
    var labels = ["S.No", "Name", "Room No"].concat(fields.map(function (f) { return fieldLabel(f, names); }));
    var totals = {}; fields.forEach(function (f) { totals[f] = 0; });
    var body = rows.map(function (r, i) {
      fields.forEach(function (f) { totals[f] += Number(r.v[f]) || 0; });
      return [String(i + 1), r.name, r.room || "-"].concat(fields.map(function (f) { return f === "totalPoints" ? num(r.v[f]) : money(r.v[f] || 0); }));
    });
    var total = ["", "Total", ""].concat(fields.map(function (f) { return f === "totalPoints" ? num(totals[f]) : money(totals[f] || 0); }));
    return { headers: labels, rows: body, total: total, raw: rows, fields: fields, names: names };
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function downloadCsv(month, source) {
    var d = tableData(month, source);
    function q(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
    var lines = [d.headers.map(q).join(",")];
    d.rows.forEach(function (row) { lines.push(row.map(q).join(",")); });
    lines.push(d.total.map(q).join(","));
    downloadBlob(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "MMA-Bills-" + month + ".csv");
    UI.toast("CSV downloaded. It opens in Excel.", "success");
  }

  /* ---- PDF (hand-written, no library) ---- */
  var HELV = { " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191, "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
    ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556, "@": 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667,
    Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278,
    g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, "{": 334, "|": 260, "}": 334, "~": 584 };
  function pdfSafe(s) { return String(s == null ? "" : s).replace(/₹/g, "Rs.").replace(/[^\x20-\x7E]/g, "?"); }
  function textW(s, size, bold) {
    var w = 0;
    for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); w += /[0-9]/.test(ch) ? 556 : (HELV[ch] || 556); }
    return (w / 1000) * size * (bold ? 1.06 : 1);
  }
  function pdfEsc(s) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
  function fitText(s, size, bold, maxW) {
    s = pdfSafe(s);
    if (textW(s, size, bold) <= maxW) return s;
    while (s.length > 1 && textW(s + "...", size, bold) > maxW) s = s.slice(0, -1);
    return s + "...";
  }

  function buildPdf(month, d) {
    var W = 842, H = 595, M = 30;
    var fixedWidths = [34, 145, 48];
    var numericCount = Math.max(1, d.headers.length - fixedWidths.length);
    var numericWidth = Math.max(22, Math.min(72, (W - M * 2 - fixedWidths.reduce(function (a, b) { return a + b; }, 0)) / numericCount));
    var colW = fixedWidths.concat(Array.from({ length: numericCount }, function () { return numericWidth; }));
    var tableW = colW.reduce(function (a, b) { return a + b; }, 0);
    var x0 = Math.max(M, (W - tableW) / 2);
    var rowH = 21, headH = 30;
    var pages = [], cmds, y;
    var title = "MMA Mess - Mount Road";
    var sub = "Monthly Mess Bill - " + pdfSafe(monthLabel(month));
    var stamp = "Generated " + new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    function text(s, x, yy, size, bold, rgb) {
      cmds.push((rgb || "0.13 0.11 0.2") + " rg BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + x.toFixed(2) + " " + yy.toFixed(2) + " Td (" + pdfEsc(pdfSafe(s)) + ") Tj ET");
    }
    function rect(x, yy, w, h, rgb) { cmds.push(rgb + " rg " + x.toFixed(2) + " " + yy.toFixed(2) + " " + w + " " + h + " re f"); }
    function hline(yy) { cmds.push("0.85 0.83 0.9 RG 0.5 w " + x0 + " " + yy.toFixed(2) + " m " + (x0 + tableW) + " " + yy.toFixed(2) + " l S"); }
    function cellText(s, ci, yy, bold, size) {
      var left = x0 + colW.slice(0, ci).reduce(function (a, b) { return a + b; }, 0);
      var pad = 6;
      var numeric = ci >= 3 || ci === 0;
      var t = fitText(s, size, bold, colW[ci] - pad * 2);
      var x = numeric ? left + colW[ci] - pad - textW(t, size, bold) : left + pad;
      text(t, x, yy, size, bold);
    }
    function newPage() {
      cmds = []; pages.push(cmds);
      text(title, x0, H - M - 6, 17, true, "0.26 0.18 0.47");
      text(sub, x0, H - M - 24, 11, false, "0.4 0.38 0.47");
      text(stamp, x0 + tableW - textW(pdfSafe(stamp), 9, false), H - M - 24, 9, false, "0.4 0.38 0.47");
      y = H - M - 48;
      rect(x0, y - headH + 8, tableW, headH, "0.94 0.92 0.98");
      d.headers.forEach(function (h, i) { cellText(h, i, y - headH / 2 + 5, true, 8.5); });
      y -= headH;
    }
    newPage();
    d.rows.forEach(function (row, ri) {
      if (y - rowH < M + 24) newPage();
      if (ri % 2) rect(x0, y - rowH + 8, tableW, rowH, "0.985 0.98 1");
      row.forEach(function (c, i) { cellText(c, i, y - 6, false, 9); });
      hline(y - rowH + 8);
      y -= rowH;
    });
    if (y - rowH < M + 24) newPage();
    rect(x0, y - rowH + 8, tableW, rowH, "0.9 0.88 0.96");
    d.total.forEach(function (c, i) { if (c !== "") cellText(c, i, y - 6, true, 9); });
    if (!d.rows.length) text("No generated bills for this month.", x0 + 6, y - 6, 10, false);
    var total = pages.length;
    pages.forEach(function (p, i) {
      var label = "Page " + (i + 1) + " of " + total + "   |   Amounts in Indian Rupees (Rs.)";
      p.push("0.5 0.48 0.55 rg BT /F1 8 Tf " + (W / 2 - textW(label, 8, false) / 2).toFixed(2) + " " + (M - 10) + " Td (" + pdfEsc(label) + ") Tj ET");
    });
    // assemble objects
    var objs = [];
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    var kids = [];
    pages.forEach(function (p, i) { kids.push((5 + i * 2) + " 0 R"); });
    objs[2] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + pages.length + " >>";
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    pages.forEach(function (p, i) {
      var content = p.join("\n");
      objs[5 + i * 2] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (6 + i * 2) + " 0 R >>";
      objs[6 + i * 2] = "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream";
    });
    var out = "%PDF-1.4\n", offsets = [];
    for (var n = 1; n < objs.length; n++) { offsets[n] = out.length; out += n + " 0 obj\n" + objs[n] + "\nendobj\n"; }
    var xref = out.length;
    out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n";
    for (var k = 1; k < objs.length; k++) out += String(offsets[k]).padStart(10, "0") + " 00000 n \n";
    out += "trailer\n<< /Size " + objs.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    var bytes = new Uint8Array(out.length);
    for (var b = 0; b < out.length; b++) bytes[b] = out.charCodeAt(b) & 255;
    return new Blob([bytes], { type: "application/pdf" });
  }

  function exportPdf(btn) {
    UI.run(btn, function () {
      var month = selectedMonth();
      if (!generatedRows(month).length) { UI.toast("Generate the bills for " + monthLabel(month) + " first.", "error"); return false; }
      downloadBlob(buildPdf(month, tableData(month)), "MMA-Bills-" + month + ".pdf");
    }, { label: "Preparing PDF…", success: "PDF downloaded." });
  }

  /* ---- Print (clean layout, no sidebar) ---- */
  function printBills(btn) {
    UI.run(btn, function () {
      var month = selectedMonth();
      if (!generatedRows(month).length) { UI.toast("Generate the bills for " + monthLabel(month) + " first.", "error"); return false; }
      var d = tableData(month);
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>MMA Mess - Mount Road Bills ' + esc(month) + "</title><style>" +
        "@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#221b33;margin:0}" +
        "h1{font-size:20px;margin:0 0 2px;color:#432d78}.sub{color:#666;font-size:12px;margin-bottom:12px}" +
        "table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cfc9dc;padding:6px 8px;text-align:right}" +
        "th{background:#efeafb;font-size:11px}td:nth-child(2),th:nth-child(2){text-align:left}td:nth-child(3),th:nth-child(3){text-align:left}" +
        "tr:nth-child(even) td{background:#faf9fd}tfoot td{font-weight:bold;background:#e6e0f4}thead{display:table-header-group}tr{page-break-inside:avoid}" +
        "</style></head><body><h1>MMA Mess - Mount Road</h1><div class=\"sub\">Monthly Mess Bill — " + esc(monthLabel(month)) + " · Amounts in ₹</div><table><thead><tr>" +
        d.headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        d.rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") +
        "</tbody><tfoot><tr>" + d.total.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr></tfoot></table></body></html>";
      var frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(frame);
      frame.onload = function () {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); }
        catch (e) { UI.toast("Could not open the print dialog.", "error"); }
        setTimeout(function () { frame.remove(); }, 60000);
      };
      frame.srcdoc = html;
    }, { label: "Preparing…", minMs: 250 });
  }

  /* ---------------------------------------------------------
     FOOD POINTS UI  (Admin > Food Menu)
     --------------------------------------------------------- */
  var pointDraft = {};      // key -> {price, point} typed but not saved yet

  function draftOf(key) {
    var saved = P.getFoodPoints()[key] || {};
    var d = pointDraft[key] || {};
    return {
      price: d.price !== undefined ? d.price : (saved.price == null ? "" : saved.price),
      point: d.point !== undefined ? d.point : (saved.point == null ? "" : saved.point)
    };
  }

  function renderFoodPoints() {
    var host = $("foodPointsRoot");
    if (!host) return;
    var foods = P.listMenuFoods();
    var saved = P.getFoodPoints();
    var week = P.read("weekMenu", []);
    var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    function pointCell(name) {
      var key = P.normFood(name);
      if (!key) return '<span class="fp-empty">—</span>';
      var d = draftOf(key);
      var isSet = saved[key] && saved[key].point !== "" && saved[key].point != null;
      return '<div class="fp-cell"><div class="fp-name">' + esc(name) + '</div><div class="fp-ctl"><input type="number" min="0" step="any" inputmode="decimal" data-fp="' + esc(key) + '" data-field="point" value="' + esc(d.point) + '" placeholder="Point" aria-label="Point for ' + esc(name) + '">' +
        '<button type="button" class="btn-secondary small fp-fix" data-key="' + esc(key) + '">Fix Point</button></div>' +
        '<div class="fp-state ' + (isSet ? "ok" : "no") + '" data-state="' + esc(key) + '">' + (isSet ? "✓ " + esc(P.fmtPoints(saved[key].point)) + " point" : "Not set") + "</div></div>";
    }
    var listRows = foods.length ? foods.map(function (f) {
      var d = draftOf(f.key);
      var isSet = saved[f.key] && saved[f.key].point !== "" && saved[f.key].point != null;
      return "<tr><td><strong>" + esc(f.name) + '</strong></td><td><input type="number" min="0" step="any" inputmode="decimal" data-fp="' + esc(f.key) + '" data-field="price" value="' + esc(d.price) + '" placeholder="Price ₹" aria-label="Price of ' + esc(f.name) + '"></td>' +
        '<td><input type="number" min="0" step="any" inputmode="decimal" data-fp="' + esc(f.key) + '" data-field="point" value="' + esc(d.point) + '" placeholder="Point" aria-label="Point for ' + esc(f.name) + '"></td>' +
        '<td class="fp-actions"><button type="button" class="btn-secondary small fp-fix" data-key="' + esc(f.key) + '">Fix Point</button> <span class="fp-state ' + (isSet ? "ok" : "no") + '" data-state="' + esc(f.key) + '">' + (isSet ? "✓ Fixed" : "Not set") + "</span></td></tr>";
    }).join("") : '<tr><td colspan="4" class="admin-empty">Add food names to the Today\'s / Weekly menu above and save them; they will appear here.</td></tr>';
    var weekRows = (Array.isArray(week) ? week : []).map(function (r, i) {
      return "<tr><td><strong>" + esc(r.day || days[i]) + "</strong></td><td>" + pointCell(r.b) + "</td><td>" + pointCell(r.l) + "</td><td>" + pointCell(r.d) + "</td></tr>";
    }).join("");
    host.innerHTML =
      '<div class="section-title">Food Points</div><div class="card"><p class="bill-help">Every food has a <b>point weight</b> (for example Idly ₹30 = 0.30 point). Monthly mess points = meals eaten × the point of that day\'s food. Bills use points, not prices.</p>' +
      '<div class="table-wrap"><table class="dtable fp-table"><thead><tr><th>Food</th><th>Price (₹, reference)</th><th>Point</th><th>Action</th></tr></thead><tbody>' + listRows + "</tbody></table></div>" +
      '<button type="button" class="btn-primary small" id="fpSaveAll">Save Points</button><div class="confirm-msg" id="fpConfirm">Food points saved.</div></div>' +
      '<div class="section-title">Weekly Menu Points</div><div class="card"><p class="bill-help">Same food points, shown on the weekly menu. Type a point and press <b>Fix Point</b>, then <b>Save Points</b>.</p>' +
      '<div class="table-wrap"><table class="dtable fp-week"><thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th></tr></thead><tbody>' + weekRows + "</tbody></table></div>" +
      '<button type="button" class="btn-primary small" id="fpSaveAll2">Save Points</button></div>';
    host.querySelectorAll("input[data-fp]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var key = inp.dataset.fp, field = inp.dataset.field;
        pointDraft[key] = Object.assign({}, pointDraft[key], {});
        pointDraft[key][field] = inp.value;
        if (field === "price" && inp.value.trim() !== "" && Number.isFinite(Number(inp.value)) && Number(inp.value) >= 0) {
          var autoPoint = (Math.round(Number(inp.value)) / 100).toFixed(2);
          pointDraft[key].point = autoPoint;
          host.querySelectorAll('input[data-fp="' + key + '"][data-field="point"]').forEach(function (o) { o.value = autoPoint; });
        }
        host.querySelectorAll('input[data-fp="' + key + '"][data-field="' + field + '"]').forEach(function (o) { if (o !== inp) o.value = inp.value; });
      });
    });
    host.querySelectorAll(".fp-fix").forEach(function (b) { b.addEventListener("click", function () { fixPoint(b.dataset.key, b); }); });
    ["fpSaveAll", "fpSaveAll2"].forEach(function (id) { var b = $(id); if (b) b.addEventListener("click", function () { saveAllPoints(b); }); });
  }

  function validPoint(v) {
    if (String(v).trim() === "") return null;
    var n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }

  function fixPoint(key, btn) {
    UI.run(btn, async function () {
      var d = draftOf(key);
      var price = validPoint(d.price);
      var p = validPoint(d.point);
      if (p === null && price !== null && !Number.isNaN(price)) p = Math.round(price) / 100;
      if (p === null || Number.isNaN(p)) { UI.toast("Enter a price or point value first.", "error"); return false; }
      if (Number.isNaN(price)) { UI.toast("Price must be a number.", "error"); return false; }
      var map = P.getFoodPoints();
      var food = P.listMenuFoods().filter(function (f) { return f.key === key; })[0];
      map[key] = { name: food ? food.name : key, price: price === null ? "" : price, point: p };
      await P.saveFoodPoints(map, key);
      if (P.refreshFutureSnapshots) await P.refreshFutureSnapshots(90);
      await refreshServerPointRate(selectedMonth());
      delete pointDraft[key];
      markPointState(key, p);
      render();
      return p;
    }, { label: "Fixing…", minMs: 200, success: function (p) { return "Point fixed: " + P.fmtPoints(p) + "."; } });
  }
  function markPointState(key, p) {
    var host = $("foodPointsRoot"); if (!host) return;
    host.querySelectorAll('[data-state="' + key + '"]').forEach(function (el) {
      el.className = "fp-state ok";
      el.textContent = el.closest("td.fp-actions") ? "✓ Fixed" : "✓ " + P.fmtPoints(p) + " point";
    });
  }

  function saveAllPoints(btn) {
    UI.run(btn, async function () {
      var map = P.getFoodPoints(), foods = P.listMenuFoods(), bad = [];
      foods.forEach(function (f) {
        var d = draftOf(f.key);
        var p = validPoint(d.point), price = validPoint(d.price);
        if (Number.isNaN(p) || Number.isNaN(price)) { bad.push(f.name); return; }
        if (p === null && price !== null) p = Math.round(price) / 100;
        if (p === null && price === null) { return; }
        map[f.key] = { name: f.name, price: price === null ? "" : price, point: p === null ? "" : p };
      });
      if (bad.length) { UI.toast("Fix the invalid value for: " + bad.join(", "), "error"); return false; }
      await P.saveFoodPoints(map);
      if (P.refreshFutureSnapshots) await P.refreshFutureSnapshots(90);
      await refreshServerPointRate(selectedMonth());
      pointDraft = {};
      renderFoodPoints();
      render();
      var unset = foods.filter(function (f) { return P.pointOf(f.name, map) === null; }).length;
      return unset;
    }, { label: "Saving…", success: function (unset) { return unset ? "Points saved. " + unset + " food(s) still have no point." : "Food points saved. Bills will use them."; } });
  }

  /* ---------------------------------------------------------
     WIRING
     --------------------------------------------------------- */
  function wireToolbar() {
    var map = { btnBillExcel: openExcel, btnBillPdf: exportPdf, btnBillPrint: printBills };
    Object.keys(map).forEach(function (id) {
      var b = $(id);
      if (b && !b.dataset.wired) { b.dataset.wired = "1"; b.addEventListener("click", function () { map[id](b); }); }
    });
  }

  function initBills() {
    wireToolbar();
    var m = $("billMonth");
    if (m && !m.value) m.value = currentMonthKey();
    renderFoodPoints();
    render();
    prepareBillingMonth(selectedMonth()).then(function () {
      render();
    }).catch(function(error) {
      console.error("Unable to load the selected month's billing data:", error);
      UI.toast(error.message || "The selected month's billing data could not be loaded.", "error");
    });
    if (m && !m.dataset.billingMonthWired) {
      m.dataset.billingMonthWired = "1";
      m.addEventListener("change", function() {
        var month = selectedMonth();
        prepareBillingMonth(month).then(function () {
          if (selectedMonth() === month) render();
        }).catch(function(error) {
          console.error("Unable to load the selected month's billing data:", error);
          UI.toast(error.message || "The selected month's billing data could not be loaded.", "error");
        });
      });
    }
  }

  // functions called from HTML attributes and from app.js
  window.renderBills = render;
  window.renderBillCalculator = render;
  window.savePerPoint = function (b) { return savePerPoint(b); };
  window.saveCharge = saveCharge;
  window.saveFixedDiscount = saveFixedDiscount;
  window.removeFixedDiscount = removeFixedDiscount;
  window.openBillEdit = openBillEdit;
  window.renderFoodPoints = renderFoodPoints;
  window.mmaBillsRefresh = render;

  var baseInit = window.initApp;
  window.initApp = async function () {
    if (typeof baseInit === "function") await Promise.resolve(baseInit.apply(this, arguments));
    initBills();
  };

  var baseRenderMenu = window.renderMenu;
  if (typeof baseRenderMenu === "function") {
    window.renderMenu = function () { baseRenderMenu.apply(this, arguments); renderFoodPoints(); };
  }
  ["saveTodayMenu", "saveWeekMenu"].forEach(function (name) {
    var base = window[name];
    if (typeof base !== "function") return;
    window[name] = function () {
      var r = base.apply(this, arguments);
      try {
        P.snapshotToday();
        if (P.refreshFutureSnapshots) P.refreshFutureSnapshots(90);
      } catch (e) { /* ignore */ }
      renderFoodPoints(); render();
      return r;
    };
  });

  document.addEventListener("DOMContentLoaded", wireToolbar);
  window.addEventListener("storage", function (e) {
    if (e.key && e.key.indexOf("mma_") === 0 && !document.querySelector("#excelModal.open, #billEditModal.open")) render();
  });
})();


// API Integration for Admin App
// This file replaces localStorage calls with API calls

// True only after the Flask session has been verified as an admin.
window.__mmaAdminSessionReady = false;

// Modified store object to use API
const apiStore = {
  async get(key, defaultValue) {
    try {
      // Map localStorage keys to API endpoints
      const keyMap = {
        'users': () => api.getUsers().then(r => r.users),
        'todayMenu': () => api.getTodayMenu(),
        'weekMenu': () => api.getWeeklyMenu(),
        'cutoffTime': () => api.getSettings().then(r => r.settings.tomorrowCutoff || r.settings.cutoffTime || '23:00'),
        'adminBills': () => api.getBills().then(r => r.bills),
        'notifHistory': () => api.getNotifications().then(r => r.notifications),
        'feedback': () => api.getFeedback().then(r => r.feedback),
        'messEntryHistory': () => api.getEntryHistory().then(r => r.entries),
        'mealRecords': () => api.getMealRecords().then(r => r.records),
        'generalSettings': () => api.getSettings().then(r => r.settings),
        'registrationRequests': () => api.getRegistrations ? api.getRegistrations().then(r => r.registrations) : [],
        'expenses': () => api.getExpenses ? api.getExpenses().then(r => r.expenses) : []
      };

      if (keyMap[key]) {
        const result = await keyMap[key]();
        return result !== undefined ? result : defaultValue;
      }

      // Fallback to localStorage for unmapped keys
      const value = localStorage.getItem("mma_" + key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error("Storage read error:", error);
      return defaultValue;
    }
  },

  async set(key, value) {
    try {
      // Map localStorage keys to API endpoints
      const keyMap = {
        'todayMenu': () => api.updateTodayMenu(value),
        'weekMenu': () => api.updateWeeklyMenu(value),
        'cutoffTime': () => api.saveSettings({ cutoffTime: value }),
        'generalSettings': () => api.saveSettings(value),
        'notifHistory': async (val) => {
          if (Array.isArray(val) && val.length > 0) {
            await api.sendNotification(val[0]);
          }
        },
        'feedback': async (val) => {
          if (Array.isArray(val) && val.length > 0) {
            await api.submitFeedback(val[0]);
          }
        }
      };

      if (keyMap[key]) {
        await keyMap[key](value);
        return;
      }

      // Fallback to localStorage for unmapped keys
      localStorage.setItem("mma_" + key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage write error:", error);
    }
  }
};

function reportAdminWriteError(error) {
  console.error("Unable to persist admin data:", error);
  if (window.MMAUI && typeof window.MMAUI.toast === "function") {
    window.MMAUI.toast(error.message || "The change could not be saved to the server.", "error");
  }
}

const originalAdminStoreSet = store.set.bind(store);
store.set = function(key, value) {
  const previousUsers = key === "users" ? store.get("users", []) : null;
  const storedValue = key === "users" && Array.isArray(value)
    ? value.map(function(user) {
        const safeUser = { ...user };
        delete safeUser.pw;
        delete safeUser.password;
        delete safeUser.password_hash;
        return safeUser;
      })
    : value;
  originalAdminStoreSet(key, storedValue);
  let write;
  if (key === "users" && Array.isArray(value)) {
    const oldById = new Map((Array.isArray(previousUsers) ? previousUsers : []).map(function(user) {
      return [String(user.id || "").toUpperCase(), user];
    }));
    const nextById = new Map(value.map(function(user) {
      return [String(user.id || "").toUpperCase(), user];
    }));
    const operations = [];
    value.forEach(function(user) {
      const id = String(user.id || "").toUpperCase();
      const old = oldById.get(id);
      if (!old) {
        operations.push(api.createUser({
          id,
          name: user.name || "",
          room: user.room || "",
          email: user.email || "",
          phone: user.phone || "",
          password: user.pw || user.password || ""
        }));
        return;
      }
      const changes = {};
      ["name", "room", "email", "phone", "status"].forEach(function(field) {
        if ((user[field] || "") !== (old[field] || "")) changes[field] = user[field] || "";
      });
      const password = user.pw || user.password;
      if (password) changes.password = password;
      if (Object.keys(changes).length) operations.push(api.updateUser(id, changes));
    });
    oldById.forEach(function(_, id) {
      if (id && !nextById.has(id)) operations.push(api.deleteUser(id));
    });
    if (operations.length) {
      write = Promise.all(operations).catch(async function(error) {
        reportAdminWriteError(error);
        try {
          const response = await api.getUsers();
          users = response.users || [];
          originalAdminStoreSet("users", users);
          if (typeof renderUsers === "function") renderUsers();
        } catch (refreshError) {
          reportAdminWriteError(refreshError);
        }
        throw error;
      });
    }
  }
  else if (key === "generalSettings") write = api.saveSettings(value);
  else if (key === "cutoffTime") write = api.saveSettings({ tomorrowCutoff: value });
  else if (key === "todayMenu") write = api.updateTodayMenu(value);
  else if (key === "weekMenu") write = api.updateWeeklyMenu(value);
  else if (key === "adminBills") write = api.saveBillSnapshots(value);
  else if (key === "notifHistory" && Array.isArray(value) && value[0]) {
    write = api.sendNotification({
      title: value[0].t || value[0].title || "",
      message: value[0].m || value[0].message || "",
      id: value[0].id,
      target: value[0].target,
      audience: value[0].audience,
      userId: value[0].userId,
      dedupeKey: value[0].dedupeKey
    });
  }
  else if (key === "adminNotifications" && Array.isArray(value) && value[0]) {
    write = api.sendNotification({
      title: value[0].title || "",
      message: value[0].message || "",
      target: value[0].target || "dash",
      audience: "admins",
      id: value[0].id,
      dedupeKey: value[0].dedupeKey
    });
  }
  if (write && key !== "users") write.catch(reportAdminWriteError);
  else if (write) write.catch(function() {});
};

window.mmaPersistBusinessData = function(key, value, changedKey) {
  let write;
  // Do not send protected persistence requests from pre-login page hydration.
  // The flag is set only after /auth/current-user confirms an admin session.
  if (!window.__mmaAdminSessionReady) {
    // Ignore startup hydration writes before authentication; protected actions
    // are unavailable until the server confirms the admin session.
    return Promise.resolve(null);
  }
  if (key === "adminBills") {
    write = api.saveBillSnapshots(value).then(function(response) {
      const bills = response.bills || [];
      localStorage.setItem("mma_adminBills", JSON.stringify(bills));
      return bills;
    });
  } else if (key === "adminBillHistory") {
    write = api.saveBillArchive(value);
  } else if (key === "notifHistory" && Array.isArray(value) && value[0]) {
    write = api.sendNotification({
      title: value[0].t || value[0].title || "",
      message: value[0].m || value[0].message || "",
      id: value[0].id,
      target: value[0].target,
      audience: value[0].audience,
      userId: value[0].userId,
      dedupeKey: value[0].dedupeKey
    });
  } else if (key === "adminNotifications" && Array.isArray(value) && value[0]) {
    write = api.sendNotification({
      title: value[0].title || "",
      message: value[0].message || "",
      target: value[0].target || "dash",
      audience: "admins",
      id: value[0].id,
      dedupeKey: value[0].dedupeKey
    });
  } else if (key === "foodPoints") {
    const foodPoints = changedKey ? { [changedKey]: value[changedKey] } : value;
    write = api.updateFoodPoints(foodPoints, changedKey).then(function(response) {
      const saved = response.foodPoints || {};
      localStorage.setItem("mma_foodPoints", JSON.stringify(saved));
      return saved;
    });
  } else if (["billConfig", "menuSnapshots", "userBillAdjustments"].includes(key)) {
    write = api.saveSettings({ [key]: value });
  }
  return write;
};

// Override doLogin to use API

// Override doLogout to use API

window.addEventListener("mma:session-expired", function () {
  window.__mmaAdminSessionReady = false;
  if (window.__mmaAdminSessionExpired) return;
  window.__mmaAdminSessionExpired = true;
  localStorage.removeItem("mma_currentUser");
  localStorage.removeItem("mma_adminLastScreen");
  window.location.replace("/student");
});

document.addEventListener("DOMContentLoaded", function() {
  api.getCurrentUser().then(async function(response) {
    const user = response.user;
    if (user && user.role === "student") {
      localStorage.removeItem("mma_currentUser");
      window.location.replace("/student");
      return;
    }
    if (!user || user.role !== "admin") {
      localStorage.removeItem("mma_currentUser");
      window.location.replace("/student");
      return;
    }

    document.body.classList.remove("session-checking");
    window.__mmaAdminSessionExpired = false;
    window.__mmaAdminSessionReady = true;
    localStorage.setItem("mma_currentUser", JSON.stringify(user));
    await initApp();
    const savedScreen = localStorage.getItem("mma_adminLastScreen");
    const allowedScreens = ["dash", "users", "menu", "entries", "cancellations", "records", "bills", "notif", "feedback", "general"];
    if (savedScreen && allowedScreens.indexOf(savedScreen) >= 0) {
      openScreen(savedScreen);
    }
    const app = document.getElementById("app");
    if (app) app.style.display = "block";
    if (typeof window.refreshAdminRequestNavigation === "function") {
      await window.refreshAdminRequestNavigation();
    } else if (typeof window.renderRegistrationRequests === "function") {
      await window.renderRegistrationRequests();
    }
  }).catch(function(error) {
    window.__mmaAdminSessionReady = false;
    localStorage.removeItem("mma_currentUser");
    if (error.status === 401) {
      window.location.replace("/student");
      return;
    }
    document.body.classList.remove("session-checking");
    console.error("Unable to restore the admin session:", error);
  });
});

// Make data loading async
function addCalendarDaysToKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.getUTCFullYear() + "-" +
    String(shifted.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(shifted.getUTCDate()).padStart(2, "0");
}

async function baseInitApp() {
  try {
    const todayEntryResponse = await api.getEntries();
    const todayKey = todayEntryResponse.server_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(todayKey || "") ||
        !Array.isArray(todayEntryResponse.entries)) {
      throw new Error("The server returned invalid current-day meal entries.");
    }
    const tomorrowKey = addCalendarDaysToKey(todayKey, 1);
    const currentMonth = todayKey.slice(0, 7);
    const [
      userResponse,
      entryResponse,
      tomorrowEntryResponse,
      recordResponse,
      todayMealRecordsResponse,
      tomorrowMealRecordsResponse,
      settingsResponse,
      billsResponse,
      notificationsResponse,
      feedbackResponse,
      registrationsResponse,
      expensesResponse,
      todayMenuResponse,
      weeklyMenuResponse,
      archiveResponse,
      noFoodResponse
    ] = await Promise.all([
      api.getUsers(),
      api.getAllEntriesForMonth(currentMonth),
      api.getEntries(tomorrowKey),
      api.getMealRecordsForMonth(currentMonth),
      api.getMealRecords(todayKey),
      api.getMealRecords(tomorrowKey),
      api.getSettings(),
      api.getBills(),
      api.getNotifications(),
      api.getFeedback(),
      api.getRegistrations(),
      api.getExpenses(),
      api.getTodayMenu(),
      api.getWeeklyMenu(),
      api.getBillArchive(),
      api.getNoFoodRequests("pending")
    ]);
    if (!Array.isArray(tomorrowEntryResponse.entries) ||
        !Array.isArray(recordResponse.records) ||
        !Array.isArray(recordResponse.cancellations) ||
        !Array.isArray(todayMealRecordsResponse.records) ||
        !Array.isArray(todayMealRecordsResponse.cancellations) ||
        !Array.isArray(tomorrowMealRecordsResponse.records) ||
        !Array.isArray(tomorrowMealRecordsResponse.cancellations)) {
      throw new Error("The server returned incomplete meal data for the cooking dates.");
    }
    const serverToday = todayKey;
    if (typeof window.mmaAdminSetCookingDate === "function") {
      window.mmaAdminSetCookingDate(
        serverToday,
        todayEntryResponse.cooking_date || serverToday
      );
    }
    const history = (entryResponse.entries || [])
      .concat(todayEntryResponse.entries || [], tomorrowEntryResponse.entries || [])
      .reduce(function(unique, entry) {
        const key = String(entry.user_id || entry.user || "").toUpperCase() + "|" + entry.date;
        const index = unique.findIndex(function(item) {
          return String(item.user_id || item.user || "").toUpperCase() + "|" + item.date === key;
        });
        if (index >= 0) unique[index] = entry;
        else unique.push(entry);
        return unique;
      }, []).map(function(entry) {
      return {
        ...entry,
        user: entry.user_id || entry.user,
        b: entry.breakfast == null ? Number(entry.b) || 0 : Number(entry.breakfast) || 0,
        l: entry.lunch == null ? Number(entry.l) || 0 : Number(entry.lunch) || 0,
        d: entry.dinner == null ? Number(entry.d) || 0 : Number(entry.dinner) || 0
      };
    });
    const cookingDates = new Set([todayKey, tomorrowKey]);
    const dailyRecords = (todayMealRecordsResponse.records || [])
      .concat(tomorrowMealRecordsResponse.records || []);
    const records = (recordResponse.records || [])
      .filter(function(record) {
        return !cookingDates.has(String(record.date || "").slice(0, 10));
      })
      .concat(dailyRecords)
      .map(function(record) {
      return { ...record, user: record.user_id || record.user };
    });
    const cancellations = (recordResponse.cancellations || [])
      .filter(function(item) {
        return !cookingDates.has(String(item.date || "").slice(0, 10));
      })
      .concat(
        todayMealRecordsResponse.cancellations || [],
        tomorrowMealRecordsResponse.cancellations || []
      );
    const settings = settingsResponse.settings || {};
    const bills = (billsResponse.bills || []).map(function(bill) {
      return {
        ...bill,
        user: bill.user || bill.user_id,
        month: bill.month || bill.billing_month,
        billingMonth: bill.billingMonth || bill.billing_month
      };
    });
    const notifications = (notificationsResponse.notifications || []).map(function(item) {
      return { ...item, t: item.t || item.title || "", m: item.m || item.message || "" };
    });
    const feedback = (feedbackResponse.feedback || []).map(function(item) {
      return { ...item, user: item.user || item.user_id };
    });
    const adminNotifications = notifications.filter(function(item) {
      return item.audience === "admins";
    }).map(function(item) {
      return {
        ...item,
        id: item.id,
        title: item.title || item.t,
        message: item.message || item.m,
        createdAt: item.createdAt || item.d
      };
    });

    users = userResponse.users || [];
    const businessCache = {
      users,
      messEntryHistory: history,
      mealRecords: records,
      mealCancellations: cancellations,
      generalSettings: settings,
      cutoffTime: settings.tomorrowCutoff || settings.cutoffTime || "23:00",
      adminBills: bills,
      notifHistory: notifications,
      feedback,
      registrationRequests: registrationsResponse.registrations || [],
      expenses: expensesResponse.expenses || [],
      adminBillHistory: (archiveResponse.archive || []).map(function(item) {
        return {
          ...item,
          user: item.user || item.user_id,
          month: item.month || item.billingMonth || item.billing_month,
          billingMonth: item.billingMonth || item.month || item.billing_month,
          archivedAt: item.archivedAt || item.archived_at,
          finalTotal: item.finalTotal == null
            ? (item.final_total == null ? item.previous_total : item.final_total)
            : item.finalTotal
        };
      }),
      adminNotifications,
      noFoodRequests: noFoodResponse.requests || [],
      todayMenu: todayMenuResponse,
      weekMenu: weeklyMenuResponse
    };
    Object.keys(businessCache).forEach(function(key) {
      localStorage.setItem("mma_" + key, JSON.stringify(businessCache[key]));
    });
    ["billConfig", "foodPoints", "menuSnapshots", "userBillAdjustments"].forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        localStorage.setItem("mma_" + key, JSON.stringify(settings[key]));
      } else {
        localStorage.removeItem("mma_" + key);
      }
    });
  } catch (error) {
    console.error("Unable to load admin mess data from the backend:", error);
    const body = document.getElementById("entriesBody");
    if (body) {
      body.innerHTML = `<tr><td colspan="6">${escapeApiHtml(error.message || "Unable to load mess entries from the server.")}</td></tr>`;
    }
    return;
  }

  // Render dashboard AFTER data is loaded to ensure correct values
  await renderDashboard();
  await Promise.all([
    renderUsers(true),
    renderMenu(true),
    renderEntries(),
    renderRecords(),
    renderNoFoodRequests(true),
    renderBills(),
    renderNotifHistory(),
    renderFeedback()
  ]);
}

// Modified renderUsers to use API
function escapeApiHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

let noFoodRefreshBusy = false;

async function renderNoFoodRequests(useCachedData) {
  const box = document.getElementById("noFoodRequestsRoot");
  if (noFoodRefreshBusy || document.getElementById("login")?.classList.contains("active")) return;
  noFoodRefreshBusy = true;
  try {
    let requests;
    if (useCachedData) {
      requests = store.get("noFoodRequests", []);
    } else {
      const response = await api.getNoFoodRequests("pending");
      requests = Array.isArray(response.requests) ? response.requests : [];
      localStorage.setItem("mma_noFoodRequests", JSON.stringify(requests));
    }
    if (!Array.isArray(requests)) requests = [];
    if (!box) return;
    if (!requests.length) {
      box.innerHTML = '<div class="admin-empty">No pending no-food requests.</div>';
      return;
    }
    box.innerHTML = requests.map(function(item) {
      const meal = ({b: "Breakfast", l: "Lunch", d: "Dinner"})[item.meal] || item.meal || "Meal";
      const requestedAt = item.requested_at ? new Date(item.requested_at).toLocaleString("en-IN") : "-";
      const id = escapeApiHtml(item.request_id || item._id || "");
      const status = String(item.status || "pending").toLowerCase();
      const branch = String(item.branch || "").trim();
      return `<div class="no-food-item">
        <b>${escapeApiHtml(item.student_name || "Student")}</b>
        <div class="meta">Room: ${escapeApiHtml(item.room || "-")}</div>
        ${branch ? `<div class="meta">Branch: ${escapeApiHtml(branch)}</div>` : ""}
        <div class="meta">Date: ${escapeApiHtml(item.date || "-")} · Meal: ${escapeApiHtml(meal)} · Dish: ${escapeApiHtml(item.dish_name || "Menu not published yet")}</div>
        <div class="meta">Status: <span class="no-food-status ${status === "pending" ? "pending" : status}">${escapeApiHtml(status.charAt(0).toUpperCase() + status.slice(1))}</span> · Requested: ${escapeApiHtml(requestedAt)}</div>
        ${status === "pending" ? `<div class="request-actions">
          <button class="btn-primary small" type="button" onclick="MMAUI.run(this,function(){return approveNoFoodRequest('${id}')},{label:'Approving…',minMs:200})">Approve</button>
          <button class="btn-secondary small" type="button" onclick="MMAUI.run(this,function(){return rejectNoFoodRequest('${id}')},{label:'Rejecting…',minMs:200})">Reject</button>
        </div>` : ""}
      </div>`;
    }).join("");
  } catch (error) {
    console.error("Unable to load no-food requests:", error);
    updateNoFoodNavBadge(0);
    if (box) box.innerHTML = `<div class="admin-empty">${escapeApiHtml(error.message || "Unable to load no-food requests.")}</div>`;
  } finally {
    noFoodRefreshBusy = false;
  }
}

window.refreshNoFoodRequests = renderNoFoodRequests;
window.approveNoFoodRequest = async function(requestId) {
  try {
    const response = await api.approveNoFoodRequest(requestId);
    if (typeof window.mmaMarkAdminTargetRead === "function") {
      await window.mmaMarkAdminTargetRead("entries");
    }
    if (window.MMAUI) window.MMAUI.toast(
      response.warning || "No-food request approved; 0 points recorded.",
      response.warning ? "error" : "success"
    );
    await renderNoFoodRequests();
    if (typeof window.refreshAdminRequestNavigation === "function") {
      await window.refreshAdminRequestNavigation();
    }
    if (typeof renderEntries === "function") renderEntries();
    if (typeof renderRecords === "function") renderRecords();
    if (typeof renderBills === "function") renderBills();
  } catch (error) {
    if (window.MMAUI) window.MMAUI.toast(error.message || "Unable to approve no-food request.", "error");
    else window.alert(error.message || "Unable to approve no-food request.");
  }
};
window.rejectNoFoodRequest = async function(requestId) {
  try {
    const response = await api.rejectNoFoodRequest(requestId);
    if (typeof window.mmaMarkAdminTargetRead === "function") {
      await window.mmaMarkAdminTargetRead("entries");
    }
    if (window.MMAUI) window.MMAUI.toast(
      response.warning || "No-food request rejected; normal meal rules remain in effect.",
      response.warning ? "error" : "success"
    );
    await renderNoFoodRequests();
    if (typeof window.refreshAdminRequestNavigation === "function") {
      await window.refreshAdminRequestNavigation();
    }
  } catch (error) {
    if (window.MMAUI) window.MMAUI.toast(error.message || "Unable to reject no-food request.", "error");
    else window.alert(error.message || "Unable to reject no-food request.");
  }
};

setInterval(function() {
  if (
    window.__mmaAdminSessionReady &&
    document.visibilityState === "visible" &&
    !document.getElementById("login")?.classList.contains("active")
  ) {
    renderNoFoodRequests();
  }
}, 20000);

function renderAdminUsersTable() {
  const body = document.getElementById("usersBody");
  if (!body) return;
  const roomFilter = document.getElementById("usersRoomFilter");
  const visibleUsers = window.MMAAdminRoomFilter
    ? window.MMAAdminRoomFilter.filterUsers(users, roomFilter ? roomFilter.value : "")
    : users;
  if (!visibleUsers.length) {
    body.innerHTML = users.length
      ? '<tr><td colspan="5">No users match this room.</td></tr>'
      : '<tr><td colspan="5">No approved users yet.</td></tr>';
    return;
  }
  body.innerHTML = window.MMARoomSort.sortByRoom(visibleUsers).map(function(user) {
    const userId = escapeApiHtml(user.id);
    return `
      <tr>
        <td>${escapeApiHtml(user.name || "-")}</td>
        <td>${escapeApiHtml(user.room || "-")}</td>
        <td><button class="link-btn" onclick="editUser('${userId}')">Edit</button></td>
        <td><button class="link-btn danger-link" onclick="deleteUser('${userId}')">Delete</button></td>
        <td><button class="link-btn" onclick="viewUser('${userId}')">View</button></td>
      </tr>
    `;
  }).join("");
}

async function renderUsers(useCachedData) {
  const body = document.getElementById("usersBody");
  if (!body) return;
  if (useCachedData) {
    users = store.get("users", []);
  } else {
    try {
      const response = await api.getUsers();
      users = response.users || [];
      originalAdminStoreSet("users", users);
    } catch (error) {
      console.error("Error fetching users:", error);
      body.innerHTML = `<tr><td colspan="5">${escapeApiHtml(error.message || "Unable to load users.")}</td></tr>`;
      return;
    }
  }

  const roomFilter = document.getElementById("usersRoomFilter");
  if (roomFilter) {
    if (window.MMAAdminRoomFilter) {
      window.MMAAdminRoomFilter.populateSelect(roomFilter, users);
    }
    if (!roomFilter.dataset.wired) {
      roomFilter.addEventListener("change", renderAdminUsersTable);
      roomFilter.dataset.wired = "1";
    }
  }
  if (typeof window.renderAdminUserActivity === "function") {
    window.renderAdminUserActivity();
  }
  renderAdminUsersTable();
}

async function saveUser() {
  const name = document.getElementById("nuName").value.trim();
  const room = document.getElementById("nuRoom").value.trim();
  const email = document.getElementById("nuEmail").value.trim();
  const password = document.getElementById("nuPw").value;
  const existingId = document.getElementById("nuId").value.trim();
  if (!name || !room || (!existingId && !password)) {
    alert("Name, room number, and a password for new users are required.");
    return;
  }

  const userData = { name, room, email, role: "student", status: "active" };
  try {
    if (existingId) {
      if (password) userData.password = password;
      await api.updateUser(existingId, userData);
    } else {
      const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "USER";
      const roomSlug = room.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const baseId = (roomSlug + "-" + slug).slice(0, 20);
      let id = baseId;
      let suffix = 2;
      while (users.some(user => String(user.id).toUpperCase() === id.toUpperCase())) {
        id = baseId + suffix++;
      }
      await api.createUser({ ...userData, id, password });
    }
    await renderUsers();
    renderDashboard();
    closeUserForm();
  } catch (error) {
    console.error("Error saving user:", error);
    alert(error.message || "Failed to save user.");
  }
}

async function deleteUser(userId) {
  const user = users.find(item => String(item.id).toUpperCase() === String(userId).toUpperCase());
  if (!user) return alert("User not found.");
  if (!confirm(`Delete account ${user.id} (${user.name || "user"})? Existing bills and meal history will be retained.`)) return;
  try {
    await api.deleteUser(userId);
    await renderUsers();
    renderDashboard();
  } catch (error) {
    console.error("Error deleting user:", error);
    alert(error.message || "Failed to delete user.");
  }
}

async function toggleUserStatusById(userId) {
  try {
    await api.toggleUserStatus(userId);
    await renderUsers();
    renderDashboard();
  } catch (error) {
    console.error("Error toggling user status:", error);
    alert(error.message || "Failed to update user status.");
  }
}

function editUser(userId) {
  const user = users.find(item => String(item.id).toUpperCase() === String(userId).toUpperCase());
  if (!user) return alert("User not found.");
  editingUserId = user.id;
  document.getElementById("nuId").value = user.id || "";
  document.getElementById("nuName").value = user.name || "";
  document.getElementById("nuPw").value = "";
  document.getElementById("nuRoom").value = user.room || "";
  document.getElementById("nuEmail").value = user.email || "";
  document.getElementById("userModalTitle").textContent = `Edit User · ${user.name || user.id}`;
  document.getElementById("saveUserButton").textContent = "Save User";
  document.getElementById("userModalBg").classList.add("open");
}

function viewUser(userId) {
  const user = users.find(item => String(item.id).toUpperCase() === String(userId).toUpperCase());
  if (!user) return alert("User not found.");
  alert(`User details\n\nName: ${user.name || "-"}\nRoom No: ${user.room || "-"}\nEmail: ${user.email || "-"}`);
}

// Modified toggleUserStatus to use API
async function toggleUserStatus(userId) {
  try {
    await api.toggleUserStatus(userId);
    await renderUsers();
    await renderDashboard();
  } catch (error) {
    console.error("Error toggling user status:", error);
    alert("Failed to update user status");
  }
}

// Modified renderMenu to use API
async function renderMenu(useCachedData) {
  const todayForm = document.getElementById("todayMenuForm");
  const weekBody = document.getElementById("weekBody");
  try {
    const todayMenu = useCachedData ? store.get("todayMenu", {}) : await api.getTodayMenu();
    const weeklyMenu = useCachedData ? store.get("weekMenu", []) : await api.getWeeklyMenu();
    const weekMenu = Array.isArray(weeklyMenu) ? weeklyMenu : [];
    localStorage.setItem("mma_todayMenu", JSON.stringify(todayMenu));
    localStorage.setItem("mma_weekMenu", JSON.stringify(weekMenu));
    if (typeof renderFoodPoints === "function") renderFoodPoints();

    if (todayForm) {
      todayForm.innerHTML = "<p class=\"bill-help\" style=\"grid-column:1/-1\">Today's Food is automatically taken from the current weekday in Weekly Menu. Edit that weekday below and save the weekly menu.</p>" +
        ["breakfast", "lunch", "dinner"].map(function(meal) {
        return `
          <div class="field">
            <label style="text-transform:capitalize">${meal}</label>
            <input id="tm_${meal}" type="text" value="${escapeApiHtml(todayMenu[meal] || '')}" readonly>
          </div>
        `;
      }).join("");
    }

    if (weekBody) {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const weekByDay = new Map(weekMenu.map(function(day) {
        return [String(day.day || "").toLowerCase(), day];
      }));
      weekBody.innerHTML = days.map(function(dayName, index) {
        const day = weekByDay.get(dayName.toLowerCase()) || {};
        return `
          <tr>
            <td>${escapeApiHtml(dayName)}</td>
            <td><input id="wb_${index}" value="${escapeApiHtml(day.b)}"></td>
            <td><input id="wl_${index}" value="${escapeApiHtml(day.l)}"></td>
            <td><input id="wd_${index}" value="${escapeApiHtml(day.d)}"></td>
          </tr>
        `;
      }).join("");
    }
  } catch (error) {
    console.error("Error fetching menu:", error);
    if (todayForm) todayForm.innerHTML = `<p class="bill-warn">${escapeApiHtml(error.message || "Unable to load today's menu.")}</p>`;
    if (weekBody) weekBody.innerHTML = `<tr><td colspan="4">${escapeApiHtml(error.message || "Unable to load the weekly menu.")}</td></tr>`;
  }
}

// Modified saveTodayMenu to use API
async function saveTodayMenu() {
  window.MMAUI?.toast("Today's Food is derived from the current weekday in Weekly Menu. Save changes there.", "info");
}

// Modified saveWeekMenu to use API
async function saveWeekMenu() {
  const weekMenu = [];
  for (let i = 0; i < 7; i++) {
    const breakfast = document.getElementById(`wb_${i}`);
    const lunch = document.getElementById(`wl_${i}`);
    const dinner = document.getElementById(`wd_${i}`);
    if (!breakfast || !lunch || !dinner) {
      alert("Weekly menu fields are not available. Reload the page and try again.");
      return;
    }
    weekMenu.push({
      day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      b: breakfast.value,
      l: lunch.value,
      d: dinner.value
    });
  }

  try {
    await api.updateWeeklyMenu(weekMenu);
    flash("weekConfirm");
    await renderMenu();
    await renderDashboard();
  } catch (error) {
    console.error("Error saving weekly menu:", error);
    alert("Failed to save weekly menu");
  }
}

// Note: This is a simplified integration. The full integration would require
// updating all render functions to be async and use API calls instead of localStorage.
// For a complete implementation, each function in app.js that uses store.get/set
// should be converted to use the corresponding API call.


(function () {
  "use strict";

  const mealNames = { b: "Breakfast", l: "Lunch", d: "Dinner" };
  let monthPage = 1;
  const pageSize = 100;

  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function dateKey(offset) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const dateParts = {};
    parts.forEach(function (part) {
      if (part.type !== "literal") dateParts[part.type] = part.value;
    });
    const value = new Date(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day) + offset);
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0")
    ].join("-");
  }

  function currentMonth() {
    return dateKey(0).slice(0, 7);
  }

  function setStatus(element, message, error) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("cancelled-meal", !!error);
  }

  function cancellationList(items) {
    return (Array.isArray(items) ? items : []).map(function (item) {
      return item;
    });
  }

  function storeCancellations(items) {
    const current = JSON.parse(localStorage.getItem("mma_mealCancellations") || "[]");
    const byKey = new Map();
    cancellationList(current).concat(cancellationList(items)).forEach(function (item) {
      byKey.set(String(item.date) + "|" + String(item.meal_type), item);
    });
    localStorage.setItem("mma_mealCancellations", JSON.stringify(Array.from(byKey.values())));
  }

  async function loadAdminBillingMonth(month) {
    const [entryResponse, recordResponse] = await Promise.all([
      api.getAllEntriesForMonth(month),
      api.getMealRecordsForMonth(month)
    ]);
    const entries = (entryResponse.entries || []).map(function (entry) {
      return {
        ...entry,
        user: entry.user_id || entry.user,
        b: Number(entry.breakfast == null ? entry.b : entry.breakfast) || 0,
        l: Number(entry.lunch == null ? entry.l : entry.lunch) || 0,
        d: Number(entry.dinner == null ? entry.d : entry.dinner) || 0
      };
    });
    const records = (recordResponse.records || []).map(function (record) {
      return { ...record, user: record.user_id || record.user };
    });
    const oldEntries = JSON.parse(localStorage.getItem("mma_messEntryHistory") || "[]");
    const oldRecords = JSON.parse(localStorage.getItem("mma_mealRecords") || "[]");
    localStorage.setItem("mma_messEntryHistory", JSON.stringify(
      (Array.isArray(oldEntries) ? oldEntries : []).filter(function (item) {
        return String(item.date || "").slice(0, 7) !== month;
      }).concat(entries)
    ));
    localStorage.setItem("mma_mealRecords", JSON.stringify(
      (Array.isArray(oldRecords) ? oldRecords : []).filter(function (item) {
        return String(item.date || "").slice(0, 7) !== month;
      }).concat(records)
    ));
    storeCancellations(recordResponse.cancellations || entryResponse.cancellations || []);
    localStorage.setItem("mma_adminBillingDataMonth", month);
  }

  function reportTable(entries, cancellations, title, summary) {
    const cancelled = new Set(cancellations.map(function (item) {
      return item.date + "|" + item.meal_type;
    }));
    const rows = window.MMARoomSort.sortByRoom(entries).map(function (entry) {
      const date = String(entry.date || "").slice(0, 10);
      const values = ["b", "l", "d"].map(function (short) {
        const field = { b: "breakfast", l: "lunch", d: "dinner" }[short];
        return cancelled.has(date + "|" + short) ? 0 : Number(entry[field] == null ? entry[short] : entry[field]) || 0;
      });
      const total = values.reduce(function (a, b) { return a + b; }, 0);
      return `<tr><td class="entry-name">${escape(entry.user_name || entry.user_id || entry.user || "-")}</td><td>${escape(entry.room || "-")}</td>${values.map(function (v, i) {
        const short = ["b", "l", "d"][i];
        return `<td class="${cancelled.has(date + "|" + short) ? "cancelled-meal" : ""}">${v}</td>`;
      }).join("")}<td><b>${total}</b></td></tr>`;
    }).join("");
    const totals = summary || entries.reduce(function (result, entry) {
      ["b", "l", "d"].forEach(function (short) {
        const field = { b: "breakfast", l: "lunch", d: "dinner" }[short];
        if (!cancelled.has(String(entry.date || "").slice(0, 10) + "|" + short)) {
          result[field] += Number(entry[field] == null ? entry[short] : entry[field]) || 0;
        }
      });
      return result;
    }, { breakfast: 0, lunch: 0, dinner: 0 });
    const portions = totals.total == null
      ? Number(totals.breakfast || 0) + Number(totals.lunch || 0) + Number(totals.dinner || 0)
      : Number(totals.total);
    return `<div class="entry-day-title">${escape(title)}</div><div class="entry-report-summary"><span>Breakfast: <b>${Number(totals.breakfast || 0)}</b></span><span>Lunch: <b>${Number(totals.lunch || 0)}</b></span><span>Dinner: <b>${Number(totals.dinner || 0)}</b></span><span>Total portions: <b>${portions}</b></span></div><div class="table-wrap"><table class="dtable entry-table"><thead><tr><th>Name</th><th>Room</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Total</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="entries-empty">No mess entries exist for this selection.</td></tr>'}</tbody></table></div>`;
  }

  async function loadEntryDateReport() {
    const input = document.getElementById("entryDateFilter");
    const container = document.getElementById("entryDateReport");
    if (!input || !container) return;
    const selected = input.value;
    if (!selected) {
      container.innerHTML = '<p class="entry-report-status">Choose a date to view persisted entries.</p>';
      return;
    }
    container.innerHTML = '<p class="entry-report-status">Loading entries…</p>';
    try {
      const response = await api.getEntries(selected);
      const entries = Array.isArray(response.entries) ? response.entries : [];
      const cancellations = cancellationList(response.cancellations);
      storeCancellations(cancellations);
      container.innerHTML = reportTable(entries, cancellations, `Entries for ${selected}`);
    } catch (error) {
      container.innerHTML = `<p class="entry-report-status">${escape(error.message || "Unable to load entries.")}</p>`;
    }
  }

  async function loadEntryMonthReport(page) {
    const input = document.getElementById("entryMonthFilter");
    const container = document.getElementById("entryMonthReport");
    if (!input || !container) return;
    if (page) monthPage = page;
    const selected = input.value;
    if (!selected) {
      container.innerHTML = '<p class="entry-report-status">Choose a month to view persisted entries.</p>';
      return;
    }
    container.innerHTML = '<p class="entry-report-status">Loading monthly entries…</p>';
    try {
      const response = await api.getEntriesForMonth(selected, monthPage, pageSize);
      const cancellations = cancellationList(response.cancellations);
      storeCancellations(cancellations);
      const entries = Array.isArray(response.entries) ? response.entries : [];
      const summary = response.summary || { breakfast: 0, lunch: 0, dinner: 0, total: 0 };
      const labelDate = new Date(selected + "-01T00:00:00");
      const label = labelDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const pages = Number(response.pages) || 0;
      container.innerHTML = reportTable(entries, cancellations, `${label} · ${response.total || 0} students`, summary) +
        (pages > 1 ? `<div class="entry-filter-tools" aria-label="Monthly entry pages"><button class="btn-secondary small" type="button" ${monthPage <= 1 ? "disabled" : ""} onclick="loadEntryMonthReport(${monthPage - 1})">Previous</button><span>Page ${monthPage} of ${pages}</span><button class="btn-secondary small" type="button" ${monthPage >= pages ? "disabled" : ""} onclick="loadEntryMonthReport(${monthPage + 1})">Next</button></div>` : "");
    } catch (error) {
      container.innerHTML = `<p class="entry-report-status">${escape(error.message || "Unable to load monthly entries.")}</p>`;
    }
  }

  async function refreshEntryReports() {
    const dateInput = document.getElementById("entryDateFilter");
    const monthInput = document.getElementById("entryMonthFilter");
    if (!dateInput || !monthInput) return;
    if (!dateInput.value) dateInput.value = dateKey(0);
    if (!monthInput.value) monthInput.value = currentMonth();
    await Promise.all([
      loadEntryDateReport(),
      loadEntryMonthReport(1),
    ]);
  }

  function clearEntryDateFilter() {
    const input = document.getElementById("entryDateFilter");
    if (input) input.value = "";
    const container = document.getElementById("entryDateReport");
    if (container) container.innerHTML = '<p class="entry-report-status">Choose a date to view persisted entries.</p>';
  }

  function changeEntryMonth(amount) {
    const input = document.getElementById("entryMonthFilter");
    if (!input || !/^\d{4}-\d{2}$/.test(input.value)) return;
    const [year, month] = input.value.split("-").map(Number);
    const next = new Date(year, month - 1 + amount, 1);
    input.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    loadEntryMonthReport(1);
  }

  function clearEntryMonthFilter() {
    const input = document.getElementById("entryMonthFilter");
    if (input) input.value = "";
    monthPage = 1;
    const container = document.getElementById("entryMonthReport");
    if (container) container.innerHTML = '<p class="entry-report-status">Choose a month to view persisted entries.</p>';
  }

  function renderCancellationStatus() {
    const status = document.getElementById("cancellationStatus");
    const dateInput = document.getElementById("cancellationDate");
    const mealInput = document.getElementById("cancellationMeal");
    if (!status || !dateInput || !mealInput) return;
    const selected = (JSON.parse(localStorage.getItem("mma_mealCancellations") || "[]") || [])
      .find(function (item) {
        return item.date === dateInput.value && item.meal_type === mealInput.value;
      });
    if (selected) {
      setStatus(status, `${mealNames[selected.meal_type]} is cancelled for ${selected.date}. No meal points or meal-related fines apply. Reason: ${selected.reason || "Not specified"}.`);
    } else {
      setStatus(status, `${mealNames[mealInput.value]} is not currently cancelled for ${dateInput.value}.`);
    }
  }

  async function loadCancellationHistory() {
    const dateInput = document.getElementById("cancellationDate");
    const history = document.getElementById("cancellationHistory");
    if (!dateInput || !history || !dateInput.value) return;
    try {
      const response = await api.getMealCancellations(dateInput.value.slice(0, 7), "month");
      const items = cancellationList(response.cancellations);
      storeCancellations(items);
      const monthItems = items.slice().sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date)) || String(a.meal_type).localeCompare(String(b.meal_type));
      });
      history.innerHTML = monthItems.length ? monthItems.map(function (item) {
        const name = mealNames[item.meal_type] || item.meal_type;
        return `<div class="cancellation-item"><b>${escape(name)} · ${escape(item.date)}</b><div>${escape(item.reason || "No reason provided")}</div><small>Cancelled by ${escape(item.cancelled_by || "administration")} · ${escape(item.cancelled_at || "")}${item.retroactive ? " · Retroactive adjustment" : ""}</small></div>`;
      }).join("") : '<p class="entry-report-status">No cancellations recorded for this month.</p>';
      renderCancellationStatus();
    } catch (error) {
      history.textContent = error.message || "Cancellation history could not be loaded.";
    }
  }

  async function confirmMealCancellation() {
    const dateInput = document.getElementById("cancellationDate");
    const mealInput = document.getElementById("cancellationMeal");
    const reasonInput = document.getElementById("cancellationReason");
    if (!dateInput || !dateInput.value || !mealInput) {
      alert("Select a cancellation date and meal.");
      return;
    }
    const date = dateInput.value;
    const meal = mealNames[mealInput.value];
    if (!confirm(`Cancel ${meal} for ${date} for all active students? Previously entered portions will be non-billable; this action will notify students.`)) return;
    let payload = {
      date,
      meal: mealInput.value,
      reason: reasonInput ? reasonInput.value.trim() : "",
      confirmRetroactive: false
    };
    try {
      let result;
      try {
        result = await api.cancelMeal(payload);
      } catch (error) {
        if (error.status !== 409 || !String(error.message).toLowerCase().includes("confirmation")) throw error;
        if (!confirm(`This is a past or already-served meal. Confirm retroactive cancellation of ${meal} on ${date}. Existing bills will be adjusted and the action audited.`)) return;
        payload.confirmRetroactive = true;
        result = await api.cancelMeal(payload);
      }
      storeCancellations([result.cancellation]);
      if (reasonInput) reasonInput.value = "";
      await Promise.all([
        loadCancellationHistory(),
        loadEntryDateReport(),
        loadEntryMonthReport(1)
      ]);
      if (typeof window.renderRecords === "function") window.renderRecords();
      if (window.MMAUI && window.MMAUI.toast) {
        window.MMAUI.toast(result.created ? `${meal} cancelled; students notified.` : `${meal} was already cancelled.`, "success");
      }
    } catch (error) {
      alert(error.message || "The meal cancellation could not be saved.");
    }
  }

  const originalRenderEntries = window.renderEntries;
  window.renderEntries = function () {
    if (typeof originalRenderEntries === "function") originalRenderEntries();
    const dateInput = document.getElementById("entryDateFilter");
    const monthInput = document.getElementById("entryMonthFilter");
    if (dateInput && !dateInput.value) dateInput.value = dateKey(0);
    if (monthInput && !monthInput.value) monthInput.value = currentMonth();
  };

  const originalOpenScreen = window.openScreen;
  window.openScreen = function (id) {
    if (typeof originalOpenScreen === "function") originalOpenScreen(id);
    if (id === "entries") refreshEntryReports();
    if (id === "cancellations") {
      const dateInput = document.getElementById("cancellationDate");
      if (dateInput && !dateInput.value) dateInput.value = dateKey(0);
      loadCancellationHistory();
    }
  };

  const originalRenderRecords = window.renderRecords;
  const loadedRecordCancellationDates = new Set();
  window.renderRecords = function () {
    if (typeof originalRenderRecords === "function") originalRenderRecords();
    const dateInput = document.getElementById("recDate");
    const selected = dateInput && dateInput.value;
    if (!selected || loadedRecordCancellationDates.has(selected)) return;
    loadedRecordCancellationDates.add(selected);
    api.getMealCancellations(selected).then(function (response) {
      storeCancellations(response.cancellations || []);
      if (typeof originalRenderRecords === "function") originalRenderRecords();
    }).catch(function (error) {
      loadedRecordCancellationDates.delete(selected);
      console.error("Unable to load cancellation status for meal records:", error);
    });
  };

  window.loadEntryDateReport = loadEntryDateReport;
  window.loadEntryMonthReport = loadEntryMonthReport;
  window.refreshEntryReports = refreshEntryReports;
  window.clearEntryDateFilter = clearEntryDateFilter;
  window.changeEntryMonth = changeEntryMonth;
  window.clearEntryMonthFilter = clearEntryMonthFilter;
  window.renderCancellationStatus = renderCancellationStatus;
  window.loadCancellationHistory = loadCancellationHistory;
  window.confirmMealCancellation = confirmMealCancellation;
  window.loadAdminBillingMonth = loadAdminBillingMonth;

  const billMonthInput = document.getElementById("billMonth");
  if (billMonthInput) {
    billMonthInput.addEventListener("change", function () {
      loadAdminBillingMonth(billMonthInput.value).then(function () {
        if (typeof window.mmaBillsRefresh === "function") window.mmaBillsRefresh();
      }).catch(function (error) {
        console.error("Unable to load selected billing-month records:", error);
      });
    });
  }
})();

async function doLogout() {
  try {
    await api.logout();
  } catch (error) {
    console.error("Logout request failed:", error);
    if (error.status !== 401) {
      alert("Logout could not be completed. Please try again.");
      return;
    }
  }
  window.__mmaAdminSessionReady = false;
  localStorage.removeItem("mma_currentUser");
  localStorage.removeItem("mma_adminLastScreen");
  window.location.replace("/student");
}
