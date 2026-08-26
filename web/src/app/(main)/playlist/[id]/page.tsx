import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { loadEntity } from '@/lib/entity';
import type { Playlist } from '@/lib/types';
import { EntityUnavailable, unavailableMetadata } from '@/components/ui/EntityUnavailable';
import { entityHref, formatCount, formatDuration, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';
import { ThemeCover } from '@/components/theme/ThemeCover';

export const revalidate = 600;

function getPlaylist(id: string) {
  return loadEntity(
    () => api.playlist(id, 100),
    (pl): pl is Playlist => !!pl?.id,
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const result = await getPlaylist((await params).id);
  if (result.status === 'unavailable') return unavailableMetadata('playlist');
  if (result.status === 'missing') return { title: 'Playlist not found', robots: { index: false } };
  const pl = result.data;
  const cover = pickImage(pl.image);
  const description =
    pl.description ||
    `Listen to the playlist ${pl.name} on ${SITE.name}. ${pl.songCount ?? pl.songs?.length ?? ''} songs.`.trim();
  return {
    title: pl.name,
    description,
    alternates: { canonical: entityHref('playlist', pl.name, pl.id) },
    openGraph: {
      type: 'music.playlist',
      title: pl.name,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: pl.name }],
    },
    twitter: { card: 'summary_large_image', title: pl.name, description, images: [cover] },
  };
}

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const result = await getPlaylist((await params).id);
  if (result.status === 'unavailable') return <EntityUnavailable kind="playlist" />;
  if (result.status === 'missing') notFound();
  const pl = result.data;

  const cover = pickImage(pl.image);
  const songs = pl.songs ?? [];
  const totalSecs = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="app-page">
      <ThemeCover cover={cover} />
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
          { name: pl.name, path: entityHref('playlist', pl.name, pl.id) },
        ])}
      />

      <DetailHeader
        cover={cover}
        eyebrow={SITE.name}
        title={pl.name}
        description={pl.description}
        meta={
          <span>
            Playlist
            {songs.length ? ` · ${songs.length} songs` : ''}
            {totalSecs ? ` · ${formatDuration(totalSecs)}` : ''}
            {pl.followerCount ? ` · ${formatCount(pl.followerCount)} followers` : ''}
          </span>
        }
        actions={<CollectionActions songs={songs} />}
      />

      {songs.length ? (
        <TrackList songs={songs} />
      ) : (
        <p className="text-[13px] text-text-secondary">This playlist has no playable tracks.</p>
      )}
    </div>
  );
}
