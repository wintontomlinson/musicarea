import type { Config } from 'tailwindcss';

/**
 * The palette here deliberately holds no colour values. Every entry points at a
 * custom property declared in `src/app/globals.css`, because the theme engine in
 * `src/lib/color.ts` rewrites those properties at runtime to match the artwork
 * on screen. This file used to duplicate the hex values, which meant utilities
 * compiled to static colours and ignored the tokens entirely.
 *
 * The `rgb(var(--x) / <alpha-value>)` form is what keeps opacity modifiers such
 * as `bg-surface/80` and `border-accent/25` working. It only works because the
 * variables hold bare channels (`255 59 191`) rather than `rgb(...)`.
 */
const channel = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: channel('--bg-rgb'),
        scrim: channel('--scrim-rgb'),
        surface: {
          DEFAULT: channel('--surface-rgb'),
          raised: channel('--surface-raised-rgb'),
        },
        accent: {
          DEFAULT: channel('--accent-rgb'),
          soft: channel('--accent-soft-rgb'),
          mid: channel('--accent-mid-rgb'),
          alt: channel('--accent-alt-rgb'),
        },
        // Ink for content sitting on an accent fill. Flips between light and dark
        // with the generated accent's luminance, which is why `text-white` is
        // wrong on any accent background.
        'on-accent': channel('--on-accent-rgb'),
        secondary: {
          DEFAULT: channel('--text-secondary-rgb'),
        },
        text: {
          DEFAULT: channel('--text-rgb'),
          secondary: channel('--text-secondary-rgb'),
          muted: channel('--text-muted-rgb'),
        },
      },
      borderColor: {
        subtle: 'var(--line)',
      },
      backgroundImage: {
        brand:
          'linear-gradient(110deg, rgb(var(--accent-rgb)) 0%, rgb(var(--accent-mid-rgb)) 48%, rgb(var(--accent-alt-rgb)) 100%)',
      },
      fontFamily: {
        // Inter first. It used to sit behind -apple-system and SF Pro, which
        // resolve on every Apple device, so the font `next/font` downloads was
        // paid for on load and then never rendered for a large share of users.
        // The system stack stays as the fallback while Inter loads and for the
        // rare case where it fails.
        sans: [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'system-ui',
          'sans-serif',
        ],
        // Apple ships two families, not one: SF Pro Text is spaced for body copy
        // and SF Pro Display is tightened for headlines. Using Display for the
        // Now Playing title and page headings is most of what makes Apple Music
        // typography read the way it does. Apple devices resolve it locally;
        // everyone else falls through to Inter, which is close in construction.
        display: [
          'SF Pro Display',
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // Display size for the immersive player, where the track title is the
        // hero and needs to outrank every page heading.
        d2: ['52px', { lineHeight: '1.02', letterSpacing: '-0.045em' }],
        h1: ['46px', { lineHeight: '1.02', letterSpacing: '-0.045em' }],
        h2: ['33px', { lineHeight: '1.08', letterSpacing: '-0.035em' }],
        h3: ['25px', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        h4: ['21px', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        h5: ['17px', { lineHeight: '1.3', letterSpacing: '-0.012em' }],
        h6: ['13px', { lineHeight: '1.4' }],
        // Karaoke lyrics. Large, and deliberately looser in line height than the
        // headings: lines wrap often and a tight leading makes a wrapped lyric
        // read as two separate lines.
        lyric: ['28px', { lineHeight: '1.28', letterSpacing: '-0.02em' }],
        'lyric-lg': ['38px', { lineHeight: '1.24', letterSpacing: '-0.025em' }],
      },
      spacing: {
        18: '72px',
        22: '88px',
        30: '120px',
      },
      borderRadius: {
        // 12px is the redesign's card radius. The previous 16px is kept as
        // `card-lg` for the larger panels, where 12px reads as too tight against
        // the amount of padding they carry.
        card: '12px',
        'card-lg': '16px',
        xl2: '24px',
        pill: '999px',
      },
      boxShadow: {
        lift: '0 18px 42px -22px rgba(0,0,0,0.9)',
        glow: '0 14px 36px -14px rgb(var(--accent-rgb) / 0.55)',
        'glow-lg': '0 30px 70px -28px rgb(var(--accent-rgb) / 0.7)',
        'glow-alt': '0 14px 34px -15px rgb(var(--accent-alt-rgb) / 0.55)',
        // Album art on the Now Playing stage. A large, very soft accent-tinted
        // shadow reads as light thrown by the artwork onto the page behind it.
        art: '0 40px 90px -30px rgb(var(--accent-rgb) / 0.45), 0 18px 50px -20px rgba(0,0,0,0.85)',
      },
      transitionTimingFunction: {
        smooth: 'var(--ease-smooth)',
      },
      backdropBlur: {
        // 20px, matching the glassmorphism spec. The heavier blur for panels over
        // artwork is applied by the `.glass-overlay` class, which needs an
        // `@supports` fallback a utility cannot express.
        glass: '20px',
      },
      keyframes: {
        // Marquee is expressed as a percentage translate so one keyframe works for
        // any text width; the component measures the overflow and sets the
        // duration, which keeps the scroll speed constant instead of making long
        // titles race.
        marquee: {
          '0%, 12%': { transform: 'translateX(0)' },
          '88%, 100%': { transform: 'translateX(var(--marquee-shift, -50%))' },
        },
        // The Now Playing artwork drift. Small enough to be felt rather than
        // watched: anything larger competes with the music.
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -1.25%, 0) scale(1.012)' },
        },
        // Ambient background wash behind the artwork.
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1.5) rotate(0deg)' },
          '50%': { transform: 'translate3d(2%, -2%, 0) scale(1.62) rotate(4deg)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Like button feedback. Overshoots, because a heart that scales straight
        // to its target feels mechanical.
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.32)' },
          '70%': { transform: 'scale(0.94)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        marquee: 'marquee var(--marquee-duration, 12s) linear infinite',
        float: 'float 9s var(--ease-smooth) infinite',
        drift: 'drift 26s var(--ease-smooth) infinite',
        shimmer: 'shimmer 1.6s infinite',
        'heart-pop': 'heartPop 420ms var(--ease-smooth)',
      },
    },
  },
  plugins: [],
};

export default config;
