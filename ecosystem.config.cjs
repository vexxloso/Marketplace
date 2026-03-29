const path = require("path");

/** Run from repo root: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "market-api",
      cwd: path.join(__dirname, "apps/api"),
      script: "node",
      args: "dist/src/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "market-web",
      cwd: path.join(__dirname, "apps/web"),
      script: "pnpm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
