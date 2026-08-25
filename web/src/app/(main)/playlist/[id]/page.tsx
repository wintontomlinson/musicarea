import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { Playlist } from '@/lib/types';
import { formatCount, formatDuration, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const revalidate = 600;

async function getPlaylist(id: string): Promise<Playlist | null> {
  try {
    const pl = await api.playlist(id, 100);
    return pl?.id ? pl : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const pl = await getPlaylist(params.id);
  if (!pl) return { title: 'Playlist not found' };
  const cover = pickImage(pl.image);
  const description =
    pl.description ||
    `Listen to the playlist ${pl.name} on ${SITE.name}. ${pl.songCount ?? pl.songs?.length ?? ''} songs.`.trim();
  return {
    title: pl.name,
    description,
    alternates: { canonical: `/playlist/${pl.id}` },
    openGraph: {
      type: 'music.playlist',
      title: pl.name,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: pl.name }],
    },
    twitter: { card: 'summary_large_image', title: pl.name, description, images: [cover] },
  };
}

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const pl = await getPlaylist(params.id);
  if (!pl) notFound();

  const cover = pickImage(pl.image);
  const songs = pl.songs ?? [];
  const totalSecs = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="flex flex-col gap-10 px-4 py-6 sm:px-6">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MusicPlaylist',
          name: pl.name,
          numTracks: songs.length,
          image: cover,
          url: `${SITE.url}/playlist/${pl.id}`,
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: pl.name, path: `/playlist/${pl.id}` },
        ])}
      />

      <DetailHeader
        cover={cover}
        eyebrow="Playlist"
        title={pl.name}
        description={pl.description}
        meta={
          <span>
            {songs.length ? `${songs.length} songs` : ''}
            {totalSecs ? ` · ${formatDuration(totalSecs)}` : ''}
            {pl.followerCount ? ` · ${formatCount(pl.followerCount)} followers` : ''}
          </span>
        }
        actions={<CollectionActions songs={songs} />}
      />

      {songs.length ? (
        <TrackList songs={songs} />
      ) : (
        <p className="text-sm text-text-secondary">This playlist has no playable tracks.</p>
      )}
    </div>
  );
}
