<div class="page-content">
    <div class="form-container form-container--wide">

        <div class="page-header">
            <div><h1><?php echo isset($tos) ? 'Edit TOS Blueprint' : 'New TOS Blueprint'; ?></h1><p class="page-sub"><?php echo isset($tos) ? 'Update this blueprint.' : 'Set the total items and how they spread across Bloom levels.'; ?></p></div>
        </div>

        <?php if (empty($subjects)): ?>
            <div class="card">
                <div class="empty-state">
                    <div class="empty-icon"><i data-lucide="book-open"></i></div>
                    <h4>No subjects available</h4>
                    <p>You need at least one subject before creating a TOS.</p>
                    <a href="<?php echo site_url('subjects/create'); ?>" class="btn btn-primary">
                        <i data-lucide="plus"></i> Create Subject
                    </a>
                </div>
            </div>
        <?php else: ?>
            <div class="card">
                <div class="card-body">
                    <form action="" method="post" id="tos-form" data-dirty-guard>
                        <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                        <?php if (validation_errors()): ?>
                            <div class="form-alert" role="alert"><i data-lucide="circle-alert"></i><div><strong>Please review the blueprint.</strong><span><?php echo htmlspecialchars(trim(validation_errors(' ', ' ')), ENT_QUOTES, 'UTF-8'); ?></span></div></div>
                        <?php endif; ?>

                        <div class="form-section">
                            <div class="form-section-title">Details</div>
                            <div class="form-group">
                                <label class="form-label" for="title">Title <span class="req">*</span></label>
                                <input type="text" id="title" name="title" class="form-control" required maxlength="255"
                                       value="<?php echo htmlspecialchars(set_value('title', isset($tos) ? $tos->title : ''), ENT_QUOTES, 'UTF-8'); ?>"
                                       placeholder="e.g. Midterm Exam Blueprint" autofocus>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="subject_id">Subject <span class="req">*</span></label>
                                <select id="subject_id" name="subject_id" class="form-control form-select" required>
                                    <option value="">Select a subject…</option>
                                    <?php foreach ($subjects as $s): ?>
                                        <?php $tos_subject_value = set_value('subject_id', isset($tos) ? $tos->subject_id : (isset($preselect) ? $preselect : '')); ?>
                                        <option value="<?php echo htmlspecialchars($s->id); ?>" <?php echo $tos_subject_value === $s->id ? 'selected' : ''; ?>>
                                            <?php echo htmlspecialchars($s->name); ?><?php echo $s->code ? ' (' . htmlspecialchars($s->code) . ')' : ''; ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="total_items">Total Items <span class="req">*</span></label>
                                <input type="number" id="total_items" name="total_items" class="form-control" required min="1" max="500"
                                       value="<?php echo (int) set_value('total_items', isset($tos) ? $tos->total_items : 50); ?>">
                            </div>
                        </div>

                        <div class="form-section">
                            <div class="form-section-title">Bloom's Taxonomy Weights</div>
                            <p class="form-hint mb-2">
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
                                                   value="<?php echo (int) set_value($key, isset($bloom_weights[$key]) ? $bloom_weights[$key] : 0); ?>"
                                                   data-bloom="1">
                                            <span class="bloom-pct">%</span>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                            <div class="bloom-total" id="bloomTotal" role="status" aria-live="polite">
                                Total: <span id="bloomTotalValue">0</span>%
                                <span class="bloom-total-badge" id="bloomTotalBadge"></span>
                            </div>
                        </div>

                        <div class="form-actions form-actions--sticky">
                            <button type="submit" class="btn btn-primary">
                                <i data-lucide="check"></i> <?php echo isset($tos) ? 'Save Changes' : 'Create Blueprint'; ?>
                            </button>
                            <?php $return_subject = isset($tos) ? $tos->subject_id : (!empty($preselect) ? $preselect : null); ?>
                            <a href="<?php echo isset($tos) ? site_url('tos/view/' . $tos->id) : site_url('tos' . ($return_subject ? '?subject_id=' . rawurlencode($return_subject) : '')); ?>" class="btn btn-outline">Cancel</a>
                        </div>
                    </form>
                </div>
            </div>
        <?php endif; ?>

    </div>
</div>
