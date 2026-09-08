/**
 * analytics.js — minimal interactions for analytics pages
 * Most charts and tables are server-rendered; this handles any
 * client-side enhancements like tooltips or lazy loading.
 */
(function () {
    "use strict";

    // Highlight rows on hover for better readability of dense tables
    document.querySelectorAll(".data-table tbody tr").forEach(function (row) {
        row.addEventListener("mouseenter", function () {
            row.style.background = "var(--surface-2, #f8fafc)";
        });
        row.addEventListener("mouseleave", function () {
            row.style.background = "";
        });
    });
})();
