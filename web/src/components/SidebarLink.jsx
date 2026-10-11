import { useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Link } from 'react-router-dom';

/**
 * SidebarLink — nav item whose label pops out as a tooltip while the rail is
 * collapsed. Radix handles positioning, collision and focus; `compact` gates
 * visibility so expanded/medium layouts never show it.
 */
export default function SidebarLink({ compact, label, children, onClick, ...props }) {
  const [open, setOpen] = useState(false);

  // Collapse only exists on the desktop rail — keep the same ≥992px gate the
  // old hand-rolled tooltip used so a narrow window can't trigger labels.
  function handleOpenChange(next) {
    setOpen(next && compact && window.matchMedia('(min-width: 992px)').matches);
  }

  return (
    <Tooltip.Root open={open} onOpenChange={handleOpenChange} delayDuration={150}>
      <Tooltip.Trigger asChild>
        <Link
          {...props}
          aria-label={label}
          onClick={(e) => { setOpen(false); onClick?.(e); }}
        >
          {children}
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="sidebar-tooltip"
          side="right"
          sideOffset={8}
          collisionPadding={8}
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
