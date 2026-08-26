import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Album } from '@/lib/types';
import { entityHref, formatDuration, idFromSlug, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { CollectionMenu } from '@/components/collections/CollectionMenu';
import { CollectionFavoriteButton } from '@/components/library/FavoriteButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const revalidate = 600;

async function getAlbum(slug: string): Promise<Album | null> {
  try {
    const album = await api.album(idFromSlug(slug));
    return album?.id ? album : null;
  } catch {
    return null;
  }
}

function albumArtist(album: Album): { name: string; id?: string } {
  const credit = album.artists?.primary?.[0] || album.artists?.all?.[0];
  return { name: credit?.name || 'Various Artists', id: credit?.id };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const album = await getAlbum(params.slug);
  if (!album) return { title: 'Album not found' };

  const cover = pickImage(album.image);
  const artist = albumArtist(album).name;
  const title = `${album.name} by ${artist}`;
  const description = `Listen to the album ${album.name} by ${artist}${
    album.year ? ` (${album.year})` : ''
  } on ${SITE.name}.`;

  return {
    title,
    description,
    alternates: { canonical: entityHref('album', album.name, album.id) },
    openGraph: {
      type: 'music.album',
      title,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: album.name }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [cover] },
  };
}

export default async function AlbumPage({ params }: { params: { slug: string } }) {
  const album = await getAlbum(params.slug);
  if (!album) notFound();

  const cover = pickImage(album.image);
  const artist = albumArtist(album);
  const songs = album.songs ?? [];
  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
  const href = entityHref('album', album.name, album.id);

  const albumLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: album.name,
    byArtist: { '@type': 'MusicGroup', name: artist.name },
    numTracks: songs.length,
    ...(album.year ? { datePublished: String(album.year) } : {}),
    image: cover,
    url: `${SITE.url}${href}`,
    track: songs.slice(0, 50).map((song, index) => ({
      '@type': 'MusicRecording',
      position: index + 1,
      name: song.name,
      url: `${SITE.url}${entityHref('song', song.name, song.id)}`,
    })),
  };

  return (
    <div className="page page-stack">
      <JsonLd data={albumLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: album.name, path: href },
        ])}
      />

      <DetailHeader
        cover={cover}
        kind="Album"
        title={album.name}
        description={album.description}
        byline={
          artist.id ? (
            <Link
              href={entityHref('artist', artist.name, artist.id)}
              className="transition-colors duration-fast hover:underline"
            >
              {artist.name}
            </Link>
          ) : (
            artist.name
          )
        }
        meta={
          [
            album.year ? String(album.year) : null,
            songs.length ? `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}` : null,
            totalSeconds ? formatDuration(totalSeconds) : null,
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        actions={
          <CollectionActions songs={songs}>
            <CollectionFavoriteButton
              card={{ id: album.id, name: album.name, type: 'album', image: album.image }}
              label="album"
            />
            <CollectionMenu title={album.name} path={href} songs={songs} />
          </CollectionActions>
        }
      />

      {songs.length ? (
        <TrackList songs={songs} showArt={false} showAlbum={false} />
      ) : (
        <EmptyState
          compact
          title="No playable tracks"
          message="This album has no streamable songs in the catalogue right now."
        />
      )}
    </div>
  );
}
