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


(function () {

    /* ==============================
       STORAGE
       ============================== */

    const S = window.localStorage;

    const key = name => `mma_${name}`;

    function get(name, defaultValue) {
        try {
            const value = S.getItem(key(name));

            return value === null
                ? defaultValue
                : JSON.parse(value);

        } catch (error) {
            return defaultValue;
        }
    }

    function set(name, value) {
        S.setItem(
            key(name),
            JSON.stringify(value)
        );
    }


    /* ==============================
       HELPERS
       ============================== */

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/[&<>"']/g, character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character]));
    }

    function today() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function tomorrow() {
        const date = today();
        date.setDate(date.getDate() + 1);
        return date;
    }

    function dateKey(date) {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function getCurrentUser() {

        const userId =
            get("currentUserId", "");

        return get("users", []).find(
            user =>
                String(user.id).toUpperCase() ===
                String(userId).toUpperCase()
        );
    }


    /* ==============================
       USER REQUESTS & FEEDBACK
       ============================== */

    function insertRequestSection() {

        const main =
            document.querySelector("main");

        if (
            !main ||
            document.getElementById(
                "clientRequests"
            )
        ) {
            return;
        }

        const section =
            document.createElement("section");

        section.id = "clientRequests";
        section.className = "screen";

        section.innerHTML = `
            <button
                class="back"
                onclick="openScreen('home')">
                ← Back
            </button>

            <div
                class="section-title"
                style="margin-top:0">
                Requests & Feedback
            </div>

            <div class="card">
                <div
                    class="request-list"
                    id="clientRequestList">
                </div>
            </div>

            <div class="section-title">
                New Request
            </div>

            <div class="card">

                <div class="field">
                    <label>Type</label>

                    <select id="reqType">
                        <option value="permission">
                            Meal permission
                        </option>

                        <option value="cancellation">
                            Meal cancellation
                        </option>

                        <option value="leave">
                            Mess leave
                        </option>

                        <option value="complaint">
                            Complaint
                        </option>

                        <option value="suggestion">
                            Improvement suggestion
                        </option>
                    </select>
                </div>


                <div class="field">
                    <label>Meal</label>

                    <select id="reqMeal">
                        <option value="breakfast">
                            Breakfast
                        </option>

                        <option value="lunch">
                            Lunch
                        </option>

                        <option value="dinner">
                            Dinner
                        </option>

                        <option value="all">
                            All meals
                        </option>
                    </select>
                </div>


                <div class="field">
                    <label>From</label>

                    <input
                        id="reqFrom"
                        type="date">
                </div>


                <div class="field">
                    <label>To</label>

                    <input
                        id="reqTo"
                        type="date">
                </div>


                <div class="field">
                    <label>
                        Reason / message
                    </label>

                    <textarea
                        id="reqMessage"
                        rows="4"
                        placeholder="Explain your request">
                    </textarea>
                </div>


                <button
                    class="btn-primary"
                    onclick="submitClientRequest()">
                    Submit Request
                </button>

            </div>
        `;

        const more =
            document.getElementById("more");

        main.insertBefore(
            section,
            more
        );
    }


    /* ==============================
       RENDER REQUESTS
       ============================== */

    function renderRequests() {

        const box =
            document.getElementById(
                "clientRequestList"
            );

        if (!box) {
            return;
        }

        const currentUser =
            getCurrentUser();

        if (!currentUser) {

            box.innerHTML = `
                <div class="empty">
                    Login required.
                </div>
            `;

            return;
        }

        const requests =
            get("requests", [])
                .filter(
                    request =>
                        String(request.user)
                            .toUpperCase() ===
                        String(currentUser.id)
                            .toUpperCase()
                )
                .reverse();


        if (requests.length === 0) {

            box.innerHTML = `
                <div class="empty">
                    No requests yet.
                </div>
            `;

            return;
        }


        box.innerHTML =
            requests.map(request => `

                <div class="request-item">

                    <b>
                        ${escapeHTML(
                            request.type
                        )}
                    </b>

                    <span class="access-pill">
                        ${escapeHTML(
                            request.status ||
                            "Pending"
                        )}
                    </span>

                    <div class="meta">
                        ${escapeHTML(
                            request.meal || ""
                        )}
                        ·
                        ${escapeHTML(
                            request.from || ""
                        )}

                        ${
                            request.to
                                ? `→ ${escapeHTML(
                                    request.to
                                )}`
                                : ""
                        }
                    </div>

                    <p>
                        ${escapeHTML(
                            request.message || ""
                        )}
                    </p>

                </div>

            `).join("");
    }


    /* ==============================
       SUBMIT REQUEST
       ============================== */

    window.submitClientRequest =
        function () {

            const currentUser =
                getCurrentUser();

            if (!currentUser) {
                alert(
                    "Please login again."
                );
                return;
            }


            const type =
                document.getElementById(
                    "reqType"
                ).value;


            const request = {

                id:
                    "REQ" + Date.now(),

                user:
                    currentUser.id,

                name:
                    currentUser.name,

                room:
                    currentUser.room,

                type,

                meal:
                    document.getElementById(
                        "reqMeal"
                    ).value,

                from:
                    document.getElementById(
                        "reqFrom"
                    ).value,

                to:
                    document.getElementById(
                        "reqTo"
                    ).value,

                message:
                    document.getElementById(
                        "reqMessage"
                    ).value.trim(),

                status:
                    "pending",

                createdAt:
                    new Date().toISOString()
            };


            if (
                !request.message &&
                type !== "leave"
            ) {

                alert(
                    "Please enter a reason or message."
                );

                return;
            }


            const requests =
                get("requests", []);

            requests.push(request);

            set(
                "requests",
                requests
            );


            document.getElementById(
                "reqMessage"
            ).value = "";


            renderRequests();

            alert(
                "Request sent to admin / mess secretary."
            );
        };


    /* ==============================
       CHANGE PASSWORD
       ============================== */

    function addPasswordSection() {

        const settings =
            document.getElementById(
                "settings"
            );

        if (
            !settings ||
            document.getElementById(
                "changePasswordCard"
            )
        ) {
            return;
        }


        const card =
            document.createElement("div");

        card.className =
            "card password-box";

        card.id =
            "changePasswordCard";


        card.innerHTML = `

            <div class="field">

                <label>
                    Current password
                </label>

                <input
                    id="oldPw"
                    type="password">

            </div>


            <div class="field">

                <label>
                    New password
                </label>

                <input
                    id="newPw"
                    type="password"
                    minlength="6">

            </div>


            <div class="field">

                <label>
                    Confirm new password
                </label>

                <input
                    id="newPw2"
                    type="password"
                    minlength="6">

            </div>


            <button
                class="btn-primary"
                onclick="changeClientPassword()">

                Change Password

            </button>


            <div
                class="confirm-msg"
                id="pwChanged">

                Password changed successfully.

            </div>
        `;


        settings.appendChild(card);
    }


    window.changeClientPassword =
        function () {

            const currentUser =
                getCurrentUser();

            if (!currentUser) {
                return;
            }


            const oldPassword =
                document.getElementById(
                    "oldPw"
                ).value;

            const newPassword =
                document.getElementById(
                    "newPw"
                ).value;

            const confirmPassword =
                document.getElementById(
                    "newPw2"
                ).value;


            if (
                String(currentUser.pw ?? "") !==
                oldPassword
            ) {

                alert(
                    "Current password is incorrect."
                );

                return;
            }


            if (newPassword.length < 6) {

                alert(
                    "New password must be at least 6 characters."
                );

                return;
            }


            if (
                newPassword !==
                confirmPassword
            ) {

                alert(
                    "New passwords do not match."
                );

                return;
            }


            const users =
                get("users", []);

            const index =
                users.findIndex(
                    user =>
                        String(user.id)
                            .toUpperCase() ===
                        String(currentUser.id)
                            .toUpperCase()
                );


            if (index === -1) {
                return;
            }


            users[index].pw =
                newPassword;

            users[index]
                .lastPasswordChangeAt =
                new Date().toISOString();


            set(
                "users",
                users
            );


            document.getElementById(
                "oldPw"
            ).value = "";

            document.getElementById(
                "newPw"
            ).value = "";

            document.getElementById(
                "newPw2"
            ).value = "";


            const message =
                document.getElementById(
                    "pwChanged"
                );

            if (message) {
                message.style.display =
                    "block";
            }
        };


    /* ==============================
       REGISTRATION
       ============================== */

    function addRegistrationRoute() {

        const token =
            new URLSearchParams(
                location.search
            ).get("register");


        if (!token) {
            return;
        }


        const invitation =
            get("invites", [])
                .find(
                    item =>
                        item.token === token &&
                        item.active
                );


        if (!invitation) {
            return;
        }


        const login =
            document.getElementById(
                "login"
            );

        if (!login) {
            return;
        }


        login.innerHTML = `

            <div class="login-card">

                <div class="login-mark">
                    MM
                </div>

                <h1>
                    Join MMA Mess - Mount Road
                </h1>

                <p class="sub">
                    Registration request —
                    management approval required
                </p>


                <div class="field">
                    <label>
                        Room number
                    </label>

                    <input
                        id="regRoom"
                        type="text">
                </div>


                <div class="field">
                    <label>
                        Name
                    </label>

                    <input
                        id="regName"
                        type="text">
                </div>


                <div class="field">
                    <label>
                        Type
                    </label>

                    <select id="regType">

                        <option value="student">
                            Student
                        </option>

                        <option value="worker">
                            Worker
                        </option>

                    </select>
                </div>


                <div class="field">
                    <label>
                        Create password
                    </label>

                    <input
                        id="regPw"
                        type="password">
                </div>


                <div class="field">
                    <label>
                        Confirm password
                    </label>

                    <input
                        id="regPw2"
                        type="password">
                </div>


                <button
                    class="btn-primary"
                    onclick="submitClientRegistration(
                        '${escapeHTML(token)}'
                    )">

                    Send Registration Request

                </button>


                <div class="hint">
                    Your account becomes active
                    only after admin / mess
                    secretary approval.
                </div>

            </div>
        `;
    }


    /* ==============================
       USER ACTIVITY
       ============================== */

    function updateUserActivity() {

        const currentUser =
            getCurrentUser();

        if (!currentUser) {
            return;
        }


        const users =
            get("users", []);

        const index =
            users.findIndex(
                user =>
                    String(user.id)
                        .toUpperCase() ===
                    String(currentUser.id)
                        .toUpperCase()
            );


        if (index === -1) {
            return;
        }


        users[index].lastActivityAt =
            new Date().toISOString();


        set(
            "users",
            users
        );
    }


    /* ==============================
       INITIALIZATION
       ============================== */

    const oldInit =
        window.initApp;


    window.initApp =
        function () {

            if (
                typeof oldInit ===
                "function"
            ) {
                oldInit();
            }


            insertRequestSection();

            renderRequests();
        };


    /* ==============================
       SCREEN CHANGE
       ============================== */

    const oldOpenScreen =
        window.openScreen;


    window.openScreen =
        function (id) {

            if (
                typeof oldOpenScreen ===
                "function"
            ) {
                oldOpenScreen(id);
            }


            if (
                id ===
                "clientRequests"
            ) {
                renderRequests();
            }


            updateUserActivity();
        };


    /* ==============================
       PAGE LOAD
       ============================== */

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            addRegistrationRoute();

            insertRequestSection();

            addPasswordSection();

        }
    );

})();

