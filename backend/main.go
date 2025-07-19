package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rajsinghtech/tsflow/backend/internal/config"
	"github.com/rajsinghtech/tsflow/backend/internal/handlers"
	"github.com/rajsinghtech/tsflow/backend/internal/services"
)

func main() {
	if err := godotenv.Load("../.env"); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	tailscaleService := services.NewTailscaleService(cfg)
	handlerService := handlers.NewHandlers(tailscaleService)

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Add gzip compression middleware
	router.Use(gzip.Gzip(gzip.DefaultCompression))

	corsConfig := cors.DefaultConfig()
	if cfg.Environment == "production" {
		corsConfig.AllowAllOrigins = true
	} else {
		corsConfig.AllowOrigins = []string{"http://localhost:3000", "http://localhost:5173"}
	}
	corsConfig.AllowCredentials = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	router.Use(cors.New(corsConfig))

	router.GET("/health", handlerService.HealthCheck)

	api := router.Group("/api")
	{
		api.GET("/devices", handlerService.GetDevices)
		api.GET("/network-logs", handlerService.GetNetworkLogs)
		api.GET("/network-map", handlerService.GetNetworkMap)
		api.GET("/devices/:deviceId/flows", handlerService.GetDeviceFlows)
		api.GET("/dns/nameservers", handlerService.GetDNSNameservers)
	}

	var distPath string
	if cfg.Environment == "production" {
		distPath = "./dist"
	} else {
		distPath = "../frontend/dist"
	}

	log.Printf("Serving static files from: %s", distPath)

	router.Static("/assets", distPath+"/assets")
	router.StaticFile("/favicon.svg", distPath+"/favicon.svg")
	router.StaticFile("/", distPath+"/index.html")
	router.NoRoute(func(c *gin.Context) {
		log.Printf("Serving SPA route for: %s", c.Request.URL.Path)
		c.File(distPath + "/index.html")
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.Port
	}

	log.Printf("Starting TSFlow server on port %s", port)
	log.Printf("Tailnet: %s", cfg.TailscaleTailnet)
	log.Printf("API URL: %s", cfg.TailscaleAPIURL)
	log.Printf("Environment: %s", cfg.Environment)
	
	// Log authentication method being used
	if cfg.TailscaleOAuthClientID != "" && cfg.TailscaleOAuthClientSecret != "" {
		log.Printf("Authentication: OAuth Client Credentials (Client ID: %s)", cfg.TailscaleOAuthClientID)
	} else {
		log.Printf("Authentication: API Key")
	}

	if err := router.Run("0.0.0.0:" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
