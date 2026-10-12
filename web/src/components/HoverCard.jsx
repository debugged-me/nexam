/**
 * HoverCard — rich preview shown while a pointer rests on (or keyboard focus
 * lands on) its trigger. A desktop enhancement only: anything inside must
 * also be reachable another way, since touch screens never show it.
 *
 *   <HoverCard trigger={<Link to="…">CS-101</Link>}>…breakdown…</HoverCard>
 */
import * as RadixHoverCard from '@radix-ui/react-hover-card';
import ScopedLayer from './ScopedLayer.jsx';

export default function HoverCard({
  trigger, children, side = 'bottom', align = 'start', className = '', openDelay = 350,
}) {
  return (
    <RadixHoverCard.Root openDelay={openDelay} closeDelay={120}>
      <RadixHoverCard.Trigger asChild>{trigger}</RadixHoverCard.Trigger>
      <RadixHoverCard.Portal>
        <ScopedLayer>
          <RadixHoverCard.Content
            className={`nx-pop nx-hovercard${className ? ` ${className}` : ''}`}
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
          >
            {children}
          </RadixHoverCard.Content>
        </ScopedLayer>
      </RadixHoverCard.Portal>
    </RadixHoverCard.Root>
  );
}
