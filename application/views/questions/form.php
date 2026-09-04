<div class="page-content">
    <div style="max-width:800px;margin:0 auto">

        <div class="page-header">
            <h2>
                <?php echo isset($question) ? 'Edit Question' : 'New Question'; ?>
            </h2>
            <a href="<?php echo site_url('questions'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="arrow-left"></i> Back
            </a>
        </div>

        <div class="card">
            <div class="card-body">
                <form action="" method="post" autocomplete="off">
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">

                    <div class="form-group">
                        <label class="form-label" for="subject_id">Subject <span style="color:#dc2626">*</span></label>
                        <select id="subject_id" name="subject_id" class="form-control form-select" required>
                            <option value="" disabled>Select a subject…</option>
                            <?php foreach ($subjects as $s): ?>
                                <?php
                                $selected = false;
                                if (isset($question)) {
                                    $selected = ($question->subject_id === $s->id);
                                } elseif (isset($preselect_subject) && $preselect_subject === $s->id) {
                                    $selected = true;
                                }
                                ?>
                                <option value="<?php echo htmlspecialchars($s->id); ?>" <?php echo $selected ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($s->name); ?>
                                    <?php echo $s->code ? ' (' . htmlspecialchars($s->code) . ')' : ''; ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="question-form-grid">
                        <div class="form-group">
                            <label class="form-label" for="type">Question Type <span style="color:#dc2626">*</span></label>
                            <select id="type" name="type" class="form-control form-select" required>
                                <?php
                                $type_labels = [
                                    'mcq'           => 'Multiple Choice',
                                    'true_false'    => 'True / False',
                                    'identification'=> 'Identification',
                                    'essay'         => 'Essay',
                                ];
                                $current_type = isset($question) ? $question->type : 'mcq';
                                ?>
                                <?php foreach ($question_types as $t): ?>
                                    <option value="<?php echo $t; ?>" <?php echo ($current_type === $t) ? 'selected' : ''; ?>>
                                        <?php echo isset($type_labels[$t]) ? $type_labels[$t] : ucfirst($t); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="bloom">Bloom Level</label>
                            <select id="bloom" name="bloom" class="form-control form-select">
                                <option value="">— Select —</option>
                                <?php $current_bloom = isset($question) ? $question->bloom : ''; ?>
                                <?php foreach ($bloom_levels as $b): ?>
                                    <option value="<?php echo $b; ?>" <?php echo ($current_bloom === $b) ? 'selected' : ''; ?>>
                                        <?php echo ucfirst($b); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="topic">Topic</label>
                        <input type="text" id="topic" name="topic" class="form-control" maxlength="255"
                               value="<?php echo isset($question) ? htmlspecialchars($question->topic) : ''; ?>"
                               placeholder="e.g. Quadratic Equations">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="stem">Question Stem <span style="color:#dc2626">*</span></label>
                        <textarea id="stem" name="stem" class="form-control" rows="3" required
                                  placeholder="Enter the question text…"><?php echo isset($question) ? htmlspecialchars($question->stem) : ''; ?></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="options">Options <span class="text-muted" style="font-weight:400;font-size:12px">(for MCQ — one option per line)</span></label>
                        <textarea id="options" name="options" class="form-control" rows="5"
                                  placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"><?php echo isset($question) ? htmlspecialchars($question->options) : ''; ?></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="answer">Answer</label>
                        <input type="text" id="answer" name="answer" class="form-control"
                               value="<?php echo isset($question) ? htmlspecialchars($question->answer) : ''; ?>"
                               placeholder="e.g. Option B">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="explanation">Explanation</label>
                        <textarea id="explanation" name="explanation" class="form-control" rows="3"
                                  placeholder="Optional explanation shown after answering"><?php echo isset($question) ? htmlspecialchars($question->explanation) : ''; ?></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="status">Status</label>
                        <select id="status" name="status" class="form-control form-select">
                            <?php $current_status = isset($question) ? $question->status : 'draft'; ?>
                            <?php foreach ($statuses as $st): ?>
                                <option value="<?php echo $st; ?>" <?php echo ($current_status === $st) ? 'selected' : ''; ?>>
                                    <?php echo ucfirst($st); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div style="display:flex;gap:10px">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="check"></i> <?php echo isset($question) ? 'Update' : 'Create'; ?>
                        </button>
                        <a href="<?php echo site_url('questions'); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>

<style>
@media (max-width: 600px) {
    .question-form-grid { grid-template-columns: 1fr !important; }
}
</style>
