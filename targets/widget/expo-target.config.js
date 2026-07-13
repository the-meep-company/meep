/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'MeepWidgets',
  displayName: 'Meep',
  deploymentTarget: '17.0',
  colors: {
    $accent: '#2563EB',
    $widgetBackground: { light: '#FAFAFA', dark: '#1C1C1E' },
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