/* MMA Mess - Mount Road user enhancements - consolidated fixes */
(function () {
  "use strict";

  const PREFIX = "mma_";
  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (_) {}
  };
  const uid = () => String(
    (typeof currentUser !== "undefined" && currentUser && currentUser.id) || read("currentUserId", "") || ""
  ).toUpperCase();
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const user = () => {
    if (typeof currentUser !== "undefined" && currentUser) return currentUser;
    const id = uid();
    return read("users", []).find(u => String(u.id || "").toUpperCase() === id) || null;
  };
  const keyFor = d => window.mmaMessDate.calendarKey(d);
  const target = n => window.mmaMessDate.targetDate(n);
  const formatTime = value => {
    const parts = String(value || "06:00").split(":");
    let h = Number(parts[0] || 0); const m = parts[1] || "00";
    const suffix = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
  };
  const configuredCutoff = () => {
    const settings = read("generalSettings", {});
    return settings && (settings.tomorrowCutoff || settings.cutoffTime) ||
      read("cutoffTime", "23:00");
  };
  const isCutoffClosed = () => window.mmaMessDate.timeKey() >= configuredCutoff();

  function applyTheme() {
    const saved = read("theme", "dark");
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "dark";
    const next = current === "dark" ? "light" : "dark";
    write("theme", next); applyTheme(); updateThemeButton();
  }
  function updateThemeButton() {
    const isDark = document.documentElement.dataset.theme === "dark";
    const text = isDark ? "☀️" : "🌙";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    const b = document.getElementById("themeToggleBtn");
    const hb = document.getElementById("themeHeaderBtn");
    if (b) {
      b.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";
      b.setAttribute("aria-label", label);
    }
    if (hb) {
      hb.textContent = text;
      hb.setAttribute("aria-label", label);
      hb.setAttribute("title", label);
    }
  }
  window.toggleTheme = toggleTheme;

  function notificationAudience(n) {
    if (!n) return false;
    if (n.audience === "admins") return false;
    const owner=String(n.userId||"").toUpperCase();
    if(n.audience==="user")return !!owner&&owner===uid();
    if(["all","users","students"].includes(n.audience))return !owner||owner===uid();
    return !n.audience&&!owner;
  }
  function getNotificationsForUser() {
    const all=read("notifHistory", []); return Array.isArray(all) ? all.filter(notificationAudience) : [];
  }
  function getRead() { return read("readNotifications_" + uid(), []); }
  function setRead(ids) { write("readNotifications_" + uid(), ids); }
  function markNotificationRead(id) {
    const ids=getRead();
    if (!ids.includes(id)) { ids.push(id); setRead(ids); }
    if (/^[a-f\d]{24}$/i.test(id) && typeof api !== "undefined" && typeof api.markNotificationRead === "function") {
      api.markNotificationRead(id).catch(function(error) {
        console.error("Unable to mark notification as read:", error);
        if (window.MMAUI && typeof window.MMAUI.toast === "function") {
          window.MMAUI.toast(error.message || "Notification read state could not be saved.", "error");
        }
      });
    }
  }
  function addNotification(title, message, targetScreen, userId, dedupeKey) {
    const all=read("notifHistory", []);
    const list=Array.isArray(all)?all:[];
    if (dedupeKey && list.some(n => n.dedupeKey === dedupeKey && (!userId || n.userId === userId))) return;
    list.unshift({
      id: "NTF-" + Date.now() + "-" + Math.random().toString(36).slice(2,7),
      t:title, m:message, d:new Date().toLocaleString("en-IN"),
      target:targetScreen || "home", userId:userId || null, audience:userId ? "user" : "users",
      dedupeKey:dedupeKey || null, createdAt:new Date().toISOString()
    });
    write("notifHistory", list);
  }
  window.mmaAddNotification = addNotification;

  function renderNotifications() {
    const list=document.getElementById("notifList"); const badge=document.getElementById("notifBadge");
    if (!list) return;
    const notifications=getNotificationsForUser(); const read=getRead();
    const unread=notifications.filter(n => n.read !== true && !read.includes(n.id)).length;
    if (badge) { badge.textContent=unread; badge.style.display=unread ? "flex" : "none"; }
    const markAll=document.getElementById("markAllNotificationsBtn");
    if (markAll) markAll.disabled=!unread;
    if (!notifications.length) { list.innerHTML='<div class="empty">No notifications available.</div>'; return; }
    list.innerHTML=notifications.map((n, index) => {
      const id=n.id || (n.d + n.t + index); const isUnread=n.read !== true && !read.includes(n.id);
      return `<button class="notif-item ${isUnread ? "is-unread" : ""}" data-notif-id="${id}" data-target="${n.target || "home"}" type="button">
        <div class="nt">${isUnread ? '<span class="dot"></span>' : ""}${escapeHTML(n.t || "Update")}</div>
        <div class="nm">${escapeHTML(n.m || "")}</div><div class="nd">${escapeHTML(n.d || "")}</div>
      </button>`;
    }).join("");
    list.querySelectorAll(".notif-item").forEach(btn => btn.addEventListener("click", function(){
      const id=this.dataset.notifId; markNotificationRead(id); renderNotifications();
      if (typeof window.openScreen === "function") window.openScreen(this.dataset.target || "home");
    }));
  }
  async function markAllNotificationsRead() {
    const notifications=getNotificationsForUser();
    try {
      if (typeof api === "undefined" || typeof api.markNotificationsRead !== "function") {
        throw new Error("Notification read state is unavailable.");
      }
      await api.markNotificationsRead();
      const ids=notifications.map(n=>n.id).filter(Boolean);
      setRead(ids);
      notifications.forEach(n => { n.read=true; });
      write("notifHistory", read("notifHistory", []));
      renderNotifications();
    } catch (error) {
      console.error("Unable to mark notifications as read:", error);
      if (window.MMAUI && typeof window.MMAUI.toast === "function") {
        window.MMAUI.toast(error.message || "Notifications could not be marked as read.", "error");
      }
    }
  }
  window.markNotifsRead = markAllNotificationsRead;
  window.renderNotifs = renderNotifications;

  async function clearAllNotifications() {
    if (!window.confirm("Clear all notifications?")) return;
    try {
      if (typeof api === "undefined" || typeof api.clearNotifications !== "function") {
        throw new Error("Notification clearing is unavailable.");
      }
      await api.clearNotifications();
      const current=read("notifHistory", []);
      write("notifHistory",(Array.isArray(current)?current:[]).filter(n=>!notificationAudience(n)));
      setRead([]);
      renderNotifications();
      if (window.MMAUI && typeof window.MMAUI.toast === "function") {
        window.MMAUI.toast("Notifications cleared.", "success");
      }
    } catch (error) {
      console.error("Unable to clear notifications:", error);
      if (window.MMAUI && typeof window.MMAUI.toast === "function") {
        window.MMAUI.toast(error.message || "Notifications could not be cleared.", "error");
      }
    }
  }
  window.clearAllNotifications = clearAllNotifications;

  function ensureNotificationControls() {
    const section=document.getElementById("notifs");
    if (section && !document.getElementById("markAllNotificationsBtn")) {
      const title=section.querySelector(".section-title");
      if (title) {
        const b=document.createElement("button"); b.id="markAllNotificationsBtn"; b.className="btn-secondary small notif-mark-all"; b.type="button"; b.textContent="Mark all read";
        b.addEventListener("click", markAllNotificationsRead); title.appendChild(b);
      }
    }
    const back=document.querySelector("#notifs .back");
    if(back&&!back.__mmaHistoryBack){
      back.onclick=null;
      back.addEventListener("click",goBackFromNotifications);
      back.__mmaHistoryBack=true;
    }
    const card=document.querySelector("#notifs #notifList")?.parentElement;
    if(card&&!document.getElementById("clearAllNotificationsBtn")){
      const button=document.createElement("button");button.id="clearAllNotificationsBtn";button.className="btn-secondary small notif-clear-all";button.type="button";button.textContent="Clear All";
      button.addEventListener("click",clearAllNotifications);
      card.insertBefore(button,card.firstChild);
    }
  }

  function addBackButtons() {
    const targets={mess:"home",monthly:"more",bill:"home",notifs:"home",more:"home",settings:"more",clientRequests:"more"};
    Object.keys(targets).forEach(id=>{
      const s=document.getElementById(id); if (!s || s.querySelector(".back")) return;
      const b=document.createElement("button"); b.className="back mma-back"; b.type="button"; b.textContent="← Back";
      b.addEventListener("click", () => { window.__mmaBack=true; window.openScreen(targets[id]); });
      s.insertBefore(b, s.firstChild);
    });
  }

  const baseOpenScreen=window.openScreen;
  let history=Array.isArray(window.__mmaScreenHistory) ? window.__mmaScreenHistory : [];
  window.openScreen=function(id){
    if (!id) return;
    const current=document.querySelector("main .screen.active")?.id;
    if (!window.__mmaBack && current && current !== id) history.push(current);
    if (window.__mmaBack) { history = history.filter((v,i,a)=>i===a.length-1 || v!==id); window.__mmaBack=false; }
    window.__mmaScreenHistory=history;
    if (typeof baseOpenScreen === "function") baseOpenScreen(id);
    if (id === "notifs") renderNotifications();
    if (id === "settings") { ensureThemeSetting(); updateThemeButton(); }
    updateUserActivity();
  };

  function updateUserActivity() {
    const id=uid(); if (!id) return; const users=read("users", []); const i=users.findIndex(u=>String(u.id||"").toUpperCase()===id);
    if (i<0) return; users[i].lastActivityAt=new Date().toISOString(); write("users",users);
  }

  function ensureThemeSetting() {
    const settings=document.getElementById("settings"); if (!settings || document.getElementById("themeSettingCard")) return;
    const card=document.createElement("div"); card.id="themeSettingCard"; card.className="card theme-card";
    card.innerHTML='<div><b>Appearance</b><div class="theme-help">Your theme preference is saved on this device.</div></div><button id="themeToggleBtn" class="btn-secondary small" type="button"></button>';
    settings.appendChild(card); card.querySelector("button").addEventListener("click",toggleTheme); updateThemeButton();
  }

  function updateCutoffUI() {
    const value=configuredCutoff();
    const display=document.getElementById("cutoffTimeDisplay"); if (display) display.textContent=formatTime(value);
    const closed=isCutoffClosed();
    const submit=document.getElementById("tomorrowSubmitBtn"); const edit=document.getElementById("tomorrowEditBtn"); const note=document.querySelector(".cutoff-note");
    if (note) note.innerHTML=closed ? `Mess entry closed at <span>${escapeHTML(formatTime(value))}</span>.` : `Mess entry closes at <span>${escapeHTML(formatTime(value))}</span>.`;
    if (submit && submit.dataset.mmaClosed !== "1") submit.disabled=closed;
    if (edit && edit.dataset.mmaClosed !== "1") edit.disabled=closed;
    if (note) note.classList.toggle("closed", closed);
  }

  function renderTomorrow() {
    if (!window.currentUser && typeof currentUser === "undefined") return;
    const c=document.getElementById("qtyRows"); if (!c) return;
    const d=target(1); const label=document.getElementById("tomorrowEntryDate"); if(label) label.textContent=`(${d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})})`;
    const hist=read("messEntryHistory", []); const u=user(); if(!u) return;
    const entry=hist.find(e=>String(e.user||"").toUpperCase()===String(u.id).toUpperCase() && e.date===keyFor(d));
    const q={breakfast:Number(entry?.b||0),lunch:Number(entry?.l||0),dinner:Number(entry?.d||0)};
    const closed=isCutoffClosed(); const submitted=!!entry;
    ["breakfast","lunch","dinner"].forEach(meal=>{ if (typeof qty !== "undefined") qty[meal]=q[meal]; });
    c.innerHTML=["breakfast","lunch","dinner"].map(meal=>`<div class="qty-row"><div class="qty-label" style="text-transform:capitalize">${meal}</div><div class="qty-ctrl"><button ${closed||submitted?"disabled":""} onclick="changeQty('${meal}',-1)">−</button><span class="val" id="qv_${meal}">${q[meal]}</span><button ${closed||submitted?"disabled":""} onclick="changeQty('${meal}',1)">+</button></div></div>`).join("");
    const confirmation=document.getElementById("entryConfirm"), submit=document.getElementById("tomorrowSubmitBtn"), edit=document.getElementById("tomorrowEditBtn");
    if(confirmation) confirmation.style.display=submitted?"block":"none";
    if(submit){submit.style.display=submitted?"none":"block";submit.disabled=closed;}
    if(edit){edit.style.display=submitted&&!closed?"block":"none";edit.disabled=closed;}
    updateCutoffUI();
  }

  window.renderQty=renderTomorrow;
  window.changeQty=function(meal,diff){ if(isCutoffClosed()) return; if(typeof qty==='undefined') return; qty[meal]=Math.max(0,Math.min(99,Number(qty[meal]||0)+diff)); const el=document.getElementById("qv_"+meal); if(el) el.textContent=qty[meal]; };
  // Removed window.editTomorrowEntry - now handled by step2-user.js and app.js to avoid conflicts
  // Legacy localStorage-only submitEntry removed - use API-integrated version from api-integration.js
  function addAdminActivityNotification(u,e){
    const all=read("adminNotifications",[]); const list=Array.isArray(all)?all:[]; const key="entry-"+u.id+"-"+e.date; if(list.some(n=>n.dedupeKey===key)) return;
    list.unshift({id:"AN-"+Date.now(),title:"New mess entry",message:`${u.name||u.id} submitted tomorrow's entry.`,target:"entries",createdAt:new Date().toISOString(),dedupeKey:key}); write("adminNotifications",list);
  }

  function patchLoginActivity(){
    const original=window.doLogin; if(typeof original!=="function" || original.__mmaWrapped) return;
    const wrapped=function(){ original.apply(this,arguments); const u=user(); if(u){const users=read("users",[]); const i=users.findIndex(x=>String(x.id||"").toUpperCase()===String(u.id).toUpperCase()); if(i>=0){users[i].lastLoginAt=new Date().toISOString();users[i].lastActivityAt=new Date().toISOString();write("users",users);}} applyTheme(); }; wrapped.__mmaWrapped=true; window.doLogin=wrapped;
  }

  function registerRoute(){
    const token=new URLSearchParams(location.search).get("register"); if(!token) return;
    const invitations=read("invitations",[]); const invite=(Array.isArray(invitations)?invitations:[]).find(i=>String(i.code)===String(token)&&i.status!=="used"); if(!invite) return;
    const login=document.getElementById("login"); if(!login) return;
    login.innerHTML=`<div class="login-card"><div class="login-mark">MM</div><h1>Join MMA Mess - Mount Road</h1><p class="sub">Registration request — management approval required</p><div class="field"><label>Name</label><input id="regName" type="text"></div><div class="field"><label>Room number</label><input id="regRoom" type="text"></div><div class="field"><label>Phone number</label><input id="regPhone" type="tel" autocomplete="tel"></div><div class="field"><label>Gmail ID</label><input id="regEmail" type="email" autocomplete="email"></div><div class="field"><label>Create password</label><input id="regPw" type="password"></div><div class="field"><label>Confirm password</label><input id="regPw2" type="password"></div><button class="btn-primary" id="regSubmit">Send Registration Request</button><div class="err-msg" id="regError"></div><div class="hint">Your account becomes active only after management approval.</div></div>`;
    document.getElementById("regSubmit").onclick=async function(){
      const name=document.getElementById("regName").value.trim(), room=document.getElementById("regRoom").value.trim(), phone=document.getElementById("regPhone").value.replace(/\D/g,""), email=document.getElementById("regEmail").value.trim().toLowerCase(), pw=document.getElementById("regPw").value, pw2=document.getElementById("regPw2").value;
      const error=document.getElementById("regError");
      if(!name||!room||!/^\d{10}$/.test(phone)||!email||pw!==pw2||pw.length<6){error.textContent="Enter all details, a valid 10-digit phone number, a Gmail address, and matching passwords of at least 6 characters.";error.style.display="block";return;}
      const button=document.getElementById("regSubmit");button.disabled=true;
      try {
        await api.register({name,room,phone,email,password:pw,confirm:pw2});
        const invs=read("invitations",[]);const ii=invs.findIndex(i=>String(i.code)===String(token));if(ii>=0){invs[ii].status="used";invs[ii].usedAt=new Date().toISOString();write("invitations",invs);}
        login.innerHTML='<div class="login-card"><div class="login-mark">✓</div><h1>Request submitted</h1><p class="sub">Management will approve your account. You can sign in using your registered email or phone after approval.</p></div>';
      } catch(err) {
        error.textContent=err.message||"Registration request could not be submitted.";
        error.style.display="block";
      } finally {
        button.disabled=false;
      }
    };
  }

  function enhanceInit(){
    applyTheme(); addBackButtons(); ensureNotificationControls(); ensureThemeSetting(); updateCutoffUI(); renderNotifications(); patchLoginActivity(); registerRoute();
  }

  document.addEventListener("DOMContentLoaded", enhanceInit);
  window.addEventListener("storage",()=>{applyTheme();updateCutoffUI();renderNotifications();});
  window.addEventListener("focus",()=>{updateCutoffUI();renderNotifications();});
  setInterval(updateCutoffUI,30000);
})();

/* Admin permission: a manually approved entry can be eaten/confirmed after the normal clock closes. */
(function(){
  const read=(k,d)=>{try{const v=localStorage.getItem('mma_'+k);return v===null?d:JSON.parse(v);}catch(e){return d;}};
  function approvedToday(short){
    if(!currentUser)return false;const today=(typeof getDateKey==='function')?getDateKey(getTargetDate(0)):'';const h=read('messEntryHistory',[]);const e=Array.isArray(h)?h.find(x=>String(x.user||'').toUpperCase()===String(currentUser.id||'').toUpperCase()&&x.date===today):null;return !!(e&&e.adminApproved&&Number(e[short]||0)>0);
  }
  const oldOpen=window.isMealOpen;
  window.isMealOpen=function(mealKey){const map={breakfast:'b',lunch:'l',dinner:'d'};if(approvedToday(map[mealKey]))return true;return typeof oldOpen==='function'?oldOpen(mealKey):false;};
  const oldPast=window.isMealPastClose;
  window.isMealPastClose=function(mealKey){const map={breakfast:'b',lunch:'l',dinner:'d'};if(approvedToday(map[mealKey]))return false;return typeof oldPast==='function'?oldPast(mealKey):false;};
  const oldEffective=window.getEffectiveMealValue;
  window.getEffectiveMealValue=function(userId,dateKey,entry,short){if(entry&&entry.adminApproved)return {planned:Number(entry[short]||0),value:Number(entry[short]||0),fine:false,adminApproved:true};return typeof oldEffective==='function'?oldEffective(userId,dateKey,entry,short):{planned:Number(entry?.[short]||0),value:Number(entry?.[short]||0),fine:false};};
})();


/* =========================================================
   MMA STEP 2 FINAL - USER MESS ENTRY / CONFIRMATION
   Frontend-only until backend integration.
   ========================================================= */
