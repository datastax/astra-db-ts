import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['**/*.*js'],
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: '/home/me/work/astra-db-ts',
      },
    },

    rules: {
      // We are *way* past this point lmao
      '@typescript-eslint/no-explicit-any': 'off',

      // Only way I can do indentation in ts-doc
      'no-irregular-whitespace': 'off',

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

      'semi': 'error',
      // 'comma-dangle': ['error', 'only-multiline'],
    },
  },
];
