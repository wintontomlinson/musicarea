'use client';

/**
 * Web Audio plumbing for the frequency visualizer.
 *
 * This is the one feature in the player that can break playback outright if it is
 * done carelessly, so the guard rails matter more than the graph.
 *
 * A `MediaElementAudioSourceNode` routes an element's audio *through* the graph.
 * If the media is cross-origin and the element has no `crossOrigin` attribute,
 * the resource is treated as tainted and the node outputs **silence**: the track
 * appears to play with no sound. Setting `crossOrigin = 'anonymous'` fixes that,
 * but only when the server actually answers with the matching CORS header. If it
 * does not, the element now fails to load the audio **at all**.
 *
 * So both paths are dangerous without knowing what the CDN does, and there is no
 * way to undo either after the fact. The origin is therefore probed once, before
 * any element is pointed at a stream, and the analyser is attached only when the
 * answer is yes. When it is no, the visualizer is unavailable and says so; audio
 * is never put at risk to draw a picture.
 */

/** Number of bars the UI draws, downsampled from the FFT bins. */
export const VISUALIZER_BARS = 32;

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let frequencyBuffer: Uint8Array | null = null;

/** Per-origin CORS verdict. All streams come from one CDN, so one probe covers them. */
const corsByOrigin = new Map<string, Promise<boolean>>();

/**
 * Elements already wired into the graph. An element can only ever have one
 * `MediaElementAudioSourceNode`; creating a second throws, and there are two
 * decks being recycled, so attachment has to be idempotent per element.
 */
const attached = new WeakSet<HTMLMediaElement>();

/** True once an attach has succeeded, so the UI knows there is data to read. */
let live = false;

export function isVisualizerLive(): boolean {
  return live;
}

/**
 * Ask whether the origin serving this URL allows cross-origin reads.
 *
 * Only the response headers are needed, so the body is abandoned as soon as they
 * arrive. A plain `GET` is used rather than a `Range` request because `Range` is
 * not a CORS-safelisted header and would trigger a preflight, which can fail on a
 * CDN whose simple requests are perfectly fine.
 */
export function supportsCors(url: string): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return Promise.resolve(false);
  }

  const cached = corsByOrigin.get(origin);
  if (cached) return cached;

  const probe = (async () => {
    const controller = new AbortController();
    try {
      const res = await fetch(url, { mode: 'cors', signal: controller.signal });
      // Headers are in; the audio itself is not wanted here.
      controller.abort();
      return res.type === 'cors' || res.ok;
    } catch {
      // A CORS failure surfaces as a TypeError, indistinguishable from offline.
      // Either way the honest answer is "cannot attach safely".
      return false;
    }
  })();

  corsByOrigin.set(origin, probe);
  return probe;
}

function ensureContext(): AudioContext | null {
  if (context) return context;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
    analyser = context.createAnalyser();
    // 256 bins is more resolution than 32 bars need, but it keeps the low end
    // from being lumped into one bar.
    analyser.fftSize = 256;
    // Without smoothing the bars strobe; this is the usual compromise.
    analyser.smoothingTimeConstant = 0.8;
    frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
    analyser.connect(context.destination);
    return context;
  } catch {
    context = null;
    analyser = null;
    return null;
  }
}

/**
 * Route a media element through the analyser.
 *
 * The caller must have confirmed CORS support and set `crossOrigin` on the
 * element *before* its source was assigned. Returns false if the graph could not
 * be built, in which case the element is left entirely alone and plays normally.
 */
export function attachElement(element: HTMLMediaElement): boolean {
  if (attached.has(element)) return true;
  const ctx = ensureContext();
  if (!ctx || !analyser) return false;
  try {
    const source = ctx.createMediaElementSource(element);
    // Connecting to the analyser alone would leave nothing reaching the speakers:
    // once an element is in the graph, the graph owns its output.
    source.connect(analyser);
    attached.add(element);
    live = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Resume the context. Browsers start it suspended until a user gesture, and
 * playback is one, so this is called when a deck starts.
 */
export function resumeContext(): void {
  if (context?.state === 'suspended') void context.resume().catch(() => {});
}

/**
 * Current spectrum, downsampled to `VISUALIZER_BARS` values in 0..1.
 * Returns null when nothing is attached, so the UI can stay honest about it.
 */
export function readSpectrum(): number[] | null {
  if (!analyser || !frequencyBuffer || !live) return null;
  // Cast: the DOM types are generic over the buffer, and this one is a plain
  // Uint8Array backed by an ArrayBuffer, which is what the API wants.
  analyser.getByteFrequencyData(frequencyBuffer as Uint8Array<ArrayBuffer>);

  const bins = frequencyBuffer.length;
  // The top of the spectrum is mostly empty on lossy audio, so the upper bins are
  // skipped rather than drawn as permanently flat bars.
  const usable = Math.floor(bins * 0.7);
  const perBar = Math.max(1, Math.floor(usable / VISUALIZER_BARS));
  const out: number[] = [];
  for (let i = 0; i < VISUALIZER_BARS; i++) {
    let sum = 0;
    const start = i * perBar;
    for (let j = 0; j < perBar; j++) sum += frequencyBuffer[start + j] ?? 0;
    out.push(sum / perBar / 255);
  }
  return out;
}
