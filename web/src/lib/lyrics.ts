import { decodeEntities } from '@/lib/utils';

/**
 * Lyrics parsing.
 *
 * Two formats arrive here, from two different places.
 *
 * LRCLIB returns LRC, a plain-text format where each line is prefixed with one or more
 * `[mm:ss.xx]` cues. That is the only source of *timed* lyrics available to this app.
 *
 * The catalogue's own endpoint returns an HTML fragment with `<br>` separators and no
 * timings at all. It covers far more of the Indian catalogue than LRCLIB does, so it is
 * the common case rather than the fallback, and the reading view built on it has to be
 * good in its own right rather than a consolation prize.
 */

export interface LyricLine {
  /** Seconds from the start of the track, or null for untimed lyrics. */
  time: number | null;
  /** Empty for an instrumental gap between timed cues. */
  text: string;
}

/** What a lyrics lookup resolved to. Distinct from the UI's loading/error states. */
export type Lyrics =
  | { kind: 'synced'; lines: LyricLine[]; source: 'lrclib'; copyright?: string }
  | { kind: 'static'; lines: LyricLine[]; source: 'lrclib' | 'catalogue'; copyright?: string }
  /** The track has been positively identified as having no vocals. */
  | { kind: 'instrumental' }
  | { kind: 'none' };

/**
 * A leading cue, e.g. `[01:23.45]`.
 *
 * Minutes allow three digits because tracks over an hour exist and some writers emit
 * `[103:20]` rather than rolling into hours. The fraction separator can be `.` or `:`,
 * both of which appear in the wild.
 */
const CUE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Metadata tags, which are not lyrics and must not be rendered.
 *
 * `offset` is deliberately in this list rather than being applied. It is meant to shift
 * every cue by some milliseconds, but implementations disagree on the sign, and getting
 * it backwards would desynchronise the whole track in the direction opposite to what the
 * file intended. LRCLIB almost never emits it, so ignoring it is both safer and cheaper
 * than guessing.
 */
const METADATA = /^\[(ar|ti|al|au|by|re|ve|length|offset|id|tool|encoder):/i;

/** Parse LRC into timed lines, sorted by cue time. */
export function parseLrc(raw: string): LyricLine[] {
  const out: LyricLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || METADATA.test(line)) continue;

    CUE.lastIndex = 0;
    const times: number[] = [];
    let consumed = 0;
    let match: RegExpExecArray | null;

    while ((match = CUE.exec(line)) !== null) {
      // Only cues at the very front of the line count. A bracketed aside inside the
      // lyric itself ("[chorus]" or a bracketed number) is text, not a timestamp, and
      // treating it as one would split the line and lose words.
      if (match.index !== consumed) break;
      consumed = match.index + match[0].length;

      const fraction = match[3] ?? '';
      out.push({
        // A fraction is scaled by its own length, so `.5` is half a second and `.05` is
        // a twentieth. Reading it as a fixed number of hundredths would put `[00:01.5]`
        // five hundredths in instead of five tenths.
        time:
          Number(match[1]) * 60 +
          Number(match[2]) +
          (fraction ? Number(fraction) / 10 ** fraction.length : 0),
        text: '',
      });
      times.push(out.length - 1);
    }

    if (!times.length) continue;

    // One line can carry several cues, for a refrain that repeats. Each cue becomes its
    // own entry with the same words.
    const text = line.slice(consumed).trim();
    for (const index of times) out[index].text = text;
  }

  // Cues for a repeated refrain are written at the first occurrence, so the file is not
  // necessarily in time order even though it looks like it is.
  out.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  return out;
}

/** Split untimed lyrics into lines, accepting either newlines or `<br>` tags. */
export function parsePlain(raw: string): LyricLine[] {
  return (
    decodeEntities(
      raw
        // `<br>`, `<br/>` and `<br />` all appear in catalogue responses.
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        // Any remaining markup is stripped rather than rendered. These strings are
        // injected as text, so a stray tag would show as literal source.
        .replace(/<[^>]*>/g, ''),
    )
      .split(/\n/)
      .map((line) => line.trim())
      // Runs of blank lines collapse to nothing. The source often double-spaces every
      // line, which would otherwise read as a verse break between each one.
      .filter((line, index, all) => line || (index > 0 && all[index - 1]))
      .map((text) => ({ time: null, text }))
  );
}

/**
 * Index of the line that should be highlighted at `time`, or -1 before the first cue.
 *
 * Binary search rather than a scan. This runs on every animation frame while the lyrics
 * pane is open, and a linear walk over a few hundred lines sixty times a second is
 * measurable work for an answer that is almost always adjacent to the last one.
 */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = lines[mid].time;
    if (cue === null || cue <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** True when a parsed set has usable words rather than only blank cues. */
export function hasWords(lines: LyricLine[]): boolean {
  return lines.some((line) => line.text.length > 0);
}
