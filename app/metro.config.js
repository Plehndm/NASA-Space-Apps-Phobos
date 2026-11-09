// Metro config: Expo's defaults, plus the map data (app/data/) served at /mapdata/ and the route
// assistant's backend at /api/assistant by the same dev server, so a phone only ever needs the one
// address it already uses for the app.
const { getDefaultConfig } = require("expo/metro-config");
const { serveMapData } = require("./scripts/data-middleware");
const { serveAssistant } = require("./scripts/assistant-middleware");

const config = getDefaultConfig(__dirname);

const enhance = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const next = enhance ? enhance(middleware, server) : middleware;
    return (req, res, done) => (serveMapData(req, res) || serveAssistant(req, res) ? undefined : next(req, res, done));
  },
};

module.exports = config;
