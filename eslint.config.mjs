// @ts-check

import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: ['dist/**/*', 'examples/**/*'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // We are *way* past this point lmao
      '@typescript-eslint/no-explicit-any': 'off',

      // Only way I can do indentation in ts-doc
      'no-irregular-whitespace': 'off',

      // sorry.
      '@typescript-eslint/no-unused-expressions': 'off',

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
    },
  },
  {
    // disable type-aware linting on JS files
    files: ['**/*.*js'],
    ...ts.configs.disableTypeChecked,
    rules: { 'no-undef': 'off' },
  },
);
