# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**senior-buyer-dev** is an automated purchasing bot for Chinese e-commerce platforms Weidian (微店) and Youzan (有赞). It implements scheduled flash-sale purchasing with configurable timing and multi-account support.

**Tech Stack:** Koa.js backend, Node.js, PM2 process management, Jenkins CI/CD.

## Development Commands

### Running Services Locally

```bash
# Weidian API (port 7071)
cd weidian/weidian-api
yarn install
yarn dev      # Development with nodemon
yarn start    # Production

# Youzan API (port 7072)
cd youzan/youzan-api
yarn install
yarn dev      # Development with nodemon
yarn start    # Production
```

### PM2 Process Management (Production)

```bash
pm2 start ecosystem.config.js           # Start both services
pm2 restart weidian-api                 # Restart Weidian
pm2 restart youzan-api                  # Restart Youzan
pm2 logs weidian-api                    # View logs
pm2 logs youzan-api
```

### Deployment

Jenkins handles deployment. Manual trigger:
```bash
curl -u zhoukaidong:11d3db647b16c4e8488f40bac6190f7304 \
  https://cloud.jiuwusan.cn:36443/jenkins-api/job/senior-buyer/build?token=610f2dcb-87c2-4176-bc15-13bca77b0c4b
```

## Architecture

### Dual Platform Structure

Both `weidian/` and `youzan/` follow identical architecture:

```
platform/
├── platform-api/
│   ├── contoller/       # Route handlers (HTTP layer)
│   ├── service/         # Business logic layer
│   ├── database/        # Configuration storage (JSON)
│   ├── public/          # Static assets
│   ├── app.js           # Koa application entry
│   └── index.js         # Server startup
└── refs/                # API documentation/reference
```

### Core Service Classes

**Order** (`service/order.js`): Manages multiple OrderTask instances, implements polling mechanism, coordinates parallel orders across buyers.

**OrderTask** (`service/order_task.js`): Represents a timed purchasing task with target time configuration, contains multiple Buyer instances.

**Buyer** (`service/buyer.js`): Handles individual buyer operations - cart queries, order parameter generation, order creation.

### Authentication

Both platforms use cookie-based session authentication:
- **Weidian:** `wdtoken`, `cookie`, `udc` fields
- **Youzan:** `kdt_session_id`, `cookie`, `user_id`

No OAuth - authentication credentials stored in platform configuration files.

### Order Creation Strategy

- **Weidian:** One-product-one-order (each cart item becomes separate order)
- **Youzan:** Supports combined orders (all items in single order via `combine` parameter)

### Configuration Storage

- **Weidian:** `weidian/weidian-api/database/config.json`
- **Youzan:** `youzan/youzan-api/service/config.js`

Configuration includes target time, advance timing parameters, and buyer credentials.

## API Endpoints

Both platforms expose similar REST APIs under `/weidian/api/*` and `/youzan/api/*`:

- `GET /timestamp` - Server timestamp
- `GET /order/query/config` - Current configuration
- `GET /order/query/cart` - Shopping cart query
- `GET /order/query/preOrder` - Pre-order information
- `POST /order/create` - Create orders
- `POST /order/polling/create` - Start/stop polling orders
- `POST /order/target/create` - Execute target-time order

## Code Style

Prettier configuration (`.prettierrc`):
- Single quotes
- 180 character line width
- 2-space tabs
- Semicolons required
- No trailing commas

## Important Patterns

1. **Response Middleware:** Global `ctx.success()` and `ctx.fail()` for standardized API responses
2. **Error Handling:** Global try-catch middleware in Koa
3. **Success Tracking:** Buyers track `succeedIds` to prevent duplicate orders
4. **HTML Parsing:** Weidian uses Cheerio to extract data from HTML cart pages
5. **UUID Generation:** Custom UUID v4 implementation for request tracking

## Production Paths (via Jenkins)

Remote server: `10.10.0.139`, PM2 Docker container
- Weidian: `/app/services/senior-buyer/weidian/weidian-api`
- Youzan: `/app/services/senior-buyer/youzan/youzan-api`
