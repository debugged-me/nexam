/* ==========================================================================
   datatables.js — the nexam data grid controller
   --------------------------------------------------------------------------
   DataTables runs headless (dom: 't'). It owns sorting, paging and filtering;
   every visible control is rendered here so the chrome matches the rest of the
   app instead of the library's Bootstrap defaults.

   Per grid it wires up:
     - external search box + "/" shortcut
     - facet <select> filters bound to columns
     - row selection (click, shift-range, select-all-on-page) + bulk delete
     - a view menu: density, column visibility, CSV export
     - a footer with range, page size and pagination
     - density / columns / page size persisted per table in localStorage

   Note on the Responsive extension: it is deliberately not used. It measures
   columns by cloning the table into a 1px box, which cannot produce sane
   numbers against `table-layout: fixed` — the result was every data column
   being dropped at 1440px. Columns are sized deterministically in CSS, the
   grid scrolls sideways on narrow screens, and the user decides what to hide
   through the View menu.
   ========================================================================== */
(function () {
    "use strict";

    var STORE_PREFIX = "nexam.grid.";

    /* ---------------------------------------------------------------- utils */

    function readPrefs(key) {
        try { return JSON.parse(localStorage.getItem(STORE_PREFIX + key)) || {}; }
        catch (e) { return {}; }
    }

    function writePrefs(key, prefs) {
        try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(prefs)); }
        catch (e) { /* private mode — preferences are a convenience, not state */ }
    }

    function icons() {
        if (window.lucide) lucide.createIcons();
    }

    function el(tag, className, html) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (html !== undefined) node.innerHTML = html;
        return node;
    }

    /** Escape text inserted into chip labels (search terms come from user input). */
    var escaper = document.createElement("div");
    function escapeText(str) {
        escaper.textContent = str == null ? "" : String(str);
        return escaper.innerHTML;
    }

    /** Visible text of a cell's HTML — screen-reader and icon markup stripped. */
    var scratch = document.createElement("div");
    function cellText(html) {
        scratch.innerHTML = html == null ? "" : String(html);
        scratch.querySelectorAll(".sr-only, svg, .g-menu").forEach(function (n) { n.remove(); });
        return (scratch.textContent || "").replace(/\s+/g, " ").trim();
    }

    /** Quote for CSV, and neutralise leading characters spreadsheets execute. */
    function csvCell(value) {
        var safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
        return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
    }

    /* ------------------------------------------------------------- one grid */

    function Grid(node) {
        this.node = node;
        this.$node = $(node);
        this.dataset = node.closest("[data-dataset]");
        this.key = node.getAttribute("data-grid") || node.id || "grid";
        this.label = node.getAttribute("data-grid-label") || "records";
        this.prefs = readPrefs(this.key);
        this.selected = new Set();
        this.lastIndex = null;
        this.init();
    }

    /** Initialize or re-initialize the DataTables instance. */
    Grid.prototype.initTable = function () {
        var self = this;
        var headers = Array.prototype.slice.call(this.node.querySelectorAll("thead th"));

        var columns = headers.map(function (th) {
            var def = {};
            if (th.classList.contains("col-select") ||
                th.classList.contains("col-actions")) {
                def.orderable = false;
                def.searchable = false;
            }
            return def;
        });

        var pageLength = parseInt(this.prefs.pageLength, 10);
        if ([10, 25, 50, 100].indexOf(pageLength) === -1) pageLength = 25;

        var sortCol = -1;
        headers.forEach(function (th, i) {
            var name = (th.getAttribute("data-name") || "").toLowerCase();
            if (name === "created" || name === "updated") sortCol = i;
        });
        var order = sortCol >= 0 ? [[sortCol, "desc"]] : [];

        this.api = this.$node.DataTable({
            dom: "t",
            columns: columns,
            paging: true,
            pageLength: pageLength,
            order: order,
            autoWidth: false,
            deferRender: true,
            language: {
                zeroRecords: '<span class="ds-noresults-title">No matching ' + this.label + "</span>" +
                    '<span class="ds-noresults-sub">Try a different search, or ' +
                    '<button type="button" data-grid-reset>clear the filters</button>.</span>'
            },
            drawCallback: function () { self.afterDraw(); }
        });
    };

    Grid.prototype.init = function () {
        var self = this;

        this.initTable();

        this.applyColumnPrefs();
        this.applyDensity(this.prefs.density === "compact" ? "compact" : "comfortable");

        this.buildFooter();
        this.buildViewMenu();
        this.buildFilterBar();
        this.wireSearch();
        this.wireFilters();
        this.wireSelection();
        this.wireSelectToggle();
        this.wireMenus();

        this.afterDraw();
    };

    /* ------------------------------------------------------------ chrome */

    Grid.prototype.query = function (selector) {
        return this.dataset ? this.dataset.querySelector(selector) : null;
    };

    /** Sort arrows and checkbox state — refreshed on every draw. */
    Grid.prototype.afterDraw = function () {
        var self = this;

        this.node.querySelectorAll("thead th").forEach(function (th) {
            var sortable = th.classList.contains("sorting") ||
                th.classList.contains("sorting_asc") ||
                th.classList.contains("sorting_desc");

            var arrow = th.querySelector(".ds-sort");
            if (!sortable) { if (arrow) arrow.remove(); return; }

            if (!arrow) {
                arrow = el("span", "ds-sort");
                arrow.setAttribute("aria-hidden", "true");
                th.appendChild(arrow);
            }
            var name = th.classList.contains("sorting_asc") ? "arrow-up"
                : th.classList.contains("sorting_desc") ? "arrow-down"
                    : "arrow-down-up";
            arrow.innerHTML = '<i data-lucide="' + name + '"></i>';
        });

        this.node.querySelectorAll("tbody tr[data-id]").forEach(function (row) {
            var checked = self.selected.has(row.getAttribute("data-id"));
            var box = row.querySelector("[data-row-check]");
            if (box) box.checked = checked;
            row.classList.toggle("is-selected", checked);
        });

        this.syncHeaderCheckbox();
        this.renderFooter();
        this.renderFilterBar();
        icons();
    };

    /* -------------------------------------------------------------- footer */

    Grid.prototype.buildFooter = function () {
        var self = this;
        this.foot = this.query("[data-grid-foot]");
        if (!this.foot) return;

        this.foot.innerHTML = "";

        var range = el("div", "ds-range");
        this.rangeText = el("span");
        range.appendChild(this.rangeText);

        var perPage = el("label", "ds-perpage");
        perPage.innerHTML = "<span>Rows</span>";
        this.perPageSelect = el("select");
        this.perPageSelect.setAttribute("aria-label", "Rows per page");
        [10, 25, 50, 100].forEach(function (n) {
            var opt = el("option", null, String(n));
            opt.value = String(n);
            if (n === self.api.page.len()) opt.selected = true;
            self.perPageSelect.appendChild(opt);
        });
        this.perPageSelect.addEventListener("change", function () {
            var len = parseInt(self.perPageSelect.value, 10);
            self.prefs.pageLength = len;
            writePrefs(self.key, self.prefs);
            self.api.page.len(len).draw(false);
        });
        perPage.appendChild(this.perPageSelect);
        range.appendChild(perPage);

        this.pager = el("div", "ds-pager");
        this.pager.setAttribute("role", "navigation");
        this.pager.setAttribute("aria-label", "Pagination");

        this.foot.appendChild(range);
        this.foot.appendChild(this.pager);
    };

    Grid.prototype.renderFooter = function () {
        if (!this.foot) return;

        var self = this;
        var info = this.api.page.info();

        var from = info.recordsDisplay === 0 ? 0 : info.start + 1;
        this.rangeText.innerHTML = info.recordsDisplay === 0
            ? "No " + this.label
            : "<b>" + from + "–" + info.end + "</b> of <b>" + info.recordsDisplay + "</b>" +
              (info.recordsDisplay < info.recordsTotal
                  ? ' <span class="g-mute">(filtered from ' + info.recordsTotal + ")</span>"
                  : "");

        this.pager.innerHTML = "";
        if (info.pages <= 1) { this.foot.hidden = info.recordsDisplay === 0 && info.recordsTotal === 0; return; }
        this.foot.hidden = false;

        function pageBtn(label, page, opts) {
            opts = opts || {};
            var btn = el("button", "ds-page", label);
            btn.type = "button";
            if (opts.disabled) btn.disabled = true;
            if (opts.current) btn.setAttribute("aria-current", "page");
            if (opts.aria) btn.setAttribute("aria-label", opts.aria);
            if (!opts.disabled && !opts.current) {
                btn.addEventListener("click", function () { self.api.page(page).draw(false); });
            }
            return btn;
        }

        this.pager.appendChild(pageBtn('<i data-lucide="chevrons-left"></i>', 0, {
            disabled: info.page === 0, aria: "First page"
        }));
        this.pager.appendChild(pageBtn('<i data-lucide="chevron-left"></i>', info.page - 1, {
            disabled: info.page === 0, aria: "Previous page"
        }));

        // A window of pages around the current one, with first/last anchors.
        var pages = [];
        var span = 1;
        for (var i = 0; i < info.pages; i++) {
            if (i === 0 || i === info.pages - 1 || Math.abs(i - info.page) <= span) pages.push(i);
        }

        var previous = null;
        pages.forEach(function (p) {
            if (previous !== null && p - previous > 1) self.pager.appendChild(el("span", "ds-gap", "…"));
            self.pager.appendChild(pageBtn(String(p + 1), p, {
                current: p === info.page, aria: "Page " + (p + 1)
            }));
            previous = p;
        });

        this.pager.appendChild(pageBtn('<i data-lucide="chevron-right"></i>', info.page + 1, {
            disabled: info.page >= info.pages - 1, aria: "Next page"
        }));
        this.pager.appendChild(pageBtn('<i data-lucide="chevrons-right"></i>', info.pages - 1, {
            disabled: info.page >= info.pages - 1, aria: "Last page"
        }));
    };

    /* -------------------------------------------------------------- search */

    Grid.prototype.wireSearch = function () {
        var self = this;
        this.search = this.query("[data-grid-search]");
        if (!this.search) return;

        var timer = null;
        this.search.addEventListener("input", function () {
            clearTimeout(timer);
            timer = setTimeout(function () { self.api.search(self.search.value).draw(); }, 120);
        });

        this.search.addEventListener("keydown", function (ev) {
            if (ev.key !== "Escape" || self.search.value === "") return;
            ev.stopPropagation();
            self.clearFilters();
        });
    };

    Grid.prototype.clearFilters = function () {
        if (this.search) this.search.value = "";
        this.api.search("");
        (this.filters || []).forEach(function (f) { f.selected = null; });
        this.api.columns().search("").draw();
    };

    /* -------------------------------------------------------------- filters */

    /** Read the facet config from the JSON script block and build the filter
     *  state model. Each filter tracks its column, options, and the currently
     *  selected value (null = no filter). */
    Grid.prototype.wireFilters = function () {
        var self = this;
        this.filters = [];

        if (!this.dataset) return;
        var script = this.dataset.querySelector("[data-grid-facets]");
        if (!script) return;

        var config;
        try { config = JSON.parse(script.textContent); }
        catch (e) { return; }
        if (!Array.isArray(config)) return;

        config.forEach(function (facet) {
            var options = [];
            Object.keys(facet.options || {}).forEach(function (value) {
                options.push({ value: value, label: facet.options[value] });
            });
            var selected = facet.selected || null;
            self.filters.push({
                name: facet.name || "Filter",
                column: parseInt(facet.column, 10),
                options: options,
                selected: selected
            });
        });

        // Apply any server-side pre-selected filters to DataTables.
        this.filters.forEach(function (f) {
            if (f.selected) {
                self.api.column(f.column).search("^" + f.selected + "$", true, false);
            }
        });

        this.filterBtn = this.dataset.querySelector("[data-grid-filter-trigger]");
        this.filterBadge = this.dataset.querySelector("[data-grid-filter-count]");
        if (this.filterBtn) {
            this.filterBtn.addEventListener("click", function () { self.openFilterModal(); });
        }
        this.updateFilterButton();
    };

    /** Count active filters and reflect it on the toolbar button. */
    Grid.prototype.updateFilterButton = function () {
        if (!this.filterBtn) return;
        var count = (this.filters || []).filter(function (f) { return f.selected; }).length;
        this.filterBtn.setAttribute("data-active", count > 0 ? "true" : "false");
        if (this.filterBadge) {
            this.filterBadge.textContent = String(count);
            this.filterBadge.hidden = count === 0;
        }
    };

    /** Open a modal with all filter options as toggle pills. Selections are
     *  staged locally; "Apply" commits them to DataTables. */
    Grid.prototype.openFilterModal = function () {
        var self = this;
        if (!this.filters || !this.filters.length) return;

        // Stage a copy of the current selections so Cancel leaves state intact.
        var staged = this.filters.map(function (f) { return f.selected; });

        var bodyHtml = "";
        this.filters.forEach(function (f, fi) {
            bodyHtml += '<div class="ds-filter-section">';
            bodyHtml += '<div class="ds-filter-section-label">' + escapeText(f.name) + "</div>";
            bodyHtml += '<div class="ds-filter-options">';
            f.options.forEach(function (opt) {
                var pressed = staged[fi] === opt.value;
                bodyHtml += '<button type="button" class="ds-filter-option" ' +
                    'data-facet="' + fi + '" data-value="' + escapeText(opt.value) + '" ' +
                    'aria-pressed="' + pressed + '">' + escapeText(opt.label) + "</button>";
            });
            bodyHtml += "</div></div>";
        });

        var overlay = NexamModal.open({
            title: "Filter " + this.label,
            subtitle: "Narrow the " + this.label + " shown in the table.",
            body: bodyHtml,
            type: "info",
            showClose: true,
            buttons: [
                {
                    text: "Clear all",
                    style: "cancel",
                    dismiss: false,
                    onClick: function () {
                        // Reset staged selections and update pill states in-place.
                        staged = self.filters.map(function () { return null; });
                        overlay.querySelectorAll(".ds-filter-option").forEach(function (btn) {
                            btn.setAttribute("aria-pressed", "false");
                        });
                    }
                },
                {
                    text: "Apply",
                    style: "primary",
                    icon: "check",
                    dismiss: true,
                    onClick: function () {
                        // Commit staged selections to the filter state + DataTables.
                        self.filters.forEach(function (f, fi) { f.selected = staged[fi]; });
                        self.applyFilters();
                    }
                }
            ]
        });

        // Wire pill toggles — single-select per facet.
        var modal = overlay.querySelector(".nexam-modal");
        modal.querySelectorAll(".ds-filter-option").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var fi = parseInt(btn.getAttribute("data-facet"), 10);
                var val = btn.getAttribute("data-value");
                // Toggle: clicking the active pill deselects it.
                if (staged[fi] === val) {
                    staged[fi] = null;
                    btn.setAttribute("aria-pressed", "false");
                } else {
                    staged[fi] = val;
                    // Deselect sibling pills in the same facet.
                    modal.querySelectorAll('.ds-filter-option[data-facet="' + fi + '"]').forEach(function (sib) {
                        sib.setAttribute("aria-pressed", "false");
                    });
                    btn.setAttribute("aria-pressed", "true");
                }
            });
        });
    };

    /** Push all filter selections into DataTables column search and redraw. */
    Grid.prototype.applyFilters = function () {
        var self = this;
        this.filters.forEach(function (f) {
            if (f.selected) {
                self.api.column(f.column).search("^" + f.selected + "$", true, false);
            } else {
                self.api.column(f.column).search("");
            }
        });
        this.api.draw();
        this.updateFilterButton();
    };

    /* ----------------------------------------------------------- filter bar */

    /** Build the empty chip container that sits between the toolbar and the
     *  grid. Hidden until a facet or search is active. */
    Grid.prototype.buildFilterBar = function () {
        if (!this.dataset) return;
        var bar = el("div", "ds-filter-bar");
        bar.hidden = true;
        bar.setAttribute("aria-live", "polite");
        // Insert between the toolbar/selection bar and the scroll container.
        var scroll = this.dataset.querySelector(".dataset-scroll");
        if (scroll) this.dataset.insertBefore(bar, scroll);
        this.filterBar = bar;
    };

    /** Read the current filter + search state and render a chip per active
     *  filter, plus a "Clear all" button. */
    Grid.prototype.renderFilterBar = function () {
        if (!this.filterBar) return;

        var self = this;
        var chips = [];
        var hasSearch = this.search && this.search.value.trim() !== "";
        var filterActive = (this.filters || []).some(function (f) { return f.selected; });

        if (!hasSearch && !filterActive) {
            this.filterBar.hidden = true;
            this.filterBar.innerHTML = "";
            return;
        }

        if (hasSearch) {
            chips.push(this.filterChip('Search', '"' + this.search.value.trim() + '"', function () {
                self.search.value = "";
                self.api.search("").draw();
            }));
        }

        (this.filters || []).forEach(function (f) {
            if (!f.selected) return;
            var opt = f.options.find(function (o) { return o.value === f.selected; });
            var label = opt ? opt.label : f.selected;
            chips.push(self.filterChip(f.name, label, function () {
                f.selected = null;
                self.applyFilters();
            }));
        });

        this.filterBar.innerHTML = "";
        this.filterBar.appendChild(el("span", "ds-filter-bar-label", "Filters:"));
        chips.forEach(function (c) { self.filterBar.appendChild(c); });

        var clearAll = el("button", "ds-filter-clear",
            '<i data-lucide="x"></i><span>Clear all</span>');
        clearAll.type = "button";
        clearAll.addEventListener("click", function () { self.clearFilters(); });
        this.filterBar.appendChild(clearAll);

        this.filterBar.hidden = false;
        icons();
    };

    Grid.prototype.filterChip = function (name, value, onClear) {
        var chip = el("span", "ds-filter-chip");
        chip.innerHTML = "<b>" + escapeText(name) + "</b> " + escapeText(value);
        var btn = el("button", null, '<i data-lucide="x"></i>');
        btn.type = "button";
        btn.setAttribute("aria-label", "Remove " + name + " filter");
        btn.addEventListener("click", onClear);
        chip.appendChild(btn);
        return chip;
    };

    /* ----------------------------------------------------------- selection */

    /** Toggle the checkbox column on/off via the "Select" toolbar button. */
    Grid.prototype.wireSelectToggle = function () {
        var self = this;
        this.selectToggle = this.query("[data-grid-select-toggle]");
        if (!this.selectToggle) return;

        this.selectToggle.addEventListener("click", function () {
            var on = self.selectToggle.getAttribute("aria-pressed") === "true";
            if (on) {
                self.removeSelectColumn();
            } else {
                self.addSelectColumn();
            }
        });
    };

    /** Insert a checkbox column into the table header + every body row. */
    Grid.prototype.addSelectColumn = function () {
        var self = this;
        this.selectToggle.setAttribute("aria-pressed", "true");
        this.dataset.setAttribute("data-selecting", "true");

        // Header
        var thead = this.node.querySelector("thead tr");
        if (thead && !thead.querySelector("[data-check-all]")) {
            var th = document.createElement("th");
            th.className = "col-select wp-4";
            th.innerHTML = '<label class="ds-check"><input type="checkbox" data-check-all><span aria-hidden="true"></span><span class="sr-only">Select all</span></label>';
            thead.insertBefore(th, thead.firstChild);
        }

        // Body rows
        this.node.querySelectorAll("tbody tr[data-id]").forEach(function (row) {
            if (row.querySelector("[data-row-check]")) return;
            var td = document.createElement("td");
            td.className = "col-select";
            td.innerHTML = '<label class="ds-check"><input type="checkbox" data-row-check><span aria-hidden="true"></span></label>';
            row.insertBefore(td, row.firstChild);
        });

        // Re-init selection wiring for the new checkboxes
        this.headerCheck = this.node.querySelector("[data-check-all]");
        this.wireSelection();

        // Tell DataTables about the new column
        if (this.api) {
            this.api.destroy();
            this.initTable();
            this.afterDraw();
        }

        if (window.lucide) lucide.createIcons();
    };

    /** Remove the checkbox column and clear selections. */
    Grid.prototype.removeSelectColumn = function () {
        var self = this;
        this.selectToggle.setAttribute("aria-pressed", "false");
        this.selected.clear();
        this.dataset.setAttribute("data-selecting", "false");

        // Remove header
        var th = this.node.querySelector("thead th.col-select");
        if (th) th.remove();

        // Remove body cells
        this.node.querySelectorAll("tbody tr td.col-select").forEach(function (td) { td.remove(); });

        // Hide selection bar
        if (this.selectBar) this.selectBar.hidden = true;

        // Re-init DataTables without the column
        if (this.api) {
            this.api.destroy();
            this.initTable();
            this.afterDraw();
        }
    };

    Grid.prototype.wireSelection = function () {
        var self = this;
        this.headerCheck = this.node.querySelector("[data-check-all]");
        this.selectBar = this.query("[data-grid-selection]");
        if (!this.headerCheck && !this.selectBar) return;

        this.node.addEventListener("click", function (ev) {
            var box = ev.target.closest("[data-row-check]");
            if (!box) return;
            var row = box.closest("tr[data-id]");
            if (!row) return;

            var rows = self.pageRowIds();
            var index = rows.indexOf(row.getAttribute("data-id"));

            if (ev.shiftKey && self.lastIndex !== null && index > -1) {
                var lo = Math.min(self.lastIndex, index);
                var hi = Math.max(self.lastIndex, index);
                for (var i = lo; i <= hi; i++) {
                    if (box.checked) self.selected.add(rows[i]); else self.selected.delete(rows[i]);
                }
            } else {
                if (box.checked) self.selected.add(row.getAttribute("data-id"));
                else self.selected.delete(row.getAttribute("data-id"));
            }

            self.lastIndex = index;
            self.syncSelection();
        });

        if (this.headerCheck) {
            this.headerCheck.addEventListener("change", function () {
                var rows = self.pageRowIds();
                rows.forEach(function (id) {
                    if (self.headerCheck.checked) self.selected.add(id); else self.selected.delete(id);
                });
                self.lastIndex = null;
                self.syncSelection();
            });
        }

        if (this.selectBar) {
            var clear = this.selectBar.querySelector("[data-selection-clear]");
            if (clear) {
                clear.addEventListener("click", function () {
                    self.selected.clear();
                    self.lastIndex = null;
                    self.syncSelection();
                });
            }

            var form = this.selectBar.querySelector("[data-selection-form]");
            var trigger = this.selectBar.querySelector("[data-selection-delete]");
            if (form && trigger) {
                trigger.addEventListener("click", function () {
                    var count = self.selected.size;
                    if (!count) return;
                    var noun = count === 1 ? self.label.replace(/s$/, "") : self.label;
                    NexamModal.deleteConfirm(
                        "Delete " + count + " " + noun + "?",
                        "This permanently removes " + (count === 1 ? "the selected record" : "all " + count + " selected records") +
                        " and everything attached to " + (count === 1 ? "it" : "them") + ". This cannot be undone.",
                        function () {
                            form.querySelectorAll("input[name='ids[]']").forEach(function (n) { n.remove(); });
                            self.selected.forEach(function (id) {
                                var input = document.createElement("input");
                                input.type = "hidden";
                                input.name = "ids[]";
                                input.value = id;
                                form.appendChild(input);
                            });
                            form.submit();
                        }
                    );
                });
            }
        }
    };

    /** Ids of the rows currently rendered on this page, in visual order. */
    Grid.prototype.pageRowIds = function () {
        return Array.prototype.map.call(
            this.node.querySelectorAll("tbody tr[data-id]"),
            function (row) { return row.getAttribute("data-id"); }
        );
    };

    Grid.prototype.syncSelection = function () {
        var self = this;
        this.node.querySelectorAll("tbody tr[data-id]").forEach(function (row) {
            var on = self.selected.has(row.getAttribute("data-id"));
            row.classList.toggle("is-selected", on);
            var box = row.querySelector("[data-row-check]");
            if (box) box.checked = on;
        });

        this.syncHeaderCheckbox();

        var count = this.selected.size;
        if (this.dataset) this.dataset.setAttribute("data-selecting", count > 0 ? "true" : "false");
        if (this.selectBar) {
            this.selectBar.hidden = count === 0;
            var label = this.selectBar.querySelector("[data-selection-count]");
            if (label) {
                label.textContent = count + " selected";
            }
        }
    };

    Grid.prototype.syncHeaderCheckbox = function () {
        if (!this.headerCheck) return;
        var rows = this.pageRowIds();
        var chosen = rows.filter(function (id) { return this.selected.has(id); }, this).length;
        this.headerCheck.checked = rows.length > 0 && chosen === rows.length;
        this.headerCheck.indeterminate = chosen > 0 && chosen < rows.length;
    };

    /* ----------------------------------------------------------- view menu */

    Grid.prototype.buildViewMenu = function () {
        var self = this;
        var menu = this.query("[data-grid-view]");
        if (!menu) return;

        var trigger = menu.querySelector("[data-grid-view-trigger]");
        var panel = menu.querySelector("[data-grid-view-panel]");
        if (!trigger || !panel) return;

        /* Density */
        var seg = el("div", "ds-seg");
        seg.setAttribute("role", "group");
        seg.setAttribute("aria-label", "Row density");
        [["comfortable", "Comfortable"], ["compact", "Compact"]].forEach(function (pair) {
            var btn = el("button", null, pair[1]);
            btn.type = "button";
            btn.setAttribute("aria-pressed", String(self.density === pair[0]));
            btn.addEventListener("click", function () {
                self.applyDensity(pair[0]);
                seg.querySelectorAll("button").forEach(function (b, i) {
                    b.setAttribute("aria-pressed", String(i === (pair[0] === "comfortable" ? 0 : 1)));
                });
                self.api.columns.adjust();
            });
            seg.appendChild(btn);
        });

        panel.appendChild(el("div", "ds-menu-label", "Density"));
        panel.appendChild(seg);
        panel.appendChild(el("div", "ds-menu-sep"));
        panel.appendChild(el("div", "ds-menu-label", "Columns"));

        /* Column visibility — structural columns stay locked on. */
        this.api.columns().every(function (index) {
            var th = this.header();
            if (th.classList.contains("col-select") ||
                th.classList.contains("col-actions") ||
                th.hasAttribute("data-locked")) return;

            var name = (th.getAttribute("data-name") || th.textContent || "").trim();
            var item = el("label", "ds-menu-item");
            var box = document.createElement("input");
            box.type = "checkbox";
            box.checked = this.visible();
            box.addEventListener("change", function () {
                self.api.column(index).visible(box.checked);
                self.prefs.hidden = self.hiddenColumnNames();
                writePrefs(self.key, self.prefs);
                self.api.columns.adjust();
            });
            item.appendChild(box);
            item.appendChild(el("span", null, name));
            panel.appendChild(item);
        });

        /* Export */
        panel.appendChild(el("div", "ds-menu-sep"));
        var exportBtn = el("button", "ds-menu-item",
            '<i data-lucide="download"></i><span>Export visible rows (CSV)</span>');
        exportBtn.type = "button";
        exportBtn.addEventListener("click", function () {
            self.exportCsv();
            setOpen(false);
        });
        panel.appendChild(exportBtn);

        function setOpen(open) {
            panel.hidden = !open;
            trigger.setAttribute("aria-expanded", String(open));
            if (open) icons();
        }

        trigger.addEventListener("click", function (ev) {
            ev.stopPropagation();
            setOpen(panel.hidden);
        });

        document.addEventListener("click", function (ev) {
            if (!panel.hidden && !menu.contains(ev.target)) setOpen(false);
        });

        document.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape" && !panel.hidden) { setOpen(false); trigger.focus(); }
        });

        icons();
    };

    Grid.prototype.applyDensity = function (density) {
        this.density = density;
        if (this.dataset) this.dataset.setAttribute("data-density", density);
        this.prefs.density = density;
        writePrefs(this.key, this.prefs);
    };

    Grid.prototype.hiddenColumnNames = function () {
        var hidden = [];
        this.api.columns().every(function () {
            if (!this.visible()) {
                var name = this.header().getAttribute("data-name") || this.header().textContent.trim();
                if (name) hidden.push(name);
            }
        });
        return hidden;
    };

    Grid.prototype.applyColumnPrefs = function () {
        var hidden = this.prefs.hidden;
        if (!Array.isArray(hidden) || !hidden.length) return;
        this.api.columns().every(function () {
            var th = this.header();
            if (th.classList.contains("col-select") ||
                th.classList.contains("col-actions")) return;
            var name = th.getAttribute("data-name") || th.textContent.trim();
            if (hidden.indexOf(name) > -1) this.visible(false, false);
        });
        this.api.columns.adjust();
    };

    /* -------------------------------------------------------------- export */

    Grid.prototype.exportCsv = function () {
        var self = this;
        var visible = [];
        this.api.columns().every(function (index) {
            var th = this.header();
            if (!this.visible()) return;
            if (th.classList.contains("col-select") ||
                th.classList.contains("col-actions")) return;
            visible.push({ index: index, name: (th.getAttribute("data-name") || th.textContent || "").trim() });
        });

        var lines = [visible.map(function (c) { return csvCell(c.name); }).join(",")];

        // Read from the row data, not the DOM: rows on other pages are not
        // rendered, and the export covers everything the filter matched.
        this.api.rows({ search: "applied" }).data().each(function (row) {
            lines.push(visible.map(function (c) {
                return csvCell(cellText(row[c.index]));
            }).join(","));
        });

        var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "nexam-" + self.key + "-" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };

    /* --------------------------------------------------------- row menus */

    /** Flip the action menu upward when the row sits near the viewport floor. */
    Grid.prototype.wireMenus = function () {
        this.node.addEventListener("click", function (ev) {
            var summary = ev.target.closest(".g-menu > summary");
            if (!summary) return;
            var menu = summary.parentNode;
            var space = window.innerHeight - summary.getBoundingClientRect().bottom;
            menu.classList.toggle("drop-up", space < 200);
        });
    };

    /* ------------------------------------------------------------ bootstrap */

    $(document).ready(function () {
        var tables = document.querySelectorAll("table.datatable");
        if (!tables.length) return;

        var grids = Array.prototype.map.call(tables, function (node) { return new Grid(node); });

        /* "clear the filters" inside the no-results row */
        document.addEventListener("click", function (ev) {
            if (!ev.target.closest("[data-grid-reset]")) return;
            grids.forEach(function (grid) { grid.clearFilters(); });
        });

        /* "/" focuses the first grid search; Escape clears it. */
        document.addEventListener("keydown", function (ev) {
            if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
            var tag = (ev.target && ev.target.tagName) || "";
            if (["INPUT", "TEXTAREA", "SELECT"].indexOf(tag) > -1 || ev.target.isContentEditable) return;
            var search = document.querySelector("[data-grid-search]");
            if (!search) return;
            ev.preventDefault();
            search.focus();
            search.select();
        });
    });
})();
