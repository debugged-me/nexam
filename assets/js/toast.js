/* ==========================================================================
   toast.js — transient notifications
   --------------------------------------------------------------------------
   Toasts stack in the corner and never block the page. Hovering pauses the
   auto-dismiss so a message cannot vanish while it is being read.

   Usage (unchanged):
     NexamToast.success("Saved!");
     NexamToast.error("Something went wrong");
     NexamToast.warning("Check your input");
     NexamToast.info("FYI");
     NexamToast.delete("Item removed");
     NexamToast.show("Custom title", "Message", "info", 4000);  // 0 = sticky
     NexamToast.clear();
   ========================================================================== */

var NexamToast = (function () {
    "use strict";

    var MAX_VISIBLE = 4;
    var stack = null;

    var icons = {
        success: "circle-check",
        error: "circle-x",
        warning: "triangle-alert",
        info: "info",
        delete: "trash-2"
    };

    var titles = {
        success: "Success",
        error: "Error",
        warning: "Warning",
        info: "Info",
        delete: "Deleted"
    };

    function container() {
        if (!stack || !stack.parentNode) {
            stack = document.createElement("div");
            stack.id = "nexam-toasts";
            stack.setAttribute("role", "region");
            stack.setAttribute("aria-live", "polite");
            stack.setAttribute("aria-label", "Notifications");
            document.body.appendChild(stack);
        }
        return stack;
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str == null ? "" : str;
        return div.innerHTML;
    }

    /**
     * @param {string} title    Heading; falls back to the type's label. Pass ""
     *                          to show the message on its own.
     * @param {string} message  Body copy.
     * @param {string} type     success | error | warning | info | delete
     * @param {number} duration Milliseconds; 0 keeps the toast until dismissed.
     */
    function show(title, message, type, duration) {
        type = icons[type] ? type : "info";
        duration = duration === 0 ? 0 : (duration || 4000);
        message = message || "";

        // An explicit "" means the caller wants the message to stand alone;
        // undefined means "use the default label for this type".
        var heading = title === "" ? "" : (title || titles[type]);

        var el = document.createElement("div");
        el.className = "nexam-toast type-" + type;
        el.setAttribute("role", type === "error" ? "alert" : "status");

        el.innerHTML =
            '<span class="toast-icon"><i data-lucide="' + icons[type] + '"></i></span>' +
            '<div class="toast-body">' +
                (heading ? '<p class="toast-title">' + escapeHtml(heading) + "</p>" : "") +
                (message ? '<div class="toast-message' + (heading ? "" : " solo") + '">' +
                    escapeHtml(message) + "</div>" : "") +
            "</div>" +
            '<button class="toast-close" type="button" aria-label="Dismiss"><i data-lucide="x"></i></button>' +
            (duration > 0 ? '<div class="toast-progress"><span></span></div>' : "");

        var box = container();
        box.appendChild(el);

        // Retire the oldest rather than letting the stack grow without bound.
        while (box.children.length > MAX_VISIBLE) {
            dismiss(box.children[0]);
        }

        if (typeof lucide !== "undefined") lucide.createIcons();

        requestAnimationFrame(function () { el.classList.add("show"); });

        el.querySelector(".toast-close").addEventListener("click", function () { dismiss(el); });

        if (duration > 0) {
            startTimer(el, duration);
        }

        return el;
    }

    /** Auto-dismiss with a progress bar that pauses while hovered or focused. */
    function startTimer(el, duration) {
        var bar = el.querySelector(".toast-progress span");
        var remaining = duration;
        var startedAt;
        var timer;

        function run() {
            startedAt = Date.now();
            if (bar) {
                bar.style.transitionDuration = remaining + "ms";
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { bar.style.transform = "scaleX(0)"; });
                });
            }
            timer = setTimeout(function () { dismiss(el); }, remaining);
        }

        function pause() {
            clearTimeout(timer);
            remaining -= Date.now() - startedAt;
            if (bar) {
                // Freeze the bar where it currently sits.
                var width = bar.getBoundingClientRect().width;
                var full = bar.parentNode.getBoundingClientRect().width || 1;
                bar.style.transitionDuration = "0ms";
                bar.style.transform = "scaleX(" + (width / full) + ")";
            }
        }

        el.addEventListener("mouseenter", pause);
        el.addEventListener("focusin", pause);
        el.addEventListener("mouseleave", function () { if (remaining > 0) run(); });
        el.addEventListener("focusout", function () { if (remaining > 0) run(); });

        run();
    }

    function dismiss(el) {
        if (!el || el.dataset.closing === "1") return;
        el.dataset.closing = "1";
        el.classList.remove("show");
        el.classList.add("hide");

        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 240);
    }

    function clear() {
        if (!stack) return;
        Array.prototype.slice.call(stack.children).forEach(dismiss);
    }

    return {
        show: show,
        clear: clear,
        close: dismiss,
        success: function (message, title, duration) { return show(title, message, "success", duration); },
        error: function (message, title, duration) { return show(title, message, "error", duration); },
        warning: function (message, title, duration) { return show(title, message, "warning", duration); },
        info: function (message, title, duration) { return show(title, message, "info", duration); },
        delete: function (message, title, duration) { return show(title, message, "delete", duration); }
    };
})();
