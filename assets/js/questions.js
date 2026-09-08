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
        if (panel) panel.classList.add("nexam-modal--question");

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
       Structured multiple-choice option editor
       ------------------------------------------------------------------ */

    function initOptionEditor() {
        var form = document.getElementById("question-form");
        var source = document.getElementById("options");
        var answer = document.getElementById("answer");
        var type = document.getElementById("type");
        var optionsGroup = document.getElementById("options-group");
        var answerGroup = document.getElementById("answer-group");
        var trueFalseAnswer = document.getElementById("true-false-answer");
        if (!form || !source || !answer || !type || !optionsGroup || !answerGroup || !trueFalseAnswer) return;

        var editor = document.createElement("div");
        editor.className = "option-editor";
        editor.innerHTML = '<div class="option-list" id="option-list"></div>' +
            '<button type="button" class="btn btn-outline btn-sm option-add"><i data-lucide="plus"></i> Add option</button>' +
            '<p class="form-hint option-help" aria-live="polite">Select the radio button beside the correct answer.</p>';
        source.classList.add("js-source-field");
        source.insertAdjacentElement("beforebegin", editor);

        var list = editor.querySelector(".option-list");
        var addButton = editor.querySelector(".option-add");
        var initial = source.value.split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean);
        while (initial.length < 4) initial.push("");

        function sync() {
            var values = Array.prototype.map.call(list.querySelectorAll(".option-text"), function (input) {
                return input.value.trim();
            });
            source.value = values.filter(Boolean).join("\n");
            var selected = list.querySelector('input[type="radio"]:checked');
            if (selected) {
                var selectedInput = selected.closest(".option-row").querySelector(".option-text");
                answer.value = selectedInput.value.trim();
            }
            list.querySelectorAll(".option-remove").forEach(function (button) {
                button.disabled = list.children.length <= 2;
            });
        }

        function renumber() {
            list.querySelectorAll(".option-row").forEach(function (row, index) {
                var letter = String.fromCharCode(65 + index);
                row.querySelector(".option-letter").textContent = letter;
                row.querySelector('input[type="radio"]').setAttribute("aria-label", "Mark option " + letter + " as correct");
                row.querySelector(".option-text").setAttribute("aria-label", "Option " + letter);
            });
        }

        function addRow(value) {
            if (list.children.length >= 8) {
                NexamToast.info("A question can have up to eight options.");
                return;
            }
            var row = document.createElement("div");
            row.className = "option-row";
            row.innerHTML = '<span class="option-letter"></span>' +
                '<label class="option-correct-wrap"><input type="radio" name="correct-option" class="option-correct"><span class="sr-only">Mark as correct</span></label>' +
                '<input type="text" class="form-control option-text" maxlength="500" placeholder="Enter an answer option">' +
                '<button type="button" class="option-remove" aria-label="Remove option"><i data-lucide="trash-2"></i></button>';
            row.querySelector(".option-text").value = value || "";
            row.querySelector(".option-text").addEventListener("input", sync);
            row.querySelector(".option-correct").addEventListener("change", sync);
            row.querySelector(".option-remove").addEventListener("click", function () {
                row.remove();
                renumber();
                sync();
            });
            list.appendChild(row);
            if (value && value === answer.value) row.querySelector(".option-correct").checked = true;
            renumber();
            sync();
            refreshIcons(editor);
        }

        initial.forEach(addRow);
        addButton.addEventListener("click", function () {
            addRow("");
            list.lastElementChild.querySelector(".option-text").focus();
        });

        function syncType() {
            var isMcq = type.value === "mcq";
            var isTrueFalse = type.value === "true_false";
            optionsGroup.hidden = !isMcq;
            answerGroup.hidden = isMcq;
            answer.hidden = isTrueFalse;
            trueFalseAnswer.hidden = !isTrueFalse;
            if (isTrueFalse) {
                var normalized = answer.value.toLowerCase();
                trueFalseAnswer.value = normalized === "true" ? "True" : (normalized === "false" ? "False" : "");
                answer.value = trueFalseAnswer.value;
            } else {
                answer.placeholder = "Enter the expected answer";
            }
        }
        trueFalseAnswer.addEventListener("change", function () { answer.value = trueFalseAnswer.value; });
        type.addEventListener("change", syncType);
        syncType();

        form.addEventListener("submit", function (event) {
            if (type.value !== "mcq") return;
            sync();
            var filled = list.querySelectorAll(".option-text");
            var values = Array.prototype.filter.call(filled, function (input) { return input.value.trim() !== ""; });
            if (values.length < 2) {
                event.preventDefault();
                NexamToast.warning("Add at least two answer options.");
                filled[0].focus();
                return;
            }
            if (!list.querySelector('input[type="radio"]:checked') || answer.value.trim() === "") {
                event.preventDefault();
                NexamToast.warning("Select the correct answer before saving.");
                list.querySelector('input[type="radio"]').focus();
            }
        });
    }

    /* ------------------------------------------------------------------
       Wire up buttons
       ------------------------------------------------------------------ */

    document.addEventListener("DOMContentLoaded", function () {
        initOptionEditor();
        var newBtn = document.getElementById("new-question-btn");
        if (newBtn) newBtn.addEventListener("click", openNewQuestionDialog);

        var newBtnEmpty = document.getElementById("new-question-btn-empty");
        if (newBtnEmpty) newBtnEmpty.addEventListener("click", openNewQuestionDialog);

        // ── Approve / Reject AI-drafted questions ────────
        document.querySelectorAll(".btn-approve-q").forEach(function (btn) {
            btn.addEventListener("click", async function () {
                var id = btn.dataset.id;
                try {
                    var csrfCookie = getCookie("nexam_csrf_cookie");
                    var res = await fetch(SITE_URL + "/questions/approve/" + id, {
                        method: "POST",
                        headers: {
                            "X-CSRF-TOKEN": csrfCookie || "",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                    });
                    var data = await res.json();
                    if (res.ok) {
                        NexamToast.success("Question approved and added to the bank.");
                        var row = btn.closest("tr");
                        if (row) row.remove();
                    } else {
                        NexamToast.error(data.error || "Approval failed.");
                    }
                } catch (err) {
                    NexamToast.error("Network error.");
                }
            });
        });

        document.querySelectorAll(".btn-reject-q").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.dataset.id;
                NexamModal.deleteConfirm("Reject this question?", "The AI-drafted question will be permanently deleted.", function () {
                    fetch(SITE_URL + "/questions/reject/" + id, {
                        method: "POST",
                        headers: {
                            "X-CSRF-TOKEN": getCookie("nexam_csrf_cookie") || "",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                    }).then(function (res) { return res.json(); }).then(function (data) {
                        if (data.ok) {
                            NexamToast.success("Question rejected.");
                            var row = btn.closest("tr");
                            if (row) row.remove();
                        } else {
                            NexamToast.error(data.error || "Rejection failed.");
                        }
                    }).catch(function () {
                        NexamToast.error("Network error.");
                    });
                });
            });
        });
    });

    function getCookie(name) {
        var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? match[2] : "";
    }
})();
