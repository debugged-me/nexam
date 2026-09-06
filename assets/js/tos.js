/* TOS blueprint form feedback. */
(function () {
    "use strict";
    var form = document.getElementById("tos-form");
    var inputs = document.querySelectorAll(".bloom-input");
    var totalEl = document.getElementById("bloomTotalValue");
    var badgeEl = document.getElementById("bloomTotalBadge");
    if (!form || !inputs.length || !totalEl || !badgeEl) return;

    function recalculate() {
        var sum = 0;
        inputs.forEach(function (input) { sum += parseInt(input.value, 10) || 0; });
        totalEl.textContent = sum;
        badgeEl.textContent = sum === 100 ? "Balanced" : (100 - sum > 0 ? (100 - sum) + "% remaining" : Math.abs(100 - sum) + "% over");
        badgeEl.className = "bloom-total-badge " + (sum === 100 ? "ok" : "warn");
        return sum;
    }

    inputs.forEach(function (input) { input.addEventListener("input", recalculate); });
    form.addEventListener("submit", function (event) {
        if (recalculate() !== 100) {
            event.preventDefault();
            NexamToast.warning("Bloom taxonomy weights must total exactly 100%.");
            inputs[0].focus();
        }
    });
    recalculate();
})();
