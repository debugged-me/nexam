/**
 * exams.js — exam view interactions (generate PDFs, download links)
 */
(function () {
    "use strict";

    var genBtn = document.getElementById("btn-generate-pdfs");
    if (!genBtn) return;

    var examId = genBtn.dataset.examId;
    var downloadsCard = document.getElementById("exam-downloads");
    var downloadsContent = document.getElementById("downloads-content");

    genBtn.addEventListener("click", async function () {
        genBtn.disabled = true;
        genBtn.innerHTML = '<i data-lucide="loader-2" style="animation: spin 1s linear infinite;"></i> Generating...';
        if (window.lucide) lucide.createIcons();

        try {
            var csrfCookie = getCookie("nexam_csrf_cookie");
            var res = await fetch(SITE_URL + "/exams/generate_pdfs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": csrfCookie || "",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ exam_id: examId }),
            });
            var data = await res.json();
            if (res.ok && data.sets) {
                NexamToast.success("PDFs generated successfully.");
                renderDownloads(data);
            } else {
                NexamToast.error(data.error || "Generation failed.");
                genBtn.disabled = false;
                genBtn.innerHTML = '<i data-lucide="file-text"></i> Generate PDFs';
                if (window.lucide) lucide.createIcons();
            }
        } catch (err) {
            NexamToast.error("Network error. Please try again.");
            genBtn.disabled = false;
            genBtn.innerHTML = '<i data-lucide="file-text"></i> Generate PDFs';
            if (window.lucide) lucide.createIcons();
        }
    });

    function renderDownloads(data) {
        var html = '<div class="download-list">';

        data.sets.forEach(function (set) {
            html += '<div class="download-group">';
            html += '<h4>Set ' + set.setLabel + '</h4>';
            html += '<a href="' + SITE_URL + '/exams/download/' + examId + '/exam?set=' + set.setLabel + '" class="btn btn-outline btn-sm">';
            html += '<i data-lucide="file-text"></i> Exam PDF</a> ';
            html += '<a href="' + SITE_URL + '/exams/download/' + examId + '/answerkey?set=' + set.setLabel + '" class="btn btn-outline btn-sm">';
            html += '<i data-lucide="key"></i> Answer Key</a> ';
            html += '<a href="' + SITE_URL + '/exams/download/' + examId + '/omr?set=' + set.setLabel + '" class="btn btn-outline btn-sm">';
            html += '<i data-lucide="scan-line"></i> OMR Sheet</a>';
            html += '</div>';
        });

        if (data.tosReportPath) {
            html += '<div class="download-group">';
            html += '<h4>TOS Report</h4>';
            html += '<a href="' + SITE_URL + '/exams/download/' + examId + '/tos-report" class="btn btn-outline btn-sm">';
            html += '<i data-lucide="table"></i> TOS Summary Report</a>';
            html += '</div>';
        }

        html += '</div>';
        downloadsContent.innerHTML = html;
        downloadsCard.hidden = false;
        if (window.lucide) lucide.createIcons();
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? match[2] : "";
    }
})();
