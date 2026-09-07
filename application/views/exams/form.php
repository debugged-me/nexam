<div class="page-content">
    <div class="form-container form-container--wide">

        <div class="page-header">
            <div><h1><?php echo isset($exam) ? 'Edit exam' : 'New exam'; ?></h1><p class="page-sub"><?php echo isset($exam) ? 'Update the exam details.' : 'Start from a blueprint or create a blank exam.'; ?></p></div>
        </div>

        <?php if (!isset($exam) && (!isset($tos) || !$tos)): ?>
            <section class="creation-panel mb-2" aria-labelledby="creation-method-title">
                <div class="creation-panel-head">
                    <div>
                        <h2 id="creation-method-title">Start from a blueprint</h2>
                        <p>Automatically select questions using the blueprint’s subject and Bloom distribution.</p>
                    </div>
                    <span class="creation-tag">Recommended</span>
                </div>
                <div class="creation-panel-body">
                    <?php if (!empty($tos_list)): ?>
                        <div class="creation-blueprints">
                            <?php foreach (array_slice($tos_list, 0, 3) as $blueprint): ?>
                                <a href="<?php echo site_url('exams/create?tos=' . rawurlencode($blueprint->id)); ?>" class="creation-blueprint-link">
                                    <span><strong><?php echo htmlspecialchars($blueprint->title); ?></strong><small><?php echo htmlspecialchars($blueprint->subject_name); ?> · <?php echo (int) $blueprint->total_items; ?> items</small></span>
                                    <i data-lucide="chevron-right"></i>
                                </a>
                            <?php endforeach; ?>
                        </div>
                        <a href="<?php echo site_url('tos'); ?>" class="creation-mode-action">View all blueprints <i data-lucide="arrow-right"></i></a>
                    <?php else: ?>
                        <div class="creation-empty">
                            <span>No blueprints yet.</span>
                            <a href="<?php echo site_url('tos/create'); ?>">Create a blueprint</a>
                        </div>
                    <?php endif; ?>
                </div>
                <div class="creation-panel-footer">
                    <div>
                        <strong>Start with a blank exam</strong>
                        <span>Add and organize questions manually.</span>
                    </div>
                    <a href="#exam-details" class="btn btn-outline">Continue blank</a>
                </div>
            </section>
        <?php endif; ?>

        <?php if (isset($tos) && $tos): ?>
            <?php
                $weights = isset($bloom_weights) && is_array($bloom_weights) ? $bloom_weights : [];
                $dist_parts = [];
                foreach ($weights as $b => $p) {
                    $dist_parts[] = ucfirst(htmlspecialchars($b)) . ' ' . (int) $p . '%';
                }
                $distribution = implode(', ', $dist_parts);
            ?>
            <div class="callout callout-warning mb-2">
                <div class="callout-icon"><i data-lucide="table"></i></div>
                <div>
                    <div class="callout-title">Generating from TOS: <?php echo htmlspecialchars($tos->title); ?></div>
                    <div class="callout-detail">
                        Total items: <?php echo (int) $tos->total_items; ?>
                        <?php if ($distribution): ?>
                            &middot; Bloom distribution: <?php echo $distribution; ?>
                        <?php endif; ?>
                    </div>
                    <div class="callout-note">
                        <i data-lucide="info"></i>
                        Questions will be auto-selected from active questions matching this subject and bloom distribution.
                    </div>
                </div>
            </div>
        <?php elseif (!isset($exam)): ?>
            <div class="section-kicker" id="exam-details">Blank exam details</div>
        <?php endif; ?>

        <div class="card"<?php echo !isset($exam) && (!isset($tos) || !$tos) ? ' aria-labelledby="exam-details"' : ''; ?>>
            <div class="card-body">
                <?php if (validation_errors()): ?>
                    <div class="form-alert" role="alert" tabindex="-1">
                        <i data-lucide="circle-alert"></i>
                        <div><strong>Please review the form.</strong><span><?php echo htmlspecialchars(trim(validation_errors(' ', ' ')), ENT_QUOTES, 'UTF-8'); ?></span></div>
                    </div>
                <?php endif; ?>
                <form action="" method="post" data-dirty-guard>
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <?php if (isset($tos) && $tos): ?>
                        <input type="hidden" name="tos_id" value="<?php echo htmlspecialchars($tos->id); ?>">
                    <?php endif; ?>

                    <div class="form-section">
                        <div class="form-section-title">Details</div>
                        <div class="form-group">
                            <label class="form-label" for="title">Title <span class="req">*</span></label>
                            <input type="text" id="title" name="title" class="form-control" required maxlength="255"
                                   autocomplete="off"
                                   value="<?php echo htmlspecialchars(set_value('title', isset($exam) ? $exam->title : (isset($tos) && $tos ? $tos->title : ''))); ?>" autofocus>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="subject_id">Subject <span class="req">*</span></label>
                            <select id="subject_id" name="subject_id" class="form-control form-select" required>
                                <option value="">Select a subject…</option>
                                <?php foreach ($subjects as $s): ?>
                                    <?php $selected_subject = set_value('subject_id', isset($exam) ? $exam->subject_id : (isset($tos) && $tos ? $tos->subject_id : (!empty($preselect_subject) ? $preselect_subject : ''))); ?>
                                    <option value="<?php echo htmlspecialchars($s->id); ?>"
                                        <?php echo $selected_subject === $s->id ? 'selected' : ''; ?>>
                                        <?php echo htmlspecialchars($s->name); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="format">Format <span class="req">*</span></label>
                                <select id="format" name="format" class="form-control form-select" required>
                                    <?php $selected_format = set_value('format', isset($exam) ? $exam->format : 'print'); ?>
                                    <option value="print" <?php echo $selected_format === 'print' ? 'selected' : ''; ?>>Print</option>
                                    <option value="digital" <?php echo $selected_format === 'digital' ? 'selected' : ''; ?>>Digital</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="duration_minutes">Duration (minutes)</label>
                                <input type="number" id="duration_minutes" name="duration_minutes" class="form-control" min="0" max="1000"
                                       value="<?php echo htmlspecialchars(set_value('duration_minutes', isset($exam) && $exam->duration_minutes ? $exam->duration_minutes : '')); ?>"
                                       placeholder="Optional">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-title">Content</div>
                        <div class="form-group">
                            <label class="form-label" for="instructions">Instructions</label>
                            <textarea id="instructions" name="instructions" class="form-control" rows="4"
                                      maxlength="5000" placeholder="Optional instructions shown to examinees"><?php echo htmlspecialchars(set_value('instructions', isset($exam) && $exam->instructions ? $exam->instructions : '')); ?></textarea>
                        </div>

                        <?php if (isset($exam)): ?>
                            <div class="form-group">
                                <span class="form-label">Publishing status</span>
                                <div><span class="badge badge-<?php echo $exam->status === 'published' ? 'green' : 'amber'; ?>"><?php echo ucfirst(htmlspecialchars($exam->status)); ?></span></div>
                                <div class="form-hint">Publishing is managed from the exam details page so it always requires an explicit confirmation.</div>
                            </div>
                        <?php endif; ?>
                    </div>

                    <div class="form-actions form-actions--sticky">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="check"></i> <?php echo isset($exam) ? 'Update Exam' : ((isset($tos) && $tos) ? 'Generate Exam' : 'Create Blank Exam'); ?>
                        </button>
                        <?php $return_subject = isset($exam) ? $exam->subject_id : (isset($tos) && $tos ? $tos->subject_id : (!empty($preselect_subject) ? $preselect_subject : null)); ?>
                        <a href="<?php echo isset($exam) ? site_url('exams/view/' . rawurlencode($exam->id)) : site_url('exams' . ($return_subject ? '?subject_id=' . rawurlencode($return_subject) : '')); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
