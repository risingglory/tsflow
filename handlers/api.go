package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"tsflow/client"
	"tsflow/models"

	"github.com/gin-gonic/gin"
)

// APIHandler handles HTTP requests for the TSFlow API
type APIHandler struct {
	tailscaleClient *client.TailscaleClient
	cache           *ResponseCache
}

// ResponseCache provides simple in-memory caching with TTL
type ResponseCache struct {
	data   sync.Map
	expiry sync.Map
	mu     sync.RWMutex
}

type CacheEntry struct {
	Data      interface{}
	ExpiresAt time.Time
}

func NewResponseCache() *ResponseCache {
	cache := &ResponseCache{}
	// Start cleanup goroutine
	go cache.cleanup()
	return cache
}

func (c *ResponseCache) Get(key string) (interface{}, bool) {
	if entry, exists := c.data.Load(key); exists {
		cacheEntry := entry.(CacheEntry)
		if time.Now().Before(cacheEntry.ExpiresAt) {
			return cacheEntry.Data, true
		}
		c.data.Delete(key)
	}
	return nil, false
}

func (c *ResponseCache) Set(key string, value interface{}, ttl time.Duration) {
	entry := CacheEntry{
		Data:      value,
		ExpiresAt: time.Now().Add(ttl),
	}
	c.data.Store(key, entry)
}

func (c *ResponseCache) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		c.data.Range(func(key, value interface{}) bool {
			if entry, ok := value.(CacheEntry); ok {
				if now.After(entry.ExpiresAt) {
					c.data.Delete(key)
				}
			}
			return true
		})
	}
}

// NewAPIHandler creates a new API handler with caching
func NewAPIHandler(accessToken, tailnet string) *APIHandler {
	return &APIHandler{
		tailscaleClient: client.NewTailscaleClient(accessToken, tailnet),
		cache:           NewResponseCache(),
	}
}

// GetNetworkMap returns the network map for the specified time range with optimizations
func (h *APIHandler) GetNetworkMap(c *gin.Context) {
	// Create timeout context
	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()

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

	// Check cache first
	cacheKey := h.generateCacheKey("network-map", start, end, c.Request.URL.RawQuery)
	if cached, found := h.cache.Get(cacheKey); found {
		log.Printf("Cache hit for network-map request")
		c.JSON(http.StatusOK, cached)
		return
	}

	// Set streaming headers for better UX during long requests
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no") // Disable nginx buffering

	// Use channels for concurrent data fetching
	type result struct {
		logs    *models.NetworkLogResponse
		devices *models.DevicesResponse
		err     error
	}

	logsChan := make(chan result, 1)
	devicesChan := make(chan result, 1)

	// Fetch network logs concurrently
	go func() {
		logs, err := h.tailscaleClient.GetNetworkLogsWithContext(ctx, start, end)
		logsChan <- result{logs: logs, err: err}
	}()

	// Fetch devices concurrently
	go func() {
		devices, err := h.tailscaleClient.GetDevicesWithContext(ctx)
		devicesChan <- result{devices: devices, err: err}
	}()

	// Wait for both requests with timeout
	var logs *models.NetworkLogResponse
	var devices *models.DevicesResponse

	select {
	case logsResult := <-logsChan:
		if logsResult.err != nil {
			cancel()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch network logs: " + logsResult.err.Error()})
			return
		}
		logs = logsResult.logs
	case <-ctx.Done():
		c.JSON(http.StatusRequestTimeout, gin.H{"error": "Request timeout while fetching network logs"})
		return
	}

	select {
	case devicesResult := <-devicesChan:
		if devicesResult.err != nil {
			cancel()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch devices: " + devicesResult.err.Error()})
			return
		}
		devices = devicesResult.devices
	case <-ctx.Done():
		c.JSON(http.StatusRequestTimeout, gin.H{"error": "Request timeout while fetching devices"})
		return
	}

	// Process data with context timeout
	processingCtx, processCancel := context.WithTimeout(ctx, 15*time.Second)
	defer processCancel()

	networkMap := h.tailscaleClient.ProcessFlowDataWithContext(processingCtx, logs, devices)

	// Parse filter parameters for raw flows
	filters := h.parseFlowFilters(c)

	// Filter raw flows based on query parameters
	filteredRawFlows := h.tailscaleClient.FilterRawFlows(networkMap.RawFlows, filters)

	// Add metadata about the response
	response := gin.H{
		"devices":   networkMap.Devices,
		"flows":     networkMap.Flows,
		"rawFlows":  filteredRawFlows,
		"timeRange": networkMap.TimeRange,
		"metadata": gin.H{
			"deviceCount":    len(networkMap.Devices),
			"flowCount":      len(networkMap.Flows),
			"rawFlowCount":   len(filteredRawFlows),
			"totalRawFlows":  len(networkMap.RawFlows),
			"filtersApplied": len(filters.Ports) > 0 || len(filters.Protocols) > 0 || len(filters.FlowTypes) > 0 || filters.MinBytes > 0,
			"queryRange": gin.H{
				"start": start.Format(time.RFC3339),
				"end":   end.Format(time.RFC3339),
			},
			"cached": false,
		},
	}

	// Cache the response for 30 seconds for small time ranges, 2 minutes for larger ones
	cacheTTL := 30 * time.Second
	if end.Sub(start) > 6*time.Hour {
		cacheTTL = 2 * time.Minute
	}
	h.cache.Set(cacheKey, response, cacheTTL)

	c.JSON(http.StatusOK, response)
}

