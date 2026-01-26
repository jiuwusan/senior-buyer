package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/zhoukaidong/senior-buyer-go/internal/domain/model"
)

// APIResponse is the standard API response format
type APIResponse = model.APIResponse

// Success sends a successful response
func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Code: 200,
		Msg:  "成功",
		Data: data,
	})
}

// SuccessWithMsg sends a successful response with a custom message
func SuccessWithMsg(c *gin.Context, msg string, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Code: 200,
		Msg:  msg,
		Data: data,
	})
}

// Fail sends a failure response
func Fail(c *gin.Context, code int, msg string, data interface{}) {
	if code == 0 {
		code = -99
	}
	c.JSON(http.StatusOK, APIResponse{
		Code: code,
		Msg:  msg,
		Data: data,
	})
}

// RecoveryMiddleware handles panics and returns error responses
func RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				logError("Gateway panic: %v", err)
				Fail(c, -99, "system error", nil)
			}
		}()
		c.Next()
	}
}

// LoggerMiddleware logs all requests
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		logInfo("gateway: %s %s", c.Request.Method, c.Request.URL.Path)
		c.Next()
	}
}

// Helper functions for logging (can be replaced with proper logger)
func logInfo(format string, args ...interface{}) {
	// TODO: Use proper logger
}

func logError(format string, args ...interface{}) {
	// TODO: Use proper logger
}
