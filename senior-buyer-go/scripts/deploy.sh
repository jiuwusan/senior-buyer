#!/bin/bash

# Deploy script for Senior Buyer Go
# This script builds and deploys the services using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="deployments/docker-compose.yml"
SERVICE=${1:-"all"}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Senior Buyer Go - Deploy Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Function to print usage
usage() {
    echo ""
    echo "Usage: $0 [service]"
    echo ""
    echo "Services:"
    echo "  all         Build and deploy all services (default)"
    echo "  weidian     Build and deploy Weidian API only"
    echo "  youzan      Build and deploy Youzan API only"
    echo ""
    echo "Commands:"
    echo "  $0 build       Build Docker images"
    echo "  $0 up          Start services"
    echo "  $0 down        Stop services"
    echo "  $0 restart     Restart services"
    echo "  $0 logs        View logs"
    echo "  $0 status      Check service status"
    echo ""
    exit 0
}

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose not found${NC}"
    echo "Please install docker-compose first"
    exit 1
fi

# Change to project root directory
cd "$(dirname "$0")/.."

# Parse command
COMMAND=${1:-"up"}
shift || true

case "$COMMAND" in
    build)
        echo -e "${BLUE}Building Docker images...${NC}"
        docker-compose -f "$COMPOSE_FILE" build
        echo -e "${GREEN}✓ Build complete${NC}"
        ;;

    up)
        echo -e "${BLUE}Starting services...${NC}"
        docker-compose -f "$COMPOSE_FILE" up -d
        echo -e "${GREEN}✓ Services started${NC}"
        echo ""
        echo -e "${YELLOW}Services:${NC}"
        echo "  - Weidian API: http://localhost:37071"
        echo "  - Youzan API:  http://localhost:37072"
        echo ""
        echo -e "${YELLOW}View logs:${NC}"
        echo "  docker-compose -f $COMPOSE_FILE logs -f"
        ;;

    down)
        echo -e "${BLUE}Stopping services...${NC}"
        docker-compose -f "$COMPOSE_FILE" down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;

    restart)
        echo -e "${BLUE}Restarting services...${NC}"
        docker-compose -f "$COMPOSE_FILE" restart
        echo -e "${GREEN}✓ Services restarted${NC}"
        ;;

    logs)
        SERVICE=$1
        if [ -z "$SERVICE" ]; then
            docker-compose -f "$COMPOSE_FILE" logs -f
        else
            docker-compose -f "$COMPOSE_FILE" logs -f "$SERVICE"
        fi
        ;;

    status)
        echo -e "${BLUE}Service status:${NC}"
        docker-compose -f "$COMPOSE_FILE" ps
        echo ""
        echo -e "${YELLOW}Health checks:${NC}"
        echo -e "Weidian: ${GREEN}$(curl -s -o /dev/null -w "%{http_code}" http://localhost:37071/weidian/api/timestamp)${NC}"
        echo -e "Youzan:  ${GREEN}$(curl -s -o /dev/null -w "%{http_code}" http://localhost:37072/youzan/api/timestamp)${NC}"
        ;;

    help|--help|-h)
        usage
        ;;

    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo ""
        usage
        ;;
esac
