// Extends app.json. Lets each developer sign device builds with their own
// Apple team without committing it: APPLE_TEAM_ID=XXXXXXXXXX npm run ios:device
// Once the shared Meep team exists, set ios.appleTeamId in app.json instead.
module.exports = ({ config }) => {
  const appleTeamId = process.env.APPLE_TEAM_ID || config.ios?.appleTeamId;
  return {
    ...config,
    ios: { ...config.ios, ...(appleTeamId ? { appleTeamId } : {}) },
  };
};
