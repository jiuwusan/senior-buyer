#!/bin/bash

# Build script for Senior Buyer Go
# This script builds both Weidian and Youzan services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Senior Buyer Go - Build Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Parse arguments
TARGET_OS=${TARGET_OS:-linux}
TARGET_ARCH=${TARGET_ARCH:-amd64}
OUTPUT_DIR=${OUTPUT_DIR:-bin}

# Display build configuration
echo ""
echo -e "${YELLOW}Build Configuration:${NC}"
echo "  OS:      $TARGET_OS"
echo "  Arch:    $TARGET_ARCH"
echo "  Output:  $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Set build environment
export CGO_ENABLED=0
export GOOS=$TARGET_OS
export GOARCH=$TARGET_ARCH

echo -e "${GREEN}Building Weidian API...${NC}"
go build -o "$OUTPUT_DIR/weidian-api" cmd/weidian/main.go
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Weidian API built successfully${NC}"
else
    echo -e "${RED}✗ Weidian API build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Building Youzan API...${NC}"
go build -o "$OUTPUT_DIR/youzan-api" cmd/youzan/main.go
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Youzan API built successfully${NC}"
else
    echo -e "${RED}✗ Youzan API build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Binaries:"
echo "  - $OUTPUT_DIR/weidian-api"
echo "  - $OUTPUT_DIR/youzan-api"
echo ""
echo -e "${YELLOW}To run locally:${NC}"
echo "  ./$OUTPUT_DIR/weidian-api  # Port 37071"
echo "  ./$OUTPUT_DIR/youzan-api   # Port 37072"
