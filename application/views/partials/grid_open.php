<?php
/**
 * Opening half of a data grid: card, toolbar, selection bar, scroll container.
 * Pair with partials/grid_close.php. Configured through $grid:
 *
 *   key         string  storage key + csv filename (e.g. 'subjects')
 *   label       string  plural noun used in counts and confirmations
 *   placeholder string  search input placeholder
 *   facets      array   [['name'=>'Status','column'=>4,'options'=>[v=>label],'selected'=>'']]
 *   bulk_url    string  POST target for bulk delete; omit to disable selection
 */
$grid = isset($grid) ? $grid : [];
$g_key         = isset($grid['key']) ? $grid['key'] : 'grid';
$g_label       = isset($grid['label']) ? $grid['label'] : 'records';
$g_placeholder = isset($grid['placeholder']) ? $grid['placeholder'] : 'Search…';
$g_facets      = isset($grid['facets']) ? $grid['facets'] : [];
$g_bulk        = isset($grid['bulk_url']) ? $grid['bulk_url'] : '';
?>
<section class="dataset" data-dataset data-density="comfortable" data-selecting="false">

    <div class="dataset-bar">
        <div class="dataset-bar-lead">
            <label class="ds-search" for="<?php echo $g_key; ?>-search">
                <i data-lucide="search"></i>
                <span class="sr-only">Search <?php echo htmlspecialchars($g_label); ?></span>
                <input id="<?php echo $g_key; ?>-search" type="search" autocomplete="off"
                       placeholder="<?php echo htmlspecialchars($g_placeholder); ?>"
                       data-grid-search>
                <kbd aria-hidden="true">/</kbd>
            </label>

            <?php if (!empty($g_facets)): ?>
                <button type="button" class="ds-btn ds-filter-btn" data-grid-filter-trigger>
                    <i data-lucide="filter"></i> Filters
                    <span class="ds-filter-badge" data-grid-filter-count hidden>0</span>
                </button>
                <script type="application/json" data-grid-facets><?php
                    echo json_encode($g_facets, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
                ?></script>
            <?php endif; ?>
        </div>

        <div class="dataset-bar-trail">
            <?php if ($g_bulk !== ''): ?>
                <button type="button" class="ds-btn" data-grid-select-toggle aria-pressed="false">
                    <i data-lucide="check-square"></i> Select
                </button>
            <?php endif; ?>
            <div class="ds-menu" data-grid-view>
                <button type="button" class="ds-btn" aria-expanded="false" aria-haspopup="true"
                        data-grid-view-trigger>
                    <i data-lucide="settings-2"></i> Options
                </button>
                <div class="ds-menu-panel" role="group" aria-label="Table options" hidden data-grid-view-panel></div>
            </div>
        </div>
    </div>

    <?php if ($g_bulk !== ''): ?>
        <div class="dataset-select-bar" hidden data-grid-selection>
            <span class="ds-select-count" data-selection-count aria-live="polite">0 selected</span>
            <form class="ds-select-bar-form" method="post" action="<?php echo $g_bulk; ?>" data-selection-form>
                <input type="hidden" name="<?php echo $csrf_name; ?>" value="<?php echo $csrf_hash; ?>">
                <button type="button" class="ds-btn is-danger" data-selection-delete>
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </form>
            <button type="button" class="ds-btn" data-selection-clear>Clear</button>
        </div>
    <?php endif; ?>

    <div class="dataset-scroll">
