/**
 * materials.js — upload form interactions + list page actions
 */
(function () {
  'use strict';

  // ── Upload form: source type tabs ──────────────────
  const tabs = document.querySelectorAll('.source-tab');
  const panels = document.querySelectorAll('[data-source-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const source = tab.dataset.source;

      tabs.forEach((t) => {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });

      panels.forEach((p) => {
        const match = p.dataset.sourcePanel === source;
        p.hidden = !match;

        // Disable inputs in hidden panels so they don't submit
        p.querySelectorAll('input, textarea, select').forEach((el) => {
          el.disabled = !match;
        });
      });

      // For the YouTube tab, point the url field to the youtube_url input
      if (source === 'youtube') {
        const urlInput = document.querySelector('[data-source-panel="url"] input[name="url"]');
        const ytInput = document.getElementById('youtube_url');
        if (urlInput && ytInput) {
          // The YouTube panel has its own url input; disable the URL panel's
          urlInput.disabled = true;
        }
      }
    });
  });

  // ── File drop zone ──────────────────────────────────
  const fileDrop = document.getElementById('file-drop');
  const fileInput = document.getElementById('file');
  const prompt = fileDrop?.querySelector('.file-drop-prompt');
  const selected = fileDrop?.querySelector('.file-drop-selected');

  if (fileDrop && fileInput) {
    fileDrop.addEventListener('click', () => fileInput.click());

    fileDrop.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDrop.classList.add('is-dragover');
    });

    fileDrop.addEventListener('dragleave', () => {
      fileDrop.classList.remove('is-dragover');
    });

    fileDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDrop.classList.remove('is-dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        showSelectedFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) showSelectedFile(fileInput.files[0]);
    });

    function showSelectedFile(file) {
      const nameEl = selected.querySelector('.file-name');
      const sizeEl = selected.querySelector('.file-size');
      nameEl.textContent = file.name;
      sizeEl.textContent = formatSize(file.size);
      prompt.hidden = true;
      selected.hidden = false;
    }

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }
  }

  // ── Delete confirmation ────────────────────────────
  document.querySelectorAll('.btn-delete[data-confirm]').forEach((btn) => {
    const form = btn.closest('form');
    if (!form) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      NexamModal.deleteConfirm('Delete material?', btn.dataset.confirm, function () {
        form.submit();
      });
    });
  });

  // ── Reprocess failed materials ─────────────────────
  document.querySelectorAll('.btn-reprocess').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.querySelector('i').style.animation = 'spin 1s linear infinite';

      try {
        const csrfCookie = getCookie('nexam_csrf_cookie');
        const res = await fetch(`${SITE_URL}/materials/reprocess/${id}`, {
          method: 'POST',
          headers: {
            'X-CSRF-TOKEN': csrfCookie || '',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        const data = await res.json();
        if (res.ok) {
          NexamToast.success('Reprocessing started.');
          setTimeout(() => location.reload(), 1000);
        } else {
          NexamToast.error(data.error || 'Reprocess failed.');
          btn.disabled = false;
          btn.querySelector('i').style.animation = '';
        }
      } catch (err) {
        NexamToast.error('Network error. Please try again.');
        btn.disabled = false;
        btn.querySelector('i').style.animation = '';
      }
    });
  });

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : '';
  }
})();
