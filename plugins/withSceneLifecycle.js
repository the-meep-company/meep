const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// Apps built with the iOS 27 SDK must adopt the UIScene lifecycle, or UIKit
// kills them at launch (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
// Expo SDK 54's template still creates the window in the AppDelegate, so move
// that into a SceneDelegate and forward deep links from the scene.
const MARKER = '// meep: scene lifecycle';

const WINDOW_SETUP = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)

    if let activity = connectionOptions.userActivities.first {
      self.scene(scene, continue: activity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      options[.sourceApplication] = context.options.sourceApplication
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity) { _ in }
  }
}
`;

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'swift' || src.includes(MARKER)) return cfg;
    if (!WINDOW_SETUP.test(src)) {
      throw new Error('withSceneLifecycle: AppDelegate template changed; update the plugin.');
    }
    src = src.replace(WINDOW_SETUP, '');
    cfg.modResults.contents = src + SCENE_DELEGATE;
    return cfg;
  });
};