(function(){
  const read=(k,d)=>{try{const v=localStorage.getItem("mma_"+k);return v===null?d:JSON.parse(v);}catch(e){return d;}};
  const write=(k,v)=>{try{localStorage.setItem("mma_"+k,JSON.stringify(v));}catch(e){}};
  const user=()=>{try{return typeof currentUser!=="undefined"?currentUser:null;}catch(e){return null;}};
  const settings=()=>Object.assign({
    tomorrowCutoff:"23:00",
    breakfastOpen:"07:00", breakfastClose:"11:00",
    lunchOpen:"07:00", lunchClose:"15:00",
    dinnerOpen:"19:30", dinnerClose:"23:30"
  },read("generalSettings",{}));
  const target=n=>window.mmaMessDate.targetDate(n);
  const key=d=>window.mmaMessDate.calendarKey(d);
  const fmt=v=>{const p=String(v||"00:00").split(":");let h=Number(p[0]||0),m=String(p[1]||"00");const ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${m} ${ap}`;};
  const mins=v=>{const p=String(v||"00:00").split(":");return Number(p[0]||0)*60+Number(p[1]||0);};

  /* The cutoff is today's configured time for tomorrow's entry. */
  function cutoffClosed(){
    const t=settings().tomorrowCutoff;
    return window.mmaMessDate.timeKey()>=t;
  }

  let tomorrowDirty=false;
  let localQty={breakfast:0,lunch:0,dinner:0};
  const mealShort={breakfast:"b",lunch:"l",dinner:"d"};

  function normalizeQuantity(value){
    const number=Number(value);
    return Number.isFinite(number)?Math.max(0,Math.min(99,Math.trunc(number))):0;
  }

  function isCancelledMeal(meal){
    return typeof isMealCancelled==="function"&&isMealCancelled(key(target(1)),mealShort[meal]);
  }

  function syncSavedQty(entry){
    if(tomorrowDirty)return;
    localQty={
      breakfast:normalizeQuantity(entry&&(entry.breakfast==null?entry.b:entry.breakfast)),
      lunch:normalizeQuantity(entry&&(entry.lunch==null?entry.l:entry.lunch)),
      dinner:normalizeQuantity(entry&&(entry.dinner==null?entry.d:entry.dinner))
    };
    ["breakfast","lunch","dinner"].forEach(meal=>{if(isCancelledMeal(meal))localQty[meal]=0;});
    if(typeof qty!=="undefined"){qty.breakfast=localQty.breakfast;qty.lunch=localQty.lunch;qty.dinner=localQty.dinner;}
  }

  function getEntry(){
    const u=user(); if(!u)return null;
    const hist=read("messEntryHistory",[]);
    return Array.isArray(hist)?hist.find(e=>String(e.user||e.user_id||"").toUpperCase()===String(u.id||"").toUpperCase()&&e.date===key(target(1))):null;
  }

  function getQty(){
    const e=getEntry();
    if(tomorrowDirty)return localQty;
    return e?{breakfast:normalizeQuantity(e.breakfast==null?e.b:e.breakfast),lunch:normalizeQuantity(e.lunch==null?e.l:e.lunch),dinner:normalizeQuantity(e.dinner==null?e.d:e.dinner)}:{breakfast:0,lunch:0,dinner:0};
  }

  function getTomorrowMenu(){
    const saved=read("tomorrowMenu",null);
    if(saved&&saved.date===key(target(1)))return saved;
    const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const row=(read("weekMenu",[])||[]).find(item=>String(item.day||"").toLowerCase()===days[target(1).getDay()].toLowerCase())||{};
    return {breakfast:row.b||"",lunch:row.l||"",dinner:row.d||""};
  }

  function escapeHTML(value){
    return String(value||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function setButtonState(el,disabled){if(el){el.disabled=disabled;el.classList.toggle("disabled",disabled);}}

  function renderTomorrowEntry(){
    const c=document.getElementById("qtyRows");
    if(!c||!user())return;
    const st=settings(), closed=cutoffClosed(), entry=getEntry();
    /* Only sync saved quantities when not in edit mode to prevent overwriting
       user's unsaved changes with stale server data. */
    if(!tomorrowDirty)syncSavedQty(entry);
    const submitted=!!entry&&!tomorrowDirty;
    const locked=closed||submitted;
    const isEditMode=tomorrowDirty;

    const menu=getTomorrowMenu();
    const tomorrowKey=key(target(1));
    c.innerHTML=["breakfast","lunch","dinner"].map(meal=>`
      <div class="qty-row">
        <div class="qty-label mma-tomorrow-meal-label"><b>${meal.charAt(0).toUpperCase()+meal.slice(1)}</b><span>${escapeHTML(menu[meal]||"Menu not published yet")}</span>${isCancelledMeal(meal)?'<small class="confirmation-meal-time">Cancelled by administration</small>':""}</div>
        <div class="qty-ctrl">
          <button type="button" ${locked||isCancelledMeal(meal)?"disabled":""} onclick="changeQty('${meal}',-1)">−</button>
          <span class="val" id="qv_${meal}">${localQty[meal]}</span>
          <button type="button" ${locked||isCancelledMeal(meal)?"disabled":""} onclick="changeQty('${meal}',1)">+</button>
        </div>
      </div>`).join("")+`<div class="mma-qty-more-note" style="${isEditMode?'display:none':''}">You can enter more than 2 portions.</div>`;

    const note=document.querySelector(".cutoff-note");
    const submit=document.getElementById("tomorrowSubmitBtn");
    const edit=document.getElementById("tomorrowEditBtn");
    const confirm=document.getElementById("entryConfirm");
    const dateLabel=document.getElementById("tomorrowEntryDate");

    if(dateLabel)dateLabel.textContent=`(${target(1).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short"})})`;

    if(note){
      note.classList.toggle("closed",closed);
      note.innerHTML=closed
        ? `<div class="mma-closed-banner">Time over for tomorrow's entry</div>`
        : `Mess entry closes at <span id="cutoffTimeDisplay">${fmt(st.tomorrowCutoff)}</span>.`;
    }
    if(submit){submit.style.display=submitted?"none":"block";setButtonState(submit,closed);}
    if(edit){edit.style.display=submitted&&!closed?"block":"none";setButtonState(edit,closed);}
    if(confirm)confirm.style.display=submitted?"block":"none";
  }

  /* Final quantity handler: no artificial limit of 2. */
  window.mmaChangeTomorrowQty=function(meal,difference){
    if(cutoffClosed()) {renderTomorrowEntry();return;}
    if(!Object.prototype.hasOwnProperty.call(mealShort,meal)||isCancelledMeal(meal))return;
    const entry=getEntry();
    if(entry&&!tomorrowDirty)return;
    const delta=Number(difference);
    if(!Number.isInteger(delta))return;
    localQty[meal]=Math.max(0,Math.min(99,normalizeQuantity(localQty[meal])+delta));
    tomorrowDirty=true;
    if(typeof qty!=="undefined")qty[meal]=localQty[meal];
    const value=document.getElementById("qv_"+meal);if(value)value.textContent=localQty[meal];
  };
  window.changeQty=window.mmaChangeTomorrowQty;

  window.mmaGetTomorrowEntryDraft=function(){return {...localQty};};
  window.mmaSyncTomorrowQty=syncSavedQty;
  window.mmaCommitTomorrowEntry=function(entry){
    const u=user();
    if(!entry||entry.date!==key(target(1))||String(entry.user_id||entry.user||"").toUpperCase()!==String(u&&u.id||"").toUpperCase())return;
    localQty={breakfast:normalizeQuantity(entry.breakfast==null?entry.b:entry.breakfast),lunch:normalizeQuantity(entry.lunch==null?entry.l:entry.lunch),dinner:normalizeQuantity(entry.dinner==null?entry.d:entry.dinner)};
    ["breakfast","lunch","dinner"].forEach(meal=>{if(isCancelledMeal(meal))localQty[meal]=0;});
    tomorrowDirty=false;
    if(typeof qty!=="undefined"){qty.breakfast=localQty.breakfast;qty.lunch=localQty.lunch;qty.dinner=localQty.dinner;}
  };

  window.mmaEditTomorrowEntry=async function(){
    if(cutoffClosed()){renderTomorrowEntry();return false;}
    // Refresh entry history from API to ensure we have the latest data
    try {
      if(typeof window.refreshStudentEntryHistory === "function") {
        await window.refreshStudentEntryHistory();
      }
    } catch(error) {
      console.error("Unable to refresh entry history before edit:", error);
      if(window.MMAUI) window.MMAUI.toast("The latest mess entry could not be loaded. Please try again.", "error");
      return false;
    }
    const e=getEntry();
    if(e)localQty={breakfast:normalizeQuantity(e.breakfast==null?e.b:e.breakfast),lunch:normalizeQuantity(e.lunch==null?e.l:e.lunch),dinner:normalizeQuantity(e.dinner==null?e.d:e.dinner)};
    tomorrowDirty=true;
    if(typeof submitted!=="undefined")submitted=false;
    renderTomorrowEntry();
    return true;
  };
  window.editTomorrowEntry=window.mmaEditTomorrowEntry;

  let entrySaving=false;
  // Removed window.submitEntry - now handled by api-integration.js to avoid conflicts
  // This ensures consistent date and user_id handling in all submission paths

  function renderTodayConfirmation(){
    const box=document.getElementById("todayEntry");if(!box)return;
    const st=settings();
    const entry=(typeof getMyEntryForDate==="function")?getMyEntryForDate(key(target(0))):null;
    const meals=[
      ["Breakfast",Number(entry?.breakfast||entry?.b||0),st.breakfastOpen,st.breakfastClose],
      ["Lunch",Number(entry?.lunch||entry?.l||0),st.lunchOpen,st.lunchClose],
      ["Dinner",Number(entry?.dinner||entry?.d||0),st.dinnerOpen,st.dinnerClose]
    ];
    const shorts=["b","l","d"],todayKey=key(target(0));
    box.innerHTML=meals.map((m,i)=>{
      const eff=(typeof getEffectiveMealValue==="function"&&user())?getEffectiveMealValue(user().id,todayKey,entry,shorts[i]):{value:m[1],fine:false};
      return `
      <div class="qty-row">
        <div class="qty-label"><b>${m[0]}</b> <span class="mma-meal-time-label">(${fmt(m[2])} - ${fmt(m[3])})</span></div>
        <div class="qty-ctrl"><span class="val ${eff.fine?"monthly-fine":""}">${eff.value}</span></div>
      </div>`;}).join("");
  }

  function hideLogin(){
    const login=document.getElementById("login"),app=document.getElementById("app");
    const session=read("authSession",null),id=read("currentUserId","");
    if(session&&id&&login&&app){login.classList.remove("active");login.classList.add("step2-hidden");app.classList.add("step2-visible");app.style.display="block";}
  }

  /* Re-render only the clock/lock state, never the quantity values. */
  function refreshCutoffState(){
    const closed=cutoffClosed();
    const note=document.querySelector(".cutoff-note");
    if(!note)return;
    const st=settings();
    const alreadyClosed=note.classList.contains("closed");
    if(closed&&!alreadyClosed){renderTomorrowEntry();return;}
    if(!closed&&alreadyClosed){renderTomorrowEntry();return;}
    if(!closed){
      const span=document.getElementById("cutoffTimeDisplay");
      if(span)span.textContent=fmt(st.tomorrowCutoff);
    }
  }

  window.mmaRenderTomorrowEntry=renderTomorrowEntry;
  window.renderQty=renderTomorrowEntry;
  window.renderTomorrow=renderTomorrowEntry;

  document.addEventListener("DOMContentLoaded",()=>{
    hideLogin();
    setTimeout(()=>{hideLogin();renderTomorrowEntry();renderTodayConfirmation();},50);
  });
  window.addEventListener("pageshow",()=>{hideLogin();renderTomorrowEntry();renderTodayConfirmation();});
  window.addEventListener("focus",hideLogin);
  setInterval(()=>{hideLogin();refreshCutoffState();},1000);

  const oldRefresh=window.refreshMessEntryDates;
  window.refreshMessEntryDates=function(){
    if(typeof currentUser!=="undefined"&&currentUser){
      /* Do not re-render tomorrow's entry while the user is editing to prevent
         overwriting unsaved changes with stale server data. Only re-render
         when not in edit mode (tomorrowDirty is false). */
      if(!tomorrowDirty)renderTomorrowEntry();
      /* Today confirmation is rendered on login/pageshow and after entry updates.
         Avoid replacing its DOM on every periodic refresh (prevents flicker/disappearing labels). */
      if(typeof renderYesterdayEntry==="function")renderYesterdayEntry();
      if(typeof renderMonthly==="function")renderMonthly();
      if(typeof renderMealStatus==="function")renderMealStatus();
    }
  };
})();


/* =========================================================
   MMA MESS - USER APP
   ========================================================= */

/* ==================== SHARED STORAGE ==================== */

const store = {
  get(key, defaultValue) {
    try {
      const value = localStorage.getItem("mma_" + key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error("Storage read error:", error);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem("mma_" + key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage write error:", error);
    }
  }
};

/* ==================== ADMIN DATA ==================== */

function getUsers() {
  return store.get("users", []);
}

function getTodayMenu() {
  return store.get("todayMenu", {
    breakfast: "",
    lunch: "",
    dinner: ""
  });
}

function getWeekMenu() {
  return store.get("weekMenu", [
    { day: "Mon", b: "", l: "", d: "" },
    { day: "Tue", b: "", l: "", d: "" },
    { day: "Wed", b: "", l: "", d: "" },
    { day: "Thu", b: "", l: "", d: "" },
    { day: "Fri", b: "", l: "", d: "" },
    { day: "Sat", b: "", l: "", d: "" },
    { day: "Sun", b: "", l: "", d: "" }
  ]);
}

function getTomorrowEntries() {
  return store.get("tomorrowEntries", []);
}

function getBills() {
  return store.get("adminBills", []);
}

function getNotifications() {
  return store.get("notifHistory", []);
}

function getFeedback() {
  return store.get("feedback", []);
}

function getCutoffTime() {
  return store.get("cutoffTime", "06:00");
}

/* ==================== ENTRY HISTORY ==================== */

function getEntryHistory() {
  const history = store.get("messEntryHistory", []);
  return Array.isArray(history) ? history : [];
}

function saveEntryHistory(history) {
  store.set("messEntryHistory", history);
}

/* ==================== CURRENT USER ==================== */

let currentUser = null;

function findUser(userId) {
  return getUsers().find(function (user) {
    return String(user.id || "").toUpperCase() ===
      String(userId || "").toUpperCase();
  }) || null;
}

/* ==================== PASSWORD ==================== */

function togglePw() {
  const passwordInput = document.getElementById("pw");
  const button = document.getElementById("pwToggle");

  if (!passwordInput) return;

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    if (button) button.textContent = "Hide";
  } else {
    passwordInput.type = "password";
    if (button) button.textContent = "Show";
  }
}

/* ==================== LOGIN ==================== */

function doLogin() {
  const errorBox = document.getElementById("loginErr");
  if (errorBox) {
    errorBox.textContent = "Backend authentication is required to sign in.";
    errorBox.style.display = "block";
  }
}

/* ==================== LOGOUT ==================== */

function doLogout() {
  currentUser = null;
  store.set("currentUserId", "");

  const app = document.getElementById("app");
  const login = document.getElementById("login");
  const uid = document.getElementById("uid");
  const pw = document.getElementById("pw");

  if (app) app.style.display = "none";
  if (login) login.classList.add("active");
  if (uid) uid.value = "";
  if (pw) pw.value = "";

  openScreen("home");
}

/* ==================== NAVIGATION ==================== */

window.__mmaScreenHistory = Array.isArray(window.__mmaScreenHistory)
  ? window.__mmaScreenHistory
  : [];

function openScreen(id) {
  const active = document.querySelector("main .screen.active");
  if (!window.__mmaBackNavigation && active && active.id !== id) {
    window.__mmaScreenHistory.push(active.id);
  }
  window.__mmaBackNavigation = false;

  document.querySelectorAll("main .screen").forEach(function (screen) {
    screen.classList.remove("active");
  });

  const target = document.getElementById(id);
  if (target) target.classList.add("active");

  document.querySelectorAll("nav.bottom .navbtn").forEach(function (button) {
    button.classList.toggle("active", button.dataset.s === id);
  });

  // Authentication and role remain authoritative on the server. This value
  // only remembers the last in-app screen after that session is restored.
  if (currentUser && id !== "login") {
    store.set("lastScreen", id);
  }

  if (id === "notifs") markNotifsRead();
  if (id === "settings") updateSettings();
}

function goBackFromNotifications() {
  const previous = window.__mmaScreenHistory || [];
  const current = document.querySelector("main .screen.active")?.id;
  let destination = "";
  while (previous.length && !destination) {
    const candidate = previous.pop();
    if (candidate !== current && document.getElementById(candidate)) destination = candidate;
  }
  window.__mmaBackNavigation = true;
  openScreen(destination || "home");
}

function toggleSide() {
  const side = document.querySelector(".side");
  if (side) side.classList.toggle("open");
}

/* ==================== DATE FUNCTIONS ==================== */

function getDateKey(date) {
  return window.mmaMessDate.calendarKey(date);
}

function getTargetDate(daysFromToday) {
  return window.mmaMessDate.targetDate(daysFromToday);
}

function formatEntryDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short"
  });
}

/* ==================== INITIALIZE APP ==================== */

function initApp() {
  if (!currentUser) {
    const savedUserId = store.get("currentUserId", "");
    if (savedUserId) currentUser = findUser(savedUserId);
  }

  if (!currentUser) return;

  renderUserDetails();
  renderTodayMenu();
  renderWeekMenu();

  // Display entries for all three dates
  renderYesterdayEntry();
  renderTodayEntry();
  renderQty();

  renderMealStatus();
  renderMonthly();
  renderBills();
  renderNotifs();
  updateSettings();
}

/* ==================== USER DETAILS ==================== */

function renderUserDetails() {
  if (!currentUser) return;

  const name = currentUser.name || currentUser.id || "User";

  const headerName = document.getElementById("hdrName");
  const greeting = document.getElementById("greetText");
  const date = document.getElementById("todayDate");

  if (headerName) headerName.textContent = name;
  if (greeting) greeting.textContent = "Hi, " + name;

  if (date) {
    date.textContent = getTargetDate(0).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }
}

/* ==================== TODAY MENU ==================== */

function renderTodayMenu() {
  const container = document.getElementById("todayFood");
  if (!container) return;

  const todayMenu = getTodayMenu();

  const emoji = {
    breakfast: "🥣",
    lunch: "🍚",
    dinner: "🍛"
  };

  container.innerHTML = Object.entries(todayMenu).map(function (item) {
    const meal = item[0];
    const food = item[1];

    return `
      <div class="food-card">
        <div class="emoji">${emoji[meal] || "🍽️"}</div>
        <div class="meal">${meal}</div>
        <div class="name">${food || "Not updated"}</div>
      </div>
    `;
  }).join("");
}

/* ==================== WEEKLY MENU ==================== */

