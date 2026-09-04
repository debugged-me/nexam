    </div><!-- /.main-content -->

    <script src="<?php echo base_url('assets/js/toast.js'); ?>"></script>
    <script src="<?php echo base_url('assets/js/modal.js'); ?>"></script>
    <script>lucide.createIcons();</script>
    <script src="<?php echo base_url('assets/js/app-shell.js'); ?>"></script>

    <?php if (!empty($page_js)): ?>
        <?php foreach ((array) $page_js as $js): ?>
            <script src="<?php echo base_url('assets/js/' . $js); ?>"></script>
        <?php endforeach; ?>
    <?php endif; ?>

    <?php $toast = $this->session->flashdata('toast'); ?>
    <?php if ($toast): ?>
    <script>
        document.addEventListener("DOMContentLoaded", function () {
            NexamToast.show("", <?php echo json_encode($toast['message']); ?>, <?php echo json_encode($toast['type']); ?>, 5000);
        });
    </script>
    <?php endif; ?>
</body>
</html>
