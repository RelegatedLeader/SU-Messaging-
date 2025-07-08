const path = require("path");

module.exports = {
  style: {
    css: {
      loaderOptions: { sourceMap: true },
    },
  },
  webpack: {
    alias: {
      "process/browser": path.resolve(
        __dirname,
        "node_modules/process/browser.js"
      ),
    },
    configure: {
      resolve: {
        fallback: {
          process: require.resolve("process/browser.js"),
        },
      },
    },
  },
};
