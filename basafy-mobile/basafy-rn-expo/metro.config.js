const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const repoRoot = path.resolve(projectRoot, '..', '..');
const backendRoot = path.resolve(repoRoot, 'basafy-backend');

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([backendRoot]));

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@backend': backendRoot,
};

module.exports = config;
