/**
 * Artwork-driven theming.
 *
 * The whole visual system hangs off a handful of CSS custom properties declared
 * in `globals.css`. This module reads the dominant colours out of a cover image
 * and rewrites those properties, so the site takes on the colour of whatever
 * album, artist or track is in front of the listener.
 *
 * Two decisions are worth knowing about before changing anything here.
 *
 * 1. Every token is stored as bare `r g b` channels, not as a colour. That is
 *    what lets Tailwind keep its opacity modifiers working: the config declares
 *    `rgb(var(--accent-rgb) / <alpha-value>)`, so `bg-accent/25` still compiles.
 *
 * 2. The palette is not used raw. Sampled colours are pulled into a fixed range
 *    of saturation and lightness first, and the dark backgrounds are generated
 *    rather than sampled. Real cover art is far too varied to trust directly:
 *    without this a washed-out sleeve produces a muddy grey site and a neon one
 *    produces an unreadable page. Normalising means every album gets a palette
 *    of the same *character*, only in a different hue.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  /** 0..1, not degrees. */
  h: number;
  s: number;
  l: number;
}

/** The full set of colours the UI is built from. */
export interface Palette {
  /** Vivid primary. Buttons, active states, the start of the brand gradient. */
  accent: Rgb;
  /** A lighter primary, used for text and eyebrows where `accent` is too dark. */
  accentSoft: Rgb;
  /** Middle of the brand gradient. */
  accentMid: Rgb;
  /** Secondary hue. The end of the brand gradient and the highlight colour. */
  accentAlt: Rgb;
  /** Ink for content sitting *on* the accent. White or near-black, whichever the
   *  accent's luminance calls for. */
  onAccent: Rgb;
  bg: Rgb;
  surface: Rgb;
  surfaceRaised: Rgb;
  /** Near-black, for hero scrims that must not kill the artwork under them. */
  scrim: Rgb;
  text: Rgb;
  textSecondary: Rgb;
  textMuted: Rgb;
}

/**
 * The static brand palette, and the value every `:root` token starts at. Server
 * rendering and the first paint use these, so the adaptive palette is a fade
 * rather than a flash. Kept as literals rather than generated so the shipped
 * design is exactly reproducible.
 */
export const DEFAULT_PALETTE: Palette = {
  accent: { r: 255, g: 59, b: 191 },
  accentSoft: { r: 255, g: 120, b: 215 },
  accentMid: { r: 168, g: 85, b: 247 },
  accentAlt: { r: 77, g: 231, b: 255 },
  onAccent: { r: 255, g: 255, b: 255 },
  bg: { r: 9, g: 6, b: 19 },
  surface: { r: 21, g: 16, b: 38 },
  surfaceRaised: { r: 32, g: 24, b: 58 },
  scrim: { r: 8, g: 4, b: 17 },
  text: { r: 255, g: 250, b: 255 },
  textSecondary: { r: 184, g: 173, b: 210 },
  textMuted: { r: 120, g: 109, b: 150 },
};

/* -------------------------------------------------------------------------- */
/* Palette modes                                                              */
/* -------------------------------------------------------------------------- */

/**
 * How the neutral family (backgrounds, surfaces, body text) is produced.
 *
 * `tinted` is the original behaviour: every neutral is generated from the accent
 * hue at a fixed lightness, so a blue record gives a deep navy page. It is what
 * makes the site read as one colour rather than a collage.
 *
 * `neutral` pins the neutrals to a true OLED greyscale and lets only the accent
 * family move with the artwork. Blacker, more restrained, and it saves power on
 * OLED panels because `#0a0a0a` drives the subpixels far closer to off than a
 * tinted near-black does.
 */
export type NeutralMode = 'tinted' | 'neutral';

/**
 * Where the accent comes from.
 *
 * `adaptive` samples the artwork. `brand` holds the hand-made pink palette.
 * `green` and `red` pin the accent to a fixed brand colour, for listeners who
 * find a colour that moves per track distracting.
 */
export type AccentMode = 'adaptive' | 'brand' | 'green' | 'red';

/** Fixed accent choices. Reproduced exactly, not normalised: the whole point of
 *  choosing one is that it does not drift. Resolved through `paletteForMode`. */
