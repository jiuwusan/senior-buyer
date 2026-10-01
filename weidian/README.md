# 微店账号配置

在 `weidian/weidian-api/database/config.json` 中保存私有配置，格式参考 `weidian/weidian-api/config.example.json`：

```json
{
  "source_id": "your-source-id",
  "users": [
    { "username": "13800000000", "password": "your-login-password" }
  ]
}
```

`source_id` 对所有用户共用；`username` 是微店买家手机号。服务在查询购物车时使用账号密码登录，并读取默认收货地址。目标店铺固定为 `1711911458`。如果账号有多个地址且没有默认地址，查询会报错，不会猜测收货地址。

配置文件已被 Git 和 Docker 构建排除。旧版任务数组配置无法自动迁移，因为其中没有登录密码；请在部署前备份旧文件并手动替换。若微店要求图形验证或短信验证，自动登录会失败，需要先处理验证要求。

`GET /weidian/api/order/query/config` 不返回密码。控制台更新已有账号时，密码留空表示保留现有密码；新增账号必须提供密码。请限制 `37071` 端口和配置文件的访问权限。

`POST /weidian/api/order/target/create` 的目标时间改为在请求 Body 中提供，例如 `{"targetTime":"2026-10-01T12:00:00.000Z"}`。可选的毫秒参数为 `advanceTimestamps`、`advancePostInterval`、`postDuration`、`postInterval`，只对本次请求生效。
