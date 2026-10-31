const { readApiOrigin, apiOriginPlugin } = require('./scripts/api-origin.cjs');

module.exports = function (api) {
  const readDevOrigin = () =>
    readApiOrigin(undefined, undefined, 'FISIOMOVE_DEV_API_ORIGIN');
  api.cache.using(() => JSON.stringify([readApiOrigin(), readDevOrigin()]));
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        apiOriginPlugin,
        { origin: readApiOrigin(), devOrigin: readDevOrigin() },
      ],
    ],
  };
};
