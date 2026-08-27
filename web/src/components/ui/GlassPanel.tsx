import type { ElementType, ReactNode } from 'react';

interface GlassPanelProps {
  /**
   * `page` tints toward the surface colour, for panels over the page background.
   * `overlay` tints toward the scrim and blurs harder, for panels over artwork,
   * where a lighter tint stops holding the text up.
   */
  tone?: 'page' | 'overlay';
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Frosted glass surface.
 *
 * The blur itself lives in `globals.css` rather than in Tailwind utilities here,
 * because the `overlay` tone needs an `@supports` fallback that raises its opacity
 * where `backdrop-filter` is unavailable. A utility-only version would leave text
 * sitting on a barely-tinted photograph in those browsers, which is a legibility
 * failure rather than a cosmetic one.
 */
export function GlassPanel({ tone = 'page', as, className = '', children }: GlassPanelProps) {
  const Tag = as ?? 'div';
  return (
    <Tag className={`${tone === 'overlay' ? 'glass-overlay' : 'glass-panel'} ${className}`}>
      {children}
    </Tag>
  );
}