const FIXED_ACCENTS: Record<'green' | 'red', Rgb> = {
  green: { r: 29, g: 185, b: 84 }, // #1DB954
  red: { r: 252, g: 60, b: 68 }, // #FC3C44
};

/**
 * The greyscale shell used by `neutral` mode.
 *
 * Text is pure white here rather than the accent-tinted near-white the tinted
 * shell uses, because a colour cast on white over a truly neutral background
 * reads as a mistake rather than as warmth.
 */
const NEUTRAL_SHELL = {
  bg: { r: 10, g: 10, b: 10 }, // #0a0a0a
  surface: { r: 17, g: 17, b: 17 }, // #111111
  surfaceRaised: { r: 26, g: 26, b: 26 }, // #1a1a1a
  scrim: { r: 5, g: 5, b: 5 },
  text: { r: 255, g: 255, b: 255 },
  textSecondary: { r: 160, g: 160, b: 160 }, // #a0a0a0
  textMuted: { r: 110, g: 110, b: 110 },
} as const;

export interface PaletteOptions {
  /** Defaults to `tinted`, which is the behaviour every existing caller had. */
  neutralMode?: NeutralMode;
}

/* -------------------------------------------------------------------------- */
/* Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/** Edge length the cover is downscaled to before sampling. 48x48 = 2304 pixels,
 *  which is plenty for a dominant hue and costs well under a millisecond. */
const SAMPLE_EDGE = 48;

/** Hue is voted on in 15-degree buckets. Narrow enough to separate a red sleeve
 *  from an orange one, wide enough that noise and JPEG artefacts still agree. */
const HUE_BUCKETS = 24;

/** A second hue has to sit at least this far from the first to count as its own
 *  colour rather than a shade of it. 0.1 of the wheel is 36 degrees. */
const MIN_HUE_SEPARATION = 0.1;

/**
 * How far the secondary hue is allowed to sit from the accent, in turns.
 *
 * The sampled distance is only used for its *direction*; the magnitude is capped
 * here. Without the cap a sleeve that is red with a mint detail produces a
 * gradient running red through yellow-green, because the shorter arc between two
 * near-opposite hues still crosses a third colour family. Holding the pair
 * inside 36 to 72 degrees keeps every gradient analogous, which is the thing
 * that reads as expensive: one colour with depth, not three colours fighting.
 *
 * The shipped brand gradient is deliberately wider than this (pink to cyan is
 * 132 degrees). It is a hand-made exception, which is why `DEFAULT_PALETTE` holds
 * literals instead of being generated.
 */
const MIN_ALT_ARC = 0.1;
const MAX_ALT_ARC = 0.2;

/** Direction and distance used when the artwork offers only one hue. Negative
 *  means the secondary sits behind the accent on the wheel, so a pink turns
 *  toward violet and a red toward magenta. */
const FALLBACK_ALT_ROTATION = -MAX_ALT_ARC;

/** Pixels this close to black or white say nothing about hue. */
const MIN_LIGHTNESS = 0.08;
const MAX_LIGHTNESS = 0.92;
/** Below this a pixel is grey, and its hue is numerical noise. */
const MIN_SATURATION = 0.12;

/**
 * Luminance bands, not lightness bands.
 *
 * This is the difference between a palette that works for every album and one
 * that only works for pink. HSL lightness is a geometric midpoint, not a
 * perceived one: `hsl(60 100% 55%)` is a near-white yellow and
 * `hsl(240 100% 55%)` is a near-black blue, so pinning lightness leaves contrast
 * swinging by more than 10x across the hue wheel. White text on a yellow accent
 * disappears; blue accent text on a blue-black page disappears. Each token is
 * therefore pulled until its *relative luminance* (the quantity WCAG contrast is
 * actually computed from) lands in a band, which makes contrast roughly
 * hue-invariant.
 *
 * The bands are centred on the hand-picked brand palette's own measurements, so
 * the shipped design sits inside them untouched:
 *   accent #ff3bbf .28 | soft #ff78d7 .40 | mid #a855f7 .22 | alt #4de7ff .66
 */
