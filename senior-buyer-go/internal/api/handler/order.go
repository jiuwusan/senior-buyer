package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zhoukaidong/senior-buyer-go/internal/core/service"
)

// OrderHandler handles order-related HTTP requests
type OrderHandler struct {
	orderService *service.Order
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(orderService *service.Order) *OrderHandler {
	return &OrderHandler{
		orderService: orderService,
	}
}

// RegisterRoutes registers all order routes
func (h *OrderHandler) RegisterRoutes(router *gin.RouterGroup, apiPrefix string) {
	orderGroup := router.Group(apiPrefix + "/order")
	{
		orderGroup.GET("/query/config", h.QueryConfig)
		orderGroup.GET("/query/cart", h.QueryCart)
		orderGroup.GET("/query/preOrder", h.QueryPreOrder)
		orderGroup.POST("/create", h.CreateOrder)
		orderGroup.POST("/polling/create", h.PollingCreate)
		orderGroup.POST("/target/create", h.TargetCreate)
	}
}

// Timestamp handles GET /timestamp
func (h *OrderHandler) Timestamp(c *gin.Context) {
	Success(c, time.Now().UnixMilli())
}

// QueryConfig handles GET /order/query/config
func (h *OrderHandler) QueryConfig(c *gin.Context) {
	configs := h.orderService.QueryConfig()
	Success(c, configs)
}

// QueryCart handles GET /order/query/cart
func (h *OrderHandler) QueryCart(c *gin.Context) {
	results, err := h.orderService.QueryCart()
	if err != nil {
		Fail(c, -1, "查询购物车失败", nil)
		return
	}
	Success(c, results)
}

// QueryPreOrder handles GET /order/query/preOrder
func (h *OrderHandler) QueryPreOrder(c *gin.Context) {
	results, err := h.orderService.QueryPreOrder()
	if err != nil {
		Fail(c, -1, "查询预订单失败", nil)
		return
	}
	Success(c, results)
}

// CreateOrder handles POST /order/create
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req struct {
		Combine bool `json:"combine"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		// If binding fails, default to false
		req.Combine = false
	}

	results, err := h.orderService.CreateOrder(req.Combine)
	if err != nil {
		Fail(c, -1, "创建订单失败", nil)
		return
	}
	Success(c, results)
}

// PollingCreate handles POST /order/polling/create
func (h *OrderHandler) PollingCreate(c *gin.Context) {
	var req struct {
		Polling  bool `json:"polling"`
		Interval int  `json:"interval"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		// If binding fails, use defaults
		req.Polling = false
		req.Interval = 50
	}

	// Set default interval if not provided
	if req.Interval == 0 {
		req.Interval = 50
	}

	message := h.orderService.PollingOrder(req.Polling, req.Interval)
	Success(c, message)
}

// TargetCreate handles POST /order/target/create
func (h *OrderHandler) TargetCreate(c *gin.Context) {
	results := h.orderService.TargetOrder()
	Success(c, results)
}

// GetTimestamp is an alias for Timestamp for route registration convenience
func (h *OrderHandler) GetTimestamp(c *gin.Context) {
	h.Timestamp(c)
}

// SetupRoutes sets up all routes for the order handler
func (h *OrderHandler) SetupRoutes(router *gin.Engine, apiPrefix string) {
	api := router.Group(apiPrefix)
	{
		api.GET("/timestamp", h.Timestamp)
	}

	// Order routes
	h.RegisterRoutes(router, apiPrefix)
}

// GetStatus returns polling status information
func (h *OrderHandler) GetStatus(c *gin.Context) {
	polling, interval := h.orderService.GetPollingStatus()
	runningCount := h.orderService.GetRunningTasksCount()

	Success(c, gin.H{
		"polling":       polling,
		"interval":      interval,
		"runningTasks":  runningCount,
		"totalTasks":    len(h.orderService.QueryConfig()),
	})
}
