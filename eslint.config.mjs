import { FlatCompat } from '@eslint/eslintrc';

/**
 * ESLint flat config.
 *
 * Uses FlatCompat because eslint-config-next@15 still ships as an eslintrc-style
 * shareable config. When Next.js moves to a native flat config, this file can be
 * simplified to import the plugin directly.
 *
 * The rules worth keeping are the correctness ones — unescaped entities, bad
 * hook usage, missing dependencies, invalid nesting. Stylistic rules are left
 * off deliberately: Prettier-adjacent disagreements are noise in review, and the
 * compiler already catches type errors.
 */
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'scripts/**'],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // Unused args are often load-bearing in callbacks whose signature is fixed.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // Any is occasionally unavoidable at the Supabase boundary, where a
      // raw jsonb value genuinely has no better static type.
      '@typescript-eslint/no-explicit-any': 'warn',

      'react-hooks/exhaustive-deps': 'warn',

      // Empty catch blocks are fine when documented; a bare throw is not.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  {
    // Generated-style and config files do not need React rules.
    files: ['**/*.config.{ts,mjs}', 'tailwind.config.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },

  {
    /**
     * The Supabase type definitions are structural: every row carries an
     * Insert/Update pair whether or not the app currently references it. They
     * are the schema, not application code, so "unused" is the normal state.
     */
    files: ['src/types/database.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
];
export default config;
