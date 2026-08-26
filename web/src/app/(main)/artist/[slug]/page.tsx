import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { loadEntity } from '@/lib/entity';
import type { Artist, CollectionCard } from '@/lib/types';
import { EntityUnavailable, unavailableMetadata } from '@/components/ui/EntityUnavailable';
import { entityHref, formatCount, idFromSlug, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { Carousel } from '@/components/sections/Carousel';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';
import { Icon } from '@/components/ui/Icon';

export const revalidate = 600;

function getArtist(slug: string) {
  return loadEntity(
    () => api.artist(idFromSlug(slug)),
    (artist): artist is Artist => !!artist?.id,
  );
}

/**
 * The bio arrives either as a plain string or as an array of sections, and is
 * often absent. Flattened to a single line and trimmed to a length a search
 * result will actually display.
 */
function bioText(bio: Artist['bio']): string | undefined {
  if (!bio) return undefined;
  const raw = typeof bio === 'string' ? bio : bio.map((b) => b.text).filter(Boolean).join(' ');
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const result = await getArtist((await params).slug);
  if (result.status === 'unavailable') return unavailableMetadata('artist');
  if (result.status === 'missing') return { title: 'Artist not found', robots: { index: false } };
  const artist = result.data;
  const cover = pickImage(artist.image, '500x500');
  const title = artist.name;
  const listeners = artist.followerCount ? `${formatCount(artist.followerCount)} followers. ` : '';
  // Prefer the catalogue's own biography: it describes the artist, where the
  // generic line only describes the page. Falls back when there is no bio.
  const description =
    bioText(artist.bio) ??
    `${title} on ${SITE.name}. ${listeners}Listen to top songs, albums and singles.`;
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

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await getArtist((await params).slug);
  if (result.status === 'unavailable') return <EntityUnavailable kind="artist" />;
  if (result.status === 'missing') notFound();
  const artist = result.data;

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
    <div className="flex flex-col gap-9 pb-8">
      <JsonLd data={groupLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: artist.name, path: entityHref('artist', artist.name, artist.id) },
        ])}
      />

      {/* Full-bleed banner, as Apple Music heads an artist page. */}
      <header className="relative flex min-h-[300px] items-end overflow-hidden sm:min-h-[400px]">
        <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
        <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 pb-7 sm:px-8 lg:px-10">
          {artist.isVerified && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-accent">
              <Icon name="heart" size={13} /> Verified Artist
            </span>
          )}
          <h1 className="text-h2 font-bold tracking-tight sm:text-[56px] sm:leading-[1.05]">
            {artist.name}
          </h1>
          {artist.followerCount ? (
            <p className="text-[13px] text-white/70">
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
                <Link key={r.id} href={entityHref('artist', r.name, r.id)} className="w-28 shrink-0 text-center">
                  <span className="relative mx-auto mb-2 block h-28 w-28 overflow-hidden rounded-full shadow-lift">
                    <Image src={pickImage(r.image, '150x150')} alt="" fill sizes="112px" className="object-cover" />
                  </span>
                  <span className="block truncate text-[14px] font-medium">{r.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
