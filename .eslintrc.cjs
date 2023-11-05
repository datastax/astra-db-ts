/* eslint-env node */
module.exports = {
  ignorePatterns: ["dist"],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier', 'sort-destructure-keys'],
  root: true,
};