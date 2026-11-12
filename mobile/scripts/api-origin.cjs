const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

function readApiOrigin(
  directory = path.resolve(__dirname, '..'),
  environment = process.env,
  key = 'FISIOMOVE_API_ORIGIN',
) {
  const file = path.join(directory, '.env');
  const dotenv = fs.existsSync(file)
    ? parseEnv(fs.readFileSync(file, 'utf8'))
    : {};
  // Only explicitly selected public configuration is eligible for bundling.
  return environment[key] ?? dotenv[key];
}

function apiOriginPlugin({ types: t }, options) {
  return {
    name: 'fisiomove-public-api-origin',
    visitor: {
      ReferencedIdentifier(nodePath) {
        const values = {
          __FISIOMOVE_API_ORIGIN__: options.origin,
          __FISIOMOVE_DEV_API_ORIGIN__: options.devOrigin,
        };
        if (Object.hasOwn(values, nodePath.node.name)) {
          const value = values[nodePath.node.name];
          nodePath.replaceWith(
            value === undefined
              ? t.unaryExpression('void', t.numericLiteral(0))
              : t.stringLiteral(value),
          );
        }
      },
    },
  };
}
module.exports = { readApiOrigin, apiOriginPlugin };
