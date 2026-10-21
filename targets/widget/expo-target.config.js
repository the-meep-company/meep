/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'MeepWidgets',
  displayName: 'Meep',
  deploymentTarget: '17.0',
  colors: {
    // Sleek theme: brand purple accent, near-black dark background.
    $accent: '#6C5CE7',
    $widgetBackground: { light: '#FAFAFA', dark: '#0F0F14' },
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
