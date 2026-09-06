<div class="page-content">
    <div class="form-container form-container--wide">

        <div class="page-header">
            <div><h1><?php echo isset($question) ? 'Edit Question' : 'New Question'; ?></h1><p class="page-sub"><?php echo isset($question) ? 'Update this item.' : 'Write the stem, options and answer, then tag it so you can find it later.'; ?></p></div>
        </div>

        <div class="card">
            <div class="card-body">
                <form action="" method="post" id="question-form" data-dirty-guard>
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <?php if (validation_errors()): ?>
                        <div class="form-alert" role="alert"><i data-lucide="circle-alert"></i><div><strong>Please review the question.</strong><span><?php echo htmlspecialchars(trim(validation_errors(' ', ' ')), ENT_QUOTES, 'UTF-8'); ?></span></div></div>
                    <?php endif; ?>

                    <div class="form-section">
                        <div class="form-section-title">Classification</div>
                        <div class="form-group">
                            <label class="form-label" for="subject_id">Subject <span class="req">*</span></label>
                            <select id="subject_id" name="subject_id" class="form-control form-select" required>
                                <option value="" disabled>Select a subject…</option>
                                <?php foreach ($subjects as $s): ?>
                                    <?php
                                    $selected = false;
                                    $posted_subject = set_value('subject_id');
                                    if ($posted_subject !== '') {
                                        $selected = ($posted_subject === $s->id);
                                    } elseif (isset($question)) {
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

                        <div class="question-form-grid">
                            <div class="form-group">
                                <label class="form-label" for="type">Question Type <span class="req">*</span></label>
                                <select id="type" name="type" class="form-control form-select" required>
                                    <?php
                                    $type_labels = [
                                        'mcq'           => 'Multiple Choice',
                                        'true_false'    => 'True / False',
                                        'identification'=> 'Identification',
                                        'essay'         => 'Essay',
                                    ];
                                    $current_type = set_value('type', isset($question) ? $question->type : 'mcq');
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
                                    <?php $current_bloom = set_value('bloom', isset($question) ? $question->bloom : ''); ?>
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
                                   value="<?php echo htmlspecialchars(set_value('topic', isset($question) ? $question->topic : ''), ENT_QUOTES, 'UTF-8'); ?>"
                                   placeholder="e.g. Quadratic Equations">
                        </div>
                    </div>

                    <div class="form-section">
                        <div class="form-section-title">Content</div>
                        <div class="form-group">
                            <label class="form-label" for="stem">Question Stem <span class="req">*</span></label>
                            <textarea id="stem" name="stem" class="form-control" rows="3" required
                                      placeholder="Enter the question text…"><?php echo htmlspecialchars(set_value('stem', isset($question) ? $question->stem : ''), ENT_QUOTES, 'UTF-8'); ?></textarea>
                        </div>

                        <div class="form-group" id="options-group">
                            <label class="form-label" for="options">Answer Options <span class="form-hint-inline">(choose the correct option)</span></label>
                            <textarea id="options" name="options" class="form-control" rows="5"
                                      placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"><?php echo htmlspecialchars(set_value('options', isset($question) ? $question->options : ''), ENT_QUOTES, 'UTF-8'); ?></textarea>
                        </div>

                        <div class="form-group" id="answer-group">
                            <label class="form-label" for="answer">Answer</label>
                            <input type="text" id="answer" name="answer" class="form-control"
                                   maxlength="10000"
                                   value="<?php echo htmlspecialchars(set_value('answer', isset($question) ? $question->answer : ''), ENT_QUOTES, 'UTF-8'); ?>"
                                   placeholder="Enter the expected answer">
                            <select id="true-false-answer" class="form-control form-select" hidden aria-label="True or false answer">
                                <option value="">Select an answer…</option>
                                <option value="True">True</option>
                                <option value="False">False</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="explanation">Explanation</label>
                            <textarea id="explanation" name="explanation" class="form-control" rows="3" maxlength="10000"
                                      placeholder="Optional explanation shown after answering"><?php echo htmlspecialchars(set_value('explanation', isset($question) ? $question->explanation : ''), ENT_QUOTES, 'UTF-8'); ?></textarea>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="status">Status</label>
                            <select id="status" name="status" class="form-control form-select">
                                <?php $current_status = set_value('status', isset($question) ? $question->status : 'draft'); ?>
                                <?php foreach ($statuses as $st): ?>
                                    <option value="<?php echo $st; ?>" <?php echo ($current_status === $st) ? 'selected' : ''; ?>>
                                        <?php echo ucfirst($st); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="form-actions form-actions--sticky">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="check"></i> <?php echo isset($question) ? 'Save Changes' : 'Create Question'; ?>
                        </button>
                        <?php $return_subject = isset($question) ? $question->subject_id : (!empty($preselect_subject) ? $preselect_subject : null); ?>
                        <a href="<?php echo site_url('questions' . ($return_subject ? '?subject_id=' . rawurlencode($return_subject) : '')); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
