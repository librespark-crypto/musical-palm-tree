import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Flat ESLint config.
 *
 * `eslint-config-next@16` ships real flat configs (no FlatCompat shim needed),
 * so the Next.js rules, the TypeScript parser and the React/JSX-a11y plugins
 * all come from that package. The extra rules below tighten what this codebase
 * promised: no `any`, no unused vars, no stray console output.
 */
const eslintConfig = [
  {
    ignores: [
      'legacy/**',
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'public/sw.js',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'scripts/**/*.mjs', '*.config.*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
