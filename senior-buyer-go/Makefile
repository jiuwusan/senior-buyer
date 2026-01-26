.PHONY: all build clean run-weidian run-youzan test deps

# Build both services
all: build-weidian build-youzan

# Install dependencies
deps:
	go mod download
	go mod tidy

# Build Weidian service
build-weidian:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/weidian-api cmd/weidian/main.go

# Build Youzan service
build-youzan:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/youzan-api cmd/youzan/main.go

# Build for local development
build:
	go build -o bin/weidian-api cmd/weidian/main.go
	go build -o bin/youzan-api cmd/youzan/main.go

# Run Weidian locally
run-weidian:
	go run cmd/weidian/main.go

# Run Youzan locally
run-youzan:
	go run cmd/youzan/main.go

# Clean build artifacts
clean:
	rm -rf bin/

# Run tests
test:
	go test -v ./...

# Format code
fmt:
	go fmt ./...

# Lint code
lint:
	golangci-lint run
