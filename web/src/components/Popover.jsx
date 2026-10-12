/**
 * Popover — click-to-open floating panel over Radix's unstyled primitive.
 *
 *   <Popover trigger={<button type="button">Peek</button>} label="Draft preview">
 *     …panel content…
 *   </Popover>
 *
 * `trigger` must be a single element that accepts a ref (a button). The panel
 * is portaled through ScopedLayer so page-scoped styles still apply, flips
 * and clamps to stay on screen, and closes on Escape or an outside click.
 */
import * as RadixPopover from '@radix-ui/react-popover';
import ScopedLayer from './ScopedLayer.jsx';

export default function Popover({
  trigger, children, label, side = 'bottom', align = 'start', className = '', open, onOpenChange,
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <ScopedLayer>
          <RadixPopover.Content
            className={`nx-pop${className ? ` ${className}` : ''}`}
            side={side}
            align={align}
            sideOffset={6}
            collisionPadding={12}
            aria-label={label}
          >
            {children}
          </RadixPopover.Content>
        </ScopedLayer>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
