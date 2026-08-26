import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Artist, CollectionCard } from '@/lib/types';
import { entityHref, formatCount, idFromSlug, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { TrackList } from '@/components/sections/TrackList';
import { Carousel } from '@/components/sections/Carousel';
import { CollectionActions } from '@/components/player/CollectionActions';
import { CollectionMenu } from '@/components/collections/CollectionMenu';
import { CollectionFavoriteButton } from '@/components/library/FavoriteButton';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const revalidate = 600;

async function getArtist(slug: string): Promise<Artist | null> {
  try {
    const artist = await api.artist(idFromSlug(slug));
    return artist?.id ? artist : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const artist = await getArtist(params.slug);
  if (!artist) return { title: 'Artist not found' };

  const cover = pickImage(artist.image, '500x500');
  const followers = artist.followerCount ? `${formatCount(artist.followerCount)} followers. ` : '';
  const description = `${artist.name} on ${SITE.name}. ${followers}Top songs, albums and singles.`;

  return {
    title: artist.name,
    description,
    alternates: { canonical: entityHref('artist', artist.name, artist.id) },
    openGraph: {
      type: 'profile',
      title: artist.name,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: artist.name }],
    },
    twitter: { card: 'summary_large_image', title: artist.name, description, images: [cover] },
  };
}

export default async function ArtistPage({ params }: { params: { slug: string } }) {
  const artist = await getArtist(params.slug);
  if (!artist) notFound();

  const cover = pickImage(artist.image, '500x500');
  const href = entityHref('artist', artist.name, artist.id);
  const topSongs = artist.topSongs ?? [];
  const albums = artist.topAlbums ?? [];
  const singles = artist.singles ?? [];
  const related = Array.isArray(artist.similarArtists) ? artist.similarArtists : [];

  const withType = (card: CollectionCard): CollectionCard => ({
    ...card,
    type: card.type || 'album',
  });

  return (
    <div className="flex flex-col gap-11 pb-4">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: artist.name,
          image: cover,
          url: `${SITE.url}${href}`,
          ...(artist.followerCount
            ? {
                interactionStatistic: {
                  '@type': 'InteractionCounter',
                  interactionType: 'https://schema.org/FollowAction',
                  userInteractionCount: artist.followerCount,
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: artist.name, path: href },
        ])}
      />

      {/* Full-bleed banner. The image runs under the transparent header. */}
      <header className="relative -mt-14 flex min-h-[300px] items-end overflow-hidden sm:min-h-[380px]">
        <Image src={cover} alt="" fill priority sizes="100vw" className="object-cover" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/70 to-[#080808]/25"
        />

        <div className="page relative flex w-full flex-col gap-4 pb-8 pt-20">
          <div className="flex items-center gap-2">
            <p className="t-micro">Artist</p>
            {artist.isVerified && (
              <span className="text-micro font-semibold uppercase tracking-[0.09em] text-accent">
                Verified
              </span>
            )}
          </div>

          <h1 className="text-title font-bold tracking-[-0.03em] sm:text-[48px] sm:leading-[1.02]">
            {artist.name}
          </h1>

          {artist.followerCount ? (
            <p className="t-meta">{formatCount(artist.followerCount)} followers</p>
          ) : null}

          {topSongs.length > 0 && (
            <div className="mt-1">
              <CollectionActions songs={topSongs}>
                <CollectionFavoriteButton
                  card={{ id: artist.id, name: artist.name, type: 'artist', image: artist.image }}
                  label="artist"
                />
                <CollectionMenu title={artist.name} path={href} songs={topSongs} />
              </CollectionActions>
            </div>
          )}
        </div>
      </header>

      <div className="page flex flex-col gap-11">
        {topSongs.length > 0 && (
          <section aria-labelledby="artist-popular">
            <h2 id="artist-popular" className="mb-4 text-section">
              Popular
            </h2>
            <TrackList songs={topSongs.slice(0, 10)} />
          </section>
        )}

        {albums.length > 0 && (
          <Carousel
            row={{
              id: 'artist-albums',
              title: 'Albums',
              kind: 'albums',
              items: albums.map(withType),
            }}
          />
        )}

        {singles.length > 0 && (
          <Carousel
            row={{
              id: 'artist-singles',
              title: 'Singles and EPs',
              kind: 'albums',
              items: singles.map(withType),
            }}
          />
        )}

        {related.length > 0 && (
          <section aria-labelledby="artist-related">
            <h2 id="artist-related" className="mb-4 text-section">
              Related artists
            </h2>
            <div className="bleed-row no-scrollbar pb-1">
              {related.map((entry) => (
                <Link
                  key={entry.id}
                  href={entityHref('artist', entry.name, entry.id)}
                  className="group w-[112px] shrink-0 snap-start text-center sm:w-[124px]"
                >
                  <span className="relative mx-auto block aspect-square overflow-hidden rounded-full border border-subtle bg-surface-raised shadow-art">
                    <Image
                      src={pickImage(entry.image, '150x150')}
                      alt=""
                      fill
                      sizes="124px"
                      className="object-cover transition-transform duration-base ease-out group-hover:scale-[1.04]"
                    />
                  </span>
                  <span className="mt-3 block truncate text-body font-medium group-hover:underline">
                    {entry.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
