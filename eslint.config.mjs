// @ts-check

import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...ts.configs.recommendedTypeChecked,
      ...ts.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    rules: {
      // We are *way* past this point lmao
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // Only way I can do indentation in ts-doc
      'no-irregular-whitespace': 'off',

      // no.
      '@typescript-eslint/restrict-template-expressions': 'off',

      // sorry :(
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-empty-function': 'off',

      // Makes underscore variables not throw a fit
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Sometimes 'requires' is necessary
      '@typescript-eslint/no-require-imports': 'off',

      // https://stackoverflow.com/questions/49743842/javascript-unexpected-control-characters-in-regular-expression
      'no-control-regex': 'off',

      // Linting
      'semi': 'error',
      'comma-dangle': ['error', 'always-multiline'],

      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Laxer rules for test files
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/dot-notation': 'off',
    },
  },
  {
    // Disable type-aware linting on JS files
    files: ['**/*.*js'],
    ...ts.configs.disableTypeChecked,
    rules: { 'no-undef': 'off' },
  },
);
