/* eslint-env node */
module.exports = {
  ignorePatterns: ['dist/*', 'scripts/*'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  rules: {
    // We are *way* past this point lmao
    '@typescript-eslint/no-explicit-any': 'off',
    // Only way I can do indentation in ts-doc
    'no-irregular-whitespace': 'off',
    // Makes underscore variables not throw a fit
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_',
      },
    ],
    '@typescript-eslint/no-var-requires': 'off',
  },
};
