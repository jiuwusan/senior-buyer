# senior-buyer

脚本定点抢购 微店 有赞

# 店铺地址

微店 行星文化：https://shop1711911458.v.weidian.com/?userid=1711911458
有赞 素龙 https://shop149420996.m.youzan.com/wscshop/showcase/homepage?kdt_id=149228828

# 定时任务

```bash
crontab -l
crontab -e

20 12 * * * curl -X POST http://127.0.0.1:37071/weidian/api/order/polling/create -H "Content-Type: application/json" -d '{"polling": true, "interval": 50}' >> /tmp/weidian_curl.log 2>&1
00 12 * * * curl -X POST http://127.0.0.1:37072/youzan/api/order/polling/create -H "Content-Type: application/json" -d '{"polling": true, "interval": 50}' >> /tmp/youzan_curl.log 2>&1
```

# GitHub Actions 构建与 Docker Hub 发布

推送到 GitHub `master` 后，GitHub Actions 会先运行配置读取测试，再构建 `linux/amd64` 和 `linux/arm64` 镜像并发布到 `jiuwusan/senior-buyer:latest`。也可以在 Actions 页面手动运行工作流。

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置仓库密钥 `DOCKERHUB_TOKEN`，值为 Docker Hub 账户 `jiuwusan` 的访问令牌。发布工作流不会把令牌写入镜像。

微店和有赞的账户配置分别保存在 `weidian/weidian-api/database/config.json` 与 `youzan/youzan-api/database/config.json`。它们不会进入 Git 或镜像；部署前请在服务器上准备好这两个文件。若文件不存在，服务会初始化为空数组 `[]`。

# Docker Compose 启动

## 1. 启动服务

在项目根目录执行：

```bash
docker compose pull
docker compose up -d
```

## 2. 服务端口

- 微店服务: `http://localhost:37071`
- 有赞服务: `http://localhost:37072`

## 3. 停止服务

```bash
docker compose down
```

## 4. 查看日志

容器内使用 `pm2` 启动两个服务，日志会持久化到项目根目录 `logs`：

- 微店标准输出: `logs/weidian-api-out.log`
- 微店错误日志: `logs/weidian-api-error.log`
- 有赞标准输出: `logs/youzan-api-out.log`
- 有赞错误日志: `logs/youzan-api-error.log`

也可以直接查看容器日志：

```bash
docker compose logs -f
```

## 5. 持久化目录

- 微店配置文件目录: `./weidian/weidian-api/database`
- 有赞配置文件目录: `./youzan/youzan-api/database`
- 服务日志目录: `./logs`