const ACCENT_LUMINANCE = [0.28, 0.55] as const;
const ACCENT_SOFT_LUMINANCE = [0.4, 0.75] as const;
const ACCENT_ALT_LUMINANCE = [0.34, 0.72] as const;

/**
 * Above this accent luminance, white text on the accent drops under 3:1 and the
 * ink has to flip dark. 0.30 is exactly that crossover, and it sits just above
 * the brand pink's 0.28, so the default palette keeps its white ink.
 */
const WHITE_INK_MAX_LUMINANCE = 0.3;

/**
 * The gradient's midpoint gets a band chosen by the ink rather than a fixed one.
 * Text on a `bg-brand` pill sits across the middle of the gradient, not just on
 * the accent, so whichever ink the accent picked has to survive the midpoint too.
 */
const MID_LUMINANCE_UNDER_WHITE_INK = [0.1, 0.27] as const;
const MID_LUMINANCE_UNDER_DARK_INK = [0.33, 0.75] as const;

/** Sampling is abandoned after this, so a stalled CDN cannot hold the theme. */
const LOAD_TIMEOUT_MS = 6000;

/**
 * Width requested from the image optimizer. Must be a member of Next's
 * `images.imageSizes` or `images.deviceSizes` or the route answers 400; 64 is in
 * the default `imageSizes`. If either is ever narrowed in `next.config.mjs`, this
 * has to move with it.
 */
const SAMPLE_WIDTH = 64;

/* -------------------------------------------------------------------------- */
/* Colour space                                                               */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h /= 6;
  if (h < 0) h += 1;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 1) + 1) % 1) * 6;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

/** WCAG relative luminance. The basis of every contrast ratio. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (channel: number) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Move an HSL colour along its lightness axis until its luminance falls inside
 * `[min, max]`, leaving hue and saturation alone. Luminance rises monotonically
 * with lightness at a fixed hue and saturation (black at 0, white at 1), so a
 * bisection is both correct and quick.
 */
function withLuminanceIn(colour: Hsl, [min, max]: readonly [number, number]): Hsl {
  const current = relativeLuminance(hslToRgb(colour));
  if (current >= min && current <= max) return colour;
  const target = current < min ? min : max;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (relativeLuminance(hslToRgb({ ...colour, l: mid })) < target) lo = mid;
    else hi = mid;
  }
  return { ...colour, l: (lo + hi) / 2 };
}

/** Shortest signed distance from `a` to `b` around the wheel, in turns. */
function hueDelta(a: number, b: number): number {
  let d = b - a;
  while (d > 0.5) d -= 1;
  while (d < -0.5) d += 1;
  return d;
}

/* -------------------------------------------------------------------------- */
/* Palette construction                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build the whole palette from one or two sampled hues.
 *
 * The relationships between tokens are lifted from the hand-designed brand
 * palette: the accent is a vivid mid-lightness colour, `accentSoft` is the same
 * hue lifted until it is readable as text, and the gradient runs accent to
 * secondary through a computed midpoint. Only the lightness of each token is
 * fixed; the hues come from the artwork.
 */
export function buildPalette(
  primary: Hsl,
  secondary: Hsl | null,
  options: PaletteOptions = {},
): Palette {
  return build(primary, secondary, options, false);
}

/**
 * Build a palette around an exact accent colour.
 *
 * Used by the fixed accent modes. Unlike `buildPalette` this does not push the
 * seed through the saturation boost or the luminance band, because a listener who
 * picked Spotify green expects `#1DB954` and not a normalised approximation of
 * it. Everything derived from the accent (the gradient, the ink, the neutrals
 * under `tinted`) is still computed the usual way, so the rest of the palette
 * stays internally consistent.
 */
function paletteFromAccent(accent: Rgb, options: PaletteOptions = {}): Palette {
  return build(rgbToHsl(accent), null, options, true);
}

