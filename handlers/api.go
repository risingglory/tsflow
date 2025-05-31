package handlers

import (
	"net/http"
	"strconv"
	"time"
	"tsflow/client"

	"github.com/gin-gonic/gin"
)

// APIHandler handles HTTP requests for the TSFlow API
type APIHandler struct {
	tailscaleClient *client.TailscaleClient
}

// NewAPIHandler creates a new API handler
func NewAPIHandler(accessToken, tailnet string) *APIHandler {
	return &APIHandler{
		tailscaleClient: client.NewTailscaleClient(accessToken, tailnet),
	}
}

// GetNetworkMap returns the network map for the specified time range
func (h *APIHandler) GetNetworkMap(c *gin.Context) {
	// Parse query parameters
	startParam := c.DefaultQuery("start", "")
	endParam := c.DefaultQuery("end", "")

	var start, end time.Time
	var err error

	if startParam == "" || endParam == "" {
		// Default to last hour if no time range specified
		end = time.Now()
		start = end.Add(-1 * time.Hour)
	} else {
		start, err = time.Parse(time.RFC3339, startParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start time format. Use RFC3339."})
			return
		}

		end, err = time.Parse(time.RFC3339, endParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end time format. Use RFC3339."})
			return
		}
	}

	// Validate time range - limit to 7 days max to prevent massive queries
	maxDuration := 7 * 24 * time.Hour
	if end.Sub(start) > maxDuration {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "Time range too large. Maximum allowed is 7 days.",
			"maxRange":       "7 days",
			"requestedRange": end.Sub(start).String(),
		})
		return
	}

	// Ensure start is before end
	if start.After(end) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start time must be before end time."})
		return
	}

	// Fetch network logs with timeout context
	logs, err := h.tailscaleClient.GetNetworkLogs(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch network logs: " + err.Error()})
		return
	}

	// Fetch devices
	devices, err := h.tailscaleClient.GetDevices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch devices: " + err.Error()})
		return
	}

	// Process and return network map
	networkMap := h.tailscaleClient.ProcessFlowData(logs, devices)

	// Add metadata about the response
	response := gin.H{
		"devices":   networkMap.Devices,
		"flows":     networkMap.Flows,
		"timeRange": networkMap.TimeRange,
		"metadata": gin.H{
			"deviceCount": len(networkMap.Devices),
			"flowCount":   len(networkMap.Flows),
			"queryRange": gin.H{
				"start": start.Format(time.RFC3339),
				"end":   end.Format(time.RFC3339),
			},
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetDevices returns all devices in the tailnet
func (h *APIHandler) GetDevices(c *gin.Context) {
	devices, err := h.tailscaleClient.GetDevices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch devices: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, devices)
}

// GetDeviceFlows returns flows for a specific device
func (h *APIHandler) GetDeviceFlows(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Device ID is required"})
		return
	}

	// Parse query parameters
	startParam := c.DefaultQuery("start", "")
	endParam := c.DefaultQuery("end", "")
	limitParam := c.DefaultQuery("limit", "100")

	limit, err := strconv.Atoi(limitParam)
	if err != nil || limit <= 0 {
		limit = 100
	}

	// Cap the limit to prevent massive responses
	if limit > 1000 {
		limit = 1000
	}

	var start, end time.Time

	if startParam == "" || endParam == "" {
		// Default to last hour if no time range specified
		end = time.Now()
		start = end.Add(-1 * time.Hour)
	} else {
		start, err = time.Parse(time.RFC3339, startParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start time format. Use RFC3339."})
			return
		}

		end, err = time.Parse(time.RFC3339, endParam)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end time format. Use RFC3339."})
			return
		}
	}

	// Validate time range for device flows - limit to 24 hours max
	maxDuration := 24 * time.Hour
	if end.Sub(start) > maxDuration {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "Time range too large for device flows. Maximum allowed is 24 hours.",
			"maxRange":       "24 hours",
			"requestedRange": end.Sub(start).String(),
		})
		return
	}

	// Fetch network logs
	logs, err := h.tailscaleClient.GetNetworkLogs(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch network logs: " + err.Error()})
		return
	}

	// Fetch devices
	devices, err := h.tailscaleClient.GetDevices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch devices: " + err.Error()})
		return
	}

	// Process network map
	networkMap := h.tailscaleClient.ProcessFlowData(logs, devices)

	// Filter flows for the specific device
	var deviceFlows []interface{}
	count := 0

	for _, flow := range networkMap.Flows {
		if count >= limit {
			break
		}

		// Check if flow involves the specified device
		if (flow.SourceDevice != nil && flow.SourceDevice.ID == deviceID) ||
			(flow.DestinationDevice != nil && flow.DestinationDevice.ID == deviceID) {
			deviceFlows = append(deviceFlows, flow)
			count++
		}
	}

	// Find the device for additional context
	var targetDevice interface{}
	for _, device := range networkMap.Devices {
		if device.ID == deviceID {
			targetDevice = device
			break
		}
	}

	response := gin.H{
		"device": targetDevice,
		"flows":  deviceFlows,
		"metadata": gin.H{
			"totalFlows":     len(deviceFlows),
			"requestedMax":   limit,
			"actualReturned": count,
			"queryRange": gin.H{
				"start": start.Format(time.RFC3339),
				"end":   end.Format(time.RFC3339),
			},
		},
	}

	c.JSON(http.StatusOK, response)
}

// HealthCheck returns the health status of the service
func (h *APIHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "TSFlow API",
		"version":   "1.0.0",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
