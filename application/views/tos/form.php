<div class="page-content">
    <div style="max-width:800px;margin:0 auto">

        <div class="page-header">
            <p class="page-sub"><?php echo isset($tos) ? 'Update this blueprint.' : 'Set the total items and how they spread across Bloom levels.'; ?></p>
            <a href="<?php echo site_url('tos'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="arrow-left"></i> Back
            </a>
        </div>

        <?php if (empty($subjects)): ?>
            <div class="card">
                <div class="empty-state">
                    <i data-lucide="book-open"></i>
                    <p>You need at least one subject before creating a TOS.</p>
                    <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary">
                        <i data-lucide="plus"></i> Create Subject
                    </a>
                </div>
            </div>
        <?php else: ?>
            <div class="card">
                <div class="card-body">
                    <form action="" method="post" autocomplete="off">
                        <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">

                        <div class="form-group">
                            <label class="form-label" for="title">Title <span style="color:#dc2626">*</span></label>
                            <input type="text" id="title" name="title" class="form-control" required maxlength="255"
                                   value="<?php echo isset($tos) ? htmlspecialchars($tos->title) : ''; ?>"
                                   placeholder="e.g. Midterm Exam Blueprint" autofocus>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="subject_id">Subject <span style="color:#dc2626">*</span></label>
                            <select id="subject_id" name="subject_id" class="form-control form-select" required>
                                <option value="">Select a subject…</option>
                                <?php foreach ($subjects as $s): ?>
                                    <option value="<?php echo htmlspecialchars($s->id); ?>"
                                        <?php echo (isset($tos) && $tos->subject_id === $s->id) || (isset($preselect) && $preselect === $s->id) ? 'selected' : ''; ?>>
                                        <?php echo htmlspecialchars($s->name); ?><?php echo $s->code ? ' (' . htmlspecialchars($s->code) . ')' : ''; ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="total_items">Total Items <span style="color:#dc2626">*</span></label>
                            <input type="number" id="total_items" name="total_items" class="form-control" required min="1" max="500"
                                   value="<?php echo isset($tos) ? (int) $tos->total_items : 50; ?>">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Bloom's Taxonomy Weights (%)</label>
                            <p class="text-muted" style="font-size:13px;margin-bottom:12px">
                                Distribute percentages across the six cognitive levels. Should total 100%.
                            </p>
                            <div class="bloom-grid">
                                <?php
                                $bloom_labels = [
                                    'remember'   => 'Remember',
                                    'understand' => 'Understand',
                                    'apply'      => 'Apply',
                                    'analyze'    => 'Analyze',
                                    'evaluate'   => 'Evaluate',
                                    'create'     => 'Create',
                                ];
                                foreach ($bloom_labels as $key => $label):
                                ?>
                                    <div class="bloom-cell">
                                        <label class="form-label" for="bloom_<?php echo $key; ?>"><?php echo $label; ?></label>
                                        <div class="bloom-input-wrap">
                                            <input type="number" id="bloom_<?php echo $key; ?>" name="<?php echo $key; ?>"
                                                   class="form-control bloom-input" min="0" max="100" step="1"
                                                   value="<?php echo isset($bloom_weights[$key]) ? (int) $bloom_weights[$key] : 0; ?>"
                                                   data-bloom="1">
                                            <span class="bloom-pct">%</span>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <div class="bloom-total" id="bloomTotal">
                                Total: <span id="bloomTotalValue">0</span>%
                                <span class="bloom-total-badge" id="bloomTotalBadge"></span>
                            </div>
                        </div>

                        <div style="display:flex;gap:10px">
                            <button type="submit" class="btn btn-primary">
                                <i data-lucide="check"></i> <?php echo isset($tos) ? 'Update' : 'Create'; ?>
                            </button>
                            <a href="<?php echo isset($tos) ? site_url('tos/view/' . $tos->id) : site_url('tos'); ?>" class="btn btn-outline">Cancel</a>
                        </div>
                    </form>
                </div>
            </div>
        <?php endif; ?>

    </div>
</div>

<style>
.bloom-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-bottom: 14px;
}
.bloom-cell .form-label { margin-bottom: 4px; font-size: 12px; }
.bloom-input-wrap { position: relative; }
.bloom-input { padding-right: 28px; }
.bloom-pct {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 13px;
    pointer-events: none;
}
.bloom-total {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    padding: 10px 14px;
    background: var(--bg-hover);
    border-radius: var(--radius-sm);
}
.bloom-total-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}
.bloom-total-badge.ok { background: #f0fdf4; color: #16a34a; }
.bloom-total-badge.warn { background: #fef2f2; color: #dc2626; }
@media (max-width: 600px) {
    .bloom-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>

<script>
(function () {
    var inputs = document.querySelectorAll('.bloom-input');
    var totalEl = document.getElementById('bloomTotalValue');
    var badgeEl = document.getElementById('bloomTotalBadge');

    function recalc() {
        var sum = 0;
        inputs.forEach(function (el) {
            sum += parseInt(el.value, 10) || 0;
        });
        totalEl.textContent = sum;
        if (sum === 100) {
            badgeEl.textContent = 'Balanced';
            badgeEl.className = 'bloom-total-badge ok';
        } else {
            badgeEl.textContent = 'Should be 100%';
            badgeEl.className = 'bloom-total-badge warn';
        }
    }

    inputs.forEach(function (el) {
        el.addEventListener('input', recalc);
    });

    recalc();
})();
</script>
