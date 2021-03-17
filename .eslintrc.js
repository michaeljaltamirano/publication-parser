module.exports = {
  root: true,
  env: {
    browser: false,
    es2021: true,
    node: true,
    jest: false,
  },
  extends: ['plugin:@michaeljaltamirano/all'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-unused-vars': [
      2,
      {
        argsIgnorePattern: '^_',
      },
    ],
    'import/prefer-default-export': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'no-console': 'off',
    'no-restricted-syntax': 'off',
    'no-await-in-loop': 'off',
  },
};
