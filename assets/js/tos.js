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

    // ── Generate Questions (AI RAG) ────────────────────
    var genBtn = document.getElementById("btn-generate-questions");
    if (genBtn) {
        genBtn.addEventListener("click", async function () {
            var tosId = genBtn.dataset.tosId;
            NexamModal.confirm(
                "Generate questions with AI?",
                "The system will draft questions from your uploaded materials using RAG, aligned to this blueprint's Bloom distribution. You'll review every question before it enters the question bank.",
                "info",
                async function () {
                    genBtn.disabled = true;
                    genBtn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Generating...';
                    if (window.lucide) lucide.createIcons();

                    try {
                        var csrfCookie = getCookie("nexam_csrf_cookie");
                        var res = await fetch(SITE_URL + "/tos/generate_questions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRF-TOKEN": csrfCookie || "",
                                "X-Requested-With": "XMLHttpRequest",
                            },
                            body: JSON.stringify({ tos_id: tosId }),
                        });
                        var data = await res.json();
                        if (res.ok) {
                            NexamToast.success("Question generation started. Check the Questions page shortly.");
                        } else {
                            NexamToast.error(data.error || "Generation failed.");
                            genBtn.disabled = false;
                            genBtn.innerHTML = '<i data-lucide="sparkles"></i> Generate Questions';
                            if (window.lucide) lucide.createIcons();
                        }
                    } catch (err) {
                        NexamToast.error("Network error. Please try again.");
                        genBtn.disabled = false;
                        genBtn.innerHTML = '<i data-lucide="sparkles"></i> Generate Questions';
                        if (window.lucide) lucide.createIcons();
                    }
                }
            );
        });
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? match[2] : "";
    }
})();
