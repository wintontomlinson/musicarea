import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { loadEntity } from '@/lib/entity';
import type { Song } from '@/lib/types';
import { EntityUnavailable, unavailableMetadata } from '@/components/ui/EntityUnavailable';
import { artistLine, entityHref, idFromSlug, pickImage, pickStream, primaryArtist } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { PlayPill } from '@/components/player/PlayPill';
import { StationButton } from '@/components/player/StationButton';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const revalidate = 600;

function getSong(slug: string) {
  return loadEntity(
    async () => (await api.song(idFromSlug(slug)))[0] ?? null,
    (song): song is Song => !!song?.id,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const result = await getSong((await params).slug);
  if (result.status === 'unavailable') return unavailableMetadata('song');
  if (result.status === 'missing') return { title: 'Song not found', robots: { index: false } };
  const song = result.data;
  const cover = pickImage(song.image);
  const artist = artistLine(song);
  const title = `${song.name} by ${artist}`;
  const description = `Listen to ${song.name} by ${artist}${
    song.album?.name ? ` from the album ${song.album.name}` : ''
  } on ${SITE.name}.`;
  const audio = pickStream(song)?.url;
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

export default async function SongPage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await getSong((await params).slug);
  if (result.status === 'unavailable') return <EntityUnavailable kind="song" />;
  if (result.status === 'missing') notFound();
  const song = result.data;

  const cover = pickImage(song.image);
  const artist = primaryArtist(song);

  // Both sections are best-effort and hidden on failure, and they are fetched
  // together rather than in sequence so one slow response does not delay the
  // other. "More like this" is the recommender ranking the catalogue against this
  // track; "More by" is just the artist's own back catalogue.
  const [similarRes, artistSongsRes] = await Promise.allSettled([
    api.similar([song.id], 12),
    artist?.id ? api.artistSongs(artist.id) : Promise.resolve({ songs: [] as Song[] }),
  ]);

  const similar: Song[] =
    similarRes.status === 'fulfilled'
      ? (similarRes.value.items ?? []).filter((s) => s.id !== song.id).slice(0, 10)
      : [];

  const moreFromArtist: Song[] =
    artistSongsRes.status === 'fulfilled'
      ? artistSongsRes.value.songs
          .filter((s) => s.id !== song.id && !similar.some((x) => x.id === s.id))
          .slice(0, 10)
      : [];

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
        actions={
          <span className="flex flex-wrap items-center gap-3">
            <PlayPill song={song} />
            <StationButton kind="song" id={song.id} label="Song radio" />
          </span>
        }
      />

      {similar.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="section-title">More like this</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              Ranked against this track by the recommender, not just by artist.
            </p>
          </div>
          <TrackList songs={similar} />
        </section>
      )}

      {moreFromArtist.length > 0 && (
        <section>
          <h2 className="mb-3 section-title">More by {artist?.name}</h2>
          <TrackList songs={moreFromArtist} />
        </section>
      )}
    </div>
  );
}
