module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Transform import.meta to globalThis.__ExpoImportMetaRegistry so Metro can
          // bundle packages (e.g. zustand ESM middleware) that use import.meta syntax
          // in classic-script web bundles without a SyntaxError.
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
