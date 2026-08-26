'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLibrary, type CollectionRef } from '@/stores/library';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Icon } from '@/components/ui/Icon';
import { entityHref, pickImage } from '@/lib/utils';
import { notify } from '@/stores/toast';

/**
 * Grid of saved albums or artists. Artist artwork is circular, album artwork
 * square, which is the fastest way to tell the two apart at a glance.
 */
export function SavedCollectionsView({
  type,
  title,
  emptyMessage,
}: {
  type: CollectionRef['type'];
  title: string;
  emptyMessage: string;
}) {
  const hydrated = useLibrary((s) => s.hydrated);
  const items = useLibrary((s) => s.collections.filter((entry) => entry.type === type));
  const toggle = useLibrary((s) => s.toggleFavoriteCollection);

  const circular = type === 'artist';

  return (
    <div className="page page-stack">
      <header>
        <p className="t-micro">Your collection</p>
        <h1 className="mt-2 t-display">{title}</h1>
        {hydrated && items.length > 0 && (
          <p className="mt-2.5 t-meta">
            {items.length} saved on this device
          </p>
        )}
      </header>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((entry) => (
            <div key={entry.id} className="group relative">
              <Link
                href={
                  entry.type === 'playlist'
                    ? `/playlist/${entry.id}`
                    : entityHref(entry.type, entry.name, entry.id)
                }
                className="block"
              >
                <span
                  className={`relative mb-3 block aspect-square overflow-hidden bg-surface-raised shadow-art ${
                    circular ? 'rounded-full' : 'rounded'
                  }`}
                >
                  <Image
                    src={pickImage(entry.image)}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 45vw, 200px"
                    className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.03]"
                  />
                </span>
                <p
                  className={`truncate text-body font-semibold group-hover:underline ${
                    circular ? 'text-center' : ''
                  }`}
                >
                  {entry.name}
                </p>
                {entry.subtitle && (
                  <p
                    className={`mt-1 truncate text-meta text-text-secondary ${
                      circular ? 'text-center' : ''
                    }`}
                  >
                    {entry.subtitle}
                  </p>
                )}
              </Link>

              <button
                type="button"
                aria-label={`Remove ${entry.name}`}
                onClick={() => {
                  toggle(entry);
                  notify(`Removed ${entry.name}`);
                }}
                className="btn-icon absolute right-1 top-1 bg-black/60 opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={type === 'artist' ? 'user' : 'disc'}
          title={`No saved ${title.toLowerCase()}`}
          message={emptyMessage}
          ctaHref="/explore"
          ctaLabel="Browse catalogue"
        />
      )}
    </div>
  );
}