// generateCacheKey creates a consistent cache key
func (h *APIHandler) generateCacheKey(endpoint string, start, end time.Time, queryParams string) string {
	return fmt.Sprintf("%s-%d-%d-%s", endpoint, start.Unix(), end.Unix(), queryParams)
}

// parseFlowFilters parses filter parameters from query string with better defaults
func (h *APIHandler) parseFlowFilters(c *gin.Context) models.FlowFilters {
	filters := models.FlowFilters{
		SortBy:    c.DefaultQuery("sortBy", "timestamp"),
		SortOrder: c.DefaultQuery("sortOrder", "desc"),
		Limit:     500, // Reduced default limit for better performance
	}

	// Parse ports filter
	if portsParam := c.Query("ports"); portsParam != "" {
		filters.Ports = strings.Split(portsParam, ",")
		// Trim whitespace
		for i, port := range filters.Ports {
			filters.Ports[i] = strings.TrimSpace(port)
		}
	}

	// Parse protocols filter
	if protocolsParam := c.Query("protocols"); protocolsParam != "" {
		filters.Protocols = strings.Split(protocolsParam, ",")
		// Trim whitespace
		for i, protocol := range filters.Protocols {
			filters.Protocols[i] = strings.TrimSpace(protocol)
		}
	}

	// Parse flow types filter
	if flowTypesParam := c.Query("flowTypes"); flowTypesParam != "" {
		filters.FlowTypes = strings.Split(flowTypesParam, ",")
		// Trim whitespace
		for i, flowType := range filters.FlowTypes {
			filters.FlowTypes[i] = strings.TrimSpace(flowType)
		}
	}

	// Parse device IDs filter
	if deviceIDsParam := c.Query("deviceIds"); deviceIDsParam != "" {
		filters.DeviceIDs = strings.Split(deviceIDsParam, ",")
		// Trim whitespace
		for i, deviceID := range filters.DeviceIDs {
			filters.DeviceIDs[i] = strings.TrimSpace(deviceID)
		}
	}

	// Parse bytes filters
	if minBytesParam := c.Query("minBytes"); minBytesParam != "" {
		if minBytes, err := strconv.Atoi(minBytesParam); err == nil && minBytes > 0 {
			filters.MinBytes = minBytes
		}
	}

	if maxBytesParam := c.Query("maxBytes"); maxBytesParam != "" {
		if maxBytes, err := strconv.Atoi(maxBytesParam); err == nil && maxBytes > 0 {
			filters.MaxBytes = maxBytes
		}
	}

	// Parse limit
	if limitParam := c.Query("limit"); limitParam != "" {
		if limit, err := strconv.Atoi(limitParam); err == nil && limit > 0 {
			if limit > 1000 { // Cap at 1000 for performance
				limit = 1000
			}
			filters.Limit = limit
		}
	}

	return filters
}

