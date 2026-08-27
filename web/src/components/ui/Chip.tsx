import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';

interface CommonProps {
  active?: boolean;
  icon?: IconName;
  className?: string;
  children: React.ReactNode;
  /**
   * Overrides the chip's tint when active. Moods carry a hue from the catalogue,
   * and using it makes the row read as a palette of moods rather than as six
   * identical accent-coloured pills.
   */
  activeStyle?: React.CSSProperties;
}

type ChipProps = CommonProps &
  (
    | { href: string; onClick?: never; pressed?: never }
    | { href?: never; onClick: () => void; pressed?: boolean }
  );

/**
 * Pill-shaped filter control. Used for moods on Home and trending queries on
 * Search.
 *
 * Renders as a link when given `href` and as a button otherwise. That distinction
 * is not cosmetic: a mood that navigates to its own page must be a link so it can
 * be opened in a new tab and crawled, while a mood that filters the current page
 * in place must be a button, because nothing about the document changes.
 *
 * The press feedback is a CSS `active:` scale rather than a Framer `whileTap`. A
 * chip is a single small element with no gesture state worth tracking, and keeping
 * it free of motion components means a row of twenty chips stays twenty plain DOM
 * nodes. It also lets this stay a server component, which matters because the
 * chips on Search and Explore are rendered on the server.
 */
export function Chip({ active, icon, className = '', children, activeStyle, ...rest }: ChipProps) {
  const classes = `chip active:scale-[0.96] ${active ? 'chip-active' : ''} ${className}`;
  const body = (
    <>
      {icon && <Icon name={icon} size={15} className="shrink-0" />}
      {children}
    </>
  );

  if (rest.href !== undefined) {
    return (
      <Link href={rest.href} className={classes} style={active ? activeStyle : undefined}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={rest.onClick}
      aria-pressed={rest.pressed ?? active}
      className={classes}
      style={active ? activeStyle : undefined}
    >
      {body}
    </button>
  );
}
