module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ["prettier", "plugin:prettier/recommended", "eslint:recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "prettier", "sort-destructure-keys"],
  rules: {},
};
