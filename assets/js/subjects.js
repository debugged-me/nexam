/**
 * subjects.js — New Subject modal for the subjects list page.
 * Uses NexamModal so it shares the shell's look and feel.
 */
(function () {
    "use strict";

    var config = {};
    try {
        var el = document.getElementById("subjects-config");
        if (el) config = JSON.parse(el.textContent);
    } catch (e) { /* leave config empty */ }

    /* ---- CSRF helpers ---- */

    function csrfField(form) {
        if (config.csrfName) form.append(config.csrfName, config.csrfHash);
    }

    function storeCsrf(payload) {
        if (!payload || !payload.csrf_hash) return;
        config.csrfHash = payload.csrf_hash;
    }

    /* ---- JSON POST helper ---- */

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

    /* ---- New Subject modal ---- */

    function openNewSubjectDialog() {
        var modal = NexamModal.open({
            title: "New Subject",
            subtitle: "Add a course to group your questions, blueprints and exams",
            type: "info",
            buttons: [
                { text: "Cancel", style: "cancel", dismiss: true },
                { text: "Create Subject", style: "primary", icon: "check", dismiss: false }
            ],
            body:
                '<div class="form-group">' +
                    '<label class="form-label" for="subj_name">Subject Name <span class="req">*</span></label>' +
                    '<input type="text" id="subj_name" class="form-control" maxlength="255" autofocus placeholder="e.g. Introduction to Computer Science">' +
                "</div>" +
                '<div class="form-group">' +
                    '<label class="form-label" for="subj_code">Subject Code</label>' +
                    '<input type="text" id="subj_code" class="form-control" maxlength="50" placeholder="e.g. CS-101">' +
                "</div>" +
                '<div class="form-group mb-0">' +
                    '<label class="form-label" for="subj_desc">Description</label>' +
                    '<textarea id="subj_desc" class="form-control" rows="3" maxlength="5000" placeholder="Optional description"></textarea>' +
                "</div>"
        });

        var nameEl = modal.querySelector("#subj_name");
        nameEl.focus();

        var saveBtn = modal.querySelector('[data-btn-index="1"]');

        saveBtn.addEventListener("click", function () {
            var name = nameEl.value.trim();
            var code = modal.querySelector("#subj_code").value.trim();
            var desc = modal.querySelector("#subj_desc").value.trim();

            if (!name) {
                NexamToast.warning("Please enter a subject name.");
                nameEl.focus();
                return;
            }

            var body = new FormData();
            body.append("name", name);
            body.append("code", code);
            body.append("description", desc);
            csrfField(body);

            saveBtn.disabled = true;
            var orig = saveBtn.textContent;
            saveBtn.textContent = "Creating…";

            postJson(config.storeUrl, body)
                .then(function (result) {
                    if (!result.ok) {
                        NexamToast.error(result.payload.message || "Failed to create subject.");
                        return;
                    }
                    NexamModal.close(modal);
                    NexamToast.success(result.payload.message || "Subject created successfully.");
                    setTimeout(function () { window.location.reload(); }, 400);
                })
                .catch(function () {
                    NexamToast.error("Could not reach the server. Please try again.");
                })
                .then(function () {
                    saveBtn.disabled = false;
                    saveBtn.textContent = orig;
                });
        });
    }

    /* ---- Wire up buttons ---- */

    document.addEventListener("DOMContentLoaded", function () {
        var btn = document.getElementById("new-subject-btn");
        if (btn) btn.addEventListener("click", openNewSubjectDialog);

        var btnEmpty = document.getElementById("new-subject-btn-empty");
        if (btnEmpty) btnEmpty.addEventListener("click", openNewSubjectDialog);
    });
})();
