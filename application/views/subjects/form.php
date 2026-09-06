<div class="page-content">
    <div class="form-container">

        <div class="page-header">
            <div><h1><?php echo isset($subject) ? 'Edit Subject' : 'New Subject'; ?></h1><p class="page-sub"><?php echo isset($subject) ? 'Update the course details.' : 'Add a course to group your questions, blueprints and exams.'; ?></p></div>
        </div>

        <div class="card">
            <div class="card-body">
                <form action="" method="post" data-dirty-guard>
                    <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                    <?php if (validation_errors()): ?>
                        <div class="form-alert" role="alert"><i data-lucide="circle-alert"></i><div><strong>Please review the form.</strong><span><?php echo htmlspecialchars(trim(validation_errors(' ', ' ')), ENT_QUOTES, 'UTF-8'); ?></span></div></div>
                    <?php endif; ?>

                    <div class="form-group">
                        <label class="form-label" for="name">Subject Name <span class="req">*</span></label>
                        <input type="text" id="name" name="name" class="form-control" required maxlength="255"
                               value="<?php echo htmlspecialchars(set_value('name', isset($subject) ? $subject->name : ''), ENT_QUOTES, 'UTF-8'); ?>" autocomplete="off" autofocus>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="code">Subject Code</label>
                        <input type="text" id="code" name="code" class="form-control" maxlength="50"
                               value="<?php echo htmlspecialchars(set_value('code', isset($subject) ? $subject->code : ''), ENT_QUOTES, 'UTF-8'); ?>"
                               placeholder="e.g. CS-101">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="description">Description</label>
                        <textarea id="description" name="description" class="form-control" rows="3" maxlength="5000"
                                  placeholder="Optional description"><?php echo htmlspecialchars(set_value('description', isset($subject) ? $subject->description : ''), ENT_QUOTES, 'UTF-8'); ?></textarea>
                    </div>

                    <div class="form-actions form-actions--sticky">
                        <button type="submit" class="btn btn-primary">
                            <i data-lucide="check"></i> <?php echo isset($subject) ? 'Save Changes' : 'Create Subject'; ?>
                        </button>
                        <a href="<?php echo site_url('subjects'); ?>" class="btn btn-outline">Cancel</a>
                    </div>
                </form>
            </div>
        </div>

    </div>
</div>