function build(
  primary: Hsl,
  secondary: Hsl | null,
  options: PaletteOptions,
  exactAccent: boolean,
): Palette {
  const accent = exactAccent
    ? primary
    : withLuminanceIn(
        { h: primary.h, s: clamp(primary.s * 1.22, 0.68, 1), l: clamp(primary.l, 0.52, 0.66) },
        ACCENT_LUMINANCE,
      );

  // Take the direction the artwork suggests, but not its magnitude.
  const suggested = secondary ? hueDelta(primary.h, secondary.h) : FALLBACK_ALT_ROTATION;
  const arc =
    (suggested < 0 ? -1 : 1) * clamp(Math.abs(suggested) || MAX_ALT_ARC, MIN_ALT_ARC, MAX_ALT_ARC);

  const accentAlt = withLuminanceIn(
    {
      h: accent.h + arc,
      s: secondary ? clamp(secondary.s * 1.18, 0.6, 1) : accent.s,
      l: secondary ? clamp(secondary.l, 0.56, 0.74) : clamp(accent.l + 0.04, 0.56, 0.74),
    },
    ACCENT_ALT_LUMINANCE,
  );

  const accentRgb = hslToRgb(accent);
  const whiteInk = relativeLuminance(accentRgb) <= WHITE_INK_MAX_LUMINANCE;
  const onAccent = whiteInk
    ? { r: 255, g: 255, b: 255 }
    : hslToRgb({ h: accent.h, s: 0.55, l: 0.07 });

  // The gradient midpoint sits 48% along the arc, matching the 48% stop the
  // brand gradient has always used, and is then held wherever the ink can be
  // read over it.
  const mid = withLuminanceIn(
    {
      h: accent.h + arc * 0.48,
      s: clamp((accent.s + accentAlt.s) / 2, 0.7, 1),
      l: clamp((accent.l + accentAlt.l) / 2, 0.54, 0.68),
    },
    whiteInk ? MID_LUMINANCE_UNDER_WHITE_INK : MID_LUMINANCE_UNDER_DARK_INK,
  );

  // Every neutral, from the page background to muted text, is generated at a
  // fixed lightness from the *accent* hue. Keeping the whole neutral family on
  // one hue is what makes the page read as one colour rather than a collage, and
  // that hue has to be the dominant one from the sleeve: a blue record should
  // give a deep navy page, not a page tinted by whatever the gradient midpoint
  // happened to land on. At these lightnesses the hue only registers as a faint
  // cast, which is exactly the amount of colour a background wants.
  const neutral = (saturationScale: number, min: number, max: number, l: number): Rgb =>
    hslToRgb({ h: accent.h, s: clamp(accent.s * saturationScale, min, max), l });

  const shell =
    options.neutralMode === 'neutral'
      ? NEUTRAL_SHELL
      : {
          bg: neutral(0.52, 0.3, 0.58, 0.049),
          surface: neutral(0.41, 0.24, 0.46, 0.106),
          surfaceRaised: neutral(0.41, 0.24, 0.46, 0.161),
          scrim: neutral(0.62, 0.34, 0.68, 0.041),
          // Body text is a near-white carrying a trace of the accent, the way
          // #fffaff carried a trace of the pink.
          text: hslToRgb({ h: accent.h, s: 1, l: 0.99 }),
          textSecondary: neutral(0.29, 0.18, 0.34, 0.751),
          textMuted: neutral(0.16, 0.1, 0.2, 0.508),
        };

  return {
    accent: accentRgb,
    accentSoft: hslToRgb(
      withLuminanceIn(
        { h: accent.h, s: Math.max(accent.s, 0.8), l: clamp(accent.l + 0.12, 0.7, 0.82) },
        ACCENT_SOFT_LUMINANCE,
      ),
    ),
    accentMid: hslToRgb(mid),
    accentAlt: hslToRgb(accentAlt),
    onAccent,
    ...shell,
  };
}

/* -------------------------------------------------------------------------- */
/* Mode resolution                                                            */
/* -------------------------------------------------------------------------- */

/** The brand palette rendered into a given shell. */
export function defaultPalette(neutralMode: NeutralMode = 'tinted'): Palette {
  if (neutralMode === 'tinted') return DEFAULT_PALETTE;
  return { ...DEFAULT_PALETTE, ...NEUTRAL_SHELL };
}

// Fixed palettes are pure functions of two enums, so there are at most four of
// them for the life of the tab.
const fixedCache = new Map<string, Palette>();

/**
 * Resolve a non-adaptive accent mode to a palette. Returns null for `adaptive`,
 * which has to go through artwork sampling instead.
 */
