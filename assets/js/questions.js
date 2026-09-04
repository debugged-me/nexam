/* ==========================================================================
   questions.js — filter + new question modals for the question bank page
   Both dialogs are built with NexamModal so they share the shell's look.
   ========================================================================== */

(function () {
    "use strict";

    /* ------------------------------------------------------------------
       Config + helpers
       ------------------------------------------------------------------ */

    var config = (function () {
        var tag = document.getElementById("questions-config");
        if (!tag) return {};
        try { return JSON.parse(tag.textContent); } catch (e) { return {}; }
    })();

    function meta(name) {
        var tag = document.querySelector('meta[name="' + name + '"]');
        return tag ? tag.getAttribute("content") : "";
    }

    function esc(value) {
        var div = document.createElement("div");
        div.textContent = value == null ? "" : value;
        return div.innerHTML;
    }

    function storeCsrf(payload) {
        if (!payload || !payload.csrf_hash) return;
        var tag = document.querySelector('meta[name="csrf-hash"]');
        if (tag) tag.setAttribute("content", payload.csrf_hash);
    }

    function csrfField(form) {
        var name = meta("csrf-name");
        if (name) form.append(name, meta("csrf-hash"));
    }

    function postJson(url, body) {
        return fetch(url, {
            method: "POST",
            body: body,
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" }
        }).then(function (res) {
            return res.text().then(function (text) {
                var payload;
                try {
                    payload = JSON.parse(text);
                } catch (err) {
                    payload = { message: "Your session has expired. Please refresh the page and try again." };
                }
                storeCsrf(payload);
                return { ok: res.ok, payload: payload };
            });
        });
    }

    function refreshIcons(modal) {
        if (window.lucide) lucide.createIcons();
    }

    /* ------------------------------------------------------------------
       Filter dialog
       ------------------------------------------------------------------ */

    function openFilterDialog() {
        var filters = config.filters || {};
        var subjects = config.subjects || [];
        var bloomLevels = config.bloomLevels || [];
        var questionTypes = config.questionTypes || [];

        var typeLabels = {
            mcq: "Multiple Choice",
            true_false: "True / False",
            identification: "Identification",
            essay: "Essay"
        };

        var subjectOptions = '<option value="">All subjects</option>' +
            subjects.map(function (s) {
                var sel = filters.subject_id === s.id ? " selected" : "";
                return '<option value="' + esc(s.id) + '"' + sel + '>' +
                    esc(s.name) + (s.code ? " (" + esc(s.code) + ")" : "") +
                    "</option>";
            }).join("");

        var bloomOptions = '<option value="">All levels</option>' +
            bloomLevels.map(function (b) {
                var sel = filters.bloom === b ? " selected" : "";
                return '<option value="' + esc(b) + '"' + sel + ">" + esc(capitalize(b)) + "</option>";
            }).join("");

        var typeOptions = '<option value="">All types</option>' +
            questionTypes.map(function (t) {
                var sel = filters.type === t ? " selected" : "";
                return '<option value="' + esc(t) + '"' + sel + ">" +
                    esc(typeLabels[t] || capitalize(t)) + "</option>";
            }).join("");

        var modal = NexamModal.open({
            title: "Filter Questions",
            subtitle: "Narrow the list by subject, Bloom level or type",
            type: "info",
            buttons: [
                { text: "Clear", style: "cancel", dismiss: true },
                { text: "Apply Filters", style: "primary", icon: "filter", dismiss: false }
            ],
            body:
                '<div class="form-group">' +
                    '<label class="form-label" for="m_filter_subject">Subject</label>' +
                    '<select id="m_filter_subject" class="form-control form-select">' + subjectOptions + "</select>" +
                "</div>" +
                '<div class="form-group">' +
                    '<label class="form-label" for="m_filter_bloom">Bloom Level</label>' +
                    '<select id="m_filter_bloom" class="form-control form-select">' + bloomOptions + "</select>" +
                "</div>" +
                '<div class="form-group mb-0">' +
                    '<label class="form-label" for="m_filter_type">Type</label>' +
                    '<select id="m_filter_type" class="form-control form-select">' + typeOptions + "</select>" +
                "</div>"
        });

        // Widen the modal slightly for the form fields
        var panel = modal.querySelector(".nexam-modal");
        if (panel) panel.style.maxWidth = "480px";

        var applyBtn = modal.querySelector('[data-btn-index="1"]');
        var clearBtn = modal.querySelector('[data-btn-index="0"]');

        clearBtn.addEventListener("click", function () {
            window.location.href = config.filterUrl || (meta("base-url") || "") + "questions";
        });

        applyBtn.addEventListener("click", function () {
            var params = [];
            var subject = modal.querySelector("#m_filter_subject").value;
            var bloom = modal.querySelector("#m_filter_bloom").value;
            var type = modal.querySelector("#m_filter_type").value;

            if (subject) params.push("subject_id=" + encodeURIComponent(subject));
            if (bloom) params.push("bloom=" + encodeURIComponent(bloom));
            if (type) params.push("type=" + encodeURIComponent(type));

            var url = config.filterUrl || "questions";
            if (params.length) url += "?" + params.join("&");

            window.location.href = url;
        });
    }

    /* ------------------------------------------------------------------
       New Question dialog
       ------------------------------------------------------------------ */

    function openNewQuestionDialog() {
        var subjects = config.subjects || [];
        var bloomLevels = config.bloomLevels || [];
        var questionTypes = config.questionTypes || [];
        var statuses = config.statuses || [];

        var typeLabels = {
            mcq: "Multiple Choice",
            true_false: "True / False",
            identification: "Identification",
            essay: "Essay"
        };

        if (subjects.length === 0) {
            NexamToast.warning("Create a subject first before adding questions.");
            return;
        }

        var subjectOptions = '<option value="" disabled selected>Select a subject…</option>' +
            subjects.map(function (s) {
                return '<option value="' + esc(s.id) + '">' + esc(s.name) +
                    (s.code ? " (" + esc(s.code) + ")" : "") + "</option>";
            }).join("");

        var typeOptions = questionTypes.map(function (t) {
            var sel = t === "mcq" ? " selected" : "";
            return '<option value="' + esc(t) + '"' + sel + ">" +
                esc(typeLabels[t] || capitalize(t)) + "</option>";
        }).join("");

        var bloomOptions = '<option value="">— Select —</option>' +
            bloomLevels.map(function (b) {
                return '<option value="' + esc(b) + '">' + esc(capitalize(b)) + "</option>";
            }).join("");

        var statusOptions = statuses.map(function (st) {
            var sel = st === "draft" ? " selected" : "";
            return '<option value="' + esc(st) + '"' + sel + ">" + esc(capitalize(st)) + "</option>";
        }).join("");

        var modal = NexamModal.open({
            title: "New Question",
            subtitle: "Write the stem, options and answer, then tag it",
            type: "info",
            buttons: [
                { text: "Cancel", style: "cancel", dismiss: true },
                { text: "Create Question", style: "primary", icon: "check", dismiss: false }
            ],
            body:
                '<div class="form-group">' +
                    '<label class="form-label" for="q_subject">Subject <span class="req">*</span></label>' +
                    '<select id="q_subject" class="form-control form-select">' + subjectOptions + "</select>" +
                "</div>" +
                '<div class="qf-grid">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="q_type">Type <span class="req">*</span></label>' +
                        '<select id="q_type" class="form-control form-select">' + typeOptions + "</select>" +
                    "</div>" +
                    '<div class="form-group">' +
                        '<label class="form-label" for="q_bloom">Bloom Level</label>' +
                        '<select id="q_bloom" class="form-control form-select">' + bloomOptions + "</select>" +
                    "</div>" +
                "</div>" +
                '<div class="form-group">' +
                    '<label class="form-label" for="q_topic">Topic</label>' +
                    '<input type="text" id="q_topic" class="form-control" maxlength="255" placeholder="e.g. Quadratic Equations">' +
                "</div>" +
                '<div class="form-group">' +
                    '<label class="form-label" for="q_stem">Question Stem <span class="req">*</span></label>' +
                    '<textarea id="q_stem" class="form-control" rows="3" placeholder="Enter the question text…"></textarea>' +
                "</div>" +
                '<div class="form-group">' +
                    '<label class="form-label" for="q_options">Options <span class="form-hint-inline">(MCQ — one per line)</span></label>' +
                    '<textarea id="q_options" class="form-control" rows="4" placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"></textarea>' +
                "</div>" +
                '<div class="qf-grid">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="q_answer">Answer</label>' +
                        '<input type="text" id="q_answer" class="form-control" placeholder="e.g. Option B">' +
                    "</div>" +
                    '<div class="form-group">' +
                        '<label class="form-label" for="q_status">Status</label>' +
                        '<select id="q_status" class="form-control form-select">' + statusOptions + "</select>" +
                    "</div>" +
                "</div>" +
                '<div class="form-group mb-0">' +
                    '<label class="form-label" for="q_explanation">Explanation</label>' +
                    '<textarea id="q_explanation" class="form-control" rows="2" placeholder="Optional explanation shown after answering"></textarea>' +
                "</div>"
        });

        // Widen for the two-column form layout
        var panel = modal.querySelector(".nexam-modal");
        if (panel) panel.style.maxWidth = "560px";

        var saveBtn = modal.querySelector('[data-btn-index="1"]');
        var subjectEl = modal.querySelector("#q_subject");
        subjectEl.focus();

        saveBtn.addEventListener("click", function () {
            var subject = subjectEl.value;
            var type = modal.querySelector("#q_type").value;
            var bloom = modal.querySelector("#q_bloom").value;
            var topic = modal.querySelector("#q_topic").value.trim();
            var stem = modal.querySelector("#q_stem").value.trim();
            var options = modal.querySelector("#q_options").value;
            var answer = modal.querySelector("#q_answer").value.trim();
            var status = modal.querySelector("#q_status").value;
            var explanation = modal.querySelector("#q_explanation").value.trim();

            if (!subject) {
                NexamToast.warning("Please select a subject.");
                subjectEl.focus();
                return;
            }

            if (!stem) {
                NexamToast.warning("Please enter the question stem.");
                modal.querySelector("#q_stem").focus();
                return;
            }

            var body = new FormData();
            body.append("subject_id", subject);
            body.append("type", type);
            body.append("bloom", bloom);
            body.append("topic", topic);
            body.append("stem", stem);
            body.append("options", options);
            body.append("answer", answer);
            body.append("status", status);
            body.append("explanation", explanation);
            csrfField(body);

            saveBtn.disabled = true;
            var originalLabel = saveBtn.textContent;
            saveBtn.textContent = "Creating…";

            postJson(config.storeUrl, body)
                .then(function (result) {
                    if (!result.ok) {
                        NexamToast.error(result.payload.message || "Failed to create question.");
                        return;
                    }

                    NexamModal.close(modal);
                    NexamToast.success(result.payload.message || "Question created successfully.");
                    // Reload to show the new question in the table
                    setTimeout(function () { window.location.reload(); }, 400);
                })
                .catch(function () {
                    NexamToast.error("Could not reach the server. Please try again.");
                })
                .then(function () {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalLabel;
                });
        });
    }

    /* ------------------------------------------------------------------
       Utils
       ------------------------------------------------------------------ */

    function capitalize(str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /* ------------------------------------------------------------------
       Wire up buttons
       ------------------------------------------------------------------ */

    document.addEventListener("DOMContentLoaded", function () {
        var filterBtn = document.getElementById("filter-btn");
        if (filterBtn) filterBtn.addEventListener("click", openFilterDialog);

        var newBtn = document.getElementById("new-question-btn");
        if (newBtn) newBtn.addEventListener("click", openNewQuestionDialog);

        var newBtnEmpty = document.getElementById("new-question-btn-empty");
        if (newBtnEmpty) newBtnEmpty.addEventListener("click", openNewQuestionDialog);
    });
})();
