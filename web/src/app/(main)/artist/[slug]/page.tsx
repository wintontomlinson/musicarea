import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import type { Artist, CollectionCard } from '@/lib/types';
import { entityHref, formatCount, idFromSlug, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { Carousel } from '@/components/sections/Carousel';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';
import { Icon } from '@/components/ui/Icon';

export const revalidate = 600;

async function getArtist(slug: string): Promise<Artist | null> {
  try {
    const artist = await api.artist(idFromSlug(slug));
    return artist?.id ? artist : null;
  } catch {
    return null;
  }
}

function bioText(bio: Artist['bio']): string | undefined {
  if (!bio) return undefined;
  if (typeof bio === 'string') return bio;
  return bio.map((b) => b.text).filter(Boolean).join(' ');
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const artist = await getArtist(params.slug);
  if (!artist) return { title: 'Artist not found' };
  const cover = pickImage(artist.image, '500x500');
  const title = artist.name;
  const listeners = artist.followerCount ? `${formatCount(artist.followerCount)} followers. ` : '';
  const description = `${title} on ${SITE.name}. ${listeners}Listen to top songs, albums and singles.`;
  return {
    title,
    description,
    alternates: { canonical: entityHref('artist', artist.name, artist.id) },
    openGraph: {
      type: 'profile',
      title,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: artist.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [cover] },
  };
}

export default async function ArtistPage({ params }: { params: { slug: string } }) {
  const artist = await getArtist(params.slug);
  if (!artist) notFound();

  const cover = pickImage(artist.image, '500x500');
  const topSongs = artist.topSongs ?? [];
  const albums = artist.topAlbums ?? [];
  const singles = artist.singles ?? [];
  const related = Array.isArray(artist.similarArtists) ? artist.similarArtists : [];

  const groupLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    image: cover,
    url: `${SITE.url}${entityHref('artist', artist.name, artist.id)}`,
    ...(artist.followerCount ? { interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/FollowAction',
      userInteractionCount: artist.followerCount,
    } } : {}),
  };

  const toCard = (c: CollectionCard, type: 'album' | 'playlist' = 'album'): CollectionCard => ({
    ...c,
    type: c.type || type,
  });

  return (
    <div className="flex flex-col gap-8 pb-7">
      <JsonLd data={groupLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: artist.name, path: entityHref('artist', artist.name, artist.id) },
        ])}
      />

      {/* Full-bleed banner */}
      <header className="relative flex min-h-[260px] items-end overflow-hidden border-b border-subtle sm:min-h-[340px]">
        <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative flex flex-col gap-3 p-6 sm:p-10">
          {artist.isVerified && (
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
              <Icon name="heart" size={14} /> Verified Artist
            </span>
          )}
          <h1 className="text-h1 font-extrabold tracking-tight sm:text-[64px]">{artist.name}</h1>
          {artist.followerCount ? (
            <p className="text-sm text-text-secondary">
              {formatCount(artist.followerCount)} followers
            </p>
          ) : null}
          {topSongs.length > 0 && (
            <div className="mt-2">
              <CollectionActions songs={topSongs} />
            </div>
          )}
        </div>
      </header>

      <div className="app-page pt-0">
        {topSongs.length > 0 && (
          <section>
            <h2 className="mb-3 section-title">Popular</h2>
            <TrackList songs={topSongs.slice(0, 10)} />
          </section>
        )}

        {albums.length > 0 && (
          <Carousel row={{ id: 'albums', title: 'Albums', kind: 'albums', items: albums.map((a) => toCard(a)) }} />
        )}

        {singles.length > 0 && (
          <Carousel
            row={{ id: 'singles', title: 'Singles & EPs', kind: 'albums', items: singles.map((a) => toCard(a)) }}
          />
        )}

        {related.length > 0 && (
          <section>
            <h2 className="mb-3 section-title">Related Artists</h2>
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
              {related.map((r) => (
                <Link key={r.id} href={entityHref('artist', r.name, r.id)} className="w-32 shrink-0 text-center">
                  <span className="relative mx-auto mb-2 block h-28 w-28 overflow-hidden rounded-full">
                    <Image src={pickImage(r.image, '150x150')} alt="" fill sizes="112px" className="object-cover" />
                  </span>
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
