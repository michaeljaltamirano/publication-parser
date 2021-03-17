module.exports = {
  '*.js': 'yarn prettier --write',
  '!(tsconfig).json': 'yarn prettier --write',
  '*.ts': ['yarn eslint --fix', () => 'yarn run tsc -p tsconfig.json'],
  '*.md': 'yarn prettier --write',
};
