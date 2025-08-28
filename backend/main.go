package main

import (
	"fmt"
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

// customLoggingMiddleware provides structured request logging for production
func customLoggingMiddleware() gin.HandlerFunc {
	return gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: func(param gin.LogFormatterParams) string {
			return fmt.Sprintf("[%s] %s %s %d %s %s\n",
				param.TimeStamp.Format("2006/01/02 - 15:04:05"),
				param.Method,
				param.Path,
				param.StatusCode,
				param.Latency,
				param.ClientIP,
			)
		},
		Output: os.Stdout,
		SkipPaths: []string{"/health"}, // Skip health checks to reduce noise
	})
}

func main() {
	// Configure logging to stdout for container visibility
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	if err := godotenv.Load("../.env"); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Configuration error: %v", err)
	}

	tailscaleService := services.NewTailscaleService(cfg)
	handlerService := handlers.NewHandlers(tailscaleService)

	// Configure Gin logging
	var router *gin.Engine
	if cfg.Environment == "production" {
		// In production, use custom logging middleware instead of completely disabling logs
		gin.SetMode(gin.ReleaseMode)
		gin.DefaultWriter = os.Stdout
		gin.DefaultErrorWriter = os.Stderr
		router = gin.New()
		router.Use(gin.Recovery())
		router.Use(customLoggingMiddleware())
	} else {
		router = gin.Default()
	}

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

	log.Printf("=== TSFlow Server Starting ===")
	log.Printf("Port: %s", port)
	log.Printf("Tailnet: %s", cfg.TailscaleTailnet)
	log.Printf("API URL: %s", cfg.TailscaleAPIURL)
	log.Printf("Environment: %s", cfg.Environment)
	log.Printf("Static files: %s", distPath)
	
	// Log authentication method being used
	if cfg.TailscaleOAuthClientID != "" && cfg.TailscaleOAuthClientSecret != "" {
		log.Printf("Authentication: OAuth Client Credentials (Client ID: %s)", cfg.TailscaleOAuthClientID)
	} else {
		log.Printf("Authentication: API Key")
	}
	
	log.Printf("Server ready at http://0.0.0.0:%s", port)
	log.Printf("=== Server Started Successfully ===")

	if err := router.Run("0.0.0.0:" + port); err != nil {
		log.Fatalf("FATAL Failed to start server: %v", err)
	}
}
