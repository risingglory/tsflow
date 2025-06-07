package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rajsinghtech/tsflow/backend/internal/services"
)

// Handlers contains all HTTP handlers
type Handlers struct {
	tailscaleService *services.TailscaleService
}

// NewHandlers creates a new handlers instance
func NewHandlers(tailscaleService *services.TailscaleService) *Handlers {
	return &Handlers{
		tailscaleService: tailscaleService,
	}
}

// HealthCheck handles health check requests
func (h *Handlers) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "tsflow-backend",
	})
}

// GetDevices handles device listing requests
func (h *Handlers) GetDevices(c *gin.Context) {
	devices, err := h.tailscaleService.GetDevices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch devices",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, devices)
}

// GetNetworkLogs handles network logs requests
func (h *Handlers) GetNetworkLogs(c *gin.Context) {
	// Get time range parameters from query string
	start := c.Query("start")
	end := c.Query("end")

	// Provide default time range if not specified (last 5 minutes)
	if start == "" || end == "" {
		now := time.Now()
		fiveMinutesAgo := now.Add(-5 * time.Minute)
		start = fiveMinutesAgo.Format(time.RFC3339)
		end = now.Format(time.RFC3339)
	}

	logs, err := h.tailscaleService.GetNetworkLogs(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch network logs",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// GetNetworkMap handles network map requests
func (h *Handlers) GetNetworkMap(c *gin.Context) {
	networkMap, err := h.tailscaleService.GetNetworkMap()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch network map",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, networkMap)
}

// GetDeviceFlows handles device flow requests
func (h *Handlers) GetDeviceFlows(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Device ID is required",
		})
		return
	}

	flows, err := h.tailscaleService.GetDeviceFlows(deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch device flows",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, flows)
}
