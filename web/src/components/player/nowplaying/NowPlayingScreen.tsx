'use client';

import { useState } from 'react';
import { usePlayer } from '@/stores/player';
import { Sheet } from '@/components/ui/Sheet';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/ui/Icon';
import { TransportControls } from '@/components/player/PlayerControls';
import { SeekBar } from '@/components/player/SeekBar';
import { ArtBackdrop, ArtStage } from './ArtStage';
import { TrackMeta } from './TrackMeta';
import { ActionRow } from './ActionRow';
import { LyricsPane } from './LyricsPane';
import { UpNextPane } from './UpNextPane';

type Pane = 'lyrics' | 'queue';

const PANES = [
  { id: 'lyrics' as const, label: 'Lyrics' },
  { id: 'queue' as const, label: 'Up next' },
];

/**
 * The immersive Now Playing screen.
 *
 * Replaces the previous `FullPlayer`, which was a single `max-w-md` column: correct for a phone,
 * but on a 27-inch display it left the artwork small and centred in a sea of blurred background,
 * with the lyrics and queue reachable only as overlays stacked on top of it.
 *
 * So the layout is genuinely different per breakpoint rather than one design stretched:
 *
 * **Mobile** is a single scrolling column, artwork then metadata then transport, with lyrics and
 * queue reached by toggling the pane below. There is not enough width for two columns, and the
 * artwork is what the listener came for.
 *
 * **Desktop** is two columns: artwork and controls on the left, a persistent pane on the right
 * carrying lyrics or the queue. Both are visible at once, which is the whole advantage of the
 * larger screen and removes the overlay-on-overlay problem entirely.
 *
 * All the modal behaviour (scroll lock, Escape handling, drag-to-dismiss) comes from `Sheet`, so
 * this component only describes content.
 */
export function NowPlayingScreen() {
  const open = usePlayer((state) => state.fullscreen);
  const track = usePlayer((state) => state.currentTrack());
  const lyricsOpen = usePlayer((state) => state.lyricsOpen);
  const setFullscreen = usePlayer((state) => state.setFullscreen);
  const setLyricsOpen = usePlayer((state) => state.setLyricsOpen);

  /** The listener's own choice of pane, and whether they expanded it on mobile. */
  const [chosenPane, setChosenPane] = useState<Pane>('lyrics');
  const [expanded, setExpanded] = useState(false);

  /**
   * `lyricsOpen` in the store is a request from outside this component: the player bar's lyrics
   * button and the `l` shortcut both set it to open the player straight onto the words.
   *
   * It is *derived over* rather than copied into local state. Mirroring it with an effect would
   * mean setting three pieces of state synchronously inside that effect, which cascades a
   * render, and it would fight the listener's own choice on the frame between the two. Instead
   * the request simply wins while it is set, and is cleared by the interactions that supersede
   * it, both of which are event handlers where setting state is exactly right.
   */
  const pane: Pane = lyricsOpen ? 'lyrics' : chosenPane;
  const paneOpen = lyricsOpen || expanded;

  function selectPane(id: Pane) {
    setChosenPane(id);
    setExpanded(true);
    // Consumed here. Left set, every later open of the player would snap back to lyrics even
    // after the listener had switched to the queue.
    if (lyricsOpen) setLyricsOpen(false);
  }

  function close() {
    setFullscreen(false);
    if (lyricsOpen) setLyricsOpen(false);
  }

  // Nothing to show, and nothing to keep mounted: the lyrics fetch is driven by this tree, so
  // unmounting it also stops any in-flight request for a track that is no longer playing.
  if (!track) return null;

  // The lyrics pane is only constructed when its tab is selected, so selecting the queue instead
  // means no lyrics request is made at all. That is the gating: `active` then only has to check
  // that the player itself is open.
  const paneContent =
    pane === 'lyrics' ? <LyricsPane song={track} active={open} /> : <UpNextPane />;

  return (
    <Sheet
      open={open}
      onClose={close}
      label={`Now playing: ${track.name}`}
      placement="takeover"
      zClassName="z-50"
      backdrop={<ArtBackdrop song={track} />}
      className="relative h-full overflow-y-auto"
    >
      <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Close full screen player"
            onClick={close}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.08] text-white transition hover:bg-white/[0.16]"
          >
            <Icon name="collapse" size={22} />
          </button>

          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">
            <span className="neon-dot" />
            Now playing
          </span>

          {/* Balances the header. The close button is on the left, so without something of equal
              width on the right the label would not be centred. */}
          <span className="h-10 w-10" aria-hidden="true" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-10">
          {/* ---- Left: artwork, metadata, transport ---- */}
          <div className="flex flex-col items-center gap-6 lg:gap-7">
            <ArtStage song={track} />

            <div className="flex w-full max-w-[min(78vw,26rem)] flex-col gap-5 lg:max-w-[30rem]">
              <TrackMeta song={track} />
              <SeekBar showTimes size="full" />
              <TransportControls size="full" />
              <ActionRow song={track} />
            </div>
          </div>

          {/* ---- Right on desktop, below on mobile: lyrics or queue ---- */}
          <div className="flex min-h-0 flex-col lg:h-[70vh]">
            <div className="shrink-0 px-1 lg:px-0">
              <Tabs
                items={PANES}
                value={pane}
                onChange={selectPane}
                label="Now playing panels"
                variant="pill"
                className="w-full lg:w-auto"
              />
            </div>

            {/* On mobile the pane is collapsible, because the artwork and transport should own the
                first screenful rather than being pushed up by a lyrics sheet nobody opened. On
                desktop there is room for both, so it is always shown. */}
            <div
              className={`mt-3 min-h-0 flex-1 overflow-hidden rounded-card-lg ${
                paneOpen ? 'block' : 'hidden lg:block'
              }`}
            >
              {/*
                Touch events are stopped here so they never reach the sheet's drag handler.
                The lyrics and queue panes scroll independently, and the sheet starts a
                dismiss gesture whenever its own surface is at scroll top, which it always is
                while these panes hold the scroll. Without this, swiping down to read further
                into a verse would also drag the whole player off the screen.
              */}
              <div
                onTouchStart={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
                className="glass-overlay h-full min-h-[45vh] overflow-hidden rounded-card-lg lg:min-h-0"
              >
                {paneContent}
              </div>
            </div>

            {!paneOpen && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-pill border border-white/15 bg-white/[0.07] px-4 py-2.5 text-[13px] font-semibold text-white/80 transition hover:bg-white/[0.13] lg:hidden"
              >
                <Icon name="lyrics" size={16} />
                Show lyrics and queue
              </button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
