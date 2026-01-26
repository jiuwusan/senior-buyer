# Senior Buyer Go

Go implementation of the automated purchasing bot for Weidian (微店) and Youzan (有赞) e-commerce platforms.

## Project Structure

```
senior-buyer-go/
├── cmd/
│   ├── weidian/main.go          # Weidian service entry point
│   └── youzan/main.go           # Youzan service entry point
├── internal/
│   ├── api/handler/             # HTTP handlers
│   ├── core/service/            # Business logic
│   ├── domain/model/            # Domain models
│   ├── platform/                # Platform implementations
│   │   ├── weidian/             # Weidian platform
│   │   └── youzan/              # Youzan platform
│   └── infra/config/            # Configuration
├── configs/                     # Configuration files
├── deployments/                 # Deployment configs
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/                     # Build & deploy scripts
├── go.mod
├── go.sum
└── Makefile
```

## Development

### Prerequisites

- Go 1.21+
- Docker (optional, for containerized deployment)

### Build

```bash
# Install dependencies
make deps

# Build for Linux (production)
make all

# Build for local development
make build
```

### Run Locally

```bash
# Run Weidian API (port 37071)
make run-weidian

# Run Youzan API (port 37072)
make run-youzan
```

### API Endpoints

Both services expose identical endpoints:

- `GET /{platform}/api/timestamp` - Server timestamp
- `GET /{platform}/api/order/query/config` - Query configuration
- `GET /{platform}/api/order/query/cart` - Query shopping cart
- `GET /{platform}/api/order/query/preOrder` - Query pre-order info
- `POST /{platform}/api/order/create` - Create orders
- `POST /{platform}/api/order/polling/create` - Polling orders
- `POST /{platform}/api/order/target/create` - Target time orders

## Deployment

### Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f weidian-api

# Restart services
docker-compose restart weidian-api
```

## Migration from Node.js

This is a Go rewrite of the original Node.js/Koa.js implementation. Key differences:

- **Framework**: Gin instead of Koa.js
- **HTTP Client**: fasthttp instead of fetch
- **HTML Parsing**: goquery instead of Cheerio
- **Concurrency**: goroutines + channels instead of Promises
- **Deployment**: Docker/systemd instead of PM2

## Configuration

Configuration files are JSON-compatible with the Node.js version:

- `configs/weidian.json` - Weidian platform configuration
- `configs/youzan.json` - Youzan platform configuration
