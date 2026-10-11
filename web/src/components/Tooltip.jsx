/**
 * Tooltip — thin wrapper over Radix's unstyled primitive.
 * Requires a <Tooltip.Provider> ancestor (mounted in AppLayout).
 * Renders children untouched when `label` is empty so callers can gate
 * tips on content without breaking layout.
 */
import * as RadixTooltip from '@radix-ui/react-tooltip';

export default function Tooltip({ label, side = 'top', sideOffset = 6, delayDuration, children }) {
  if (!label) return children;
  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="nx-tip"
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
