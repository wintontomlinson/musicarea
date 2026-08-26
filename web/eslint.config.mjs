import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * Flat ESLint config.
 *
 * Next 16 removed the `next lint` command, which used to synthesise a config on
 * the fly when none existed. This repo never had one committed, so linting was
 * effectively off: running it just dropped into the interactive setup prompt.
 * The rules below are the same set that command applied (core-web-vitals plus
 * the TypeScript layer), now pinned in the repo so `npm run lint` is
 * reproducible in CI.
 */
const config = [
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Unused code should fail the lint rather than accumulate, but allow the
      // conventional leading-underscore escape hatch for deliberate omissions.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];

export default config;
