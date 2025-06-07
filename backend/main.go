package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rajsinghtech/tsflow/backend/internal/config"
	"github.com/rajsinghtech/tsflow/backend/internal/handlers"
	"github.com/rajsinghtech/tsflow/backend/internal/services"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	// Initialize Tailscale service
	tailscaleService := services.NewTailscaleService(cfg.TailscaleAPIKey, cfg.TailscaleTailnet)

	// Initialize handlers
	handlerService := handlers.NewHandlers(tailscaleService)

	// Setup Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// CORS middleware
	corsConfig := cors.DefaultConfig()
	if cfg.Environment == "production" {
		corsConfig.AllowAllOrigins = true // Allow all origins in production since backend serves frontend
	} else {
		corsConfig.AllowOrigins = []string{"http://localhost:3000", "http://localhost:5173"} // Vite dev server ports
	}
	corsConfig.AllowCredentials = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	router.Use(cors.New(corsConfig))

	// Health check endpoint
	router.GET("/health", handlerService.HealthCheck)

	// API routes
	api := router.Group("/api")
	{
		api.GET("/devices", handlerService.GetDevices)
		api.GET("/network-logs", handlerService.GetNetworkLogs)
		api.GET("/network-map", handlerService.GetNetworkMap)
		api.GET("/devices/:deviceId/flows", handlerService.GetDeviceFlows)
	}

	// Serve static files from frontend build
	var distPath string
	if cfg.Environment == "production" {
		distPath = "./dist" // Docker/production path
	} else {
		distPath = "../frontend/dist" // Development path
	}

	log.Printf("Serving static files from: %s", distPath)

	// Serve all static assets (CSS, JS, images, etc.)
	router.Static("/assets", distPath+"/assets")
	router.StaticFile("/favicon.svg", distPath+"/favicon.svg")

	// Serve index.html for root and all unmatched routes (client-side routing)
	router.StaticFile("/", distPath+"/index.html")
	router.NoRoute(func(c *gin.Context) {
		log.Printf("Serving SPA route for: %s", c.Request.URL.Path)
		c.File(distPath + "/index.html")
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.Port
	}

	log.Printf("Starting TSFlow server on port %s", port)
	log.Printf("Tailnet: %s", cfg.TailscaleTailnet)
	log.Printf("Environment: %s", cfg.Environment)

	if err := router.Run("0.0.0.0:" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
