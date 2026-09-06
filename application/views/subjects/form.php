<div class="page-content">
    <div class="form-container">

        <div class="page-header">
            <p class="page-sub"><?php echo isset($subject) ? 'Update the course details.' : 'Add a course to group your questions, blueprints and exams.'; ?></p>
            <a href="<?php echo site_url('subjects'); ?>" class="btn btn-outline btn-sm">
                <i data-lucide="arrow-left"></i> Back
            </a>
        </div>

        <div class="card">
            <div class="card-body">
                <form action="" method="post" autocomplete="off">
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">

                    <div class="form-group">
                        <label class="form-label" for="name">Subject Name <span class="req">*</span></label>
                        <input type="text" id="name" name="name" class="form-control" required maxlength="255"
                               value="<?php echo isset($subject) ? htmlspecialchars($subject->name) : ''; ?>" autofocus>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="code">Subject Code</label>
                        <input type="text" id="code" name="code" class="form-control" maxlength="50"
                               value="<?php echo isset($subject) ? htmlspecialchars($subject->code) : ''; ?>"
                               placeholder="e.g. CS-101">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="description">Description</label>
                        <textarea id="description" name="description" class="form-control" rows="3"
                                  placeholder="Optional description"><?php echo isset($subject) ? htmlspecialchars($subject->description) : ''; ?></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="check"></i> <?php echo isset($subject) ? 'Update' : 'Create'; ?>
                        </button>
                        <a href="<?php echo site_url('subjects'); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
