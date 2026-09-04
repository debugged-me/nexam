/* ==========================================================================
   auth.js — Shared JS for login / register / forgot-password pages
   Icons: Lucide only (https://lucide.dev/icons/)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
    // Render all Lucide icons on the page
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Password show/hide toggle — works for any .password-toggle button
    document.querySelectorAll(".password-toggle").forEach(function (btn) {
        btn.addEventListener("click", function () {
            var input = this.parentElement.querySelector(".form-input");
            if (!input) return;

            if (input.type === "password") {
                input.type = "text";
                this.setAttribute("aria-label", "Hide password");
                this.innerHTML = '<i data-lucide="eye-off"></i>';
            } else {
                input.type = "password";
                this.setAttribute("aria-label", "Show password");
                this.innerHTML = '<i data-lucide="eye"></i>';
            }

            if (typeof lucide !== "undefined") {
                lucide.createIcons();
            }
        });
    });

    // Show spinner + "Verifying..." toast on the submit button when a form is sent
    document.querySelectorAll(".auth-form-wrap form").forEach(function (form) {
        form.addEventListener("submit", function (e) {
            var btn = form.querySelector(".btn-login");
            if (btn) btn.classList.add("is-loading");

            // Show a sticky toast based on which form was submitted
            var action = form.getAttribute("action") || "";
            var msg = "Please wait...";

            if (action.indexOf("authenticate") !== -1) {
                msg = "Verifying your credentials...";
            } else if (action.indexOf("register/submit") !== -1) {
                msg = "Creating your account...";
            } else if (action.indexOf("forgot/submit") !== -1) {
                msg = "Sending reset code...";
            } else if (action.indexOf("reset/submit") !== -1) {
                msg = "Resetting your password...";
            } else if (action.indexOf("verify/submit") !== -1) {
                msg = "Verifying your code...";
            }

            if (typeof NexamToast !== "undefined") {
                NexamToast.show("", msg, "info", 0); // 0 = sticky (won't auto-dismiss)
            }
        });
    });
});
