# Multi-stage build for Senior Buyer Go

# Stage 1: Build
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binaries
RUN make build-weidian
RUN make build-youzan

# Stage 2: Runtime
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Set timezone
ENV TZ=Asia/Shanghai

WORKDIR /app

# Copy binaries from builder
COPY --from=builder /app/bin/weidian-api ./bin/weidian-api
COPY --from=builder /app/bin/youzan-api ./bin/youzan-api

# Copy configuration files
COPY --from=builder /app/configs ./configs

# Create logs directory
RUN mkdir -p /app/logs

# Expose ports
EXPOSE 37071 37072

# Set default command (can be overridden)
CMD ["./bin/weidian-api"]
