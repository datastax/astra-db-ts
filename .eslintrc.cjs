/* eslint-env node */
module.exports = {
  // just bloody ignore everything for now
  // ignorePatterns: ["*"],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  rules: {
    // We are *way* past this point lmao
    '@typescript-eslint/no-explicit-any': 'off',
    // Only way I can do spaces in ts-doc
    'no-irregular-whitespace': 'off',
  },
};
