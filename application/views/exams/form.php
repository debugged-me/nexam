<div class="page-content">
    <div style="max-width:800px;margin:0 auto">

        <div class="page-header">
            <p class="page-sub"><?php echo isset($exam) ? 'Update this paper.' : 'Choose a subject or blueprint, then generate the paper.'; ?></p>
            <a href="<?php echo site_url('exams'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="arrow-left"></i> Back
            </a>
        </div>

        <?php if (isset($tos) && $tos): ?>
            <?php
                $weights = isset($bloom_weights) && is_array($bloom_weights) ? $bloom_weights : [];
                $dist_parts = [];
                foreach ($weights as $b => $p) {
                    $dist_parts[] = ucfirst(htmlspecialchars($b)) . ' ' . (int) $p . '%';
                }
                $distribution = implode(', ', $dist_parts);
            ?>
            <div class="card mb-2" style="background:#fffbeb;border:1px solid #fde68a">
                <div class="card-body" style="padding:16px 20px">
                    <div style="display:flex;align-items:flex-start;gap:12px">
                        <div class="stat-icon amber" style="width:40px;height:40px;flex-shrink:0">
                            <i data-lucide="table"></i>
                        </div>
                        <div>
                            <div style="font-family:var(--font-display);font-size:15px;font-weight:600;color:var(--text)">
                                Generating from TOS: <?php echo htmlspecialchars($tos->title); ?>
                            </div>
                            <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
                                Total items: <?php echo (int) $tos->total_items; ?>
                                <?php if ($distribution): ?>
                                    &middot; Bloom distribution: <?php echo $distribution; ?>
                                <?php endif; ?>
                            </div>
                            <div style="font-size:12px;color:#d97706;margin-top:6px">
                                <i data-lucide="info" style="width:13px;height:13px;display:inline-block;vertical-align:-2px"></i>
                                Questions will be auto-selected from active questions matching this subject and bloom distribution.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <div class="card">
            <div class="card-body">
                <form action="" method="post" autocomplete="off">
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <?php if (isset($tos) && $tos): ?>
                        <input type="hidden" name="tos_id" value="<?php echo htmlspecialchars($tos->id); ?>">
                    <?php endif; ?>

                    <div class="form-group">
                        <label class="form-label" for="title">Title <span style="color:#dc2626">*</span></label>
                        <input type="text" id="title" name="title" class="form-control" required maxlength="255"
                               value="<?php echo isset($exam) ? htmlspecialchars($exam->title) : (isset($tos) && $tos ? htmlspecialchars($tos->title) : ''); ?>" autofocus>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="subject_id">Subject <span style="color:#dc2626">*</span></label>
                        <select id="subject_id" name="subject_id" class="form-control form-select" required>
                            <option value="">Select a subject…</option>
                            <?php foreach ($subjects as $s): ?>
                                <option value="<?php echo htmlspecialchars($s->id); ?>"
                                    <?php echo (isset($exam) && $exam->subject_id === $s->id) || (isset($tos) && $tos && $tos->subject_id === $s->id) ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($s->name); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="format">Format <span style="color:#dc2626">*</span></label>
                        <select id="format" name="format" class="form-control form-select" required>
                            <option value="print" <?php echo (isset($exam) && $exam->format === 'print') ? 'selected' : ''; ?>>Print</option>
                            <option value="digital" <?php echo (isset($exam) && $exam->format === 'digital') ? 'selected' : ''; ?>>Digital</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="duration_minutes">Duration (minutes)</label>
                        <input type="number" id="duration_minutes" name="duration_minutes" class="form-control" min="0" max="1000"
                               value="<?php echo isset($exam) && $exam->duration_minutes ? (int) $exam->duration_minutes : ''; ?>"
                               placeholder="Optional">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="instructions">Instructions</label>
                        <textarea id="instructions" name="instructions" class="form-control" rows="4"
                                  placeholder="Optional instructions shown to examinees"><?php echo isset($exam) && $exam->instructions ? htmlspecialchars($exam->instructions) : ''; ?></textarea>
                    </div>

                    <?php if (isset($exam)): ?>
                        <div class="form-group">
                            <label class="form-label" for="status">Status <span style="color:#dc2626">*</span></label>
                            <select id="status" name="status" class="form-control form-select" required>
                                <option value="draft" <?php echo $exam->status === 'draft' ? 'selected' : ''; ?>>Draft</option>
                                <option value="published" <?php echo $exam->status === 'published' ? 'selected' : ''; ?>>Published</option>
                            </select>
                        </div>
                    <?php endif; ?>

                    <div style="display:flex;gap:10px">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="check"></i> <?php echo isset($exam) ? 'Update' : 'Create'; ?>
                        </button>
                        <a href="<?php echo site_url(isset($exam) ? 'exams/view/' . $exam->id : 'exams'); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