// GetRawFlows returns filtered raw flow logs with optimizations
func (h *APIHandler) GetRawFlows(c *gin.Context) {
	// Create timeout context
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Parse time range
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

	// Limit to 12 hours max for raw flows
	maxDuration := 12 * time.Hour
	if end.Sub(start) > maxDuration {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "Time range too large for raw flows. Maximum allowed is 12 hours.",
			"maxRange":       "12 hours",
			"requestedRange": end.Sub(start).String(),
		})
		return
	}

	// Check cache first
	cacheKey := h.generateCacheKey("raw-flows", start, end, c.Request.URL.RawQuery)
	if cached, found := h.cache.Get(cacheKey); found {
		log.Printf("Cache hit for raw-flows request")
		c.JSON(http.StatusOK, cached)
		return
	}

	// Fetch and process data concurrently
	logsChan := make(chan *models.NetworkLogResponse, 1)
	devicesChan := make(chan *models.DevicesResponse, 1)
	errChan := make(chan error, 2)

	go func() {
		logs, err := h.tailscaleClient.GetNetworkLogsWithContext(ctx, start, end)
		if err != nil {
			errChan <- err
			return
		}
		logsChan <- logs
	}()

	go func() {
		devices, err := h.tailscaleClient.GetDevicesWithContext(ctx)
		if err != nil {
			errChan <- err
			return
		}
		devicesChan <- devices
	}()

	var logs *models.NetworkLogResponse
	var devices *models.DevicesResponse

	// Wait for both with timeout
	for i := 0; i < 2; i++ {
		select {
		case err := <-errChan:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch data: " + err.Error()})
			return
		case logsData := <-logsChan:
			logs = logsData
		case devicesData := <-devicesChan:
			devices = devicesData
		case <-ctx.Done():
			c.JSON(http.StatusRequestTimeout, gin.H{"error": "Request timeout"})
			return
		}
	}

	networkMap := h.tailscaleClient.ProcessFlowDataWithContext(ctx, logs, devices)

	// Parse and apply filters
	filters := h.parseFlowFilters(c)
	filteredRawFlows := h.tailscaleClient.FilterRawFlows(networkMap.RawFlows, filters)

	response := gin.H{
		"rawFlows": filteredRawFlows,
		"metadata": gin.H{
			"totalCount":     len(networkMap.RawFlows),
			"filteredCount":  len(filteredRawFlows),
			"filtersApplied": filters,
			"timeRange": gin.H{
				"start": start.Format(time.RFC3339),
				"end":   end.Format(time.RFC3339),
			},
			"cached": false,
		},
	}

	// Cache for 1 minute
	h.cache.Set(cacheKey, response, 1*time.Minute)

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
	var deviceRawFlows []models.RawFlowEntry
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

	// Filter raw flows for the device
	for _, rawFlow := range networkMap.RawFlows {
		if len(deviceRawFlows) >= limit {
			break
		}

		if (rawFlow.SourceDevice != nil && rawFlow.SourceDevice.ID == deviceID) ||
			(rawFlow.DestinationDevice != nil && rawFlow.DestinationDevice.ID == deviceID) {
			deviceRawFlows = append(deviceRawFlows, rawFlow)
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
		"device":   targetDevice,
		"flows":    deviceFlows,
		"rawFlows": deviceRawFlows,
		"metadata": gin.H{
			"aggregatedFlows": len(deviceFlows),
			"rawFlows":        len(deviceRawFlows),
			"requestedMax":    limit,
			"actualReturned":  count,
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
