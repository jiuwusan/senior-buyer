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
│   └── index.js         # Server startup (Koa app initialization)
```

### Service Layer Hierarchy

The service layer implements a three-tier hierarchy for order management:

1. **Order** (`service/order.js`): Top-level orchestrator
   - Manages multiple OrderTask instances
   - Implements polling mechanism with configurable interval
   - Coordinates parallel order execution across all tasks
   - Polling runs for fixed duration (Weidian: 15s, Youzan: 10s)

2. **OrderTask** (`service/order_task.js`): Per-task coordinator
   - Represents a timed purchasing task with target time configuration
   - Contains multiple Buyer instances (one per account)
   - Implements advance timing logic: waits until `advancePostInterval` before target, then posts at `postInterval` for `postDuration`
   - Tracks running state to prevent concurrent execution

3. **Buyer** (`service/buyer.js`): Individual account operations
   - Handles cart queries, order parameter generation, order creation
   - Tracks `succeedIds` to prevent duplicate orders
   - For Weidian: generates separate orders per cart item (one-product-one-order)
   - For Youzan: supports combined orders via `combine` parameter

### Authentication

Both platforms use cookie-based session authentication (no OAuth):

- **Weidian:** `wdtoken`, `cookie`, `udc` fields stored in `database/config.json`
- **Youzan:** `kdt_session_id`, `cookie`, `user_id` stored in `service/config.js`

Buyers can be disabled via `disabled: true` in configuration.

### Configuration Storage

- **Weidian:** `weidian/weidian-api/database/config.json` (JSON file)
- **Youzan:** `youzan/youzan-api/service/config.js` (JS module exporting array)

Configuration structure per task:
```javascript
{
  targetTime: "2025/12/12 16:03:00",   // Target purchase time
  advanceTimestamps: 1000,              // Max advance time (ms)
  advancePostInterval: 200,             // Interval during advance phase (ms)
  postDuration: 1000,                   // Duration of post-target phase (ms)
  postInterval: 50,                     // Interval during post phase (ms)
  buyers: [...]                         // Array of buyer credentials
}
```

### API Endpoints

Both platforms expose similar REST APIs under `/weidian/api/*` and `/youzan/api/*`:

- `GET /timestamp` - Server timestamp for time synchronization
- `GET /order/query/config` - Current configuration (all tasks and buyers)
- `GET /order/query/cart` - Query shopping carts (must call before creating orders)
- `GET /order/query/preOrder` - Preview order parameters without submitting
- `POST /order/create` - Create orders (body: `{ combine: boolean }`)
- `POST /order/polling/create` - Start/stop polling orders (body: `{ polling: boolean, interval: number }`)
- `POST /order/target/create` - Execute target-time order (checks if within advance window)

### Order Flow

1. **Query Cart:** Call `/order/query/cart` to fetch cart contents and generate order parameters
2. **Preview Orders:** Call `/order/query/preOrder` to review generated order parameters
3. **Create Orders:** Call `/order/create` with `combine` flag
   - `combine: true`: Single order with all items (Youzan only)
   - `combine: false`: Separate orders per item (Weidian default)

### Code Style

Prettier configuration (`.prettierrc`):
- Single quotes
- 180 character line width
- 2-space indentation
- Semicolons required
- No trailing commas

### Important Patterns

1. **Response Middleware:** Global `ctx.success(data, msg)` and `ctx.fail(code, msg, data)` for standardized API responses
2. **Error Handling:** Global try-catch gateway middleware in `index.js`
3. **Success Tracking:** Buyers track `succeedIds` array to prevent duplicate orders
4. **HTML Parsing:** Weidian uses Cheerio to extract cart data from `__rocker-render-inject__` script tag
5. **UUID Generation:** Custom UUID v4 implementation in `Buyer.uuid()` for request tracking
6. **Async Polling:** Order.pollingOrder uses IIFE pattern for non-blocking async loop with timeout

### Production Paths (via Jenkins)

Remote server: `10.10.0.139`, PM2 Docker container
- Weidian: `/app/services/senior-buyer/weidian/weidian-api`
- Youzan: `/app/services/senior-buyer/youzan/youzan-api`
