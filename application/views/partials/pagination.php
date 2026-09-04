<?php
/**
 * Pagination partial — shared by all list pages.
 *
 * Expects $pagination array from MY_Controller::paginate().
 * Only renders if there is more than one page.
 */
if (!isset($pagination) || $pagination['total_pages'] <= 1) return;
$p = $pagination;
?>
<div class="table-footer">
    <div class="pagination-info">
        Showing <?php echo number_format($p['from']); ?>–<?php echo number_format($p['to']); ?>
        of <?php echo number_format($p['total']); ?>
    </div>
    <div class="pagination-controls">
        <?php if ($p['has_prev']): ?>
            <a href="<?php echo htmlspecialchars($p['prev_url']); ?>" class="page-btn" rel="prev" aria-label="Previous page">
                <i data-lucide="chevron-left"></i>
            </a>
        <?php else: ?>
            <span class="page-btn disabled" aria-disabled="true"><i data-lucide="chevron-left"></i></span>
        <?php endif; ?>

        <?php if ($p['show_first']): ?>
            <a href="<?php echo htmlspecialchars($p['first_url']); ?>" class="page-btn">1</a>
            <?php if ($p['links'][0]['page'] > 2): ?>
                <span class="page-ellipsis">…</span>
            <?php endif; ?>
        <?php endif; ?>

        <?php foreach ($p['links'] as $link): ?>
            <?php if ($link['is_active']): ?>
                <span class="page-btn active" aria-current="page"><?php echo $link['page']; ?></span>
            <?php else: ?>
                <a href="<?php echo htmlspecialchars($link['url']); ?>" class="page-btn"><?php echo $link['page']; ?></a>
            <?php endif; ?>
        <?php endforeach; ?>

        <?php if ($p['show_last']): ?>
            <?php if (end($p['links'])['page'] < $p['total_pages'] - 1): ?>
                <span class="page-ellipsis">…</span>
            <?php endif; ?>
            <a href="<?php echo htmlspecialchars($p['last_url']); ?>" class="page-btn"><?php echo $p['total_pages']; ?></a>
        <?php endif; ?>

        <?php if ($p['has_next']): ?>
            <a href="<?php echo htmlspecialchars($p['next_url']); ?>" class="page-btn" rel="next" aria-label="Next page">
                <i data-lucide="chevron-right"></i>
            </a>
        <?php else: ?>
            <span class="page-btn disabled" aria-disabled="true"><i data-lucide="chevron-right"></i></span>
        <?php endif; ?>
    </div>
</div>
