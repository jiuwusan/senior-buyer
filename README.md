# senior-buyer
脚本定点抢购 微店 有赞

# koa

# Docker Compose 启动

## 1. 启动服务

在项目根目录执行：

```bash
docker compose up --build -d
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
- 服务日志目录: `./logs`

# jenkins
curl -u zhoukaidong:11d3db647b16c4e8488f40bac6190f7304 https://cloud.jiuwusan.cn:36443/jenkins-api/job/senior-buyer/build?token=610f2dcb-87c2-4176-bc15-13bca77b0c4b
