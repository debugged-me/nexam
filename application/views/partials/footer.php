    </main><!-- /.main-content -->

    <script src="<?php echo nexam_asset('assets/js/toast.js'); ?>"></script>
    <script src="<?php echo nexam_asset('assets/js/modal.js'); ?>"></script>
    <?php if (!empty($use_datatables)): ?>
        <script src="<?php echo nexam_asset('assets/vendor/jquery/jquery-3.7.1.min.js'); ?>"></script>
        <script src="<?php echo nexam_asset('assets/libs/datatables/jquery.dataTables-1.13.11.min.js'); ?>"></script>
        <script src="<?php echo nexam_asset('assets/libs/datatables/dataTables.bootstrap4-1.13.11.min.js'); ?>"></script>
        <script src="<?php echo nexam_asset('assets/js/datatables.js'); ?>"></script>
    <?php endif; ?>

    <script src="<?php echo nexam_asset('assets/js/app-shell.js'); ?>"></script>

    <?php if (!empty($page_js)): ?>
        <?php foreach ((array) $page_js as $js): ?>
            <script src="<?php echo nexam_asset('assets/js/' . $js); ?>"></script>
        <?php endforeach; ?>
    <?php endif; ?>

    <?php $toast = $this->session->flashdata('toast'); ?>
    <?php if ($toast): ?>
        <div id="nexam-flash-toast" hidden
             data-message="<?php echo htmlspecialchars($toast['message'], ENT_QUOTES, 'UTF-8'); ?>"
             data-type="<?php echo htmlspecialchars($toast['type'], ENT_QUOTES, 'UTF-8'); ?>"></div>
    <?php endif; ?>
</body>
</html>
