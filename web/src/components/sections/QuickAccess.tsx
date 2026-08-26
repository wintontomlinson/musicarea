'use client';

import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui/Icon';

interface Tile {
  href: string;
  label: string;
  icon: IconName;
  hint: string;
}

const TILES: Tile[] = [
  { href: '/liked', label: 'Liked Songs', icon: 'heart', hint: 'Everything you saved' },
  { href: '/history', label: 'Recently Played', icon: 'clock', hint: 'Pick up where you left off' },
  { href: '/playlists', label: 'Your Playlists', icon: 'playlist', hint: 'Built by you' },
  { href: '/charts', label: 'Charts', icon: 'chart', hint: 'What is big right now' },
];

/**
 * Compact entry points to the destinations people return to most. Wide, low
 * rows rather than square cards, so this block reads as navigation and does not
 * compete with the artwork shelves below it.
 */
export function QuickAccess() {
  return (
    <section aria-label="Quick access">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group flex items-center gap-3 rounded border border-subtle bg-surface px-3 py-3 transition-colors duration-fast hover:border-strong hover:bg-surface-raised"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-white/5 text-text-secondary transition-colors duration-fast group-hover:text-accent">
              <Icon name={tile.icon} size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-body font-semibold">{tile.label}</span>
              <span className="mt-0.5 block truncate text-micro text-text-muted">{tile.hint}</span>
            </span>
            <Icon
              name="chevronRight"
              size={15}
              className="ml-auto shrink-0 text-text-muted transition-transform duration-fast group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
