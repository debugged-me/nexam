/* ==========================================================================
   modal.js — Reusable modal / confirmation dialog system
   Types: default, danger (delete), success, warning, info
   Usage:
     NexamModal.confirm("Delete subject?", "This cannot be undone.", "delete", function() {
         // runs on confirm
     });
     NexamModal.alert("Saved!", "Your changes have been saved.", "success");
     NexamModal.open({
         title: "Custom Modal",
         body: "<p>HTML content allowed</p>",
         type: "info",
         buttons: [
             { text: "Cancel", style: "cancel", dismiss: true },
             { text: "OK", style: "primary", onClick: function() { ... } }
         ]
     });
   ========================================================================== */

var NexamModal = (function () {
    var icons = {
        default: "layout-grid",
        danger: "trash-2",
        delete: "trash-2",
        success: "circle-check",
        warning: "triangle-alert",
        info: "info"
    };

    function createOverlay() {
        var overlay = document.createElement("div");
        overlay.className = "nexam-modal-overlay";
        return overlay;
    }

    function createModal(options) {
        options = options || {};
        var type = options.type || "default";
        var title = options.title || "";
        var subtitle = options.subtitle || "";
        var body = options.body || "";
        var buttons = options.buttons || [];
        var showClose = options.showClose !== false;
        var iconName = icons[type] || icons.default;

        var overlay = createOverlay();

        var modal = document.createElement("div");
        modal.className = "nexam-modal type-" + type;

        var html = '<div class="nexam-modal-header">';
        html += '<div class="nexam-modal-icon"><i data-lucide="' + iconName + '"></i></div>';
        html += '<div class="nexam-modal-title-wrap">';
        html += '<div class="nexam-modal-title">' + escapeHtml(title) + "</div>";
        if (subtitle) {
            html += '<div class="nexam-modal-subtitle">' + escapeHtml(subtitle) + "</div>";
        }
        html += "</div>";
        if (showClose) {
            html += '<button class="nexam-modal-close" aria-label="Close"><i data-lucide="x"></i></button>';
        }
        html += "</div>";

        if (body) {
            html += '<div class="nexam-modal-body">' + body + "</div>";
        }

        if (buttons.length > 0) {
            html += '<div class="nexam-modal-footer">';
            buttons.forEach(function (btn, i) {
                var style = btn.style || "primary";
                var cls = "nexam-btn nexam-btn-" + style;
                html += '<button class="' + cls + '" data-btn-index="' + i + '">';
                if (btn.icon) {
                    html += '<i data-lucide="' + btn.icon + '"></i>';
                }
                html += escapeHtml(btn.text || "OK");
                html += "</button>";
            });
            html += "</div>";
        }

        modal.innerHTML = html;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        // Wire up buttons
        buttons.forEach(function (btn, i) {
            var btnEl = modal.querySelector('[data-btn-index="' + i + '"]');
            if (btnEl) {
                btnEl.addEventListener("click", function () {
                    if (typeof btn.onClick === "function") {
                        btn.onClick();
                    }
                    if (btn.dismiss !== false) {
                        close(overlay);
                    }
                });
            }
        });

        // Close button
        if (showClose) {
            var closeBtn = modal.querySelector(".nexam-modal-close");
            if (closeBtn) {
                closeBtn.addEventListener("click", function () {
                    close(overlay);
                });
            }
        }

        // Click outside to close
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay && options.closeOnBackdrop !== false) {
                close(overlay);
            }
        });

        // ESC to close
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && overlay.parentNode) {
                close(overlay);
            }
        });

        // Animate in
        requestAnimationFrame(function () {
            overlay.classList.add("show");
        });

        return overlay;
    }

    function close(overlay) {
        if (!overlay || !overlay.parentNode) return;
        overlay.classList.remove("show");
        setTimeout(function () {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 250);
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    /* ---- Convenience methods ---- */

    function confirm(title, message, type, onConfirm, onCancel) {
        type = type || "warning";
        var confirmStyle = type === "danger" || type === "delete" ? "danger" : "primary";
        var confirmText = type === "danger" || type === "delete" ? "Delete" : "Confirm";
        var confirmIcon = type === "danger" || type === "delete" ? "trash-2" : "check";

        return createModal({
            title: title,
            body: message ? "<p>" + escapeHtml(message) + "</p>" : "",
            type: type,
            buttons: [
                { text: "Cancel", style: "cancel", dismiss: true, onClick: onCancel },
                {
                    text: confirmText,
                    style: confirmStyle,
                    icon: confirmIcon,
                    dismiss: true,
                    onClick: onConfirm
                }
            ]
        });
    }

    function alert(title, message, type, onOk) {
        type = type || "info";
        return createModal({
            title: title,
            body: message ? "<p>" + escapeHtml(message) + "</p>" : "",
            type: type,
            buttons: [
                { text: "OK", style: type === "success" ? "success" : "primary", dismiss: true, onClick: onOk }
            ]
        });
    }

    function deleteConfirm(title, message, onConfirm) {
        return confirm(title, message, "delete", onConfirm);
    }

    return {
        open: createModal,
        confirm: confirm,
        alert: alert,
        deleteConfirm: deleteConfirm,
        close: close
    };
})();
