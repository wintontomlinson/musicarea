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
        'brand-soft':
          'linear-gradient(110deg, rgb(var(--accent-rgb) / 0.20), rgb(var(--accent-mid-rgb) / 0.18), rgb(var(--accent-alt-rgb) / 0.16))',
        disco:
          'radial-gradient(circle at 12% 8%, rgb(var(--accent-rgb) / 0.25), transparent 29%), radial-gradient(circle at 87% 13%, rgb(var(--accent-alt-rgb) / 0.20), transparent 28%), linear-gradient(130deg, rgb(var(--surface-raised-rgb)) 0%, rgb(var(--bg-rgb)) 50%, rgb(var(--scrim-rgb)) 100%)',
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
      },
      fontSize: {
        h1: ['46px', { lineHeight: '1.02', letterSpacing: '-0.045em' }],
        h2: ['33px', { lineHeight: '1.08', letterSpacing: '-0.035em' }],
        h3: ['25px', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        h4: ['21px', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        h5: ['17px', { lineHeight: '1.3', letterSpacing: '-0.012em' }],
        h6: ['13px', { lineHeight: '1.4' }],
      },
      spacing: {
        18: '72px',
        22: '88px',
        30: '120px',
      },
      borderRadius: {
        card: '16px',
        xl2: '24px',
      },
      boxShadow: {
        lift: '0 18px 42px -22px rgba(0,0,0,0.9)',
        glow: '0 14px 36px -14px rgb(var(--accent-rgb) / 0.55)',
        'glow-lg': '0 30px 70px -28px rgb(var(--accent-rgb) / 0.7)',
        'glow-alt': '0 14px 34px -15px rgb(var(--accent-alt-rgb) / 0.55)',
      },
      transitionTimingFunction: {
        smooth: 'var(--ease-smooth)',
      },
      backdropBlur: {
        glass: '24px',
      },
    },
  },
  plugins: [],
};

export default config;
