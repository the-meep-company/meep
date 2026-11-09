// Extends app.json. Lets each developer sign device builds with their own
// Apple team without committing it: APPLE_TEAM_ID=XXXXXXXXXX npm run ios:device
// Once the shared Meep team exists, set ios.appleTeamId in app.json instead.
//
// If com.themeepcompany.meep is registered to a team you can't sign with, also
// set APPLE_BUNDLE_ID (e.g. com.yourname.meep). The App Group follows it as
// group.<bundle id>; the widget derives the same group from its own bundle id.
module.exports = ({ config }) => {
  const appleTeamId = process.env.APPLE_TEAM_ID || config.ios?.appleTeamId;
  const bundleIdentifier = process.env.APPLE_BUNDLE_ID || config.ios?.bundleIdentifier;
  const appGroup = `group.${bundleIdentifier}`;
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(appleTeamId ? { appleTeamId } : {}),
      bundleIdentifier,
      entitlements: {
        ...config.ios?.entitlements,
        'com.apple.security.application-groups': [appGroup],
      },
    },
    extra: { ...config.extra, widgetAppGroup: appGroup },
  };
};
