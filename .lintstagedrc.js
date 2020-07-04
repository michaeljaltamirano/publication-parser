module.exports = {
  '*.js': ['yarn prettier -- --write', 'yarn eslint --fix'],
  '!(tsconfig).json': ['yarn prettier -- --write'],
  '*.ts': [
    'yarn prettier -- --write',
    'yarn eslint --fix',
    () => 'yarn run tsc -p tsconfig.json',
  ],
  '*.md': ['yarn prettier -- --write'],
};