export function paletteForMode(mode: AccentMode, neutralMode: NeutralMode): Palette | null {
  if (mode === 'adaptive') return null;
  const key = `${mode}|${neutralMode}`;
  const cached = fixedCache.get(key);
  if (cached) return cached;
  const palette =
    mode === 'brand'
      ? defaultPalette(neutralMode)
      : paletteFromAccent(FIXED_ACCENTS[mode], { neutralMode });
  fixedCache.set(key, palette);
  return palette;
}

/* -------------------------------------------------------------------------- */
/* Sampling                                                                   */
/* -------------------------------------------------------------------------- */

interface Bucket {
  weight: number;
  /** Hue accumulated as an offset within the bucket, which cannot wrap. */
  hueOffset: number;
  saturation: number;
  lightness: number;
}

/**
 * Vote for the two hues that best represent the image.
 *
 * Weighting matters more than the bucketing does. A pixel's say is proportional
 * to how saturated it is and how close it is to mid lightness, because those are
 * the pixels a person would name if asked the colour of the sleeve. Plain
 * averaging instead returns the muddy centre of the histogram every time.
 */
function seedsFromPixels(data: Uint8ClampedArray): [Hsl, Hsl | null] | null {
  const buckets: Bucket[] = Array.from({ length: HUE_BUCKETS }, () => ({
    weight: 0,
    hueOffset: 0,
    saturation: 0,
    lightness: 0,
  }));
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const { h, s, l } = rgbToHsl({ r: data[i], g: data[i + 1], b: data[i + 2] });
    if (s < MIN_SATURATION || l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;

    const midness = 1 - Math.abs(l - 0.5) / 0.5;
    const weight = (0.35 + s) * (0.25 + midness);
    const scaled = h * HUE_BUCKETS;
    const index = Math.min(HUE_BUCKETS - 1, Math.floor(scaled));
    const bucket = buckets[index];
    bucket.weight += weight;
    bucket.hueOffset += (scaled - index) * weight;
    bucket.saturation += s * weight;
    bucket.lightness += l * weight;
    total += weight;
  }

  // A greyscale or sepia sleeve has no hue to borrow. Returning null hands the
  // caller back the brand palette, which is a better answer than a grey site.
  if (total <= 0) return null;

  const resolve = (index: number): Hsl => {
    const bucket = buckets[index];
    return {
      h: (index + bucket.hueOffset / bucket.weight) / HUE_BUCKETS,
      s: bucket.saturation / bucket.weight,
      l: bucket.lightness / bucket.weight,
    };
  };

  let best = 0;
  for (let i = 1; i < HUE_BUCKETS; i++) {
    if (buckets[i].weight > buckets[best].weight) best = i;
  }
  const primary = resolve(best);

  let second = -1;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    if (!buckets[i].weight) continue;
    if (Math.abs(hueDelta(primary.h, (i + 0.5) / HUE_BUCKETS)) < MIN_HUE_SEPARATION) continue;
    if (second === -1 || buckets[i].weight > buckets[second].weight) second = i;
  }

  // A weak second hue is usually a background wash or a logo, not part of the
  // artwork's identity, so it is ignored in favour of the designed rotation.
  const secondary =
    second !== -1 && buckets[second].weight > buckets[best].weight * 0.18 ? resolve(second) : null;

  return [primary, secondary];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin for the optimizer route, but an absolute URL still needs this
    // or `getImageData` throws on a tainted canvas.
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    // Nothing here aborts the underlying fetch. Assigning `img.src = ''` looks
    // like a cancel but resolves against the document URL, firing a fresh request
    // for the page HTML while the original download carries on. Giving up on the
    // promise is the honest option; the browser drops the response.
    const timer = window.setTimeout(() => reject(new Error('cover load timed out')), LOAD_TIMEOUT_MS);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('cover failed to load'));
    };
    img.decoding = 'async';
    img.src = src;
  });
}

async function readPixels(src: string): Promise<Uint8ClampedArray | null> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_EDGE;
  canvas.height = SAMPLE_EDGE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
  try {
    return ctx.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data;
  } catch {
    // Cross-origin without CORS headers. Nothing to do but keep the defaults.
    return null;
  }
}

