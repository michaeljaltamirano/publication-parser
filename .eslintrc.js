module.exports = {
  root: true,
  env: {
    browser: false,
    es2021: true,
    node: true,
    jest: false,
  },
  extends: [
    'plugin:@michaeljaltamirano/base',
    'plugin:@michaeljaltamirano/typescript',
    'plugin:@michaeljaltamirano/prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  rules: {
    'import/prefer-default-export': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'no-await-in-loop': 'off',
    'no-console': 'off',
    'no-restricted-syntax': 'off',
    'no-param-reassign': 'off',
  },
};
