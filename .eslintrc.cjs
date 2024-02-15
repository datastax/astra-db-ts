/* eslint-env node */
module.exports = {
  // just bloody ignore everything for now
  ignorePatterns: ["*"],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
};
