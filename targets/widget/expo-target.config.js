/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "MeepWidget",
  icon: "../../assets/images/icon.png",
  // App Group must match the main app (app.json) so the widget can read the
  // payload that lib/widgetData.ts writes via react-native-shared-group-preferences.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.themeepcompany.meep"],
  },
  colors: {
    $accent: "#6C5CE7",
  },
  // WidgetKit container backgrounds + modern SwiftUI need iOS 17.
  deploymentTarget: "17.0",
};
