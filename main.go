package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"tsflow/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	var (
		port        = flag.String("port", "8080", "Port to run the server on")
		accessToken = flag.String("token", "", "Tailscale API access token")
		tailnet     = flag.String("tailnet", "", "Tailscale tailnet name")
		debug       = flag.Bool("debug", false, "Enable debug mode")
	)
	flag.Parse()

	if *accessToken == "" {
		if envToken := os.Getenv("TAILSCALE_ACCESS_TOKEN"); envToken != "" {
			*accessToken = envToken
		} else {
			log.Fatal("Tailscale access token is required. Use -token flag or set TAILSCALE_ACCESS_TOKEN environment variable.")
		}
	}

	if *tailnet == "" {
		if envTailnet := os.Getenv("TAILSCALE_TAILNET"); envTailnet != "" {
			*tailnet = envTailnet
		} else {
			log.Fatal("Tailscale tailnet is required. Use -tailnet flag or set TAILSCALE_TAILNET environment variable.")
		}
	}

	if !*debug {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	apiHandler := handlers.NewAPIHandler(*accessToken, *tailnet)
	setupRoutes(r, apiHandler)

	fmt.Printf("🚀 TSFlow - Tailscale Network Flow Visualizer\n")
	fmt.Printf("📊 Tailnet: %s\n", *tailnet)
	fmt.Printf("🌐 Server running on http://localhost:%s\n", *port)
	fmt.Printf("📖 API Documentation available at http://localhost:%s/api/docs\n", *port)

	log.Fatal(r.Run(":" + *port))
}

func setupRoutes(r *gin.Engine, apiHandler *handlers.APIHandler) {
	r.LoadHTMLGlob("templates/*")

	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "TSFlow - Tailscale Network Flow Visualizer",
		})
	})

	api := r.Group("/api")
	{
		api.GET("/health", apiHandler.HealthCheck)
		api.GET("/network-map", apiHandler.GetNetworkMap)
		api.GET("/devices", apiHandler.GetDevices)
		api.GET("/devices/:deviceId/flows", apiHandler.GetDeviceFlows)

		api.GET("/docs", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"name":        "TSFlow API",
				"version":     "1.0.0",
				"description": "API for Tailscale Network Flow Visualization",
				"endpoints": map[string]interface{}{
					"GET /api/health": map[string]string{
						"description": "Health check endpoint",
						"returns":     "Service status",
					},
					"GET /api/network-map": map[string]string{
						"description": "Get network map with devices and flows",
						"parameters":  "start (ISO8601), end (ISO8601)",
						"returns":     "Network map data",
					},
					"GET /api/devices": map[string]string{
						"description": "Get all devices in the tailnet",
						"returns":     "List of devices",
					},
					"GET /api/devices/:deviceId/flows": map[string]string{
						"description": "Get flows for a specific device",
						"parameters":  "start (ISO8601), end (ISO8601), limit (int)",
						"returns":     "Device flows data",
					},
				},
				"example_usage": map[string]string{
					"Get last hour of data":   "/api/network-map",
					"Get specific time range": "/api/network-map?start=2025-05-30T00:00:00.000Z&end=2025-05-31T10:00:00.000Z",
					"Get device flows":        "/api/devices/nDhoMgNmB721CNTRL/flows?limit=50",
				},
			})
		})
	}

	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Not Found",
			"message": "The requested endpoint does not exist",
			"available_endpoints": []string{
				"GET /",
				"GET /api/health",
				"GET /api/network-map",
				"GET /api/devices",
				"GET /api/devices/:deviceId/flows",
				"GET /api/docs",
			},
		})
	})
}
