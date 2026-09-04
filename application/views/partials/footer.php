    </div><!-- /.main-content -->

    <script src="<?php echo base_url('assets/js/toast.js'); ?>"></script>
    <script src="<?php echo base_url('assets/js/modal.js'); ?>"></script>
    <script>lucide.createIcons();</script>

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
