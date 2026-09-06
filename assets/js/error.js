(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        if (window.lucide) window.lucide.createIcons();
        var back = document.querySelector("[data-error-back]");
        if (!back) return;
        if (window.history.length < 2) back.hidden = true;
        back.addEventListener("click", function () { window.history.back(); });
    });
})();