/**
 * Route a cover through Next's image optimizer.
 *
 * This is not about performance. Covers come from the JioSaavn CDN, which makes
 * no promise about `Access-Control-Allow-Origin`, and a canvas that has drawn an
 * opaque cross-origin image refuses to be read. `/_next/image` is same-origin,
 * so the pixels come back every time. `w` has to be one of Next's configured
 * widths or the route answers 400; 64 is in the default `imageSizes`.
 */
export function sampleUrl(cover: string): string | null {
  if (!cover) return null;
  // The fallback cover is an inline SVG placeholder. It has no artwork in it and
  // sampling it would tint the site the colour of the empty state.
  if (cover.startsWith('data:')) return null;
  if (cover.startsWith('/_next/image')) return cover;
  return `/_next/image?url=${encodeURIComponent(cover)}&w=${SAMPLE_WIDTH}&q=75`;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/** `null` means the sleeve had no usable hue, which is a real answer. */
type Seeds = [Hsl, Hsl | null] | null;

/**
 * The *seeds* are cached, not the finished palette.
 *
 * Sampling is the expensive half and it depends only on the image; turning seeds
 * into a palette is arithmetic and depends on the neutral mode. Caching at this
 * boundary means toggling between the tinted and neutral shells repaints
 * instantly from memory instead of re-fetching and re-reading every cover.
 */
const seedCache = new Map<string, Seeds>();
const pending = new Map<string, Promise<Seeds>>();

/**
 * Resolve the palette for a cover URL, falling back to the brand palette for
 * anything that cannot be sampled. Never rejects: a theme is a decoration, and
 * failing to compute one must not surface as an error to the listener.
 */
export function extractPalette(cover: string, options: PaletteOptions = {}): Promise<Palette> {
  const neutralMode = options.neutralMode ?? 'tinted';
  const paint = (seeds: Seeds): Palette =>
    seeds ? buildPalette(seeds[0], seeds[1], { neutralMode }) : defaultPalette(neutralMode);

  const url = sampleUrl(cover);
  if (!url) return Promise.resolve(defaultPalette(neutralMode));

  if (seedCache.has(url)) return Promise.resolve(paint(seedCache.get(url) ?? null));

  const inFlight = pending.get(url);
  if (inFlight) return inFlight.then(paint);

  const job = readPixels(url)
    .then((pixels) => {
      const seeds = (pixels && seedsFromPixels(pixels)) || null;
      // A greyscale sleeve, and a canvas that came back tainted, are both final
      // answers worth caching. A *failed* request is not: it throws, so it skips
      // this line entirely. Caching the fallback there would pin that album to
      // the brand palette for the rest of the session, so a single dropped
      // request on a train would never heal.
      seedCache.set(url, seeds);
      return seeds;
    })
    .catch((): Seeds => null)
    .finally(() => pending.delete(url));

  pending.set(url, job);
  return job.then(paint);
}

function channels({ r, g, b }: Rgb): string {
  return `${r} ${g} ${b}`;
}

function hex({ r, g, b }: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const TOKENS: Array<[string, keyof Palette]> = [
  ['--accent-rgb', 'accent'],
  ['--accent-soft-rgb', 'accentSoft'],
  ['--accent-mid-rgb', 'accentMid'],
  ['--accent-alt-rgb', 'accentAlt'],
  ['--on-accent-rgb', 'onAccent'],
  ['--bg-rgb', 'bg'],
  ['--surface-rgb', 'surface'],
  ['--surface-raised-rgb', 'surfaceRaised'],
  ['--scrim-rgb', 'scrim'],
  ['--text-rgb', 'text'],
  ['--text-secondary-rgb', 'textSecondary'],
  ['--text-muted-rgb', 'textMuted'],
];

/**
 * Write a palette onto the document. Every token is set on `<html>`, where it
 * overrides the `:root` defaults from the stylesheet, and the `theme-color` meta
 * tag is updated so the browser chrome on mobile matches the page instead of
 * leaving a seam at the top of the screen.
 */
export function applyPalette(palette: Palette): void {
  const root = document.documentElement;
  for (const [token, key] of TOKENS) {
    root.style.setProperty(token, channels(palette[key]));
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex(palette.bg));
}
