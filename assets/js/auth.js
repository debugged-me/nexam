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
});
