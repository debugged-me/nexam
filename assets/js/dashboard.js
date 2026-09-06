/* ==========================================================================
   dashboard.js — activity chart, animated counters, readiness gauge
   No chart library: the plot is hand-built SVG so it matches the design system
   exactly and costs nothing to load.
   ========================================================================== */

(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ------------------------------------------------------------------
       Small helpers
       ------------------------------------------------------------------ */

    function el(name, attrs) {
        var node = document.createElementNS(SVG_NS, name);
        for (var key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
                node.setAttribute(key, attrs[key]);
            }
        }
        return node;
    }

    function fmt(n) {
        return Number(n).toLocaleString("en-US");
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /* ------------------------------------------------------------------
       Count-up numbers
       ------------------------------------------------------------------ */

    function animateCount(node) {
        var target = parseInt(node.dataset.count, 10) || 0;
        var suffix = node.dataset.suffix || "";

        if (reduceMotion || target === 0) {
            node.textContent = fmt(target) + suffix;
            return;
        }

        var duration = 750;
        var start = performance.now();

        function step(now) {
            var t = Math.min(1, (now - start) / duration);
            node.textContent = fmt(Math.round(target * easeOutCubic(t))) + suffix;
            if (t < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    document.querySelectorAll("[data-count]").forEach(animateCount);

    /* ------------------------------------------------------------------
       Readiness gauge — sweep the arc to its value
       ------------------------------------------------------------------ */

    (function gauge() {
        var wrap = document.getElementById("readiness-gauge");
        var arc = document.getElementById("gauge-arc");
        if (!wrap || !arc) return;

        var pct = Math.max(0, Math.min(100, parseInt(wrap.dataset.value, 10) || 0));
        var length = arc.getTotalLength();

        arc.style.strokeDasharray = length;
        arc.style.strokeDashoffset = length;

        // Let the browser paint the empty track once, then sweep.
        requestAnimationFrame(function () {
            arc.style.transition = reduceMotion ? "none" : "stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)";
            arc.style.strokeDashoffset = length - (length * pct) / 100;
        });
    })();

    /* ------------------------------------------------------------------
       Activity chart
       ------------------------------------------------------------------ */

    var seriesNode = document.getElementById("dashboard-series");
    var plot = document.getElementById("activity-chart");
    if (!seriesNode || !plot) return;

    var history;
    try {
        history = JSON.parse(seriesNode.textContent) || [];
    } catch (err) {
        return;
    }
    if (!history.length) return;

    var tip = document.getElementById("chart-tip");
    var axisEl = document.getElementById("chart-axis");
    var totalEl = document.getElementById("chart-total");
    var noteEl = document.getElementById("chart-note");
    var deltaEl = document.getElementById("chart-delta");
    var switcher = document.getElementById("range-switch");

    var COLORS = { questions: "#2563EB", exams: "#7C3AED", previous: "#CBD5E1" };
    var PAD = { top: 16, right: 8, bottom: 10, left: 8 };
    var MIN_HEIGHT = 220;

    var range = 30;
    var current = [];
    var previous = [];
    var geometry = null;

    /** Monotone cubic path — smooth, but never overshoots below the data. */
    function smoothPath(points) {
        var n = points.length;
        if (n === 0) return "";
        if (n === 1) return "M" + points[0].x + "," + points[0].y;

        var dx = [], dy = [], slope = [], i;

        for (i = 0; i < n - 1; i++) {
            dx[i] = points[i + 1].x - points[i].x;
            dy[i] = points[i + 1].y - points[i].y;
            slope[i] = dx[i] ? dy[i] / dx[i] : 0;
        }

        var tangent = [slope[0]];
        for (i = 1; i < n - 1; i++) {
            if (slope[i - 1] * slope[i] <= 0) {
                tangent[i] = 0;
            } else {
                var common = dx[i - 1] + dx[i];
                tangent[i] = 3 * common / (
                    (common + dx[i]) / slope[i - 1] + (common + dx[i - 1]) / slope[i]
                );
            }
        }
        tangent[n - 1] = slope[n - 2];

        var d = "M" + points[0].x + "," + points[0].y;
        for (i = 0; i < n - 1; i++) {
            var third = dx[i] / 3;
            d += "C" + (points[i].x + third) + "," + (points[i].y + tangent[i] * third) +
                 " " + (points[i + 1].x - third) + "," + (points[i + 1].y - tangent[i + 1] * third) +
                 " " + points[i + 1].x + "," + points[i + 1].y;
        }

        return d;
    }

    function sliceData() {
        var len = history.length;
        current = history.slice(Math.max(0, len - range));
        var prevStart = Math.max(0, len - range * 2);
        previous = history.slice(prevStart, Math.max(0, len - range));

        // Pad the comparison window so both series line up index-for-index.
        while (previous.length < current.length) {
            previous.unshift({ d: "", l: "", q: 0, e: 0 });
        }
    }

    function totalOf(rows) {
        return rows.reduce(function (sum, row) { return sum + row.q + row.e; }, 0);
    }

    function render() {
        var width = plot.clientWidth;
        if (!width) return;

        var height = Math.max(MIN_HEIGHT, plot.clientHeight);
        var innerW = width - PAD.left - PAD.right;
        var innerH = height - PAD.top - PAD.bottom;

        var peak = 1;
        current.concat(previous).forEach(function (row) {
            peak = Math.max(peak, row.q + row.e, row.q, row.e);
        });
        peak = peak * 1.25;

        var stepX = current.length > 1 ? innerW / (current.length - 1) : 0;

        function xAt(i) { return PAD.left + i * stepX; }
        function yAt(v) { return PAD.top + innerH - (v / peak) * innerH; }

        var qPts = current.map(function (row, i) { return { x: xAt(i), y: yAt(row.q) }; });
        var ePts = current.map(function (row, i) { return { x: xAt(i), y: yAt(row.e) }; });
        var pPts = previous.map(function (row, i) { return { x: xAt(i), y: yAt(row.q + row.e) }; });

        var svg = el("svg", {
            viewBox: "0 0 " + width + " " + height,
            preserveAspectRatio: "none"
        });

        // Gradient + soft glow for the questions area
        var defs = el("defs");
        var grad = el("linearGradient", { id: "areaGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
        grad.appendChild(el("stop", { offset: "0%", "stop-color": COLORS.questions, "stop-opacity": ".22" }));
        grad.appendChild(el("stop", { offset: "100%", "stop-color": COLORS.questions, "stop-opacity": "0" }));
        defs.appendChild(grad);
        svg.appendChild(defs);

        // Horizontal guides
        for (var g = 0; g <= 3; g++) {
            var gy = PAD.top + (innerH / 3) * g;
            svg.appendChild(el("line", {
                x1: 0, y1: gy, x2: width, y2: gy,
                stroke: "#F1F5F9", "stroke-width": 1
            }));
        }

        // Previous period (dashed)
        if (pPts.length > 1) {
            svg.appendChild(el("path", {
                d: smoothPath(pPts),
                fill: "none",
                stroke: COLORS.previous,
                "stroke-width": 1.5,
                "stroke-dasharray": "4 4",
                "stroke-linecap": "round"
            }));
        }

        // Questions: area + line
        var qLine = smoothPath(qPts);
        if (qPts.length > 1) {
            svg.appendChild(el("path", {
                d: qLine + " L" + qPts[qPts.length - 1].x + "," + (PAD.top + innerH) +
                   " L" + qPts[0].x + "," + (PAD.top + innerH) + " Z",
                fill: "url(#areaGrad)",
                stroke: "none"
            }));
        }

        var qStroke = el("path", {
            d: qLine,
            fill: "none",
            stroke: COLORS.questions,
            "stroke-width": 2.25,
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
        });
        svg.appendChild(qStroke);

        // Exams line
        var eStroke = el("path", {
            d: smoothPath(ePts),
            fill: "none",
            stroke: COLORS.exams,
            "stroke-width": 1.75,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            opacity: ".9"
        });
        svg.appendChild(eStroke);

        // Hover furniture
        var crosshair = el("line", {
            x1: 0, y1: PAD.top, x2: 0, y2: PAD.top + innerH,
            stroke: "#CBD5E1", "stroke-width": 1, "stroke-dasharray": "3 3", opacity: "0"
        });
        var qDot = el("circle", { r: 4.5, fill: "#fff", stroke: COLORS.questions, "stroke-width": 2.5, opacity: "0" });
        var eDot = el("circle", { r: 4, fill: "#fff", stroke: COLORS.exams, "stroke-width": 2, opacity: "0" });
        svg.appendChild(crosshair);
        svg.appendChild(qDot);
        svg.appendChild(eDot);

        // Draw-in animation for the primary line
        if (!reduceMotion) {
            var len = qStroke.getTotalLength ? qStroke.getTotalLength() : 0;
            if (len) {
                qStroke.style.strokeDasharray = len;
                qStroke.style.strokeDashoffset = len;
                requestAnimationFrame(function () {
                    qStroke.style.transition = "stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)";
                    qStroke.style.strokeDashoffset = 0;
                });
            }
            eStroke.style.opacity = "0";
            requestAnimationFrame(function () {
                eStroke.style.transition = "opacity .5s ease .3s";
                eStroke.style.opacity = ".9";
            });
        }

        // Swap in the new plot, keeping the tooltip node
        Array.prototype.slice.call(plot.querySelectorAll("svg")).forEach(function (old) { old.remove(); });
        plot.insertBefore(svg, tip);

        geometry = { xAt: xAt, stepX: stepX, crosshair: crosshair, qDot: qDot, eDot: eDot, qPts: qPts, ePts: ePts };

        renderAxis();
    }

    function renderAxis() {
        if (!axisEl) return;
        axisEl.innerHTML = "";

        var ticks = Math.min(5, current.length);
        if (ticks < 2) return;

        var seen = {};
        for (var i = 0; i < ticks; i++) {
            var idx = Math.round((current.length - 1) * (i / (ticks - 1)));
            if (seen[idx]) continue;
            seen[idx] = true;
            var span = document.createElement("span");
            span.textContent = current[idx].l;
            axisEl.appendChild(span);
        }
    }

    function renderSummary() {
        var currentTotal = totalOf(current);
        var previousTotal = totalOf(previous);

        if (totalEl) totalEl.textContent = fmt(currentTotal);
        if (noteEl) noteEl.textContent = "items created in the last " + range + " days";

        if (!deltaEl) return;

        var pct, dir;
        if (previousTotal > 0) {
            pct = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
            dir = pct > 0 ? "up" : (pct < 0 ? "down" : "flat");
        } else if (currentTotal > 0) {
            pct = 100;
            dir = "up";
        } else {
            pct = 0;
            dir = "flat";
        }

        deltaEl.className = "delta " + dir;
        deltaEl.innerHTML = dir === "flat"
            ? "No change"
            : '<i data-lucide="' + (dir === "down" ? "trending-down" : "trending-up") + '"></i> ' + Math.abs(pct) + "%";

        if (window.lucide) lucide.createIcons();
    }

    /* ---- Hover interaction ---- */

    function hideTip() {
        if (tip) tip.classList.remove("show");
        if (!geometry) return;
        geometry.crosshair.setAttribute("opacity", "0");
        geometry.qDot.setAttribute("opacity", "0");
        geometry.eDot.setAttribute("opacity", "0");
    }

    var activePoint = -1;

    function showPoint(idx) {
        if (!geometry || !current.length) return;
        idx = Math.max(0, Math.min(current.length - 1, idx));
        activePoint = idx;
        var box = plot.getBoundingClientRect();
        var row = current[idx];
        var prevRow = previous[idx];
        var px = geometry.xAt(idx);

        geometry.crosshair.setAttribute("x1", px);
        geometry.crosshair.setAttribute("x2", px);
        geometry.crosshair.setAttribute("opacity", "1");

        geometry.qDot.setAttribute("cx", px);
        geometry.qDot.setAttribute("cy", geometry.qPts[idx].y);
        geometry.qDot.setAttribute("opacity", "1");

        geometry.eDot.setAttribute("cx", px);
        geometry.eDot.setAttribute("cy", geometry.ePts[idx].y);
        geometry.eDot.setAttribute("opacity", "1");

        if (!tip) return;

        var rows =
            '<div class="tip-row"><span class="tip-dot" style="background:' + COLORS.questions + '"></span>' +
            '<span class="tip-label">Questions</span><span class="tip-val">' + fmt(row.q) + "</span></div>" +
            '<div class="tip-row"><span class="tip-dot" style="background:' + COLORS.exams + '"></span>' +
            '<span class="tip-label">Exams</span><span class="tip-val">' + fmt(row.e) + "</span></div>";

        if (prevRow && prevRow.d) {
            rows += '<div class="tip-row"><span class="tip-dot" style="background:' + COLORS.previous + '"></span>' +
                    '<span class="tip-label">Prev. period</span><span class="tip-val">' + fmt(prevRow.q + prevRow.e) + "</span></div>";
        }

        tip.innerHTML = '<div class="tip-date">' + row.l + "</div>" + rows;
        tip.classList.add("show");

        // Keep the tooltip inside the card
        var tipW = tip.offsetWidth;
        var left = Math.max(tipW / 2 + 4, Math.min(box.width - tipW / 2 - 4, px));
        tip.style.left = left + "px";
        tip.style.top = geometry.qPts[idx].y + "px";
    }

    plot.addEventListener("pointermove", function (ev) {
        if (!geometry || !current.length) return;
        var box = plot.getBoundingClientRect();
        var x = ev.clientX - box.left;
        var idx = geometry.stepX
            ? Math.max(0, Math.min(current.length - 1, Math.round((x - PAD.left) / geometry.stepX)))
            : 0;
        showPoint(idx);
    });

    plot.addEventListener("pointerleave", function () {
        if (document.activeElement !== plot) hideTip();
    });

    plot.addEventListener("keydown", function (ev) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(ev.key)) return;
        ev.preventDefault();
        if (ev.key === "Escape") {
            hideTip();
            activePoint = -1;
            return;
        }
        if (ev.key === "Home") activePoint = 0;
        else if (ev.key === "End") activePoint = current.length - 1;
        else if (ev.key === "ArrowLeft") activePoint = activePoint < 0 ? current.length - 1 : activePoint - 1;
        else activePoint = activePoint < 0 ? 0 : activePoint + 1;
        showPoint(activePoint);
    });

    plot.addEventListener("blur", hideTip);

    /* ---- Range switch ---- */

    if (switcher) {
        switcher.addEventListener("click", function (ev) {
            var btn = ev.target.closest("button[data-range]");
            if (!btn) return;

            switcher.querySelectorAll("button").forEach(function (b) {
                b.classList.remove("active");
                b.setAttribute("aria-pressed", "false");
            });
            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");

            range = parseInt(btn.dataset.range, 10) || 30;
            plot.setAttribute("aria-label", "Activity chart for the last " + range + " days. Use left and right arrow keys to inspect each day.");
            hideTip();
            sliceData();
            renderSummary();
            render();
        });
    }

    /* ---- Boot + resize ---- */

    sliceData();
    renderSummary();
    render();

    var resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            hideTip();
            render();
        }, 140);
    });
})();
