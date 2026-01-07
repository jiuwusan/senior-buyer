module.exports = {
  apps: [
    {
      name: 'weidian-api',
      script: 'index.js',
      cwd: '/app/services/senior-buyer/weidian/weidian-api',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 37071
      },
      out_file: './logs/weidian-api.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'youzan-api',
      script: 'index.js',
      cwd: '/app/services/senior-buyer/youzan/youzan-api',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 37072
      },
      out_file: './logs/youzan-api.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