function renderWeekMenu() {
  const container = document.getElementById("weekMenu");
  if (!container) return;

  const week = getWeekMenu();

  const escapeHtml = function(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  };
  const todayLabel = window.mmaMessDate.weekdayKey();
  container.innerHTML = week.map(function (day) {
    const dayLabel = String(day.day || "").trim();
    const isToday = dayLabel.toLowerCase().slice(0, 3) === todayLabel;
    const meals = [
      ["Breakfast", day.b],
      ["Lunch", day.l],
      ["Dinner", day.d]
    ];
    return `
      <article class="day-card${isToday ? " is-today" : ""}">
        <div class="day-card-head">
          <div class="day">${escapeHtml(dayLabel || "Day")}</div>
          ${isToday ? '<span class="today-tag">Today</span>' : ""}
        </div>
        <div class="day-meals">
          ${meals.map(function (meal) {
            const food = String(meal[1] || "").trim();
            return `<div class="day-meal">
              <span class="day-meal-label">${meal[0]}</span>
              <span class="day-meal-food${food ? "" : " is-empty"}">${escapeHtml(food || "Menu not published")}</span>
            </div>`;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

/* ==================== FIND USER ENTRY BY DATE ==================== */

function getMyEntryForDate(dateKey) {
  if (!currentUser) return null;

  const userId = String(currentUser.id || "").toUpperCase();

  return getEntryHistory().find(function (entry) {
    return (
      (String(entry.user || entry.user_id || "").toUpperCase() === userId) &&
      entry.date === dateKey
    );
  }) || null;
}

/* ==================== COMMON ENTRY DISPLAY ==================== */

function renderEntryRows(container, entry, dateKey) {
  if (!container) return;

  const userId = currentUser ? currentUser.id : "";
  const meals = [
    ["Breakfast", "b", "breakfast"],
    ["Lunch", "l", "lunch"],
    ["Dinner", "d", "dinner"]
  ];

  // Normalize entry field names to support both API and localStorage formats
  const normalizedEntry = entry ? {
    ...entry,
    b: entry.breakfast || entry.b || 0,
    l: entry.lunch || entry.l || 0,
    d: entry.dinner || entry.d || 0
  } : null;

  container.innerHTML = meals.map(function (meal) {
    const eff = getEffectiveMealValue(userId, dateKey || (entry && entry.date), normalizedEntry, meal[1]);
    const window = getMealWindow(meal[2]);
    return `
      <div class="qty-row">
        <div class="qty-label"><span>${meal[0]}</span><small class="confirmation-meal-time">${formatTime12(window[0])} - ${formatTime12(window[1])}</small></div>
        <div class="qty-ctrl">
          <span class="val ${eff.fine ? "monthly-fine" : ""}">${eff.value}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ==================== MEAL PENALTY RULE ====================
   Shared by the user monthly points view and billing:
   - A saved portion counts normally.
   - After cutoff, only the missing expected portions are doubled.
   - An explicit opt-out keeps the normal booked point and adds the
     configured half-point surcharge separately; it locks that meal.
   - Every date is evaluated on its own and never moved to another date.
*/
const MEAL_SHORT_TO_KEY = { b: "breakfast", l: "lunch", d: "dinner" };

function isMealConfirmedFor(userId, dateKey, short) {
  const uid = String(userId || "").toUpperCase();
  const record = getMealRecords().find(function (r) {
    return String(r.user || "").toUpperCase() === uid && r.date === dateKey;
  });
  return !!(record && record.meals && record.meals[short]);
}

function isMealCancelled(dateKey, short) {
  return getMealCancellations().some(function (item) {
    return item.date === dateKey && item.meal_type === short && item.status === "cancelled";
  });
}

function getMealCancellations() {
  const cancellations = store.get("mealCancellations", []);
  return Array.isArray(cancellations) ? cancellations : [];
}

function getEffectiveMealValue(userId, dateKey, entry, short) {
  const planned = Math.max(0, Number(entry ? entry[short] : 0) || 0);
  const todayKey = getDateKey(getTargetDate(0));
  const mealKey = MEAL_SHORT_TO_KEY[short];
  const mealClosed = !!(dateKey && (dateKey < todayKey || (dateKey === todayKey && isMealPastClose(mealKey))));
  const uid = String(userId || "").toUpperCase();
  const record = getMealRecords().find(function (r) {
    return String(r.user || r.user_id || "").toUpperCase() === uid &&
      String(r.date || "").slice(0, 10) === dateKey;
  });
  const meal = record && record.meals ? record.meals[short] : null;

  const noFoodRequest = typeof window.getStudentNoFoodRequest === "function"
    ? window.getStudentNoFoodRequest(dateKey, short)
    : null;
  const noFoodStatus = noFoodRequest
    ? String(noFoodRequest.status || "pending").toLowerCase()
    : meal && meal.noFood && String(meal.noFood.status || "").toLowerCase();
  return MMAPoints.effectiveMeal({
    planned: planned,
    meal: meal,
    cancelled: isMealCancelled(dateKey, short),
    noFoodStatus: noFoodStatus,
    closed: mealClosed,
    adminApproved: !!(entry && entry.adminApproved)
  });
}

/* ==================== YESTERDAY'S MESS ENTRY ==================== */

function renderYesterdayEntry() {
  const container = document.getElementById("yesterdayEntry");
  const dateLabel = document.getElementById("yesterdayEntryDate");

  if (!container) return;

  const yesterday = getTargetDate(-1);
  const yesterdayKey = getDateKey(yesterday);

  if (dateLabel) {
    dateLabel.textContent = "(" + formatEntryDate(yesterday) + ")";
  }

  const entry = getMyEntryForDate(yesterdayKey);

  renderEntryRows(container, entry, yesterdayKey);
}

/* ==================== TODAY'S SAVED MESS ENTRY ==================== */

function renderTodayEntry() {
  if (!currentUser) return;

  const container = document.getElementById("todayEntry");
  const dateLabel = document.getElementById("todayEntryDate");

  // These elements must exist in index.html.
  if (!container) return;

  const today = getTargetDate(0);
  const todayKey = getDateKey(today);

  if (dateLabel) {
    dateLabel.textContent = "(" + formatEntryDate(today) + ")";
  }

  const entry = getMyEntryForDate(todayKey);

  renderEntryRows(container, entry, todayKey);
}

/* ==================== TOMORROW'S MESS ENTRY ==================== */

function getMyTomorrowEntry() {
  const tomorrowKey = getDateKey(getTargetDate(1));
  const entry = getMyEntryForDate(tomorrowKey);

  if (!entry) {
    return { breakfast: 0, lunch: 0, dinner: 0 };
  }

  return {
    breakfast: Number(entry.breakfast || entry.b || 0),
    lunch: Number(entry.lunch || entry.l || 0),
    dinner: Number(entry.dinner || entry.d || 0)
  };
}

let qty = getMyTomorrowEntry();
let submitted = false;
let tomorrowEditMode = false;

function checkSubmitted() {
  if (!currentUser) return false;

  const tomorrowKey = getDateKey(getTargetDate(1));
  return getMyEntryForDate(tomorrowKey) !== null;
}

function renderQty() {
  if (typeof window.mmaRenderTomorrowEntry === "function") {
    return window.mmaRenderTomorrowEntry();
  }

  const container = document.getElementById("qtyRows");
  const dateLabel = document.getElementById("tomorrowEntryDate");

  if (!container) return;

  const tomorrow = getTargetDate(1);

  if (dateLabel) {
    dateLabel.textContent = "(" + formatEntryDate(tomorrow) + ")";
  }

  if (typeof window.mmaSyncTomorrowQty === "function") {
    window.mmaSyncTomorrowQty(getMyEntryForDate(getDateKey(tomorrow)));
  } else {
    qty = getMyTomorrowEntry();
  }

  const saved = checkSubmitted();
  submitted = saved && !tomorrowEditMode;
  const isEditMode = tomorrowEditMode;

  let tomorrowMenu = {};
  try {
    const savedMenu = JSON.parse(localStorage.getItem("mma_tomorrowMenu") || "{}");
    if (savedMenu && typeof savedMenu === "object") tomorrowMenu = savedMenu;
  } catch (_) {}
  container.innerHTML = ["breakfast", "lunch", "dinner"].map(function (meal) {
    const short = { breakfast: "b", lunch: "l", dinner: "d" }[meal];
    const cancelled = isMealCancelled(getDateKey(tomorrow), short);
    if (cancelled) qty[meal] = 0;
    const dishName = String(tomorrowMenu[meal] || tomorrowMenu[short] || "").trim();
    const safeDishName = dishName.replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
    const dishLabel = dishName
      ? `<small class="tomorrow-dish-name">${safeDishName}</small>`
      : '<small class="tomorrow-dish-name menu-unpublished">Menu not published yet</small>';
    return `
      <div class="qty-row">
        <div class="qty-label" style="text-transform:capitalize">${meal}${dishLabel}${cancelled ? '<small class="confirmation-meal-time">Cancelled by administration</small>' : ""}</div>
        <div class="qty-ctrl">
          <button ${submitted || cancelled ? "disabled" : ""}
            onclick="changeQty('${meal}', -1)">−</button>
          <span class="val" id="qv_${meal}">${qty[meal]}</span>
          <button ${submitted || cancelled ? "disabled" : ""}
            onclick="changeQty('${meal}', 1)">+</button>
        </div>
      </div>
    `;
  }).join("");

  const confirmation = document.getElementById("entryConfirm");
  const submitButton = document.getElementById("tomorrowSubmitBtn");
  const editButton = document.getElementById("tomorrowEditBtn");

  if (confirmation) confirmation.style.display = submitted ? "block" : "none";
  if (submitButton) submitButton.style.display = submitted ? "none" : "block";
  if (editButton) editButton.style.display = submitted ? "block" : "none";
}

function changeQty(meal, difference) {
  if (typeof window.mmaChangeTomorrowQty === "function") {
    window.mmaChangeTomorrowQty(meal, difference);
    return;
  }

  if (submitted || isMealCancelled(getDateKey(getTargetDate(1)), { breakfast: "b", lunch: "l", dinner: "d" }[meal])) return;

  if (qty[meal] === undefined) qty[meal] = 0;

  const current = Number(qty[meal]);
  const delta = Number(difference);
  if (!Number.isFinite(delta)) return;
  qty[meal] = Math.max(
    0,
    Math.min(99, Math.trunc(Number.isFinite(current) ? current : 0) + Math.trunc(delta))
  );

  const value = document.getElementById("qv_" + meal);
  if (value) value.textContent = qty[meal];
}

function editTomorrowEntry() {
  if (typeof window.mmaEditTomorrowEntry === "function") {
    return window.mmaEditTomorrowEntry();
  }

  tomorrowEditMode = true;
  submitted = false;
  renderQty();
}

/* ==================== SAVE TOMORROW'S ENTRY ==================== */
// Legacy localStorage-only version replaced by API-integrated version in api-integration.js
// This function is kept only for reference and should not be called
function submitEntry_legacy() {
  if (!currentUser) return;

  const tomorrowKey = getDateKey(getTargetDate(1));
  const history = getEntryHistory();

  const newEntry = {
    user: currentUser.id,
    room: currentUser.room || "",
    date: tomorrowKey,
    b: Number(qty.breakfast || 0),
    l: Number(qty.lunch || 0),
    d: Number(qty.dinner || 0)
  };

  const existingIndex = history.findIndex(function (entry) {
    return (
      String(entry.user || "").toUpperCase() ===
        String(currentUser.id || "").toUpperCase() &&
      entry.date === tomorrowKey
    );
  });

  if (existingIndex >= 0) {
    history[existingIndex] = newEntry;
  } else {
    history.push(newEntry);
  }

  saveEntryHistory(history);

  /*
   * Keep the admin's tomorrowEntries list updated.
   * Preserve other users' entries.
   */
  const adminEntries = getTomorrowEntries();

  const adminIndex = adminEntries.findIndex(function (entry) {
    return String(entry.user || "").toUpperCase() ===
      String(currentUser.id || "").toUpperCase();
  });

  const adminEntry = {
    user: currentUser.id,
    room: currentUser.room || "",
    b: newEntry.b,
    l: newEntry.l,
    d: newEntry.d
  };

  if (adminIndex >= 0) {
    adminEntries[adminIndex] = adminEntry;
  } else {
    adminEntries.push(adminEntry);
  }

  store.set("tomorrowEntries", adminEntries);

  tomorrowEditMode = false;
  submitted = true;

  // Refresh every date-dependent section immediately.
  renderQty();
  renderYesterdayEntry();
  renderTodayEntry();
  renderMonthly();
}

/* ==================== TODAY'S MEAL STATUS ==================== */

function getDefaultMealStatus() {
  return {
    breakfast: { eaten: false, rating: 0, fb: "" },
    lunch: { eaten: false, rating: 0, fb: "" },
    dinner: { eaten: false, rating: 0, fb: "" }
  };
}

function getMealStatus() {
  if (!currentUser) return getDefaultMealStatus();

  return store.get(
    "mealStatus_" + currentUser.id,
    getDefaultMealStatus()
  );
}

let mealStatus = getMealStatus();

function saveMealStatus() {
  if (!currentUser) return;

  store.set("mealStatus_" + currentUser.id, mealStatus);
}

/* ==================== TODAY'S MEAL ENTRY (after eating) ====================
   The student saves how many portions they actually ate for each meal.
   Saved records go to localStorage key "mma_mealRecords" so the admin app
   (Meal Records screen) can compare them with the expected entry.

   Record shape:
   { user, date:"YYYY-MM-DD",
     meals:{ b:{q,t}|null, l:{q,t}|null, d:{q,t}|null },   // q = qty eaten, t = "HH:MM"
     confirmed:false, confirmedAt:"HH:MM"|null }
*/

// Meal opens for saving from this time (24h "HH:MM"). Change to suit the mess timings.
const MEAL_OPEN_TIME = { breakfast: "07:00", lunch: "07:00", dinner: "19:30" };
const MEAL_CLOSE_TIME = { breakfast: "11:00", lunch: "15:00", dinner: "23:30" };

function getGeneralMealTimes() {
  const defaults = { breakfastOpen:"07:00", breakfastClose:"11:00", lunchOpen:"07:00", lunchClose:"15:00", dinnerOpen:"19:30", dinnerClose:"23:30" };
  const saved = store.get("generalSettings", {});
  const result = Object.assign({}, defaults);
  Object.keys(defaults).forEach(function (key) {
    const value = saved && typeof saved === "object" ? String(saved[key] || "") : "";
    // A blank/invalid stored time must not keep a meal open indefinitely.
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) result[key] = value;
  });
  return result;
}

function getMealWindow(mealKey) {
  const s = getGeneralMealTimes();
  const map = {
    breakfast: [s.breakfastOpen, s.breakfastClose],
    lunch: [s.lunchOpen, s.lunchClose],
    dinner: [s.dinnerOpen, s.dinnerClose]
  };
  return map[mealKey] || [MEAL_OPEN_TIME[mealKey], MEAL_CLOSE_TIME[mealKey]];
}

function isMealPastClose(mealKey) {
  return nowHHMM() >= getMealWindow(mealKey)[1];
}

const MEAL_INFO = [
  { key: "breakfast", short: "b", label: "Breakfast", icon: "🍳", cls: "bf" },
  { key: "lunch",     short: "l", label: "Lunch",     icon: "🍛", cls: "ln" },
  { key: "dinner",    short: "d", label: "Dinner",    icon: "🌙", cls: "dn" }
];

let mealDraft = {};        // unsaved counter values, per meal key
let mealEditing = {};      // meals currently being edited
let feedbackOpen = {};     // feedback panels currently open
let feedbackDraft = {};    // text typed in feedback boxes

function nowHHMM() {
  return window.mmaMessDate.timeKey();
}

function formatTime12(hhmm) {
  if (!hhmm) return "";
  const parts = hhmm.split(":");
  let h = Number(parts[0]);
  const m = parts[1];
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return String(h).padStart(2, "0") + ":" + m + " " + suffix;
}

function getMealRecords() {
  const records = store.get("mealRecords", []);
  return Array.isArray(records) ? records : [];
}

function getMyTodayRecord() {
  if (!currentUser) return null;
  const todayKey = getDateKey(getTargetDate(0));
  const uid = String(currentUser.id || "").toUpperCase();

  return getMealRecords().find(function (r) {
    return String(r.user || "").toUpperCase() === uid && r.date === todayKey;
  }) || null;
}

async function saveMyTodayRecord(record, permissionShort, permissionChoice) {
  if (typeof api === "undefined" || typeof api.saveMealRecord !== "function") {
    throw new Error("The meal-record service is unavailable.");
  }
  const payloadMeals = {};
  Object.keys(record.meals || {}).forEach(function (short) {
    const meal = record.meals[short];
    if (!meal || isMealCancelled(record.date, short)) return;
    payloadMeals[short] = {
      q: Number(meal.q) || 0,
      t: meal.t || nowHHMM(),
      ...(meal.optOut ? { optOut: true } : {})
    };
    const savedChoice = meal.permission && meal.permission.choice;
    const choice = short === permissionShort
      ? permissionChoice
      : savedChoice;
    if (["with_permission", "without_permission"].includes(choice)) {
      payloadMeals[short].permissionChoice = choice;
    }
  });
  const response = await api.saveMealRecord({
    date: record.date,
    expectedUserId: currentUser.id,
    meals: payloadMeals,
    confirmed: !!record.confirmed,
    confirmedAt: record.confirmedAt || null
  });
  record = response.record || record;
  record.user = record.user_id || record.user || currentUser.id;
  record.room = record.room || currentUser.room || "";
  const records = getMealRecords();
  const uid = String(record.user || "").toUpperCase();

  const index = records.findIndex(function (r) {
    return String(r.user || "").toUpperCase() === uid && r.date === record.date;
  });

  if (index >= 0) records[index] = record;
  else records.push(record);

  store.set("mealRecords", records);
  return record;
}

function getOrCreateTodayRecord() {
  const existing = getMyTodayRecord();
  if (existing) return existing;

  return {
    user: currentUser.id,
    room: currentUser.room || "",
    date: getDateKey(getTargetDate(0)),
    meals: { b: null, l: null, d: null },
    confirmed: false,
    confirmedAt: null
  };
}

function isMealOpen(mealKey) {
  const w = getMealWindow(mealKey);
  const now = nowHHMM();
  return now >= w[0] && now < w[1];
}

function canRequestNoFoodForMeal(mealKey) {
  const w = getMealWindow(mealKey);
  const now = nowHHMM();
  return !!mealKey && !!w && Array.isArray(w) && w.length >= 2 && now >= w[0] && now < w[1];
}

function getExpectedQty(short) {
  const entry = getMyEntryForDate(getDateKey(getTargetDate(0)));
  return Number(entry ? entry[short] : 0) || 0;
}

function renderMealStatus() {
  const container = document.getElementById("mealStatusCard");
  if (!container || !currentUser) return;

  MEAL_INFO.forEach(function (m) {
    const box = document.getElementById("fb_" + m.key);
    if (box) feedbackDraft[m.key] = box.value;
  });

  mealStatus = getMealStatus();
  const todayMenu = getTodayMenu();
  const record = getMyTodayRecord();
  const today = getTargetDate(0);
  const dateText = today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " (" + today.toLocaleDateString("en-GB", { weekday: "long" }) + ")";

  const mealsHTML = MEAL_INFO.map(function (m) {
    const isMealWindowOpen = function (mealKey) {
      const windowTimes = typeof getMealWindow === "function" ? getMealWindow(mealKey) : [];
      const now = typeof nowHHMM === "function" ? nowHHMM() : "";
      return !!mealKey && Array.isArray(windowTimes) && windowTimes.length >= 2 && now >= windowTimes[0] && now < windowTimes[1];
    };
    const saved = record ? record.meals[m.short] : null;
    const editing = !!mealEditing[m.key];
    const open = isMealOpen(m.key);
    const expected = getExpectedQty(m.short);
    if (mealDraft[m.key] === undefined) mealDraft[m.key] = saved ? Number(saved.q) || 0 : expected;
    const value = mealDraft[m.key];
    const quantitySaved = !!saved && !saved.optOut && Number(value) === Number(saved.q);
    const quantityState = quantitySaved ? "saved" : "unsaved";
    const pastClose = isMealPastClose(m.key);
    const status = mealStatus[m.key] || { rating: 0, fb: "" };

    // Both the real cutoff and an explicit opt-out lock the section immediately.
    const permission = saved && saved.permission ? saved.permission : null;
    const cancelled = isMealCancelled(getDateKey(today), m.short);
    const noFoodRequest = typeof window.getStudentNoFoodRequest === "function"
      ? window.getStudentNoFoodRequest(getDateKey(today), m.short)
      : null;
    const noFoodStatus = noFoodRequest && String(noFoodRequest.status || "pending").toLowerCase();
    const approvedNoFood = !!(saved && saved.noFood && saved.noFood.status === "approved") || noFoodStatus === "approved";
    const permissionLabel = permission && permission.status === "pending"
      ? "Permission: Pending Approval"
      : permission && permission.status === "approved"
        ? "Permission: Approved"
        : permission && permission.status === "rejected"
          ? "Permission: Rejected"
          : "";
    const calculation = saved && saved.calculation ? saved.calculation : {};
    const unauthorizedQuantity = Math.max(0, Number(calculation.unauthorized_quantity) || 0);
    const unauthorizedFine = Math.max(0, Number(calculation.unauthorized_fine_points) || 0);
    const unauthorizedNotice = unauthorizedQuantity
      ? "Unauthorized extra: " + unauthorizedQuantity + " portion(s); +" +
        unauthorizedFine.toFixed(2) + " fine point(s) at double points."
      : "";
    if (cancelled) {
      return `<div class="me-card ${m.cls} meal-time-over">
        <div class="me-top"><div class="me-icon">${m.icon}</div><div class="me-name"><div class="me-title">${m.label}</div><div class="me-food">${todayMenu[m.key] || "Not available"}</div></div></div>
        <div class="me-time-over"><strong>${m.label} cancelled</strong><span>The hostel administration cancelled this meal for ${dateText}. It contributes zero meal points and no meal-related fines.</span></div>
      </div>`;
    }
    if (noFoodStatus === "pending" || noFoodStatus === "approved" || approvedNoFood) {
      const noFoodMessage = noFoodStatus === "approved" || approvedNoFood
        ? "No Food approved for this meal. Exactly 0 food points apply."
        : "No Food request is pending admin approval. No zero-point exception is applied until approval.";
      const cancelRequestAction = noFoodStatus === "pending" && noFoodRequest && noFoodRequest.request_id
        ? `<div class="me-actions"><button class="me-btn" type="button" aria-label="Cancel pending No Food request" title="Cancel pending No Food request" onclick="cancelNoFoodMealRequest('${noFoodRequest.request_id}')">&times;</button></div>` : "";
      return `<div class="me-card ${m.cls} meal-time-over">
        <div class="me-top"><div class="me-icon">${m.icon}</div><div class="me-name"><div class="me-title">${m.label}</div><div class="me-food">${todayMenu[m.key] || "Not available"}</div></div><span class="me-chip ${noFoodStatus === "approved" || approvedNoFood ? "ok" : "todo"}">No Food · ${noFoodStatus === "approved" || approvedNoFood ? "Approved" : "Pending"}</span></div>
        <div class="me-time-over"><strong>${m.label} · No Food</strong><span>${noFoodMessage}</span></div>${cancelRequestAction}
      </div>`;
    }
    if (pastClose || (saved && saved.optOut)) {
      let message = "";
      if (saved && saved.optOut) {
        message = "Meal cancelled. Extra " + (Number(saved.finePoints || 0)).toFixed(2) + " point charge recorded. This meal is locked.";
      } else if (saved) {
        const missing = Math.max(0, expected - (Number(saved.q) || 0));
        message = permissionLabel + (permissionLabel ? ". " : "") + unauthorizedNotice +
          (unauthorizedNotice ? " " : "") + (missing > 0
          ? "Saved " + (Number(saved.q) || 0) + "; " + missing + " missing portion(s) charged at double points."
          : "Saved at " + formatTime12(saved.t) + ". Cutoff passed; editing is closed.");
      } else {
        message = expected > 0
          ? "No confirmation saved. " + expected + " expected portion(s) charged at double points."
          : "No meal selected, so no fine.";
      }
      const canClosedFeedback = !!(saved && Number(saved.q) > 0);
      const feedbackHTML = feedbackOpen[m.key] && canClosedFeedback ? `
        <div class="me-feedback">
          <div class="stars">${[1,2,3,4,5].map(function(n){return `<span class="star ${n <= status.rating ? "on" : ""}" onclick="rate('${m.key}', ${n})">★</span>`;}).join("")}</div>
          <textarea class="fb-input" rows="2" id="fb_${m.key}" placeholder="Write your feedback (optional)">${feedbackDraft[m.key] !== undefined ? feedbackDraft[m.key] : (status.fb || "")}</textarea>
          <button class="fb-submit" onclick="submitFeedback('${m.key}')">Submit Feedback</button>
        </div>` : "";
      const feedbackButton = canClosedFeedback
        ? `<div class="me-actions"><button class="me-btn" onclick="toggleFeedback('${m.key}')">💬 Feedback</button></div>` : "";
      return `<div class="me-card ${m.cls} meal-time-over">
        <div class="me-top"><div class="me-icon">${m.icon}</div><div class="me-name"><div class="me-title">${m.label}</div><div class="me-food">${todayMenu[m.key] || "Not available"}</div></div></div>
        <div class="me-time-over"><strong>${m.label} time over</strong><span>${message}</span></div>
        ${feedbackButton}${feedbackHTML}
      </div>`;
    }

    const canEdit = open && !((record && record.confirmed) || (saved && saved.optOut)) && (!saved || editing);
    let chip = "";
    if (noFoodStatus === "rejected") {
      chip = `<span class="me-chip todo">No Food · Rejected</span>`;
    } else if (saved && !editing) {
      chip = `<span class="me-chip ok">✓ Saved at ${formatTime12(saved.t)}</span>`;
    } else if (!open) {
      chip = `<span class="me-chip lock">Opens at ${formatTime12(getMealWindow(m.key)[0])}</span>`;
    } else {
      chip = `<span class="me-chip todo">Not saved</span>`;
    }

    let actions = "";
    if (saved && !editing) {
      actions += `<button class="me-btn" ${(record && record.confirmed) || !open || saved.optOut ? "disabled" : ""} onclick="editMealEntry('${m.key}')">✎ Edit</button>`;
    } else if (open) {
      actions += `<button class="me-btn primary" onclick="MMAUI.run(this,function(){return saveMealEntry('${m.key}')},{label:'Saving…',minMs:200})">Save</button>`;
    }
    const canFeedback = saved && Number(saved.q) > 0 && !saved.optOut;
    actions += `<button class="me-btn" ${canFeedback ? "" : "disabled"} onclick="toggleFeedback('${m.key}')">💬 Feedback</button>`;
    const noFoodRequestStatus = String(noFoodRequest && noFoodRequest.status || "").toLowerCase();
    const canRequestNoFoodAgain = !noFoodRequest || noFoodRequestStatus === "cancelled";
    const mealWindowOpen = isMealWindowOpen(m.key);
    if (canRequestNoFoodAgain && !((saved && saved.optOut))) {
      actions += `<button class="me-btn meal-no-food" ${mealWindowOpen ? "" : "disabled"} onclick="requestNoFoodMeal('${m.key}','${getDateKey(today)}')">No Food</button>`;
    }

    const feedbackHTML = feedbackOpen[m.key] && canFeedback ? `
      <div class="me-feedback"><div class="stars">${[1,2,3,4,5].map(function(n){return `<span class="star ${n <= status.rating ? "on" : ""}" onclick="rate('${m.key}', ${n})">★</span>`;}).join("")}</div>
      <textarea class="fb-input" rows="2" id="fb_${m.key}" placeholder="Write your feedback (optional)">${feedbackDraft[m.key] !== undefined ? feedbackDraft[m.key] : (status.fb || "")}</textarea>
      <button class="fb-submit" onclick="submitFeedback('${m.key}')">Submit Feedback</button></div>` : "";

    return `<div class="me-card ${m.cls}" data-meal-key="${m.key}"><div class="me-top"><div class="me-icon">${m.icon}</div>
      <div class="me-name"><div class="me-title">${m.label}</div><div class="me-food">${todayMenu[m.key] || "Not available"}</div></div>${chip}</div>
      <div class="me-bottom"><div class="me-counter"><button ${canEdit ? "" : "disabled"} onclick="changeMealQty('${m.key}', -1)">−</button><span class="val">${value}</span><button ${canEdit ? "" : "disabled"} onclick="changeMealQty('${m.key}', 1)">+</button></div>
      <div class="me-expected">Expected ${expected}${saved && saved.q != null ? " · Actual " + Number(saved.q) : ""}</div>
      <span class="meal-quantity-state ${quantityState}" role="status">${quantitySaved ? "Saved" : "Not saved"}</span>
      ${permissionLabel ? `<div class="me-permission-status">${permissionLabel}</div>` : ""}
      ${unauthorizedNotice ? `<div class="me-permission-status">${unauthorizedNotice}</div>` : ""}
      <div class="me-actions">${actions}</div></div>${feedbackHTML}</div>`;
  }).join("");

  const chipsHTML = MEAL_INFO.map(function (m) {
    const done = record && record.meals[m.short];
    const cancelled = isMealCancelled(getDateKey(today), m.short);
    const closed = isMealPastClose(m.key) || !!(done && done.optOut);
    return `<div class="dc-chip ${done || closed || cancelled ? "done" : ""}"><div class="n">${m.label}</div><div class="s">${cancelled ? "Cancelled · 0 points" : done && done.optOut ? "Cancelled · locked" : done ? "Saved ✓" : closed ? "Time over" : "Pending"}</div></div>`;
  }).join("");
  container.innerHTML = `<div class="me-head"><div class="me-head-icon">📅</div><div><div class="me-head-title">Today's Confirmation</div><div class="me-head-date">${dateText}</div></div></div>${mealsHTML}
    <div class="dc-box"><div class="dc-title">🛡️ Daily Meal Confirmation</div><div class="dc-chips">${chipsHTML}</div></div>`;
  container.querySelectorAll("[data-meal-key]").forEach(function (card) {
    const mealKey = card.getAttribute("data-meal-key");
    const info = MEAL_INFO.find(function (item) { return item.key === mealKey; });
    const savedMeal = record && info && record.meals ? record.meals[info.short] : null;
    const saved = !!savedMeal && !savedMeal.optOut && Number(mealDraft[mealKey]) === Number(savedMeal.q);
    const value = card.querySelector(".me-counter .val");
    if (value) value.classList.add(saved ? "saved" : "unsaved");
  });
}
function changeMealQty(mealKey, diff) {
  const current = Number(mealDraft[mealKey] || 0);
  mealDraft[mealKey] = Math.max(0, Math.min(99, current + diff));
  renderMealStatus();
}



/* Meal opt-out: no fine when cancelled at least two hours before meal close;
   otherwise add half of the configured dish point as a fine point. */
async function optOutMeal(mealKey) {
  if (!currentUser) return;
  const info = MEAL_INFO.find(function (m) { return m.key === mealKey; });
  if (!info) return;
  const close = getMealWindow(mealKey)[1];
  if (nowHHMM() >= close || isMealPastClose(mealKey)) {
    alert("This meal's cutoff has passed. It can no longer be cancelled or edited.");
    renderMealStatus();
    return;
  }
  const existingRecord = getMyTodayRecord();
  const existingMeal = existingRecord && existingRecord.meals ? existingRecord.meals[info.short] : null;
  if (existingMeal && existingMeal.optOut) {
    alert("This meal has already been cancelled and is locked.");
    return;
  }
  const expected = getExpectedQty(info.short);
  if (!(expected > 0)) {
    alert("You have no planned " + info.label.toLowerCase() + " entry to cancel.");
    return;
  }
  const menu = getTodayMenu();
  const dish = menu[mealKey] || "";
  const configuredPoint = window.MMAPoints && typeof window.MMAPoints.pointOf === "function"
    ? window.MMAPoints.pointOf(dish) : null;
  if (configuredPoint === null || configuredPoint === undefined || !Number.isFinite(Number(configuredPoint))) {
    alert("The food point for this meal has not been set by Admin yet. Please contact Admin before cancelling.");
    return;
  }
  const point = Math.max(0, Number(configuredPoint));
  const finePoints = Math.round(point * 0.5 * 100) / 100;
  const text = "Cancel " + info.label + "? The normal " + point.toFixed(2) + " point charge remains and an extra " + finePoints.toFixed(2) + " point (half point) will be added. This meal will lock immediately and cannot be edited.";
  if (!confirm(text)) return;
  const record = getOrCreateTodayRecord();
  record.meals[info.short] = { q: 0, t: nowHHMM(), optOut: true, finePoints: finePoints, fineApplied: true, locked: true };
  record.confirmed = false;
  record.confirmedAt = null;
  try {
    await saveMyTodayRecord(record);
  } catch (error) {
    if (window.MMAUI) MMAUI.toast(error.message || "Meal cancellation could not be saved.", "error");
    return;
  }
  mealDraft[mealKey] = 0;
  mealEditing[mealKey] = false;
  renderMealStatus();
  alert("Meal cancelled. An extra " + finePoints.toFixed(2) + " point fine was recorded; the normal meal point remains.");
}
window.optOutMeal = optOutMeal;

let pendingExtraMeal = null;
let selectedPermissionChoice = "";

function openExtraMealDialog(mealKey, short, expected, actual) {
  pendingExtraMeal = { mealKey: mealKey, short: short, expected: expected, actual: actual };
  selectedPermissionChoice = "";
  const expectedText = document.getElementById("extraMealExpected");
  const enteredText = document.getElementById("extraMealEntered");
  const status = document.getElementById("extraMealStatus");
  const continueButton = document.getElementById("extraMealContinue");
  document.querySelectorAll("[data-permission-choice]").forEach(function (button) {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  if (expectedText) expectedText.textContent = String(expected);
  if (enteredText) enteredText.textContent = String(actual);
  if (status) status.textContent = "Select how you are requesting these extra portions.";
  if (continueButton) continueButton.disabled = true;
  const background = document.getElementById("extraMealModalBg");
  if (background) background.classList.add("open");
}

function closeExtraMealDialog() {
  const background = document.getElementById("extraMealModalBg");
  if (background) background.classList.remove("open");
  pendingExtraMeal = null;
  selectedPermissionChoice = "";
}

function selectPermissionChoice(choice, button) {
  if (!["with_permission", "without_permission"].includes(choice)) return;
  selectedPermissionChoice = choice;
  document.querySelectorAll("[data-permission-choice]").forEach(function (item) {
    const selected = item === button;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const status = document.getElementById("extraMealStatus");
  if (status) {
    status.textContent = choice === "with_permission"
      ? "This request will remain Pending Approval until an admin or mess secretary decides it."
      : "Unauthorized portions may be charged at double points under the current policy.";
  }
  const continueButton = document.getElementById("extraMealContinue");
  if (continueButton) continueButton.disabled = false;
}

async function submitExtraMealChoice() {
  if (!pendingExtraMeal || !selectedPermissionChoice) return false;
  const pending = pendingExtraMeal;
  const saved = await saveMealEntry(pending.mealKey, selectedPermissionChoice);
  if (saved !== false) closeExtraMealDialog();
  return saved;
}

async function saveMealEntry(mealKey, permissionChoice) {
  if (!currentUser) return;
  const info = MEAL_INFO.find(function (m) { return m.key === mealKey; });
  if (!info || !isMealOpen(mealKey)) return;

  const expected = getExpectedQty(info.short);
  const actual = Math.max(0, Number(mealDraft[mealKey]) || 0);
  if (actual > expected && !permissionChoice) {
    openExtraMealDialog(mealKey, info.short, expected, actual);
    return false;
  }

  const record = getOrCreateTodayRecord();
  record.meals[info.short] = { q: actual, t: nowHHMM() };
  record.confirmed = false;
  record.confirmedAt = null;
  try {
    await saveMyTodayRecord(record, info.short, permissionChoice);
  } catch (error) {
    const persisted = getMyTodayRecord();
    const persistedMeal = persisted && persisted.meals ? persisted.meals[info.short] : null;
    mealDraft[mealKey] = persistedMeal ? Number(persistedMeal.q) || 0 : expected;
    mealEditing[mealKey] = !!persistedMeal && !persistedMeal.optOut;
    renderMealStatus();
    if (window.MMAUI) MMAUI.toast(error.message || "Meal portions could not be saved.", "error");
    throw error;
  }

  // keep the older per-student status flag in sync
  mealStatus = getMealStatus();
  if (mealStatus[mealKey]) {
    mealStatus[mealKey].eaten = record.meals[info.short].q > 0;
    saveMealStatus();
  }

  mealEditing[mealKey] = false;
  renderMealStatus();
  if (permissionChoice === "with_permission" && window.MMAUI) {
    window.MMAUI.toast("Permission request submitted; status is Pending Approval.", "info");
  }
  return true;
}

function editMealEntry(mealKey) {
  const record = getMyTodayRecord();
  if (!isMealOpen(mealKey)) { renderMealStatus(); return; }
  const info = MEAL_INFO.find(function (m) { return m.key === mealKey; });
  if (record && record.confirmed) return;
  if (info && record && record.meals && record.meals[info.short] && record.meals[info.short].optOut) return;
  mealEditing[mealKey] = true;
  renderMealStatus();
}

function toggleFeedback(mealKey) {
  feedbackOpen[mealKey] = !feedbackOpen[mealKey];
  renderMealStatus();
}

async function completeTodayEntries() {
  const record = getMyTodayRecord();
  if (!record) return;

  const allSaved = MEAL_INFO.every(function (m) {
    return isMealCancelled(record.date, m.short) || record.meals[m.short];
  });
  if (!allSaved) return;

  record.confirmed = true;
  record.confirmedAt = nowHHMM();
  try {
    await saveMyTodayRecord(record);
  } catch (error) {
    if (window.MMAUI) MMAUI.toast(error.message || "Meal confirmation could not be saved.", "error");
    return;
  }
  renderMealStatus();
}

function rate(meal, rating) {
  mealStatus = getMealStatus();
  if (!mealStatus[meal]) return;

  mealStatus[meal].rating = rating;
  saveMealStatus();
  renderMealStatus();
}

/* ==================== FEEDBACK ==================== */

function submitFeedback(meal) {
  if (!currentUser) return;

  const textarea = document.getElementById("fb_" + meal);
  const comment = textarea ? textarea.value.trim() : "";

  mealStatus = getMealStatus();
  if (!mealStatus[meal]) return;

  mealStatus[meal].fb = comment;
  saveMealStatus();

  const feedback = getFeedback();
  const todayMenu = getTodayMenu();

  const newFeedback = {
    user: currentUser.id,
    name: currentUser.name || currentUser.fullName || currentUser.id,
    room: currentUser.room || "",
    meal: meal,
    food: todayMenu[meal] || "",
    rating: Number(mealStatus[meal].rating || 0),
    comment: comment,
    date: new Date().toLocaleString("en-IN")
  };

  const existingIndex = feedback.findIndex(function (item) {
    return (
      String(item.user || "").toUpperCase() ===
        String(currentUser.id || "").toUpperCase() &&
      String(item.meal || "").toLowerCase() === meal.toLowerCase()
    );
  });

  if (existingIndex >= 0) {
    feedback.splice(existingIndex, 1);
  }
  feedback.unshift(newFeedback);

  store.set("feedback", feedback);
  renderMealStatus();
  const success = document.getElementById("feedbackSuccess");
  if (success) {
    success.textContent = "Feedback sent successfully.";
    success.style.display = "block";
    clearTimeout(window.__feedbackSuccessTimer);
    window.__feedbackSuccessTimer = setTimeout(() => { success.style.display = "none"; }, 3000);
  }
}

/* ==================== MONTHLY MESS ENTRY ==================== */

function renderMonthly() {
  const container = document.getElementById("monthlyBody");
  if (!container || !currentUser) return;

  const userId = String(currentUser.id || "").toUpperCase();
  const today = getTargetDate(0);
  const todayKey = getDateKey(today);
  const monthInput = document.getElementById("monthlyMonth");
  if (monthInput && !monthInput.value) monthInput.value = todayKey.slice(0, 7);
  const selectedMonth = monthInput && /^\d{4}-\d{2}$/.test(monthInput.value) ? monthInput.value : todayKey.slice(0, 7);
  if (typeof window.mmaEnsureMonthlyEntries === "function" &&
      !window.mmaEnsureMonthlyEntries(selectedMonth)) {
    container.innerHTML = '<tr><td colspan="5">Loading monthly mess entries…</td></tr>';
    return;
  }
  if (typeof window.mmaEnsureMonthlyMealRecords === "function" &&
      !window.mmaEnsureMonthlyMealRecords(selectedMonth)) {
    container.innerHTML = '<tr><td colspan="5">Loading saved meal confirmations…</td></tr>';
    return;
  }
  const monthPrefix = selectedMonth + "-";

  // Show only dates that have arrived; tomorrow's pre-entry is not a completed monthly record.
  const byDate = {};
  getEntryHistory().forEach(function (entry) {
    const d = String(entry.date || "");
    if (String(entry.user || "").toUpperCase() === userId &&
        /^\d{4}-\d{2}-\d{2}$/.test(d) && d.indexOf(monthPrefix) === 0 && d <= todayKey) {
      byDate[d] = entry;
    }
  });
  const history = Object.keys(byDate).sort().map(function (d) { return byDate[d]; });

  // Points = meals counted x the point weight of that day's food (set by Admin > Food Menu).
  const eff = function (uid, dateKey, entry, short) {
    return getEffectiveMealValue(uid, dateKey, entry, short).value;
  };
  const foodPoints = MMAPoints.getFoodPoints();
  let totalPoints = 0;
  const missing = [];
  container.innerHTML = history.map(function (entry) {
    // Pin the food and point weights for this particular date. This keeps the
    // monthly view and bill calculation aligned with Admin > Weekly Menu Points.
    if (MMAPoints.snapshotDate) MMAPoints.snapshotDate(entry.date, false);
    const date = new Date(entry.date + "T00:00:00");
    const formattedDate = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const cells = ["b", "l", "d"].map(function (short) {
      return getEffectiveMealValue(userId, entry.date, entry, short);
    });
    // Monthly entry must use the menu configured in Admin > Food Menu / Weekly Menu
    // for that weekday. Old date snapshots can contain stale dish names, which made
    // the monthly row show quantities 2,2,2 but calculate points from unrelated foods.
    const dayMenu = MMAPoints.menuForDate(entry.date);
    const mealPoint = function (short) {
      return MMAPoints.pointOf(dayMenu[short], foodPoints);
    };
    const dp = MMAPoints.dayPoints(entry.date, entry, userId, eff, foodPoints, dayMenu);
    const dateRecords = getMealRecords().filter(function (r) {
      return String(r.user || "").toUpperCase() === userId && r.date === entry.date;
    });
    dateRecords.forEach(function (r) {
      const meals = r.meals || {};
      ["b", "l", "d"].forEach(function (short) {
        if (!isMealCancelled(entry.date, short) && meals[short] && meals[short].optOut) dp.total += Math.max(0, Number(meals[short].finePoints) || 0);
      });
    });
    dp.total = MMAPoints.round(dp.total, 2);
    dp.missing.forEach(function (n) { if (missing.indexOf(n) < 0) missing.push(n); });
    totalPoints += dp.total;
    return `
      <tr>
        <td>${formattedDate}</td>
        ${cells.map(function (cell, idx) { const short = ["b", "l", "d"][idx]; const food = dayMenu[short] || "Food not set"; const weight = mealPoint(short); const detail = weight == null ? food + " — point not set" : food + " — " + MMAPoints.fmtPoints(weight) + " point each × " + cell.value + " = " + MMAPoints.fmtPoints((Number(weight) || 0) * cell.value) + " points"; return `<td class="${cell.fine ? "monthly-fine" : ""}" title="${String(detail).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}">${cell.value}</td>`; }).join("")}
        <td class="monthly-points">${MMAPoints.fmtPoints(dp.total)}</td>
      </tr>`;
  }).join("");

  if (!history.length) {
    container.innerHTML = `<tr><td colspan="5">No mess entries saved for this month.</td></tr>`;
  }

  const daysElement = document.getElementById("monthlyDays");
  const mealsElement = document.getElementById("monthlyMeals");
  if (daysElement) daysElement.textContent = history.length;
  if (mealsElement) mealsElement.textContent = MMAPoints.fmtPoints(totalPoints);
  const grandTotal = document.getElementById("monthlyGrandTotal");
  if (grandTotal) grandTotal.textContent = MMAPoints.fmtPoints(totalPoints);

  const note = document.getElementById("monthlyPointsNote");
  if (note) {
    note.style.display = missing.length ? "block" : "none";
    note.textContent = missing.length ? "Points are not set for: " + missing.join(", ") + ". This monthly point total is incomplete until Admin configures them." : "";
  }
}

/* ==================== BILLS ==================== */

/* ==================== NOTIFICATIONS ==================== */

function getReadNotifications() {
  if (!currentUser) return [];

  return store.get("readNotifications_" + currentUser.id, []);
}

function renderNotifs() {
  const list = document.getElementById("notifList");
  const badge = document.getElementById("notifBadge");

  if (!list) return;

  const notifications = getNotifications();
  const readNotifications = getReadNotifications();

  const unreadCount = notifications.filter(function (_, index) {
    return !readNotifications.includes(index);
  }).length;

  if (badge) {
    badge.style.display = unreadCount > 0 ? "flex" : "none";
    badge.textContent = unreadCount;
  }

  if (!notifications.length) {
    list.innerHTML = `<div class="empty">No notifications available.</div>`;
    return;
  }

  list.innerHTML = notifications.map(function (notification, index) {
    const isUnread = !readNotifications.includes(index);

    return `
      <div class="notif-item">
        <div class="nt">
          ${isUnread ? '<span class="dot"></span>' : ""}
          ${notification.t || ""}
        </div>
        <div class="nm">${notification.m || ""}</div>
        <div class="nd">${notification.d || ""}</div>
      </div>
    `;
  }).join("");
}

async function markNotifsRead() {
  if (!currentUser) return;

  try {
    await api.markNotificationsRead();
    const response = await api.getNotifications();
    const notifications = response.notifications || [];
    store.set("readNotifications_" + currentUser.id, notifications.map(function(n) { return n.id; }).filter(Boolean));
    notifications.forEach(function(notification) { notification.read = true; });
    store.set("notifHistory", notifications);
    if (typeof renderNotifs === "function") await renderNotifs();
  } catch (error) {
    console.error("Unable to mark notifications as read:", error);
    if (window.MMAUI && typeof window.MMAUI.toast === "function") {
      window.MMAUI.toast(error.message || "Notifications could not be marked as read.", "error");
    }
    return;
  }

}

/* ==================== SETTINGS ==================== */

function updateSettings() {
  if (!currentUser) return;

  const name = document.getElementById("settingsName");
  const room = document.getElementById("settingsRoom");
  const email = document.getElementById("settingsEmail");
  const phone = document.getElementById("settingsPhone");
  if (name) name.textContent = currentUser.name || "";
  if (room) room.textContent = currentUser.room || "";
  if (email) email.textContent = currentUser.email || "Not added";
  if (phone) phone.textContent = currentUser.phone || "Not added";
}

/* ==================== CONFIRM MODAL ==================== */

let pendingAction = null;

function confirmAction(action) {
  pendingAction = action;

  const title = document.getElementById("modalTitle");
  const text = document.getElementById("modalText");
  const background = document.getElementById("modalBg");

  if (title) {
    title.textContent = action === "logout" ? "Log out?" : "Switch user?";
  }

  if (text) {
    text.textContent = action === "logout"
      ? "You will need your User ID and password to log back in."
      : "This will log you out so another authorized user can log in.";
  }

  if (background) background.classList.add("open");
}

function closeModal() {
  const background = document.getElementById("modalBg");
  if (background) background.classList.remove("open");
}

function doConfirm() {
  const action = pendingAction;
  closeModal();

  if (action === "logout" || action === "switch") {
    doLogout();
  }
}

/* ==================== PAGE LOAD ==================== */

document.addEventListener("DOMContentLoaded", function () {
  currentUser = null;
  const app = document.getElementById("app");
  if (app) app.style.display = "none";
  const login = document.getElementById("login");
  if (login) login.classList.add("active");
});

window.addEventListener("storage", function (event) {
  if (event.key === "mma_generalSettings" && currentUser) {
    renderYesterdayEntry();
    renderTodayEntry();
    renderMealStatus();
  }
});

/* ==================== AUTOMATIC DATE REFRESH ==================== */

function refreshMessEntryDates() {
  if (!currentUser) return;

  renderUserDetails();
  renderYesterdayEntry();
  renderTodayEntry();
  renderQty();
  renderMonthly();

  const active = document.activeElement;
  if (!(active && active.classList && active.classList.contains("fb-input"))) {
    renderMealStatus();
  }
}

setInterval(refreshMessEntryDates, 10000);

document.addEventListener("visibilitychange", function () {
  if (!document.hidden) refreshMessEntryDates();
});

window.addEventListener("focus", refreshMessEntryDates);

window.addEventListener("pageshow", function () {
  refreshMessEntryDates();
});


/* =========================================================
   DETAILED MONTHLY BILLS + PRINT/SAVE AS PDF
   ========================================================= */
function billText(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
    return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch];
  });
}
function billMoney(value) {
  const n = Number(value);
  return "₹" + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
}
function getMyBillsForDisplay() {
  if (!currentUser) return [];
  const userId = String(currentUser.id || "").toUpperCase();
  return getBills().filter(function(bill) {
    return String(bill.user || "").toUpperCase() === userId;
  }).sort(function(a,b) {
    return String(b.month || b.billingMonth || "").localeCompare(String(a.month || a.billingMonth || ""));
  });
}
function renderSavedBills() {
  const container = document.getElementById("billList");
  if (!container) return;
  if (!currentUser) { container.innerHTML = ""; return; }
  const myBills = getMyBillsForDisplay();
  if (!myBills.length) {
    container.innerHTML = '<div class="card bill-card"><div class="empty">No monthly bills have been generated for your account yet.</div></div>';
    return;
  }
  container.innerHTML = myBills.map(function(bill,index) {
    if (Number(bill.calcVersion) >= 3) return renderPointBill(bill, index);
    const q = bill.quantities || {};
    const charges = bill.foodCharges || {};
    const fine = bill.fine || {};
    const other = bill.otherCharge || {};
    const discount = bill.discount || {};
    const rates = bill.rates || {};
    const subtotal = Number(bill.foodSubtotal !== undefined ? bill.foodSubtotal : bill.amount || 0);
    const finalAmount = Number(bill.finalTotal !== undefined ? bill.finalTotal : bill.amount || 0);
    const status = bill.status === "paid" ? "Paid" : "Pending";
    const adjustmentTotal = Number(fine.amount||0)+Number(bill.maintenanceFee||0)+Number(bill.cookingFee||0)+Number(other.amount||0)-Number(discount.amount||0);
    return '<div class="card bill-card">' +
      '<div class="bill-top" onclick="toggleBill(' + index + ')" style="cursor:pointer">' +
      '<div><div class="bill-month">' + billText(bill.month || bill.billingMonth || "Previous bill") + '</div>' +
      '<div class="bill-amt">' + billMoney(finalAmount) + '</div><small>' + billText(bill.generationStatus || "Generated bill") + (bill.revision > 1 ? ' · Updated v' + bill.revision : '') + '</small></div>' +
      '<span class="status-pill ' + (bill.status || "pending") + '">' + status + '</span></div>' +
      '<div class="bill-breakdown open" id="bd_' + index + '">' +
      '<h3>Bill details</h3>' +
      '<p><strong>Mess:</strong> MMA Mess - Mount Road<br><strong>Name:</strong> ' + billText(bill.name || currentUser.name || currentUser.id) +
      '<br><strong>User ID:</strong> ' + billText(bill.user) + '<br><strong>Room:</strong> ' + billText(bill.room || currentUser.room || "-") +
      '<br><strong>Branch:</strong> ' + billText(bill.branch || currentUser.branch || "Mount Road") +
      '<br><strong>Billing month:</strong> ' + billText(bill.month || bill.billingMonth || "Previous bill") +
      '<br><strong>Saved entry days:</strong> ' + Number(bill.entryDays || bill.days || 0) + '</p>' +
      '<div class="bill-detail-row"><span>Breakfast: ' + Number(q.breakfast || 0) + ' × ' + billMoney(rates.breakfast || 0) + '</span><strong>' + billMoney(charges.breakfast || 0) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Lunch: ' + Number(q.lunch || 0) + ' × ' + billMoney(rates.lunch || 0) + '</span><strong>' + billMoney(charges.lunch || 0) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Dinner: ' + Number(q.dinner || 0) + ' × ' + billMoney(rates.dinner || 0) + '</span><strong>' + billMoney(charges.dinner || 0) + '</strong></div>' +
      '<div class="bill-detail-row total"><span>Food subtotal</span><strong>' + billMoney(subtotal) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Fine' + (fine.reason ? ': ' + billText(fine.reason) : '') + '</span><strong>' + billMoney(fine.amount || 0) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Maintenance fee</span><strong>' + billMoney(bill.maintenanceFee || 0) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Cooking fee</span><strong>' + billMoney(bill.cookingFee || 0) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Other charge' + (other.reason ? ': ' + billText(other.reason) : '') + '</span><strong>' + billMoney(other.amount || 0) + '</strong></div>' +
      '<div class="bill-detail-row"><span>Discount' + (discount.reason ? ': ' + billText(discount.reason) : '') + '</span><strong>−' + billMoney(discount.amount || 0) + '</strong></div>' +
      '<div class="bill-detail-row total"><span>Final total</span><strong>' + billMoney(finalAmount) + '</strong></div>' +
      '<p class="bill-generated">Generated: ' + billText(bill.generatedAt ? new Date(bill.generatedAt).toLocaleString("en-IN") : "-") +
      (bill.updatedAt ? '<br>Last updated: ' + billText(new Date(bill.updatedAt).toLocaleString("en-IN")) : '') + '</p>' +
      '<button class="btn-primary small" onclick="event.stopPropagation();downloadBillPDF(' + index + ')">⬇ Download PDF / Print</button>' +
      '</div></div>';
  }).join("");
}
/* Point-based bill (calcVersion 3). Shows exactly the saved record the admin sees. */
function pointBillRows(bill) {
  const n = bill.chargeNames || { fixed: "Fixed Cost", water: "Water Charges", reserve: "Reserved Fund" };
  const disc = Number(bill.fixedDiscount || 0);
  return [
    { label: "Total Points", value: MMAPoints.fmtPoints(bill.totalPoints) },
    { label: "Per Point", value: billMoney(bill.perPoint) },
    { label: "Points in Rupees", value: billMoney(bill.pointsAmount) },
    { label: n.fixed + (disc > 0 ? " (discount " + billMoney(disc) + " applied)" : ""), value: billMoney(bill.fixedCost) },
    { label: n.water, value: billMoney(bill.waterCharges) },
    { label: n.reserve, value: billMoney(bill.reservedFund) },
    ...(Array.isArray(bill.customCharges) ? bill.customCharges.map(function (charge) { return { label: charge.name || "Additional Charge", value: billMoney(charge.amount || 0) }; }) : []),
    { label: "Discount", value: "−" + billMoney(bill.individualDiscount || 0) },
    { label: "Fine" + (bill.fineReason ? " (" + billText(bill.fineReason) + ")" : ""), value: billMoney(bill.individualFine || 0) }
  ];
}
function renderPointBill(bill, index) {
  const status = bill.status === "paid" ? "Paid" : "Pending";
  const total = Number(bill.grandTotal !== undefined ? bill.grandTotal : bill.finalTotal || 0);
  const rows = pointBillRows(bill).map(function (r) {
    return '<div class="bill-detail-row"><span>' + billText(r.label) + '</span><strong>' + billText(r.value) + '</strong></div>';
  }).join("");
  return '<div class="card bill-card">' +
    '<div class="bill-top" onclick="toggleBill(' + index + ')" style="cursor:pointer">' +
    '<div><div class="bill-month">' + billText(bill.month || "Bill") + '</div>' +
    '<div class="bill-amt">' + billMoney(total) + '</div><small>' + billText(bill.generationStatus || "Generated bill") + (bill.revision > 1 ? ' \u00b7 v' + bill.revision : '') + '</small></div>' +
    '<span class="status-pill ' + (bill.status || "pending") + '">' + status + '</span></div>' +
    '<div class="bill-breakdown open" id="bd_' + index + '">' +
    '<h3>Bill details</h3>' +
    '<p><strong>Name:</strong> ' + billText(bill.name || currentUser.name || currentUser.id) +
    '<br><strong>Room:</strong> ' + billText(bill.room || currentUser.room || "-") +
    '<br><strong>Billing month:</strong> ' + billText(bill.month || "-") + '</p>' +
    rows +
    '<div class="bill-detail-row total"><span>Grand Total</span><strong>' + billMoney(total) + '</strong></div>' +
    '<p class="bill-generated">Generated: ' + billText(bill.generatedAt ? new Date(bill.generatedAt).toLocaleString("en-IN") : "-") +
    (bill.updatedAt ? '<br>Last updated: ' + billText(new Date(bill.updatedAt).toLocaleString("en-IN")) : '') + '</p>' +
    '<button class="btn-primary small" onclick="event.stopPropagation();MMAUI.run(this,function(){return downloadBillPDF(' + index + ')},{label:\'Opening\\u2026\',minMs:300})">\u2b07 Download PDF / Print</button>' +
    '</div></div>';
}
function printPointBill(bill) {
  const rows = pointBillRows(bill).map(function (r) {
    return '<div class="row"><span>' + billText(r.label) + '</span><b>' + billText(r.value) + '</b></div>';
  }).join("");
  const total = Number(bill.grandTotal !== undefined ? bill.grandTotal : bill.finalTotal || 0);
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>MMA Mess - Mount Road Bill</title><style>' +
    'body{font-family:Arial,sans-serif;color:#222;margin:32px;line-height:1.5}h1{margin-bottom:4px;color:#39246b}h2{margin-top:26px;border-bottom:1px solid #ddd;padding-bottom:6px}' +
    '.muted{color:#666}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #eee;padding:8px 0}.total{font-size:20px;font-weight:bold;border-top:2px solid #333;margin-top:10px;padding-top:12px}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.notice{margin-top:28px;color:#777;font-size:12px}@media print{button{display:none}body{margin:12mm}}' +
    '</style></head><body><h1>MMA Mess - Mount Road</h1><div class="muted">Monthly Mess Bill</div><h2>Resident details</h2><div class="meta">' +
    '<div><b>Name:</b> ' + billText(bill.name || currentUser.name || currentUser.id) + '</div><div><b>Room:</b> ' + billText(bill.room || currentUser.room || "-") + '</div>' +
    '<div><b>Billing month:</b> ' + billText(bill.month || "-") + '</div><div><b>Generated:</b> ' + billText(bill.generatedAt ? new Date(bill.generatedAt).toLocaleString("en-IN") : "-") + '</div></div>' +
    '<h2>Bill</h2>' + rows +
    '<div class="row total"><span>Grand Total</span><span>' + billMoney(total) + '</span></div>' +
    '<p class="notice">Generated by MMA Mess - Mount Road mess management. This is the bill saved by the admin for the selected month.</p>' +
    '<button onclick="window.print()">Print / Save as PDF</button><script>window.onload=function(){setTimeout(function(){window.print()},300)};<\/script></body></html>';
  const win = window.open("", "_blank");
  if (!win) {
    if (window.MMAUI) MMAUI.toast("Your browser blocked the PDF window. Allow pop-ups for this site, then try again.", "error");
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
function toggleBill(index) {
  const el = document.getElementById("bd_" + index);
  if (el) el.classList.toggle("open");
}
function downloadBillPDF(index) {
  const billsForUser = getMyBillsForDisplay();
  const bill = billsForUser[index];
  if (!bill || !currentUser || String(bill.user).toUpperCase() !== String(currentUser.id).toUpperCase()) {
    alert("This bill is not available for your account.");
    return false;
  }
  if (Number(bill.calcVersion) >= 3) return printPointBill(bill);
  const q = bill.quantities || {};
  const charges = bill.foodCharges || {};
  const rates = bill.rates || {};
  const fine = bill.fine || {};
  const other = bill.otherCharge || {};
  const discount = bill.discount || {};
  const total = Number(bill.finalTotal !== undefined ? bill.finalTotal : bill.amount || 0);
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>MMA Mess - Mount Road Bill</title><style>' +
    'body{font-family:Arial,sans-serif;color:#222;margin:32px;line-height:1.5}h1{margin-bottom:4px;color:#39246b}h2{margin-top:26px;border-bottom:1px solid #ddd;padding-bottom:6px}' +
    '.muted{color:#666}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #eee;padding:8px 0}.total{font-size:20px;font-weight:bold;border-top:2px solid #333;margin-top:10px;padding-top:12px}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}.notice{margin-top:28px;color:#777;font-size:12px}@media print{button{display:none}body{margin:12mm}}' +
    '</style></head><body><h1>MMA Mess - Mount Road</h1><div class="muted">Monthly Mess Bill</div><h2>Resident details</h2><div class="meta">' +
    '<div><b>Name:</b> ' + billText(bill.name || currentUser.name || currentUser.id) + '</div><div><b>User ID:</b> ' + billText(bill.user) + '</div>' +
    '<div><b>Room:</b> ' + billText(bill.room || currentUser.room || "-") + '</div><div><b>Branch:</b> ' + billText(bill.branch || currentUser.branch || "Mount Road") + '</div>' +
    '<div><b>Billing month:</b> ' + billText(bill.month || bill.billingMonth || "-") + '</div><div><b>Generated:</b> ' + billText(bill.generatedAt ? new Date(bill.generatedAt).toLocaleString("en-IN") : "-") + '</div></div>' +
    '<h2>Food charges</h2>' +
    '<div class="row"><span>Breakfast (' + Number(q.breakfast||0) + ' units × ' + billMoney(rates.breakfast||0) + ')</span><b>' + billMoney(charges.breakfast||0) + '</b></div>' +
    '<div class="row"><span>Lunch (' + Number(q.lunch||0) + ' units × ' + billMoney(rates.lunch||0) + ')</span><b>' + billMoney(charges.lunch||0) + '</b></div>' +
    '<div class="row"><span>Dinner (' + Number(q.dinner||0) + ' units × ' + billMoney(rates.dinner||0) + ')</span><b>' + billMoney(charges.dinner||0) + '</b></div>' +
    '<div class="row"><span><b>Food subtotal</b></span><b>' + billMoney(bill.foodSubtotal||0) + '</b></div><h2>Other fees and adjustments</h2>' +
    '<div class="row"><span>Individual fine — ' + billText(fine.reason || "No reason provided") + '</span><b>' + billMoney(fine.amount||0) + '</b></div>' +
    '<div class="row"><span>Maintenance fee</span><b>' + billMoney(bill.maintenanceFee||0) + '</b></div>' +
    '<div class="row"><span>Cooking fee</span><b>' + billMoney(bill.cookingFee||0) + '</b></div>' +
    '<div class="row"><span>Other charge — ' + billText(other.reason || "None") + '</span><b>' + billMoney(other.amount||0) + '</b></div>' +
    '<div class="row"><span>Discount — ' + billText(discount.reason || "None") + '</span><b>−' + billMoney(discount.amount||0) + '</b></div>' +
    '<div class="row total"><span>Final amount payable</span><span>' + billMoney(total) + '</span></div>' +
    '<p class="notice">Generated by MMA Mess - Mount Road mess management. This bill reflects the saved calculation snapshot for the selected billing month.</p>' +
    '<button onclick="window.print()">Print / Save as PDF</button><script>window.onload=function(){setTimeout(function(){window.print()},300)};<\/script></body></html>';
  const win = window.open("", "_blank");
  if (!win) {
    alert("Your browser blocked the PDF window. Allow pop-ups for this local site, then try again.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/* =========================================================
   PROFESSIONAL ENROLLMENT / EMAIL-PHONE AUTH
   ========================================================= */
// Refresh closed/open cards only when a meal cutoff, opt-out state, or date changes.
// This avoids repeatedly replacing the UI while a resident is typing feedback.
if (!window.__mmaMealCutoffTimer) {
  window.__mmaMealCutoffState = "";
  window.__mmaMealCutoffTimer = setInterval(function () {
    const card = document.getElementById("mealStatusCard");
    if (!currentUser || !card || document.visibilityState === "hidden") return;
    const record = getMyTodayRecord();
    const state = getDateKey(getTargetDate(0)) + "|" + MEAL_INFO.map(function (m) {
      const saved = record && record.meals ? record.meals[m.short] : null;
      return getMealWindow(m.key).join("-") + ":" + (isMealPastClose(m.key) ? "closed" : "open") + (saved && saved.optOut ? ":optout" : "");
    }).join("|");
    if (state !== window.__mmaMealCutoffState) {
      window.__mmaMealCutoffState = state;
      renderMealStatus();
    }
  }, 5000);
}

(function(){
  window.openAuthScreen=function(id){
    if(currentUser && id==="enroll"){
      if(currentUser.role==="admin"){
        window.location.replace("/admin");
      }else{
        document.getElementById("app").style.display="block";
        openScreen("home");
      }
      return;
    }
    document.querySelectorAll("#login,#enroll").forEach(function(el){el.classList.remove("active");});
    const element=document.getElementById(id);
    if(element)element.classList.add("active");
  };
})();


// API Integration for User App
// This file replaces localStorage calls with API calls

const MONTHLY_DATA_CACHE_TTL_MS = 60000;

function isMonthlyDataCacheFresh(key, month) {
  const cachedMonth = localStorage.getItem("mma_" + key + "Month");
  const loadedAt = Number(localStorage.getItem("mma_" + key + "LoadedAt") || 0);
  return cachedMonth === month && loadedAt > 0 &&
    Date.now() - loadedAt < MONTHLY_DATA_CACHE_TTL_MS;
}

// Modified store object to use API
const apiStore = {
  async get(key, defaultValue) {
    try {
      // Map localStorage keys to API endpoints
      const keyMap = {
        'users': () => api.getUsers ? api.getUsers().then(r => r.users) : [],
        'todayMenu': () => api.getTodayMenu(),
        'weekMenu': () => api.getWeeklyMenu(),
        'cutoffTime': () => api.getSettings().then(r => r.settings.tomorrowCutoff || r.settings.cutoffTime || '23:00'),
        'adminBills': () => api.getBills().then(r => r.bills),
        'notifHistory': () => api.getNotifications().then(r => r.notifications),
        'feedback': () => api.getFeedback().then(r => r.feedback),
        'messEntryHistory': () => api.getEntryHistory().then(r => r.entries),
        'mealRecords': () => api.getMealRecords().then(r => r.records),
        'generalSettings': () => api.getSettings().then(r => r.settings),
        'tomorrowEntries': () => api.getTomorrowEntries().then(r => r.entries)
      };

      if (keyMap[key]) {
        const result = await keyMap[key]();
        return result !== undefined ? result : defaultValue;
      }

      // Fallback to localStorage for unmapped keys (e.g., mealStatus, readNotifications)
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
        'messEntryHistory': async (val) => {
          // Handled by submitEntry API call
        },
        'mealRecords': async (val) => {
          if (val && val.length > 0) {
            await api.saveMealRecord(val[val.length - 1]);
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

      // Fallback to localStorage for unmapped keys (e.g., mealStatus, readNotifications)
      localStorage.setItem("mma_" + key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage write error:", error);
    }
  }
};

const originalStudentStoreSet = store.set.bind(store);
function storeStudentCancellations(items) {
  const existing = JSON.parse(localStorage.getItem("mma_mealCancellations") || "[]");
  const keyed = new Map();
  (Array.isArray(existing) ? existing : []).concat(Array.isArray(items) ? items : []).forEach(function(item) {
    keyed.set(String(item.date) + "|" + String(item.meal_type), item);
  });
  originalStudentStoreSet("mealCancellations", Array.from(keyed.values()));
}

function cacheStudentMealRecord(record) {
  const records = store.get("mealRecords", []);
  const uid = String(currentUser && currentUser.id || "").toUpperCase();
  const index = records.findIndex(function(item) {
    return String(item.user || item.user_id || "").toUpperCase() === uid && item.date === record.date;
  });
  if (index >= 0) records[index] = record;
  else records.push(record);
  originalStudentStoreSet("mealRecords", records);
}

function mergeStudentMealRecordsForDate(existingRecords, refreshedRecords, dateValue, userId) {
  const identity = String(userId || "").toUpperCase();
  const retained = (Array.isArray(existingRecords) ? existingRecords : []).filter(function(record) {
    return String(record.user || record.user_id || "").toUpperCase() !== identity ||
      record.date !== dateValue;
  });
  const refreshed = (Array.isArray(refreshedRecords) ? refreshedRecords : []).map(function(record) {
    return { ...record, user: record.user_id || record.user };
  });
  return retained.concat(refreshed);
}

function cacheStudentFeedback(feedback) {
  const records = store.get("feedback", []);
  const uid = String(currentUser && currentUser.id || "").toUpperCase();
  const index = records.findIndex(function(item) {
    return String(item.user || item.user_id || "").toUpperCase() === uid && item.meal === feedback.meal;
  });
  const item = { ...feedback, user: uid };
  if (index >= 0) records.splice(index, 1);
  records.unshift(item);
  originalStudentStoreSet("feedback", records);
}

store.set = function(key, value) {
  originalStudentStoreSet(key, value);
  if (key === "feedback" && Array.isArray(value) && value.length) {
    api.submitFeedback(value[0]).catch(function(error) {
      console.error("Unable to persist student feedback:", error);
      if (window.MMAUI && typeof window.MMAUI.toast === "function") {
        window.MMAUI.toast(error.message || "Feedback could not be saved.", "error");
      }
    });
    return;
  }
};

window.refreshStudentEntryHistory = async function(month) {
  const selectedMonth = month || getDateKey(getTargetDate(0)).slice(0, 7);
  const response = await api.getEntryHistory();
  const entries = (response.entries || []).map(function(entry) {
    return {
      ...entry,
      user: entry.user_id || entry.user,
      b: entry.breakfast == null ? Number(entry.b) || 0 : Number(entry.breakfast) || 0,
      l: entry.lunch == null ? Number(entry.l) || 0 : Number(entry.lunch) || 0,
      d: entry.dinner == null ? Number(entry.d) || 0 : Number(entry.dinner) || 0
    };
  });

  localStorage.setItem("mma_messEntryHistory", JSON.stringify(entries));
  localStorage.setItem("mma_monthlyEntryHistoryMonth", selectedMonth);
  localStorage.setItem("mma_monthlyEntryHistoryLoadedAt", String(Date.now()));
  return entries;
}

const monthlyEntryRequests = new Map();
window.mmaEnsureMonthlyEntries = function(month) {
  if (isMonthlyDataCacheFresh("monthlyEntryHistory", month)) return true;
  if (monthlyEntryRequests.has(month)) return false;
  const request = api.getAllEntriesForMonth(month).then(function(response) {
    const entries = (response.entries || []).map(function(entry) {
      return {
        ...entry,
        user: entry.user_id || entry.user,
        b: entry.breakfast == null ? Number(entry.b) || 0 : Number(entry.breakfast) || 0,
        l: entry.lunch == null ? Number(entry.l) || 0 : Number(entry.lunch) || 0,
        d: entry.dinner == null ? Number(entry.d) || 0 : Number(entry.dinner) || 0
      };
    });
    localStorage.setItem("mma_messEntryHistory", JSON.stringify(entries));
    localStorage.setItem("mma_monthlyEntryHistoryMonth", month);
    localStorage.setItem("mma_monthlyEntryHistoryLoadedAt", String(Date.now()));
    if (document.getElementById("monthlyMonth")?.value === month) renderMonthly();
  }).catch(function(error) {
    console.error("Unable to load mess entries for " + month + ":", error);
    const body = document.getElementById("monthlyBody");
    if (document.getElementById("monthlyMonth")?.value === month && body) {
      body.innerHTML = '<tr><td colspan="5">' +
        String(error.message || "Unable to load monthly mess entries.").replace(/[&<>"']/g, function(character) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
        }) + '</td></tr>';
    }
  }).finally(function() {
    monthlyEntryRequests.delete(month);
  });
  monthlyEntryRequests.set(month, request);
  return false;
};

async function refreshStudentBusinessData() {
  const [
    settingsResponse,
    mealRecordResponse,
    billResponse,
    notificationsResponse,
    feedbackResponse,
    todayMenu,
    weeklyMenu,
    tomorrowMenu,
    noFoodResponse
  ] = await Promise.all([
    api.getSettings(),
    api.getMealRecords(),
    api.getBills(),
    api.getNotifications(),
    api.getFeedback(),
    api.getTodayMenu(),
    api.getWeeklyMenu(),
    api.getTomorrowMenu(),
    api.getNoFoodRequests()
  ]);
  const settings = settingsResponse.settings || {};
  const records = (mealRecordResponse.records || []).map(function(record) {
    return { ...record, user: record.user_id || record.user };
  });
  storeStudentCancellations(mealRecordResponse.cancellations);
  const bills = (billResponse.bills || []).map(function(bill) {
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
  const values = {
    generalSettings: settings,
    cutoffTime: settings.tomorrowCutoff || settings.cutoffTime || "23:00",
    mealRecords: records,
    adminBills: bills,
    notifHistory: notifications,
    feedback,
    todayMenu,
    weekMenu: weeklyMenu,
    tomorrowMenu,
    noFoodRequests: noFoodResponse.requests || []
  };
  Object.keys(values).forEach(function(key) {
    localStorage.setItem("mma_" + key, JSON.stringify(values[key]));
  });
  localStorage.removeItem("mma_monthlyMealRecordsMonth");
  ["billConfig", "foodPoints", "menuSnapshots", "userBillAdjustments"].forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      localStorage.setItem("mma_" + key, JSON.stringify(settings[key]));
    } else {
      localStorage.removeItem("mma_" + key);
    }
  });
  await refreshStudentEntryHistory();
  if (typeof window.renderQty === "function") window.renderQty();
  if (typeof window.renderMealStatus === "function") window.renderMealStatus();
}

let studentRefreshBusy = false;
async function refreshStudentLatestMenu() {
  if (studentRefreshBusy || !currentUser || document.visibilityState === "hidden") return;
  studentRefreshBusy = true;
  try {
    const todayKey = getDateKey(getTargetDate(0));
    const tomorrowKey = getDateKey(getTargetDate(1));
    const [menu, settings, mealRecords, todayCancellations, tomorrowCancellations, noFoodResponse, weeklyMenu] = await Promise.all([
      api.getTomorrowMenu(),
      api.getSettings(),
      api.getMealRecords(),
      api.getMealCancellations(todayKey),
      api.getMealCancellations(tomorrowKey),
      api.getNoFoodRequests(),
      api.getWeeklyMenu()
    ]);
    // Keep the student weekly menu synced with the same backend data edited by admins.
    if (Array.isArray(weeklyMenu)) {
      const previousWeeklyMenu = localStorage.getItem("mma_weekMenu");
      const serializedWeeklyMenu = JSON.stringify(weeklyMenu);
      localStorage.setItem("mma_weekMenu", serializedWeeklyMenu);
      await renderWeekMenu(weeklyMenu);
      if (previousWeeklyMenu !== serializedWeeklyMenu && typeof window.renderMonthly === "function") window.renderMonthly();
    }
    localStorage.setItem("mma_tomorrowMenu", JSON.stringify(menu));
    const current = settings.settings || {};
    localStorage.setItem("mma_generalSettings", JSON.stringify(current));
    localStorage.setItem(
      "mma_cutoffTime",
      JSON.stringify(current.tomorrowCutoff || current.cutoffTime || menu.cutoffTime || "23:00")
    );
    localStorage.setItem(
      "mma_mealRecords",
      JSON.stringify(mergeStudentMealRecordsForDate(
        getMealRecords(),
        mealRecords.records,
        todayKey,
        currentUser.id
      ))
    );
    localStorage.setItem("mma_noFoodRequests", JSON.stringify(noFoodResponse.requests || []));
    storeStudentCancellations(
      (todayCancellations.cancellations || []).concat(tomorrowCancellations.cancellations || [])
    );
    /* Do not call renderQty during periodic refresh to prevent overwriting
       user's unsaved edits. The UI already checks tomorrowDirty internally. */
    if (typeof window.renderYesterdayEntry === "function") window.renderYesterdayEntry();
    if (typeof window.renderTodayEntry === "function") window.renderTodayEntry();
    if (typeof window.renderMealStatus === "function") window.renderMealStatus();
  } catch (error) {
    console.error("Unable to refresh tomorrow's menu and cutoff:", error);
    if (window.MMAUI && typeof window.MMAUI.toast === "function") {
      window.MMAUI.toast(error.message || "The latest menu could not be loaded.", "error");
    }
  } finally {
    studentRefreshBusy = false;
  }
}
setInterval(refreshStudentLatestMenu, 60000);
window.addEventListener("focus", refreshStudentLatestMenu);

function studentNoFoodRequests() {
  try {
    const value = JSON.parse(localStorage.getItem("mma_noFoodRequests") || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function noFoodMealShort(meal) {
  return ({ breakfast: "b", lunch: "l", dinner: "d", b: "b", l: "l", d: "d" })[
    String(meal || "").toLowerCase()
  ] || "";
}

function getStudentNoFoodRequest(dateValue, meal) {
  const short = noFoodMealShort(meal);
  const normalizedDate = String(dateValue || "").slice(0, 10);
  const identity = typeof currentUser !== "undefined" && currentUser
    ? String(currentUser.id || "").toUpperCase()
    : "";
  if (!identity) return null;
  return studentNoFoodRequests().find(function(item) {
    return String(item.date || "").slice(0, 10) === normalizedDate &&
      String(item.user_id || item.user || item.student_id || "").toUpperCase() === identity &&
      noFoodMealShort(item.meal || item.meal_type) === short;
  }) || null;
}

async function requestNoFoodMeal(meal, dateValue) {
  if (!currentUser) return false;
  const short = noFoodMealShort(meal);
  if (!short) return false;
  const date = dateValue || getDateKey(getTargetDate(0));
  const mealWindow = getMealWindow({ b: "breakfast", l: "lunch", d: "dinner" }[short] || short);
  const now = nowHHMM();
  if (!mealWindow || !Array.isArray(mealWindow) || !mealWindow[0] || !mealWindow[1] || now < mealWindow[0] || now >= mealWindow[1]) {
    const mealLabel = ({ b: "Breakfast", l: "Lunch", d: "Dinner" })[short] || "Meal";
    if (window.MMAUI) window.MMAUI.toast(mealLabel + " no-food requests are only available while the meal window is open.", "error");
    return false;
  }
  const existing = getStudentNoFoodRequest(date, short);
  const existingStatus = String(existing && existing.status || "").toLowerCase();
  if (existing && ["pending", "approved"].includes(existingStatus)) {
    if (window.MMAUI) window.MMAUI.toast("This no-food request is already " + existingStatus + ".", "info");
    return false;
  }
  if (!window.confirm("Request No Food for " + short.toUpperCase() + " on " + date + "? Admin approval is required before points become zero.")) {
    return false;
  }
  try {
    const response = await api.submitNoFoodRequest({ date: date, meal: short });
    const request = response && response.request;
    if (!response || !response.success || !request) {
      throw new Error((response && response.message) || "The server did not confirm the no-food request.");
    }
    const identity = String(currentUser.id || "").toUpperCase();
    const requests = studentNoFoodRequests().filter(function(item) {
      return !(item.date === request.date &&
        String(item.user_id || item.user || item.student_id || "").toUpperCase() === identity &&
        noFoodMealShort(item.meal || item.meal_type) === noFoodMealShort(request.meal));
    });
    requests.push(request);
    localStorage.setItem("mma_noFoodRequests", JSON.stringify(requests));
    if (typeof window.renderQty === "function") window.renderQty();
    if (typeof window.renderMealStatus === "function") window.renderMealStatus();
    if (window.MMAUI) {
      const alreadyApproved = String(request.status || "").toLowerCase() === "approved";
      window.MMAUI.toast(
        response.warning || (alreadyApproved
          ? "This no-food request has already been approved."
          : "No-food request submitted for admin approval."),
        response.warning ? "error" : alreadyApproved ? "info" : "success"
      );
    }
    return response;
  } catch (error) {
    if (window.MMAUI) window.MMAUI.toast(error.message || "No-food request could not be submitted.", "error");
    else window.alert(error.message || "No-food request could not be submitted.");
    return false;
  }
}

async function cancelNoFoodMealRequest(requestId) {
  const request = studentNoFoodRequests().find(function(item) {
    return String(item.request_id || item._id || "") === String(requestId);
  });
  if (!request || String(request.status || "pending").toLowerCase() !== "pending") {
    if (window.MMAUI) window.MMAUI.toast("Only pending no-food requests can be cancelled.", "error");
    return false;
  }
  if (!window.confirm("Cancel this pending no-food request? Normal meal-entry rules will apply again.")) return false;
  try {
    const response = await api.cancelNoFoodRequest(requestId);
    const cancelledRequest = response && response.request;
    if (!response || !response.success || !cancelledRequest ||
        String(cancelledRequest.status || "").toLowerCase() !== "cancelled") {
      throw new Error((response && response.message) || "The server did not confirm the request cancellation.");
    }
    const requests = studentNoFoodRequests().map(function(item) {
      if (String(item.request_id || item._id || "") !== String(requestId)) return item;
      return cancelledRequest;
    });
    localStorage.setItem("mma_noFoodRequests", JSON.stringify(requests));
    if (typeof window.renderMealStatus === "function") window.renderMealStatus();
    if (typeof window.renderQty === "function") window.renderQty();
    if (window.MMAUI) window.MMAUI.toast("No-food request cancelled.", "success");
    return true;
  } catch (error) {
    if (window.MMAUI) window.MMAUI.toast(error.message || "Could not cancel the request.", "error");
    return false;
  }
}
window.getStudentNoFoodRequest = getStudentNoFoodRequest;
window.requestNoFoodMeal = requestNoFoodMeal;
window.cancelNoFoodMealRequest = cancelNoFoodMealRequest;

const monthlyMealRecordRequests = new Map();
window.mmaEnsureMonthlyMealRecords = function(month) {
  if (isMonthlyDataCacheFresh("monthlyMealRecords", month)) return true;
  if (monthlyMealRecordRequests.has(month)) return false;

  const request = api.getMealRecordsForMonth(month).then(function(response) {
    const records = Array.isArray(response.records)
      ? response.records.map(function(record) {
          return { ...record, user: record.user_id || record.user };
        })
      : [];
    localStorage.setItem("mma_mealRecords", JSON.stringify(records));
    storeStudentCancellations(response.cancellations);
    localStorage.setItem("mma_monthlyMealRecordsMonth", month);
    localStorage.setItem("mma_monthlyMealRecordsLoadedAt", String(Date.now()));
    if (document.getElementById("monthlyMonth")?.value === month) renderMonthly();
  }).catch(function(error) {
    console.error("Unable to load saved meal confirmations for " + month + ":", error);
    const input = document.getElementById("monthlyMonth");
    const body = document.getElementById("monthlyBody");
    if (input?.value === month && body) {
      body.innerHTML = '<tr><td colspan="5">' +
        String(error.message || "Unable to load saved meal confirmations.").replace(/[&<>"']/g, function(character) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
        }) + '</td></tr>';
    }
  }).finally(function() {
    monthlyMealRecordRequests.delete(month);
  });

  monthlyMealRecordRequests.set(month, request);
  return false;
};

// Override doLogin to use API
async function doLogin() {
  const userInput = document.getElementById("uid");
  const passwordInput = document.getElementById("pw");
  const errorBox = document.getElementById("loginErr");
  const button = document.querySelector("#login .btn-primary");

  if (!userInput || !passwordInput) return;

  const userId = userInput.value.trim();
  const password = passwordInput.value;

  function showLoginError(message) {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.style.display = "block";
    }
  }

  if (button) button.disabled = true;
  try {
    const response = await api.login(userId, password);

    if (response.success && response.user && response.user.role === "admin") {
      window.location.assign("/admin");
      return;
    }

    if (response.success && response.user && response.user.role === "student") {
      window.__mmaStudentSessionExpired = false;
      currentUser = response.user;
      apiStore.set("currentUserId", currentUser.id);
      await Promise.all([
        refreshStudentBusinessData(),
        refreshStudentLatestMenu()
      ]);

      if (errorBox) errorBox.style.display = "none";

      const loginScreen = document.getElementById("login");
      const app = document.getElementById("app");

      if (loginScreen) loginScreen.classList.remove("active");
      if (app) app.style.display = "block";

      initApp();
    } else {
      showLoginError(response.message || "This account is not authorized to sign in.");
    }
  } catch (err) {
    showLoginError(err.message || "Login failed. Please try again.");
  } finally {
    if (button) button.disabled = false;
  }
}

async function submitEnrollment() {
  if (currentUser) {
    if (currentUser.role === "admin") {
      window.location.replace("/admin");
    } else {
      document.getElementById("app").style.display = "block";
      openScreen("home");
    }
    return;
  }

  const value = id => (document.getElementById(id)?.value || "").trim();
  const name = value("enrollName");
  const room = value("enrollRoom");
  const phone = value("enrollPhone").replace(/\D/g, "");
  const email = value("enrollEmail").toLowerCase();
  const password = document.getElementById("enrollPassword")?.value || "";
  const confirm = document.getElementById("enrollConfirm")?.value || "";
  const error = document.getElementById("enrollErr");
  const button = document.querySelector("#enroll .btn-primary");
  if (error) {
    error.textContent = "";
    error.style.display = "none";
  }
  if (!name || !room || !phone || !email || !password || !confirm) {
    if (error) {
      error.textContent = "Please complete all fields.";
      error.style.display = "block";
    }
    return;
  }
  if (!/^\d{10}$/.test(phone) || !/^[^\s@]+@gmail\.com$/i.test(email) || password.length < 6 || password !== confirm) {
    if (error) {
      error.textContent = "Check the phone, Gmail, and password fields and try again.";
      error.style.display = "block";
    }
    return;
  }
  if (button) button.disabled = true;
  try {
    await api.register({ name, room, phone, email, password, confirm });
    const card = document.querySelector("#enroll .login-card");
    if (card) {
      card.innerHTML = '<button class="back auth-back" type="button" onclick="openAuthScreen(\'login\')">← Back to Login</button><div class="login-mark">✓</div><h1>Enrollment Submitted</h1><p class="sub">Your details have been sent to the owner for approval.</p><div class="auth-success">Please wait for approval. Once approved, you can sign in using your enrolled Gmail ID or phone number and password.</div><button class="btn-primary" type="button" onclick="openAuthScreen(\'login\')">Go to Login</button>';
    }
  } catch (err) {
    if (error) {
      error.textContent = err.message || "Enrollment could not be submitted.";
      error.style.display = "block";
    }
  } finally {
    if (button) button.disabled = false;
  }
}

window.submitEnrollment = submitEnrollment;

async function changeClientPassword() {
  const oldPassword = document.getElementById("oldPw")?.value || "";
  const newPassword = document.getElementById("newPw")?.value || "";
  const confirmPassword = document.getElementById("newPw2")?.value || "";
  if (!currentUser) {
    alert("Sign in before changing your password.");
    return;
  }
  if (newPassword.length < 6 || newPassword !== confirmPassword) {
    alert(newPassword.length < 6 ? "New password must contain at least 6 characters." : "New passwords do not match.");
    return;
  }
  try {
    await api.changePassword({ oldPassword, newPassword });
    ["oldPw", "newPw", "newPw2"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.value = "";
    });
    const success = document.getElementById("pwChanged");
    if (success) {
      success.style.display = "block";
      setTimeout(() => { success.style.display = "none"; }, 3000);
    }
  } catch (error) {
    alert(error.message || "Password could not be changed.");
  }
}

localStorage.removeItem("mma_authSession");
localStorage.removeItem("mma_currentUserId");

document.addEventListener("DOMContentLoaded", function() {
  api.getCurrentUser().then(async function(response) {
    const user = response.user;
    if (user && user.role === "admin") {
      window.location.replace("/admin");
      return;
    }
    if (!user || user.role !== "student") {
      localStorage.removeItem("mma_authSession");
      localStorage.removeItem("mma_currentUserId");
      localStorage.removeItem("mma_currentUser");
      document.body.classList.remove("session-checking");
      return;
    }
    document.body.classList.remove("session-checking");
    window.__mmaStudentSessionExpired = false;
    currentUser = response.user;
    // Refresh data before rendering to ensure saved values are loaded
    await refreshStudentBusinessData();
    document.getElementById("login")?.classList.remove("active");
    document.getElementById("enroll")?.classList.remove("active");
    const app = document.getElementById("app");
    if (app) app.style.display = "block";
    // Call initApp AFTER data is loaded, so it renders with correct values
    initApp();
    const savedScreen = store.get("lastScreen", "home");
    const allowedScreens = ["home", "mess", "monthly", "bill", "notifs", "more", "settings"];
    openScreen(allowedScreens.includes(savedScreen) ? savedScreen : "home");
  }).catch(function(error) {
    currentUser = null;
    if (error.status === 401) {
      localStorage.removeItem("mma_authSession");
      localStorage.removeItem("mma_currentUserId");
      localStorage.removeItem("mma_currentUser");
    }
    document.body.classList.remove("session-checking");
    if (!/401|authentication required/i.test(error.message || "")) {
      console.error("Unable to restore the backend session:", error);
    }
  });
});

window.setInterval(function() {
  if (currentUser && document.visibilityState === "visible") {
    renderTodayMenu();
  }
}, 60000);

// Override doLogout to use API
async function doLogout() {
  try {
    await api.logout();
  } catch (err) {
    console.error("Logout error:", err);
    if (err.status !== 401) {
      alert(err.message || "Unable to log out. Please try again.");
      return;
    }
  }

  currentUser = null;
  apiStore.set("currentUserId", "");
  localStorage.removeItem("mma_authSession");
  localStorage.removeItem("mma_currentUser");
  localStorage.removeItem("mma_lastScreen");

  const app = document.getElementById("app");
  const login = document.getElementById("login");
  const uid = document.getElementById("uid");
  const pw = document.getElementById("pw");

  if (app) app.style.display = "none";
  if (login) login.classList.add("active");
  if (uid) uid.value = "";
  if (pw) pw.value = "";

  openScreen("home");
}

window.addEventListener("mma:session-expired", function () {
  if (window.__mmaStudentSessionExpired) return;
  window.__mmaStudentSessionExpired = true;
  currentUser = null;
  localStorage.removeItem("mma_authSession");
  localStorage.removeItem("mma_currentUser");
  localStorage.removeItem("mma_currentUserId");
  const app = document.getElementById("app");
  const login = document.getElementById("login");
  const error = document.getElementById("loginErr");
  if (app) app.style.display = "none";
  if (login) login.classList.add("active");
  if (error) {
    error.textContent = "Your session expired. Please sign in again.";
    error.style.display = "block";
  }
});

// Modified submitEntry to use API - attached to window to override conflicting definitions
window.submitEntry = async function() {
  if (!currentUser) return;

  let savedOnServer = false;
  const tomorrowKey = getDateKey(getTargetDate(1));
  const draft = typeof window.mmaGetTomorrowEntryDraft === "function"
    ? window.mmaGetTomorrowEntryDraft()
    : qty;
  const data = {
    date: tomorrowKey,
    breakfast: Number(draft.breakfast || 0),
    lunch: Number(draft.lunch || 0),
    dinner: Number(draft.dinner || 0),
    user_id: currentUser.id
  };

  try {
    const response = await api.submitEntry(data);
    if (!response.success) {
      throw new Error(response.message || "Failed to submit mess entry");
    }
    savedOnServer = true;

    const entryMatchesSubmission = function(entry) {
      return !!entry &&
        entry.date === tomorrowKey &&
        String(entry.user_id || entry.user || "").toUpperCase() === String(currentUser.id).toUpperCase() &&
        Number(entry.breakfast == null ? entry.b : entry.breakfast) === data.breakfast &&
        Number(entry.lunch == null ? entry.l : entry.lunch) === data.lunch &&
        Number(entry.dinner == null ? entry.d : entry.dinner) === data.dinner;
    };
    if (!entryMatchesSubmission(response.entry)) {
      throw new Error("The server response did not match the submitted entry.");
    }

    const history = await refreshStudentEntryHistory();
    const persistedEntry = history.find(function(entry) {
      return entry.date === tomorrowKey &&
        String(entry.user_id || entry.user || "").toUpperCase() === String(currentUser.id).toUpperCase();
    });
    if (!entryMatchesSubmission(persistedEntry)) {
      throw new Error("Refreshed history did not contain the saved quantities.");
    }

    if (typeof window.mmaCommitTomorrowEntry === "function") {
      window.mmaCommitTomorrowEntry(persistedEntry);
    }
    tomorrowEditMode = false;
    submitted = true;

    renderQty();
    renderYesterdayEntry();
    renderTodayEntry();
    renderMonthly();
  } catch (error) {
    console.error("Error submitting entry:", error);
    const message = error.message || "Unknown error";
    alert(savedOnServer
      ? "Mess entry was saved, but could not be confirmed from entry history: " + message
      : "Failed to submit mess entry: " + message);
  }
};

// Modified submitFeedback to use API
async function submitFeedback(meal) {
  if (!currentUser) return;

  const textarea = document.getElementById("fb_" + meal);
  const comment = textarea ? textarea.value.trim() : "";

  mealStatus = getMealStatus();
  if (!mealStatus[meal]) return;

  mealStatus[meal].fb = comment;
  saveMealStatus();

  const todayMenu = await api.getTodayMenu();

  const data = {
    meal: meal,
    food: todayMenu[meal] || "",
    rating: Number(mealStatus[meal].rating || 0),
    comment: comment
  };

  try {
    const response = await api.submitFeedback(data);
    cacheStudentFeedback(response.feedback || data);
    renderMealStatus();

    const success = document.getElementById("feedbackSuccess");
    if (success) {
      success.textContent = "Feedback sent successfully.";
      success.style.display = "block";
      clearTimeout(window.__feedbackSuccessTimer);
      window.__feedbackSuccessTimer = setTimeout(() => { success.style.display = "none"; }, 3000);
    }
  } catch (error) {
    console.error("Error submitting feedback:", error);
    alert("Failed to submit feedback");
  }
}

// Modified renderTodayMenu to use API
async function renderTodayMenu() {
  const container = document.getElementById("todayFood");
  if (!container) return;

  try {
    const todayMenu = await api.getTodayMenu();
    localStorage.setItem("mma_todayMenu", JSON.stringify(todayMenu));

    const emoji = {
      breakfast: "🥣",
      lunch: "🍚",
      dinner: "🍛"
    };

    container.innerHTML = Object.entries(todayMenu).map(function (item) {
      const meal = item[0];
      const food = item[1];

      return `
        <div class="food-card">
          <div class="emoji">${emoji[meal] || "🍽️"}</div>
          <div class="meal">${meal}</div>
          <div class="name">${food || "Not updated"}</div>
        </div>
      `;
    }).join("");

    try {
      const weeklyMenu = await api.getWeeklyMenu();
      const previousWeeklyMenu = localStorage.getItem("mma_weekMenu");
      const serializedWeeklyMenu = JSON.stringify(weeklyMenu);
      localStorage.setItem("mma_weekMenu", serializedWeeklyMenu);
      await renderWeekMenu(weeklyMenu);
      if (previousWeeklyMenu !== serializedWeeklyMenu) renderMonthly();
    } catch (error) {
      console.error("Error refreshing the weekly menu:", error);
    }
  } catch (error) {
    console.error("Error fetching today's menu:", error);
  }
}

// Render the same clean horizontal weekly-menu cards regardless of which script calls this function.
async function renderWeekMenu(weeklyMenu) {
  const container = document.getElementById("weekMenu");
  if (!container) return;
  try {
    const week = Array.isArray(weeklyMenu) ? weeklyMenu : await api.getWeeklyMenu();
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const todayLabel = window.mmaMessDate.weekdayKey();
    container.innerHTML = week.map(day => {
      const dayLabel = String(day.day || "").trim();
      const isToday = dayLabel.toLowerCase().slice(0, 3) === todayLabel;
      const meals = [["Breakfast",day.b],["Lunch",day.l],["Dinner",day.d]];
      return `<article class="day-card${isToday ? " is-today" : ""}">
        <div class="day-card-head"><div class="day">${escapeHtml(dayLabel || "Day")}</div>${isToday ? '<span class="today-tag">Today</span>' : ""}</div>
        <div class="day-meals">${meals.map(meal => { const food = String(meal[1] || "").trim(); return `<div class="day-meal"><span class="day-meal-label">${meal[0]}</span><span class="day-meal-food${food ? "" : " is-empty"}">${escapeHtml(food || "Menu not published")}</span></div>`; }).join("")}</div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error("Error fetching weekly menu:", error);
  }
}

// Modified renderNotifs to use API
async function renderNotifs() {
  const list = document.getElementById("notifList");
  const badge = document.getElementById("notifBadge");

  if (!list) return;

  try {
    const response = await api.getNotifications();
    const notifications = response.notifications || [];
    const readNotifications = getReadNotifications();
    const unreadCount = notifications.filter(function (notification) {
      return notification.read !== true && !readNotifications.includes(notification.id);
    }).length;

    if (badge) {
      badge.style.display = unreadCount > 0 ? "flex" : "none";
      badge.textContent = unreadCount;
    }

    if (!notifications.length) {
      list.innerHTML = `<div class="empty">No notifications available.</div>`;
      return;
    }

    const escapeText = function(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
        return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character];
      });
    };
    list.innerHTML = notifications.map(function (notification) {
      const isUnread = notification.read !== true && !readNotifications.includes(notification.id);

      return `
        <div class="notif-item ${isUnread ? "is-unread" : ""}">
          <div class="nt">
            ${isUnread ? '<span class="dot"></span>' : ""}
            ${escapeText(notification.t || "")}
          </div>
          <div class="nm">${escapeText(notification.m || "")}</div>
          <div class="nd">${escapeText(notification.d || "")}</div>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Error fetching notifications:", error);
  }
}

// Modified renderBills to use API
async function renderBills() {
  const list = document.getElementById("billList");
  if (!list || !currentUser) return;

  try {
    const response = await api.getBills();
    const bills = (response.bills || []).map(function(bill) {
      return {
        ...bill,
        user: bill.user || bill.user_id,
        month: bill.month || bill.billingMonth || bill.billing_month,
        billingMonth: bill.billingMonth || bill.month || bill.billing_month,
        finalTotal: bill.finalTotal == null
          ? (bill.grandTotal == null ? bill.final_total : bill.grandTotal)
          : bill.finalTotal,
        grandTotal: bill.grandTotal == null
          ? (bill.finalTotal == null ? bill.final_total : bill.finalTotal)
          : bill.grandTotal,
        paidAt: bill.paidAt || bill.paid_at,
        generatedAt: bill.generatedAt || bill.generated_at || bill.created_at,
        updatedAt: bill.updatedAt || bill.updated_at,
        totalPoints: bill.totalPoints == null ? bill.total_points : bill.totalPoints,
        pointsAmount: bill.pointsAmount == null ? bill.mess_charges : bill.pointsAmount,
        perPoint: bill.perPoint == null ? bill.per_point_rate : bill.perPoint,
        fixedCost: bill.fixedCost == null ? bill.fixed_cost : bill.fixedCost,
        waterCharges: bill.waterCharges == null ? bill.water_charges : bill.waterCharges,
        reservedFund: bill.reservedFund == null ? bill.reserved_fund : bill.reservedFund,
        individualFine: bill.individualFine == null ? bill.fine || 0 : bill.individualFine,
        individualDiscount: bill.individualDiscount == null ? bill.discount || 0 : bill.individualDiscount
      };
    });
    localStorage.setItem("mma_adminBills", JSON.stringify(bills));
    if (typeof renderSavedBills === "function") renderSavedBills();
  } catch (error) {
    console.error("Error fetching bills:", error);
    list.innerHTML = `<div class="card bill-card"><div class="empty">Unable to load bills. Please try again later.</div></div>`;
  }
}

// Note: This is a simplified integration. The full integration would require
// updating all render functions to be async and use API calls instead of localStorage.
// For a complete implementation, each function in app.js that uses store.get/set
// should be converted to use the corresponding API call.
