/* eslint-env node */
module.exports = {
  ignorePatterns: ['dist/*', 'scripts/*', 'examples/*'],
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
    // Sometimes 'requires' is necessary
    '@typescript-eslint/no-var-requires': 'off',
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
  }
};
