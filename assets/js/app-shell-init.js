/* Apply persisted shell state before first paint. */
(function () {
    "use strict";
    try {
        if (localStorage.getItem("nexam:rail-collapsed") === "1" &&
            window.matchMedia("(min-width: 992px)").matches) {
            document.body.classList.add("rail-collapsed");
        }
    } catch (error) {
        /* Storage can be unavailable in private browsing. */
    }
})();
