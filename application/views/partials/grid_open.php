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

            <?php foreach ($g_facets as $facet): ?>
                <div class="ds-facet" data-active="<?php echo !empty($facet['selected']) ? 'true' : 'false'; ?>">
                    <select data-grid-facet="<?php echo (int) $facet['column']; ?>"
                            aria-label="Filter by <?php echo htmlspecialchars(strtolower($facet['name'])); ?>">
                        <option value="">All <?php echo htmlspecialchars(strtolower($facet['name'])); ?></option>
                        <?php foreach ($facet['options'] as $value => $text): ?>
                            <option value="<?php echo htmlspecialchars($value); ?>"
                                <?php echo (isset($facet['selected']) && (string) $facet['selected'] === (string) $value) ? 'selected' : ''; ?>>
                                <?php echo htmlspecialchars($text); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <i data-lucide="chevron-down"></i>
                </div>
            <?php endforeach; ?>
        </div>

        <div class="dataset-bar-trail">
            <div class="ds-menu" data-grid-view>
                <button type="button" class="ds-btn" aria-expanded="false" aria-haspopup="true"
                        data-grid-view-trigger>
                    <i data-lucide="settings-2"></i> View
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
