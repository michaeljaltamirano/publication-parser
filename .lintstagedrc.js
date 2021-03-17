module.exports = {
  '*.ts': [
    'yarn prettier --write',
    'yarn eslint --fix',
    () => 'yarn run tsc -p tsconfig.json',
  ],
  '*.{md,js,json,yml}': ['yarn prettier --write'],
};
