import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090613',
        surface: {
          DEFAULT: '#151026',
          raised: '#20183a',
        },
        accent: {
          DEFAULT: '#ff3bbf',
          soft: '#ff78d7',
        },
        secondary: {
          DEFAULT: '#b8add2',
        },
        text: {
          DEFAULT: '#fffaff',
          secondary: '#b8add2',
          muted: '#786d96',
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.12)',
      },
      backgroundImage: {
        brand: 'linear-gradient(110deg, #ff3bbf 0%, #a855f7 48%, #4de7ff 100%)',
        'brand-soft': 'linear-gradient(110deg, rgba(255,59,191,0.20), rgba(168,85,247,0.18), rgba(77,231,255,0.16))',
        disco: 'radial-gradient(circle at 12% 8%, rgba(255,59,191,0.25), transparent 29%), radial-gradient(circle at 87% 13%, rgba(77,231,255,0.20), transparent 28%), linear-gradient(130deg, #160b2a 0%, #0b0718 50%, #081421 100%)',
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
        glow: '0 14px 36px -14px rgba(255,59,191,0.55)',
        cyan: '0 14px 34px -15px rgba(77,231,255,0.55)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      backdropBlur: {
        glass: '24px',
      },
    },
  },
  plugins: [],
};

export default config;
