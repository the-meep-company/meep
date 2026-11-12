const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// web/ is the separate Next.js site with its own node_modules; keep Metro out of it.
const webDir = path.resolve(__dirname, 'web').replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${webDir}[/\\\\].*`),
];

module.exports = config;
