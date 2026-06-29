module.exports = {
  apps: [
    {
      name: "demo-foundation",
      script: "dist/src/server.js",
      cwd: "/var/www/demofoundation.sentineltech.cc/backend",
      interpreter: "node",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
