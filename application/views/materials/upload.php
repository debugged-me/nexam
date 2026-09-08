<div class="page-content">
    <div class="form-container">

        <div class="page-header">
            <div>
                <h1>Upload Material</h1>
                <p class="page-sub">Add instructional content for AI-assisted question generation.</p>
            </div>
        </div>

        <div class="card">
            <div class="card-body">
                <form action="<?php echo site_url('materials/upload'); ?>" method="post" enctype="multipart/form-data" data-dirty-guard>
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <?php if (validation_errors()): ?>
                        <div class="form-alert" role="alert"><i data-lucide="circle-alert"></i><div><strong>Please review the form.</strong><span><?php echo htmlspecialchars(trim(validation_errors(' ', ' ')), ENT_QUOTES, 'UTF-8'); ?></span></div></div>
                    <?php endif; ?>

                    <div class="form-group">
                        <label class="form-label" for="subject_id">Subject <span class="req">*</span></label>
                        <select id="subject_id" name="subject_id" class="form-control" required>
                            <option value="">Select a subject…</option>
                            <?php foreach ($subjects as $s): ?>
                                <option value="<?php echo htmlspecialchars($s->id, ENT_QUOTES, 'UTF-8'); ?>"
                                    <?php echo set_select('subject_id', $s->id, $preselect_subject === $s->id); ?>>
                                    <?php echo htmlspecialchars($s->name, ENT_QUOTES, 'UTF-8'); ?>
                                    <?php echo $s->code ? ' (' . htmlspecialchars($s->code, ENT_QUOTES, 'UTF-8') . ')' : ''; ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="title">Title</label>
                        <input type="text" id="title" name="title" class="form-control" maxlength="255"
                               value="<?php echo htmlspecialchars(set_value('title'), ENT_QUOTES, 'UTF-8'); ?>"
                               placeholder="e.g. Chapter 3 Lecture Slides" autocomplete="off">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Source Type</label>
                        <div class="source-tabs" role="tablist">
                            <button type="button" class="source-tab is-active" data-source="file" role="tab" aria-selected="true">
                                <i data-lucide="upload"></i> File
                            </button>
                            <button type="button" class="source-tab" data-source="url" role="tab" aria-selected="false">
                                <i data-lucide="link"></i> URL
                            </button>
                            <button type="button" class="source-tab" data-source="youtube" role="tab" aria-selected="false">
                                <i data-lucide="youtube"></i> YouTube
                            </button>
                            <button type="button" class="source-tab" data-source="text" role="tab" aria-selected="false">
                                <i data-lucide="text"></i> Text
                            </button>
                        </div>
                    </div>

                    <div class="source-panel" data-source-panel="file">
                        <div class="form-group">
                            <label class="form-label" for="file">File <span class="req">*</span></label>
                            <div class="file-drop" id="file-drop">
                                <input type="file" id="file" name="file" accept=".pdf,.docx,.pptx,.txt" hidden>
                                <div class="file-drop-prompt">
                                    <i data-lucide="upload-cloud"></i>
                                    <p>Drag a file here or <span class="link">browse</span></p>
                                    <span class="text-muted">PDF, DOCX, PPTX, TXT — up to 50 MB</span>
                                </div>
                                <div class="file-drop-selected" hidden>
                                    <i data-lucide="file-text"></i>
                                    <span class="file-name"></span>
                                    <span class="file-size text-muted"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="source-panel" data-source-panel="url" hidden>
                        <div class="form-group">
                            <label class="form-label" for="url">Website URL <span class="req">*</span></label>
                            <input type="url" id="url" name="url" class="form-control"
                                   value="<?php echo htmlspecialchars(set_value('url'), ENT_QUOTES, 'UTF-8'); ?>"
                                   placeholder="https://example.com/article" autocomplete="off">
                            <small class="form-hint">Best with standard, text-based educational pages.</small>
                        </div>
                    </div>

                    <div class="source-panel" data-source-panel="youtube" hidden>
                        <div class="form-group">
                            <label class="form-label" for="youtube_url">YouTube URL <span class="req">*</span></label>
                            <input type="url" id="youtube_url" name="url" class="form-control"
                                   value="<?php echo htmlspecialchars(set_value('url'), ENT_QUOTES, 'UTF-8'); ?>"
                                   placeholder="https://www.youtube.com/watch?v=…" autocomplete="off">
                            <small class="form-hint">Requires captions or auto-generated transcripts.</small>
                        </div>
                    </div>

                    <div class="source-panel" data-source-panel="text" hidden>
                        <div class="form-group">
                            <label class="form-label" for="content">Text Content <span class="req">*</span></label>
                            <textarea id="content" name="content" class="form-control" rows="8"
                                      placeholder="Paste instructional text here…"><?php echo htmlspecialchars(set_value('content'), ENT_QUOTES, 'UTF-8'); ?></textarea>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-check">
                            <input type="checkbox" name="is_syllabus" value="1">
                            <span>This is a <strong>syllabus</strong> — use it to auto-generate a TOS blueprint</span>
                        </label>
                    </div>

                    <div class="form-actions form-actions--sticky">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="upload"></i> Upload & Process
                        </button>
                        <a href="<?php echo site_url('materials'); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
