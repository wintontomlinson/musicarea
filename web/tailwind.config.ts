import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0D0B13',
        surface: {
          DEFAULT: '#17141F',
          raised: '#211D2A',
        },
        accent: {
          DEFAULT: '#D950A5',
          soft: '#E477BF',
        },
        secondary: {
          DEFAULT: '#B7B0C0',
        },
        text: {
          DEFAULT: '#FFFAFF',
          secondary: '#B7B0C0',
          muted: '#7C7488',
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.12)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #D950A5, #C14995)',
      },
      fontFamily: {
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
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -10px, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.22,1,0.36,1) both',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
