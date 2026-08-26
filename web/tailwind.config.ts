import type { Config } from 'tailwindcss';

/**
 * MusicArea design tokens.
 *
 * A near-black neutral scale carries the interface so album artwork provides
 * the colour. The accent is deliberately narrow in scope: play, active state,
 * progress and favourite. Radii are small, shadows are almost absent, and the
 * type scale is editorial rather than oversized.
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
        bg: {
          DEFAULT: '#080808',
          alt: '#0D0D0D',
        },
        surface: {
          DEFAULT: '#151515',
          raised: '#1B1B1B',
        },
        accent: {
          DEFAULT: '#FF2D55',
          soft: '#FF375F',
        },
        text: {
          DEFAULT: '#F5F5F5',
          secondary: '#A6A6A6',
          muted: '#6E6E6E',
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.08)',
        strong: 'rgba(255,255,255,0.16)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Editorial scale. Page titles stay restrained so hierarchy comes from
        // weight and spacing rather than size alone.
        display: ['40px', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        title: ['28px', { lineHeight: '1.12', letterSpacing: '-0.022em', fontWeight: '700' }],
        section: ['19px', { lineHeight: '1.25', letterSpacing: '-0.014em', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.45' }],
        meta: ['13px', { lineHeight: '1.4' }],
        micro: ['11px', { lineHeight: '1.35', letterSpacing: '0.01em' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        // Used sparingly: artwork depth and floating surfaces only.
        art: '0 8px 24px -12px rgba(0,0,0,0.8)',
        pop: '0 16px 40px -16px rgba(0,0,0,0.85)',
      },
      spacing: {
        sidebar: '240px',
        player: '76px',
        tabbar: '58px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
      },
      transitionDuration: {
        fast: '140ms',
        base: '200ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-left': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        eq: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.2,0.8,0.3,1) both',
        rise: 'rise 260ms cubic-bezier(0.2,0.8,0.3,1) both',
        'sheet-up': 'sheet-up 320ms cubic-bezier(0.2,0.8,0.3,1) both',
        'slide-left': 'slide-left 260ms cubic-bezier(0.2,0.8,0.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
