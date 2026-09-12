/** PM2 process file for ContentBeta Next.js on VPS */
module.exports = {
  apps: [
    {
      name: 'contentbeta',
      cwd: '/opt/contentbeta',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
      },
      max_memory_restart: '750M',
      time: true,
    },
  ],
}
