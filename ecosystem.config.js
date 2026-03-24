module.exports = {
  apps: [
    {
      name: 'weidian-api',
      cwd: '/app/weidian/weidian-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '3G',
      out_file: '/app/logs/weidian-api-out.log',
      error_file: '/app/logs/weidian-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 37071
      }
    },
    {
      name: 'youzan-api',
      cwd: '/app/youzan/youzan-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '3G',
      out_file: '/app/logs/youzan-api-out.log',
      error_file: '/app/logs/youzan-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 37072
      }
    },
    {
      name: 'taobao-api',
      cwd: '/app/taobao/taobao-api',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '3G',
      out_file: '/app/logs/taobao-api-out.log',
      error_file: '/app/logs/taobao-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 37073
      }
    }
  ]
};
