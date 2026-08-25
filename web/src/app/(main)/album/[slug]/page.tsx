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
  const a = album.artists?.primary?.[0] || album.artists?.all?.[0];
  return { name: a?.name || 'Various Artists', id: a?.id };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const album = await getAlbum(params.slug);
  if (!album) return { title: 'Album not found' };
  const cover = pickImage(album.image);
  const artist = albumArtist(album).name;
  const title = `${album.name} by ${artist}`;
  const description = `Listen to the album ${album.name} by ${artist}${
    album.year ? ` (${album.year})` : ''
  } on ${SITE.name}. ${album.songCount ?? album.songs?.length ?? ''} songs.`.trim();
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
  const totalSecs = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

  const albumLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: album.name,
    byArtist: { '@type': 'MusicGroup', name: artist.name },
    numTracks: songs.length,
    ...(album.year ? { datePublished: String(album.year) } : {}),
    image: cover,
    url: `${SITE.url}${entityHref('album', album.name, album.id)}`,
    track: songs.slice(0, 50).map((s, i) => ({
      '@type': 'MusicRecording',
      position: i + 1,
      name: s.name,
      url: `${SITE.url}${entityHref('song', s.name, s.id)}`,
    })),
  };

  return (
    <div className="flex flex-col gap-10 px-4 py-6 sm:px-6">
      <JsonLd data={albumLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: album.name, path: entityHref('album', album.name, album.id) },
        ])}
      />

      <DetailHeader
        cover={cover}
        eyebrow="Album"
        title={album.name}
        description={album.description}
        meta={
          <span>
            {artist.id ? (
              <Link href={entityHref('artist', artist.name, artist.id)} className="font-semibold text-white hover:underline">
                {artist.name}
              </Link>
            ) : (
              <span className="font-semibold text-white">{artist.name}</span>
            )}
            {album.year ? ` · ${album.year}` : ''}
            {songs.length ? ` · ${songs.length} songs` : ''}
            {totalSecs ? ` · ${formatDuration(totalSecs)}` : ''}
          </span>
        }
        actions={<CollectionActions songs={songs} />}
      />

      {songs.length ? (
        <TrackList songs={songs} showArt={false} showAlbum={false} />
      ) : (
        <p className="text-sm text-text-secondary">This album has no playable tracks.</p>
      )}
    </div>
  );
}
