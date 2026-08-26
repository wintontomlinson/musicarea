import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import type { Playlist } from '@/lib/types';
import { formatCount, formatDuration, pickImage } from '@/lib/utils';
import { SITE } from '@/lib/config';
import { DetailHeader } from '@/components/sections/DetailHeader';
import { TrackList } from '@/components/sections/TrackList';
import { CollectionActions } from '@/components/player/CollectionActions';
import { CollectionMenu } from '@/components/collections/CollectionMenu';
import { CollectionFavoriteButton } from '@/components/library/FavoriteButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd, breadcrumbLd } from '@/components/seo/JsonLd';

export const revalidate = 600;

async function getPlaylist(id: string): Promise<Playlist | null> {
  try {
    const playlist = await api.playlist(id, 100);
    return playlist?.id ? playlist : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const playlist = await getPlaylist(params.id);
  if (!playlist) return { title: 'Playlist not found' };

  const cover = pickImage(playlist.image);
  const count = playlist.songCount ?? playlist.songs?.length ?? 0;
  const description =
    playlist.description || `Listen to ${playlist.name} on ${SITE.name}. ${count} songs.`;

  return {
    title: playlist.name,
    description,
    alternates: { canonical: `/playlist/${playlist.id}` },
    openGraph: {
      type: 'music.playlist',
      title: playlist.name,
      description,
      images: [{ url: cover, width: 500, height: 500, alt: playlist.name }],
    },
    twitter: { card: 'summary_large_image', title: playlist.name, description, images: [cover] },
  };
}

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const playlist = await getPlaylist(params.id);
  if (!playlist) notFound();

  const cover = pickImage(playlist.image);
  const songs = playlist.songs ?? [];
  const totalSeconds = songs.reduce((sum, song) => sum + (song.duration || 0), 0);
  const href = `/playlist/${playlist.id}`;

  return (
    <div className="page page-stack">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'MusicPlaylist',
          name: playlist.name,
          numTracks: songs.length,
          image: cover,
          url: `${SITE.url}${href}`,
        }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: playlist.name, path: href },
        ])}
      />

      <DetailHeader
        cover={cover}
        kind="Playlist"
        title={playlist.name}
        description={playlist.description}
        meta={
          [
            songs.length ? `${songs.length} ${songs.length === 1 ? 'song' : 'songs'}` : null,
            totalSeconds ? formatDuration(totalSeconds) : null,
            playlist.followerCount ? `${formatCount(playlist.followerCount)} followers` : null,
          ]
            .filter(Boolean)
            .join(' · ') || null
        }
        actions={
          <CollectionActions songs={songs}>
            <CollectionFavoriteButton
              card={{ id: playlist.id, name: playlist.name, type: 'playlist', image: playlist.image }}
              label="playlist"
            />
            <CollectionMenu title={playlist.name} path={href} songs={songs} />
          </CollectionActions>
        }
      />

      {songs.length ? (
        <TrackList songs={songs} />
      ) : (
        <EmptyState
          compact
          title="No playable tracks"
          message="This playlist has no streamable songs in the catalogue right now."
        />
      )}
    </div>
  );
}
