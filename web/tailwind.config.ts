import type { Config } from 'tailwindcss';

/**
 * Apple Music design tokens. Apple's system greys for surfaces, the Apple Music
 * red as the single accent, SF Pro typography (falling back to Inter on
 * non-Apple platforms), small radii and soft artwork shadows.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        surface: {
          DEFAULT: '#1C1C1E', // Apple systemGray6 (dark)
          raised: '#2C2C2E', // Apple systemGray5 (dark)
        },
        accent: {
          DEFAULT: '#FA243C', // Apple Music red
          soft: '#FF375F', // Apple systemPink (dark), used for hover
        },
        secondary: {
          DEFAULT: '#8E8E93', // Apple systemGray
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#8E8E93',
          muted: '#636366', // Apple systemGray2 (dark)
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.13)', // Apple separator (dark)
      },
      backgroundImage: {
        brand: 'linear-gradient(0deg, #FA243C, #FA243C)',
        'brand-soft': 'linear-gradient(0deg, rgba(250,36,60,0.12), rgba(250,36,60,0.12))',
      },
      fontFamily: {
        // Real SF Pro on Apple devices, Inter everywhere else.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'var(--font-inter)',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // Apple's large-title down to footnote scale.
        h1: ['40px', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        h2: ['30px', { lineHeight: '1.15', letterSpacing: '-0.022em' }],
        h3: ['24px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h4: ['21px', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        h5: ['17px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        h6: ['13px', { lineHeight: '1.4' }],
      },
      spacing: {
        18: '72px',
        22: '88px',
        30: '120px',
      },
      borderRadius: {
        card: '8px', // Apple Music artwork corner
        xl2: '14px',
      },
      boxShadow: {
        // Soft artwork shadow, as Apple Music uses under album covers.
        lift: '0 4px 14px -4px rgba(0,0,0,0.65)',
        glow: '0 6px 20px -8px rgba(0,0,0,0.7)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: {
        glass: '30px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 340ms cubic-bezier(0.4,0,0.2,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
