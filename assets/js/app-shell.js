/* ==========================================================================
   app-shell.js — shared shell behaviour
   Nav rail (collapse on desktop, drawer on mobile), topbar account menu,
   and the profile / password dialogs it opens.
   ========================================================================== */

(function () {
    "use strict";

    var DESKTOP = "(min-width: 992px)";
    var STORAGE_KEY = "nexam:rail-collapsed";
    var railToggle = document.getElementById("rail-toggle");

    /* ------------------------------------------------------------------
       Nav rail
       ------------------------------------------------------------------ */

    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("mobileSidebarOverlay");

    function isDesktop() {
        return window.matchMedia(DESKTOP).matches;
    }

    /** Mobile: slide the drawer in and out. */
    function setDrawer(open) {
        if (!sidebar) return;
        sidebar.classList.toggle("mobile-open", open);
        if (overlay) overlay.classList.toggle("show", open);
        sidebar.setAttribute("aria-hidden", open || isDesktop() ? "false" : "true");
        if (railToggle) {
            railToggle.setAttribute("aria-expanded", open ? "true" : "false");
            railToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
        }
        document.body.style.overflow = open ? "hidden" : "";
        if (open) {
            var activeLink = sidebar.querySelector(".nav-item.active") || sidebar.querySelector(".nav-item");
            if (activeLink) requestAnimationFrame(function () { activeLink.focus(); });
        } else if (!isDesktop() && document.activeElement && sidebar.contains(document.activeElement) && railToggle) {
            railToggle.focus();
        }
    }

    /** Desktop: shrink the rail to icons only, and remember the choice. */
    function setCollapsed(collapsed) {
        document.body.classList.toggle("rail-collapsed", collapsed);
        if (railToggle) {
            railToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
            railToggle.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
        }
        try {
            localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
        } catch (err) {
            /* Private browsing — the rail just won't remember between visits. */
        }
    }

    function toggleRail() {
        if (isDesktop()) {
            setCollapsed(!document.body.classList.contains("rail-collapsed"));
        } else {
            setDrawer(!sidebar.classList.contains("mobile-open"));
        }
    }

    // Kept global so any page can reach the drawer without importing this file.
    window.toggleMobileSidebar = function () { setDrawer(!sidebar.classList.contains("mobile-open")); };

    if (railToggle) railToggle.addEventListener("click", toggleRail);

    // Global back button — uses browser history, falls back to dashboard.
    var backBtn = document.getElementById("topbar-back");
    if (backBtn) {
        backBtn.addEventListener("click", function () {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = SITE_URL + "/dashboard";
            }
        });
    }

    document.querySelectorAll("[data-sidebar-toggle]").forEach(function (el) {
        el.addEventListener("click", function (ev) {
            ev.preventDefault();
            setDrawer(false);
        });
    });

    if (overlay) overlay.addEventListener("click", function () { setDrawer(false); });

    if (sidebar) {
        sidebar.querySelectorAll("a.nav-item").forEach(function (link) {
            link.addEventListener("click", function () { setDrawer(false); });
        });
    }

    // Leaving mobile width should never strand an open drawer.
    var desktopQuery = window.matchMedia(DESKTOP);
    function syncLayoutMode() {
        setDrawer(false);
        if (sidebar) sidebar.setAttribute("aria-hidden", isDesktop() ? "false" : "true");
        if (isDesktop()) {
            setCollapsed(document.body.classList.contains("rail-collapsed"));
        } else if (railToggle) {
            railToggle.setAttribute("aria-expanded", "false");
            railToggle.setAttribute("aria-label", "Open navigation");
        }
    }
    if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", syncLayoutMode);
    else desktopQuery.addListener(syncLayoutMode);
    syncLayoutMode();

    document.addEventListener("keydown", function (ev) {
        if (ev.key !== "Tab" || isDesktop() || !sidebar || !sidebar.classList.contains("mobile-open")) return;
        var focusable = sidebar.querySelectorAll('a[href], button:not([disabled])');
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
            ev.preventDefault();
            last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
            ev.preventDefault();
            first.focus();
        }
    });

    /* ------------------------------------------------------------------
       Topbar account menu
       ------------------------------------------------------------------ */

    var trigger = document.getElementById("user-trigger");
    var dropdown = document.getElementById("user-dropdown");

    function setMenu(open) {
        if (!trigger || !dropdown) return;
        dropdown.hidden = !open;
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
        trigger.classList.toggle("is-open", open);
    }

    function menuItems() {
        return dropdown ? Array.prototype.slice.call(dropdown.querySelectorAll('[role="menuitem"]')) : [];
    }

    if (trigger && dropdown) {
        trigger.addEventListener("click", function (ev) {
            ev.stopPropagation();
            setMenu(dropdown.hidden);
        });

        trigger.addEventListener("keydown", function (ev) {
            if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
            ev.preventDefault();
            setMenu(true);
            var items = menuItems();
            if (items.length) items[ev.key === "ArrowUp" ? items.length - 1 : 0].focus();
        });

        dropdown.addEventListener("keydown", function (ev) {
            var items = menuItems();
            var index = items.indexOf(document.activeElement);
            if (ev.key === "Escape") {
                ev.preventDefault();
                setMenu(false);
                trigger.focus();
            } else if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && items.length) {
                ev.preventDefault();
                var direction = ev.key === "ArrowDown" ? 1 : -1;
                items[(index + direction + items.length) % items.length].focus();
            } else if (ev.key === "Home" && items.length) {
                ev.preventDefault();
                items[0].focus();
            } else if (ev.key === "End" && items.length) {
                ev.preventDefault();
                items[items.length - 1].focus();
            }
        });

        document.addEventListener("click", function (ev) {
            if (!dropdown.hidden && !dropdown.contains(ev.target)) setMenu(false);
        });
    }

    document.addEventListener("keydown", function (ev) {
        if (ev.key !== "Escape") return;
        var restoreUser = dropdown && !dropdown.hidden;
        var restoreBell = bellPanel && !bellPanel.hidden;
        var restoreWorkspace = wsDropdown && !wsDropdown.hidden;
        setDrawer(false);
        setMenu(false);
        setBell(false);
        setWorkspace(false);
        if (restoreUser && trigger) trigger.focus();
        else if (restoreBell && bellTrigger) bellTrigger.focus();
        else if (restoreWorkspace && wsTrigger) wsTrigger.focus();
    });

    /* ------------------------------------------------------------------
       Workspace breadcrumb dropdown
       ------------------------------------------------------------------ */

    var wsTrigger = document.getElementById("workspace-trigger");
    var wsDropdown = document.getElementById("workspace-dropdown");

    function setWorkspace(open) {
        if (!wsTrigger || !wsDropdown) return;
        wsDropdown.hidden = !open;
        wsTrigger.setAttribute("aria-expanded", open ? "true" : "false");
        wsTrigger.classList.toggle("is-open", open);
    }

    if (wsTrigger && wsDropdown) {
        wsTrigger.addEventListener("click", function (ev) {
            ev.stopPropagation();
            setWorkspace(wsDropdown.hidden);
        });

        document.addEventListener("click", function (ev) {
            if (!wsDropdown.hidden && !wsDropdown.contains(ev.target) && ev.target !== wsTrigger) {
                setWorkspace(false);
            }
        });
    }

    /* ------------------------------------------------------------------
       Shared helpers
       ------------------------------------------------------------------ */

    function meta(name) {
        var tag = document.querySelector('meta[name="' + name + '"]');
        return tag ? tag.getAttribute("content") : "";
    }

    function esc(value) {
        var div = document.createElement("div");
        div.textContent = value == null ? "" : value;
        return div.innerHTML;
    }

    /* ------------------------------------------------------------------
       Notification bell
       ------------------------------------------------------------------ */

    var bellTrigger = document.getElementById("bell-trigger");
    var bellPanel = document.getElementById("bell-panel");
    var bellList = document.getElementById("bell-list");
    var bellCount = document.getElementById("bell-count");
    var bellSub = document.getElementById("bell-sub");
    var bellMarkRead = document.getElementById("bell-mark-read");

    function setBell(open) {
        if (!bellTrigger || !bellPanel) return;
        bellPanel.hidden = !open;
        bellTrigger.setAttribute("aria-expanded", open ? "true" : "false");
        bellTrigger.classList.toggle("is-open", open);
    }

    function renderAlerts(data) {
        if (!bellList) return;

        var items = data.items || [];
        var unread = data.unread || 0;

        if (bellCount) {
            bellCount.textContent = unread > 9 ? "9+" : String(unread);
            bellCount.hidden = unread === 0;
        }

        if (bellSub) {
            bellSub.textContent = items.length === 0
                ? "Everything looks in order"
                : items.length + (items.length === 1 ? " item needs a look" : " items need a look");
        }

        if (bellMarkRead) {
            bellMarkRead.hidden = unread === 0;
        }

        if (items.length === 0) {
            bellList.innerHTML = '<div class="bell-empty">Nothing needs your attention right now.</div>';
            return;
        }

        bellList.innerHTML = items.map(function (item) {
            return '<a class="bell-item" href="' + esc(item.url) + '">' +
                '<span class="bell-icon ' + esc(item.tone) + '"><i data-lucide="' + esc(item.icon) + '"></i></span>' +
                '<span class="bell-body">' +
                    '<span class="bell-title">' + esc(item.title) + "</span>" +
                    '<span class="bell-detail">' + esc(item.detail) + "</span>" +
                "</span></a>";
        }).join("");

        if (window.lucide) lucide.createIcons();
    }

    function loadAlerts() {
        if (!bellList) return;

        fetch(meta("alerts-url"), {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                if (data) renderAlerts(data);
                else if (bellSub) bellSub.textContent = "Could not load notifications";
            })
            .catch(function () {
                if (bellSub) bellSub.textContent = "Could not load notifications";
            });
    }

    function markAllRead() {
        var body = new FormData();
        var csrfName = meta("csrf-name");
        var csrfHash = meta("csrf-hash");
        if (csrfName && csrfHash) body.append(csrfName, csrfHash);

        fetch(meta("alerts-url") + "/mark-read", {
            method: "POST",
            body: body,
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                if (data && data.ok) {
                    if (bellCount) {
                        bellCount.textContent = "0";
                        bellCount.hidden = true;
                    }
                    if (bellMarkRead) bellMarkRead.hidden = true;
                }
            })
            .catch(function () { /* silent */ });
    }

    if (bellTrigger && bellPanel) {
        bellTrigger.addEventListener("click", function (ev) {
            ev.stopPropagation();
            setMenu(false);
            setBell(bellPanel.hidden);
        });

        document.addEventListener("click", function (ev) {
            if (!bellPanel.hidden && !bellPanel.contains(ev.target)) setBell(false);
        });

        if (bellMarkRead) {
            bellMarkRead.addEventListener("click", function (ev) {
                ev.stopPropagation();
                markAllRead();
            });
        }

        loadAlerts();
    }

    /* Keep row action menus mutually exclusive and dismissible. */
    var ROW_MENUS = ".g-menu";
    var OPEN_ROW_MENUS = ".g-menu[open]";

    document.addEventListener("click", function (ev) {
        var activeMenu = ev.target.closest(ROW_MENUS);
        document.querySelectorAll(OPEN_ROW_MENUS).forEach(function (menu) {
            if (menu !== activeMenu) menu.removeAttribute("open");
        });
    });

    document.addEventListener("keydown", function (ev) {
        if (ev.key !== "Escape") return;
        document.querySelectorAll(OPEN_ROW_MENUS).forEach(function (menu) {
            menu.removeAttribute("open");
            var summary = menu.querySelector("summary");
            if (summary) summary.focus();
        });
    });

    /* Dialog-safe confirmation links and simple page actions. */
    document.addEventListener("click", function (ev) {
        var confirmLink = ev.target.closest("[data-confirm]");
        if (confirmLink) {
            ev.preventDefault();
            NexamModal.confirm(
                confirmLink.dataset.confirmTitle || "Are you sure?",
                confirmLink.dataset.confirmMessage || "This action cannot be undone.",
                confirmLink.dataset.confirmType || "warning",
                function () {
                    var formId = confirmLink.dataset.confirmForm;
                    if (formId) {
                        var form = document.getElementById(formId);
                        if (form) form.submit();
                    } else if (confirmLink.closest("form")) {
                        confirmLink.closest("form").submit();
                    } else if (confirmLink.href) {
                        window.location.href = confirmLink.href;
                    }
                }
            );
            return;
        }

        if (ev.target.closest("[data-print-page]")) window.print();
    });

    /* Warn when a long authoring form is abandoned after being changed. */
    document.querySelectorAll("form[data-dirty-guard]").forEach(function (form) {
        var dirty = false;
        form.addEventListener("input", function () { dirty = true; });
        form.addEventListener("change", function () { dirty = true; });
        form.addEventListener("submit", function () { dirty = false; });
        window.addEventListener("beforeunload", function (ev) {
            if (!dirty) return;
            ev.preventDefault();
            ev.returnValue = "";
        });
    });

    var formAlert = document.querySelector(".form-alert[role='alert']");
    if (formAlert) {
        formAlert.setAttribute("tabindex", "-1");
        requestAnimationFrame(function () { formAlert.focus(); });
    }

    /* ------------------------------------------------------------------
       Account dialogs
       ------------------------------------------------------------------ */

    /** CSRF regenerates per request, so the token is re-read on every submit. */
    function csrfField(form) {
        var name = meta("csrf-name");
        if (name) form.append(name, meta("csrf-hash"));
    }

    function storeCsrf(payload) {
        if (!payload || !payload.csrf_hash) return;
        var tag = document.querySelector('meta[name="csrf-hash"]');
        if (tag) tag.setAttribute("content", payload.csrf_hash);
    }

    /** A password input paired with a show/hide button. */
    function passwordField(id, label, hint) {
        var autocomplete = id === "current_password" ? "current-password" : "new-password";
        return '<div class="form-group">' +
                '<label class="form-label" for="' + id + '">' + label + "</label>" +
                '<div class="field-reveal">' +
                    '<input type="password" id="' + id + '" class="form-control" autocomplete="' + autocomplete + '" maxlength="128">' +
                    '<button type="button" data-reveal="' + id + '" aria-label="Show password">' +
                        '<i data-lucide="eye"></i>' +
                    "</button>" +
                "</div>" +
                (hint ? '<div class="form-hint">' + hint + "</div>" : "") +
            "</div>";
    }

    function wireReveals(modal) {
        modal.querySelectorAll("[data-reveal]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var input = modal.querySelector("#" + btn.dataset.reveal);
                if (!input) return;

                var show = input.type === "password";
                input.type = show ? "text" : "password";
                btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
                btn.innerHTML = '<i data-lucide="' + (show ? "eye-off" : "eye") + '"></i>';
                if (window.lucide) lucide.createIcons();
                input.focus();
            });
        });
    }

    /**
     * Post a dialog's fields and keep it open on failure so the user can
     * correct the input without retyping everything.
     */
    /**
     * POST a form body and always resolve to { ok, payload }. A CSRF rejection
     * is served as an HTML error page rather than JSON, so parse defensively
     * and explain what actually happened.
     */
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
                    payload = {
                        message: "Your session has expired. Please refresh the page and try again."
                    };
                }
                storeCsrf(payload);
                return { ok: res.ok, payload: payload };
            });
        });
    }

    function submitDialog(url, fields, modal, saveBtn, onSuccess) {
        var body = new FormData();
        Object.keys(fields).forEach(function (key) { body.append(key, fields[key]); });
        csrfField(body);

        saveBtn.disabled = true;
        var originalLabel = saveBtn.textContent;
        saveBtn.textContent = "Saving…";

        postJson(url, body)
            .then(function (result) {
                if (!result.ok) {
                    NexamToast.error(result.payload.message || "Something went wrong.");
                    return;
                }

                NexamModal.close(modal);
                NexamToast.success(result.payload.message || "Saved.");
                if (onSuccess) onSuccess(result.payload);
            })
            .catch(function () {
                NexamToast.error("Could not reach the server. Please try again.");
            })
            .then(function () {
                saveBtn.disabled = false;
                saveBtn.textContent = originalLabel;
            });
    }

    /** Initials to show while no photo is set. */
    function initialsOf(me) {
        return ((me.first_name || "").charAt(0) + (me.last_name || "").charAt(0)).toUpperCase();
    }

    /** Swap every avatar in the shell between a photo and initials. */
    function applyAvatar(url) {
        ["user-avatar", "user-avatar-lg"].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;

            if (url) {
                el.classList.add("has-photo");
                el.innerHTML = '<img src="' + esc(url) + '" alt="">';
            } else {
                el.classList.remove("has-photo");
                el.textContent = el.dataset.initials || "";
            }
        });
    }

    /**
     * Photo upload lands immediately rather than waiting for Save: it is a
     * file transfer, not a text edit, and the preview should reflect what is
     * actually stored.
     */
    function wirePhotoPicker(modal, me) {
        var input = modal.querySelector("#photo_input");
        var preview = modal.querySelector("#photo_preview");
        var chooseBtn = modal.querySelector("#photo_choose");
        var removeBtn = modal.querySelector("#photo_remove");

        function showPhoto(url) {
            if (url) {
                preview.innerHTML = '<img src="' + esc(url) + '" alt="">';
                removeBtn.hidden = false;
            } else {
                preview.textContent = initialsOf(me);
                removeBtn.hidden = true;
            }
            applyAvatar(url);
            if (window.lucide) lucide.createIcons();
        }

        chooseBtn.addEventListener("click", function () { input.click(); });

        input.addEventListener("change", function () {
            var file = input.files && input.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                NexamToast.warning("Images must be 2 MB or smaller.");
                input.value = "";
                return;
            }

            var body = new FormData();
            body.append("photo", file);
            csrfField(body);

            chooseBtn.disabled = true;

            postJson(meta("account-avatar-url"), body)
                .then(function (result) {
                    if (!result.ok) {
                        NexamToast.error(result.payload.message || "Could not upload that image.");
                        return;
                    }
                    showPhoto(result.payload.avatar);
                    NexamToast.success(result.payload.message || "Photo updated.");
                })
                .catch(function () {
                    NexamToast.error("Could not reach the server. Please try again.");
                })
                .then(function () {
                    chooseBtn.disabled = false;
                    input.value = "";
                });
        });

        removeBtn.addEventListener("click", function () {
            var body = new FormData();
            csrfField(body);
            removeBtn.disabled = true;

            postJson(meta("account-avatar-remove-url"), body)
                .then(function (result) {
                    if (!result.ok) {
                        NexamToast.error(result.payload.message || "Could not remove the photo.");
                        return;
                    }
                    showPhoto("");
                    NexamToast.success(result.payload.message || "Photo removed.");
                })
                .catch(function () {
                    NexamToast.error("Could not reach the server. Please try again.");
                })
                .then(function () { removeBtn.disabled = false; });
        });
    }

    function openProfileDialog(me) {
        var modal = NexamModal.open({
            title: "Change Profile",
            subtitle: "Update how your name appears across nexam",
            type: "info",
            buttons: [
                { text: "Cancel", style: "cancel", dismiss: true },
                { text: "Save Changes", style: "primary", icon: "check", dismiss: false }
            ],
            body:
                '<div class="photo-picker">' +
                    '<span class="photo-preview" id="photo_preview">' +
                        (me.avatar ? '<img src="' + esc(me.avatar) + '" alt="">' : esc(initialsOf(me))) +
                    "</span>" +
                    '<span class="photo-actions">' +
                        '<span class="photo-buttons">' +
                            '<button type="button" class="btn btn-outline btn-sm" id="photo_choose">' +
                                '<i data-lucide="upload"></i> Upload photo</button>' +
                            '<button type="button" class="btn btn-ghost btn-sm" id="photo_remove"' +
                                (me.avatar ? "" : " hidden") + '><i data-lucide="trash-2"></i> Remove</button>' +
                        "</span>" +
                        '<span class="photo-note">JPG, PNG, GIF or WebP — up to 2 MB.</span>' +
                    "</span>" +
                    '<input type="file" id="photo_input" accept="image/jpeg,image/png,image/gif,image/webp" hidden>' +
                "</div>" +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="account_first_name">First name <span class="req">*</span></label>' +
                        '<input type="text" id="account_first_name" class="form-control" maxlength="100" ' +
                            'value="' + esc(me.first_name) + '" autocomplete="given-name">' +
                    "</div>" +
                    '<div class="form-group">' +
                        '<label class="form-label" for="account_middle_name">Middle name</label>' +
                        '<input type="text" id="account_middle_name" class="form-control" maxlength="100" ' +
                            'value="' + esc(me.middle_name) + '" autocomplete="additional-name">' +
                    "</div>" +
                "</div>" +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="account_last_name">Last name <span class="req">*</span></label>' +
                        '<input type="text" id="account_last_name" class="form-control" maxlength="100" ' +
                            'value="' + esc(me.last_name) + '" autocomplete="family-name">' +
                    "</div>" +
                    '<div class="form-group form-group-narrow">' +
                        '<label class="form-label" for="account_name_ext">Extension</label>' +
                        '<input type="text" id="account_name_ext" class="form-control" maxlength="20" ' +
                            'value="' + esc(me.name_ext) + '" placeholder="Jr." autocomplete="honorific-suffix">' +
                    "</div>" +
                "</div>" +
                '<div class="form-group mb-0">' +
                    '<label class="form-label" for="account_email">Email</label>' +
                    '<input type="email" id="account_email" class="form-control" ' +
                        'value="' + esc(me.email) + '" disabled>' +
                    '<div class="form-hint">Your email is tied to sign-in and verification, so it cannot be changed here.</div>' +
                "</div>"
        });

        var saveBtn = modal.querySelector('[data-btn-index="1"]');
        var first = modal.querySelector("#account_first_name");
        var middle = modal.querySelector("#account_middle_name");
        var last = modal.querySelector("#account_last_name");
        var ext = modal.querySelector("#account_name_ext");
        first.focus();

        wirePhotoPicker(modal, me);

        saveBtn.addEventListener("click", function () {
            if (first.value.trim() === "") {
                NexamToast.warning("Please enter your first name.");
                first.focus();
                return;
            }

            if (last.value.trim() === "") {
                NexamToast.warning("Please enter your last name.");
                last.focus();
                return;
            }

            submitDialog(meta("account-profile-url"), {
                first_name: first.value.trim(),
                middle_name: middle.value.trim(),
                last_name: last.value.trim(),
                name_ext: ext.value.trim()
            }, modal, saveBtn, function (payload) {
                var nameEl = document.getElementById("user-display-name");
                if (nameEl) nameEl.textContent = payload.full_name;

                ["user-avatar", "user-avatar-lg"].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.textContent = payload.initials;
                });
            });
        });
    }

    /** Fetch the current name parts, then open the dialog seeded with them. */
    function loadProfileDialog() {
        fetch(meta("account-me-url"), {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" }
        })
            .then(function (res) {
                return res.json().then(function (payload) {
                    return { ok: res.ok, payload: payload };
                });
            })
            .then(function (result) {
                storeCsrf(result.payload);

                // Opening an empty dialog would silently discard the real name
                // on save, so surface the failure instead.
                if (!result.ok) {
                    NexamToast.error(result.payload.message || "Could not load your profile.");
                    return;
                }

                var me = result.payload;
                openProfileDialog({
                    first_name: me.first_name || "",
                    middle_name: me.middle_name || "",
                    last_name: me.last_name || "",
                    name_ext: me.name_ext || "",
                    email: me.email || "",
                    avatar: me.avatar || ""
                });
            })
            .catch(function () {
                NexamToast.error("Could not load your profile. Please try again.");
            });
    }

    function openPasswordDialog() {
        var modal = NexamModal.open({
            title: "Change Password",
            subtitle: "Confirm your current password to set a new one",
            type: "warning",
            buttons: [
                { text: "Cancel", style: "cancel", dismiss: true },
                { text: "Update Password", style: "primary", icon: "check", dismiss: false }
            ],
            body:
                passwordField("account_current_password", "Current password", "") +
                passwordField("account_new_password", "New password", "At least 8 characters.") +
                passwordField("account_confirm_password", "Confirm new password", "")
        });

        wireReveals(modal);

        var saveBtn = modal.querySelector('[data-btn-index="1"]');
        var current = modal.querySelector("#account_current_password");
        var next = modal.querySelector("#account_new_password");
        var confirm = modal.querySelector("#account_confirm_password");
        current.setAttribute("autocomplete", "current-password");
        current.focus();

        saveBtn.addEventListener("click", function () {
            if (!current.value || !next.value || !confirm.value) {
                NexamToast.warning("Please fill in all three fields.");
                return;
            }

            if (next.value.length < 8) {
                NexamToast.warning("Your new password must be at least 8 characters.");
                next.focus();
                return;
            }

            if (next.value !== confirm.value) {
                NexamToast.warning("The new passwords do not match.");
                confirm.focus();
                return;
            }

            submitDialog(meta("account-password-url"), {
                current_password: current.value,
                new_password: next.value,
                confirm_password: confirm.value
            }, modal, saveBtn);
        });
    }

    document.querySelectorAll("[data-account-action]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            setMenu(false);
            if (btn.dataset.accountAction === "profile") loadProfileDialog();
            else openPasswordDialog();
        });
    });

    document.addEventListener("DOMContentLoaded", function () {
        if (window.lucide) lucide.createIcons();
        var flash = document.getElementById("nexam-flash-toast");
        if (flash && window.NexamToast) {
            NexamToast.show("", flash.dataset.message || "", flash.dataset.type || "info", 5000);
        }
    });
})();
