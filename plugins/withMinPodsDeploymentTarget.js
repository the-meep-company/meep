const { withPodfile } = require('expo/config-plugins');

// Xcode 27 refuses to build targets below iOS 15. Some pods (e.g. the
// RNCAsyncStorage resource bundle) still declare 13.4, so raise every pod
// target to at least the app's own minimum after `pod install`.
const MIN_IOS = '15.1';
const MARKER = '# meep: min pods deployment target';

module.exports = function withMinPodsDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    let podfile = cfg.modResults.contents;
    if (podfile.includes(MARKER)) return cfg;
    podfile = podfile.replace(
      /post_install do \|installer\|\n/,
      `post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MIN_IOS}')
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end
`
    );
    cfg.modResults.contents = podfile;
    return cfg;
  });
};
