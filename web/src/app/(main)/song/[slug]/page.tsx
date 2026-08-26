import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Song } from '@/lib/types';
import { artistLine, entityHref, idFromSlug, pickImage, pickStreamUrl, primaryArtist } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { PlayPill } from '@/components/player/PlayPill';
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

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const song = await getSong(params.slug);
  if (!song) return { title: 'Song not found' };
  const cover = pickImage(song.image);
  const artist = artistLine(song);
  const title = `${song.name} by ${artist}`;
  const description = `Listen to ${song.name} by ${artist}${
    song.album?.name ? ` from the album ${song.album.name}` : ''
  } on ${SITE.name}.`;
  const audio = pickStreamUrl(song);
  return {
    title,
    description,
    keywords: [song.name, artist, song.language || '', song.album?.name || '', 'song', 'lyrics']
      .filter(Boolean)
      .join(', '),
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

  // More from the primary artist (best-effort; hidden on failure).
  let moreFromArtist: Song[] = [];
  if (artist?.id) {
    try {
      const res = await api.artistSongs(artist.id);
      moreFromArtist = res.songs.filter((s) => s.id !== song.id).slice(0, 10);
    } catch {
      moreFromArtist = [];
    }
  }

  const recordingLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.name,
    byArtist: { '@type': 'MusicGroup', name: artistLine(song) },
    ...(song.album?.name ? { inAlbum: { '@type': 'MusicAlbum', name: song.album.name } } : {}),
    ...(song.duration ? { duration: `PT${Math.floor(song.duration / 60)}M${song.duration % 60}S` } : {}),
    image: cover,
    url: `${SITE.url}${entityHref('song', song.name, song.id)}`,
  };

  return (
    <div className="app-page">
      <JsonLd data={recordingLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Search', path: '/search' },
          { name: song.name, path: entityHref('song', song.name, song.id) },
        ])}
      />

      <DetailHeader
        cover={cover}
        title={song.name}
        eyebrow={
          artist?.id ? (
            <Link href={entityHref('artist', artist.name, artist.id)} className="hover:underline">
              {artistLine(song)}
            </Link>
          ) : (
            artistLine(song)
          )
        }
        meta={
          <span>
            Song
            {song.album?.name && song.album.id && (
              <>
                {' · '}
                <Link href={entityHref('album', song.album.name, song.album.id)} className="hover:text-white">
                  {song.album.name}
                </Link>
              </>
            )}
            {song.year ? ` · ${song.year}` : ''}
          </span>
        }
        actions={<PlayPill song={song} />}
      />

      {moreFromArtist.length > 0 && (
        <section>
          <h2 className="mb-3 section-title">More by {artist?.name}</h2>
          <TrackList songs={moreFromArtist} />
        </section>
      )}
    </div>
  );
}
