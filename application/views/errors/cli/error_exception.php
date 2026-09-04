<?php defined('BASEPATH') OR exit('No direct script access allowed'); ?>
EXCEPTION: <?php echo $exception->getMessage(); ?> in <?php echo $exception->getFile(); ?> line <?php echo $exception->getLine(); ?>
<?php echo $exception->getTraceAsString(); ?>
