package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rajsinghtech/tsflow/backend/internal/services"
)

type Handlers struct {
	tailscaleService *services.TailscaleService
}

func NewHandlers(tailscaleService *services.TailscaleService) *Handlers {
	return &Handlers{
		tailscaleService: tailscaleService,
	}
}

func (h *Handlers) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "tsflow-backend",
	})
}

func (h *Handlers) GetDevices(c *gin.Context) {
	devices, err := h.tailscaleService.GetDevices()
	if err != nil {
		log.Printf("ERROR GetDevices failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch devices",
			"message": err.Error(),
		})
		return
	}

	log.Printf("SUCCESS GetDevices: returned devices successfully")
	c.JSON(http.StatusOK, devices)
}

func (h *Handlers) GetServicesAndRecords(c *gin.Context) {
	// Fetch VIP services
	vipServices, servicesErr := h.tailscaleService.GetVIPServices()
	if servicesErr != nil {
		log.Printf("WARNING GetVIPServices failed: %v", servicesErr)
		vipServices = make(map[string]services.VIPServiceInfo)
	}
	
	// Fetch static records
	staticRecords, recordsErr := h.tailscaleService.GetStaticRecords()
	if recordsErr != nil {
		log.Printf("WARNING GetStaticRecords failed: %v", recordsErr)
		staticRecords = make(map[string]services.StaticRecordInfo)
	}
	
	response := gin.H{
		"services": vipServices,
		"records":  staticRecords,
	}
	
	log.Printf("SUCCESS GetServicesAndRecords: returned %d services and %d records", len(vipServices), len(staticRecords))
	c.JSON(http.StatusOK, response)
}

func (h *Handlers) GetNetworkLogs(c *gin.Context) {
	start := c.Query("start")
	end := c.Query("end")

	if start == "" || end == "" {
		now := time.Now()
		start = now.Add(-5 * time.Minute).Format(time.RFC3339)
		end = now.Format(time.RFC3339)
	}

	st, err := time.Parse(time.RFC3339, start)
	if err != nil {
		log.Printf("ERROR GetNetworkLogs: invalid start time %s: %v", start, err)
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "bad start time",
			"message": err.Error(),
		})
		return
	}

	et, err := time.Parse(time.RFC3339, end)
	if err != nil {
		log.Printf("ERROR GetNetworkLogs: invalid end time %s: %v", end, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad end time", "message": err.Error()})
		return
	}

	if et.Before(st) {
		c.JSON(400, gin.H{"error": "end time before start time"})
		return
	}

	now := time.Now()
	if st.After(now) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "future start time not allowed"})
		return
	}

	duration := et.Sub(st)
	if duration > 24*time.Hour {
		chunks, err := h.tailscaleService.GetNetworkLogsChunkedParallel(start, end, 6*time.Hour, 3)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch network logs",
				"message": err.Error(),
				"hint":    "Try selecting a smaller time range",
			})
			return
		}

		var allLogs []interface{}
		for _, chunk := range chunks {
			if logsArray, ok := chunk.([]interface{}); ok {
				allLogs = append(allLogs, logsArray...)
			} else if logsMap, ok := chunk.(map[string]interface{}); ok {
				if logs, exists := logsMap["logs"]; exists {
					if logsArray, ok := logs.([]interface{}); ok {
						allLogs = append(allLogs, logsArray...)
					}
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"logs": allLogs,
			"metadata": gin.H{
				"chunked":     true,
				"chunks":      len(chunks),
				"duration":    duration.String(),
				"totalLogs":   len(allLogs),
			},
		})
		return
	}

	logs, err := h.tailscaleService.GetNetworkLogs(start, end)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch network logs",
			"message": err.Error(),
		})
		return
	}

	log.Printf("SUCCESS GetNetworkLogs: returned logs for %s to %s", start, end)
	c.JSON(http.StatusOK, logs)
}

func (h *Handlers) GetNetworkMap(c *gin.Context) {
	networkMap, err := h.tailscaleService.GetNetworkMap()
	if err != nil {
		log.Printf("ERROR GetNetworkMap failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch network map",
			"message": err.Error(),
		})
		return
	}

	log.Printf("SUCCESS GetNetworkMap: returned network map")
	c.JSON(http.StatusOK, networkMap)
}

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

func (h *Handlers) GetDNSNameservers(c *gin.Context) {
	nameservers, err := h.tailscaleService.GetDNSNameservers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to fetch DNS nameservers",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, nameservers)
}
