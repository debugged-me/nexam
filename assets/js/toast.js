/* ==========================================================================
   toast.js — Reusable toast notification system
   Types: success, error, warning, info, delete
   Usage:
     NexamToast.success("Saved!");
     NexamToast.error("Something went wrong");
     NexamToast.warning("Check your input");
     NexamToast.info("FYI");
     NexamToast.delete("Item removed");
     NexamToast.show("Custom title", "Message", "info", 4000);
   ========================================================================== */

var NexamToast = (function () {
    var container = null;
    var icons = {
        success: "circle-check",
        error: "x-circle",
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

    function getContainer() {
        if (!container) {
            container = document.getElementById("nexam-toast-container");
            if (!container) {
                container = document.createElement("div");
                container.id = "nexam-toast-container";
                document.body.appendChild(container);
            }
        }
        return container;
    }

    function show(title, message, type, duration) {
        type = type || "info";
        duration = duration || 4000;
        title = title || titles[type] || "";
        message = message || "";

        var iconName = icons[type] || icons.info;

        var toast = document.createElement("div");
        toast.className = "nexam-toast type-" + type;
        toast.innerHTML =
            '<div class="toast-icon"><i data-lucide="' + iconName + '"></i></div>' +
            '<div class="toast-content">' +
                (title ? '<div class="toast-title">' + escapeHtml(title) + "</div>" : "") +
                (message ? '<div class="toast-message">' + escapeHtml(message) + "</div>" : "") +
            "</div>" +
            '<button class="toast-close" aria-label="Close"><i data-lucide="x"></i></button>';

        getContainer().appendChild(toast);

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        // Animate in
        requestAnimationFrame(function () {
            toast.classList.add("show");
        });

        // Close button
        toast.querySelector(".toast-close").addEventListener("click", function () {
            remove(toast);
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(function () {
                remove(toast);
            }, duration);
        }

        return toast;
    }

    function remove(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add("hide");
        setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        show: show,
        success: function (message, title, duration) {
            return show(title, message, "success", duration);
        },
        error: function (message, title, duration) {
            return show(title, message, "error", duration);
        },
        warning: function (message, title, duration) {
            return show(title, message, "warning", duration);
        },
        info: function (message, title, duration) {
            return show(title, message, "info", duration);
        },
        delete: function (message, title, duration) {
            return show(title, message, "delete", duration);
        }
    };
})();
