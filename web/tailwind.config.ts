import type { Config } from 'tailwindcss';

/**
 * Design tokens from the product spec. The palette is dark-first: near-black
 * backgrounds, layered surfaces, a coral-pink brand accent and a deep purple
 * secondary, with a coral-to-purple gradient as the signature.
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
        bg: '#0A0A0A',
        surface: {
          DEFAULT: '#111111',
          raised: '#1A1A1A',
        },
        accent: {
          DEFAULT: '#FF4D6D', // coral-pink brand
          soft: '#FF7A93',
        },
        secondary: {
          DEFAULT: '#7B2FBE', // deep purple
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#A0A0A0',
          muted: '#555555',
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #FF4D6D 0%, #7B2FBE 100%)',
        'brand-soft': 'linear-gradient(135deg, rgba(255,77,109,0.16), rgba(123,47,190,0.16))',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Heading scale from the spec.
        h1: ['48px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h2: ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h3: ['28px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        h4: ['22px', { lineHeight: '1.25' }],
        h5: ['18px', { lineHeight: '1.3' }],
        h6: ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        // 8px base unit scale.
        18: '72px',
        22: '88px',
        30: '120px',
      },
      borderRadius: {
        card: '12px',
        xl2: '20px',
      },
      boxShadow: {
        lift: '0 18px 40px -18px rgba(0,0,0,0.7)',
        glow: '0 0 60px -12px rgba(255,77,109,0.5)',
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
