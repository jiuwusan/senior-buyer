package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/zhoukaidong/senior-buyer-go/internal/api/handler"
	"github.com/zhoukaidong/senior-buyer-go/internal/core/service"
	"github.com/zhoukaidong/senior-buyer-go/internal/infra/config"
)

const (
	// DefaultPort is the default port for Weidian API
	DefaultPort = "37071"
	// APIPrefix is the prefix for all API routes
	APIPrefix = "/weidian/api"
)

func main() {
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = DefaultPort
	}

	// Set Gin mode
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize configuration loader
	loader := config.NewLoader("")

	// Initialize order service
	orderService := service.NewOrder(loader, true) // true for Weidian

	// Initialize handler
	orderHandler := handler.NewOrderHandler(orderService)

	// Create Gin router
	router := gin.New()

	// Add middleware
	router.Use(handler.RecoveryMiddleware())
	router.Use(handler.LoggerMiddleware())
	router.Use(gin.Recovery())

	// Register routes
	orderHandler.SetupRoutes(router, APIPrefix)

	// Print all registered routes
	printRoutes(router)

	// Start server
	addr := fmt.Sprintf("0.0.0.0:%s", port)
	log.Printf("Server running on %s", addr)

	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// printRoutes prints all registered routes
func printRoutes(router *gin.Engine) {
	routes := router.Routes()
	for _, route := range routes {
		if route.Method != "HEAD" {
			log.Printf("Route: %s %s", route.Method, route.Path)
		}
	}
}
