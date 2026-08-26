import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { loadEntity } from '@/lib/entity';
import type { Album } from '@/lib/types';
import { EntityUnavailable, unavailableMetadata } from '@/components/ui/EntityUnavailable';
import { entityHref, formatDuration, idFromSlug, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';
import { ThemeCover } from '@/components/theme/ThemeCover';

export const revalidate = 600;

function getAlbum(slug: string) {
  return loadEntity(
    () => api.album(idFromSlug(slug)),
    (album): album is Album => !!album?.id,
  );
}

function albumArtist(album: Album): { name: string; id?: string } {
  const a = album.artists?.primary?.[0] || album.artists?.all?.[0];
  return { name: a?.name || 'Various Artists', id: a?.id };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const result = await getAlbum((await params).slug);
  if (result.status === 'unavailable') return unavailableMetadata('album');
  if (result.status === 'missing') return { title: 'Album not found', robots: { index: false } };
  const album = result.data;
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

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await getAlbum((await params).slug);
  if (result.status === 'unavailable') return <EntityUnavailable kind="album" />;
  if (result.status === 'missing') notFound();
  const album = result.data;

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
    <div className="app-page">
      {/* Colour the whole site from this sleeve while the page is open. */}
      <ThemeCover cover={cover} />
      <JsonLd data={albumLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: album.name, path: entityHref('album', album.name, album.id) },
        ])}
      />

      <DetailHeader
        cover={cover}
        title={album.name}
        description={album.description}
        eyebrow={
          artist.id ? (
            <Link href={entityHref('artist', artist.name, artist.id)} className="hover:underline">
              {artist.name}
            </Link>
          ) : (
            artist.name
          )
        }
        meta={
          <span>
            Album
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
        <p className="text-[13px] text-text-secondary">This album has no playable tracks.</p>
      )}
    </div>
  );
}
