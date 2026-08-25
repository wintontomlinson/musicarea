import type { Config } from 'tailwindcss';

/**
 * Neutral dark design tokens, in the spirit of YouTube Music, Spotify and
 * Apple Music: layered greys, white as the only accent, and no coloured
 * gradients or glows. Colour in the interface comes from album artwork alone.
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
        bg: '#0F0F0F',
        surface: {
          DEFAULT: '#181818',
          raised: '#242424',
        },
        // White is the accent. Kept as a token so existing active/selected
        // states stay in one place.
        accent: {
          DEFAULT: '#FFFFFF',
          soft: '#E6E6E6',
        },
        secondary: {
          DEFAULT: '#B3B3B3',
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#AAAAAA',
          muted: '#717171',
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.1)',
      },
      backgroundImage: {
        // Flat neutral fills, so nothing renders a coloured gradient.
        brand: 'linear-gradient(0deg, #FFFFFF, #FFFFFF)',
        'brand-soft': 'linear-gradient(0deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1))',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['48px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h2: ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h3: ['28px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        h4: ['22px', { lineHeight: '1.25' }],
        h5: ['18px', { lineHeight: '1.3' }],
        h6: ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        18: '72px',
        22: '88px',
        30: '120px',
      },
      borderRadius: {
        card: '8px',
        xl2: '12px',
      },
      boxShadow: {
        lift: '0 10px 30px -18px rgba(0,0,0,0.8)',
        // Neutral, so any remaining use stays colourless.
        glow: '0 8px 24px -14px rgba(0,0,0,0.85)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: {
        glass: '20px',
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
