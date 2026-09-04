/* ==========================================================================
   app-shell.js — shared shell behaviour (mobile sidebar, live clock)
   Loaded on every authenticated page.
   ========================================================================== */

(function () {
    "use strict";

    /* ---- Mobile sidebar ---------------------------------------------- */

    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("mobileSidebarOverlay");

    function setSidebar(open) {
        if (!sidebar) return;
        sidebar.classList.toggle("mobile-open", open);
        if (overlay) overlay.classList.toggle("show", open);
        document.body.style.overflow = open ? "hidden" : "";
    }

    function toggleSidebar() {
        if (!sidebar) return;
        setSidebar(!sidebar.classList.contains("mobile-open"));
    }

    // Kept global: markup wires it up with data-sidebar-toggle, but exposing it
    // means any page can trigger the drawer without importing this file.
    window.toggleMobileSidebar = toggleSidebar;

    document.querySelectorAll("[data-sidebar-toggle]").forEach(function (el) {
        el.addEventListener("click", function (ev) {
            ev.preventDefault();
            toggleSidebar();
        });
    });

    if (overlay) overlay.addEventListener("click", function () { setSidebar(false); });

    // Following a link should always leave the drawer closed.
    if (sidebar) {
        sidebar.querySelectorAll("a.nav-item").forEach(function (link) {
            link.addEventListener("click", function () { setSidebar(false); });
        });
    }

    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") setSidebar(false);
    });

    /* ---- Live clock (app timezone) ------------------------------------ */

    var clockEl = document.getElementById("live-clock");

    if (clockEl) {
        var dateFmt = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric"
        });
        var timeFmt = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
        });

        var timeSlot = clockEl.querySelector(".clock-time");
        var dateSlot = clockEl.querySelector(".clock-date");

        var tick = function () {
            var now = new Date();
            if (timeSlot) timeSlot.textContent = timeFmt.format(now);
            if (dateSlot) dateSlot.textContent = dateFmt.format(now);
        };

        tick();
        setInterval(tick, 1000);
    }
})();
