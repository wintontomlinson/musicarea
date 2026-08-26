import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Song } from '@/lib/types';
import {
  artistLine,
  entityHref,
  formatDuration,
  idFromSlug,
  pickImage,
  pickStreamUrl,
  primaryArtist,
} from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { PlayPill } from '@/components/player/PlayPill';
import { SongMenu } from '@/components/tracks/SongMenu';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const revalidate = 600;

async function getSong(slug: string): Promise<Song | null> {
  try {
    const songs = await api.song(idFromSlug(slug));
    return songs[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const song = await getSong(params.slug);
  if (!song) return { title: 'Song not found' };

  const cover = pickImage(song.image);
  const artist = artistLine(song);
  const title = `${song.name} by ${artist}`;
  const description = `Listen to ${song.name} by ${artist}${
    song.album?.name ? ` from ${song.album.name}` : ''
  } on ${SITE.name}.`;
  const audio = pickStreamUrl(song);

  return {
    title,
    description,
    alternates: { canonical: entityHref('song', song.name, song.id) },
    openGraph: {
      type: 'music.song',
      title,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: song.name }],
      ...(audio ? { audio: [{ url: audio }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [cover] },
  };
}

export default async function SongPage({ params }: { params: { slug: string } }) {
  const song = await getSong(params.slug);
  if (!song) notFound();

  const cover = pickImage(song.image);
  const artist = primaryArtist(song);
  const href = entityHref('song', song.name, song.id);

  // Best effort: more from the same artist. Hidden entirely when unavailable.
  let alsoBy: Song[] = [];
  if (artist?.id) {
    try {
      const result = await api.artistSongs(artist.id);
      alsoBy = result.songs.filter((entry) => entry.id !== song.id).slice(0, 8);
    } catch {
      alsoBy = [];
    }
  }

  return (
    <div className="page page-stack">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MusicRecording',
          name: song.name,
          byArtist: { '@type': 'MusicGroup', name: artistLine(song) },
          ...(song.album?.name
            ? { inAlbum: { '@type': 'MusicAlbum', name: song.album.name } }
            : {}),
          ...(song.duration
            ? { duration: `PT${Math.floor(song.duration / 60)}M${song.duration % 60}S` }
            : {}),
          image: cover,
          url: `${SITE.url}${href}`,
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: song.name, path: href },
        ])}
      />

      <DetailHeader
        cover={cover}
        kind="Song"
        title={song.name}
        byline={
          artist?.id ? (
            <Link
              href={entityHref('artist', artist.name, artist.id)}
              className="transition-colors duration-fast hover:underline"
            >
              {artistLine(song)}
            </Link>
          ) : (
            artistLine(song)
          )
        }
        meta={
          <>
            {song.album?.name && song.album.id ? (
              <Link
                href={entityHref('album', song.album.name, song.album.id)}
                className="transition-colors duration-fast hover:text-text hover:underline"
              >
                {song.album.name}
              </Link>
            ) : (
              song.album?.name
            )}
            {song.year ? ` · ${song.year}` : ''}
            {song.duration ? ` · ${formatDuration(song.duration)}` : ''}
          </>
        }
        actions={
          <>
            <PlayPill song={song} />
            <SongMenu song={song} />
          </>
        }
      />

      {alsoBy.length > 0 && (
        <section aria-labelledby="also-by">
          <h2 id="also-by" className="mb-4 text-section">
            More by {artist?.name}
          </h2>
          <TrackList songs={alsoBy} />
        </section>
      )}
    </div>
  );
}
