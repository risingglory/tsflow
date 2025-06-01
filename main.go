package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"tsflow/handlers"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Get configuration from environment variables
	accessToken := os.Getenv("TAILSCALE_ACCESS_TOKEN")
	if accessToken == "" {
		log.Fatal("TAILSCALE_ACCESS_TOKEN environment variable is required")
	}

	tailnet := os.Getenv("TAILSCALE_TAILNET")
	if tailnet == "" {
		log.Fatal("TAILSCALE_TAILNET environment variable is required")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Set Gin mode
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = "release"
	}
	gin.SetMode(ginMode)

	// Create router with optimized middleware
	router := gin.New()

	// Add recovery middleware with custom handler
	router.Use(gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		if err, ok := recovered.(string); ok {
			c.String(http.StatusInternalServerError, fmt.Sprintf("Error: %s", err))
		}
		c.AbortWithStatus(http.StatusInternalServerError)
	}))

	// Add structured logging middleware
	router.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC822),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
	}))

	// CORS middleware with optimized settings
	corsConfig := cors.Config{
		AllowOrigins:     []string{"*"}, // Configure appropriately for production
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "X-Total-Count", "X-Filtered-Count"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}
	router.Use(cors.New(corsConfig))

	// Add timeout middleware for API routes
	router.Use(func(c *gin.Context) {
		// Skip timeout for static files and health checks
		if c.Request.URL.Path == "/health" || c.Request.URL.Path == "/" {
			c.Next()
			return
		}

		// Set timeout for API routes
		ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})

	// Add compression middleware for better performance
	router.Use(func(c *gin.Context) {
		c.Header("Vary", "Accept-Encoding")
		c.Next()
	})

	// Create API handler with optimizations
	apiHandler := handlers.NewAPIHandler(accessToken, tailnet)

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Format(time.RFC3339),
			"version":   "1.0.0",
		})
	})

	// API routes
	api := router.Group("/api")
	{
		api.GET("/network-map", apiHandler.GetNetworkMap)
		api.GET("/raw-flows", apiHandler.GetRawFlows)

		// API documentation endpoint
		api.GET("/docs", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"title":   "TSFlow API",
				"version": "1.0.0",
				"endpoints": gin.H{
					"GET /api/network-map": gin.H{
						"description": "Get network map with flows and devices",
						"parameters": gin.H{
							"start":     "Start time (RFC3339 format)",
							"end":       "End time (RFC3339 format)",
							"ports":     "Comma-separated list of ports to filter",
							"protocols": "Comma-separated list of protocols to filter",
							"flowTypes": "Comma-separated list of flow types to filter",
							"deviceIds": "Comma-separated list of device IDs to filter",
							"minBytes":  "Minimum bytes threshold",
							"maxBytes":  "Maximum bytes threshold",
							"sortBy":    "Sort field (timestamp, bytes, packets, port)",
							"sortOrder": "Sort order (asc, desc)",
							"limit":     "Maximum number of raw flows to return (max 1000)",
						},
					},
					"GET /api/raw-flows": gin.H{
						"description": "Get filtered raw flow logs",
						"parameters": gin.H{
							"start":     "Start time (RFC3339 format)",
							"end":       "End time (RFC3339 format)",
							"ports":     "Comma-separated list of ports to filter",
							"protocols": "Comma-separated list of protocols to filter",
							"flowTypes": "Comma-separated list of flow types to filter",
							"deviceIds": "Comma-separated list of device IDs to filter",
							"minBytes":  "Minimum bytes threshold",
							"maxBytes":  "Maximum bytes threshold",
							"sortBy":    "Sort field (timestamp, bytes, packets, port)",
							"sortOrder": "Sort order (asc, desc)",
							"limit":     "Maximum number of flows to return (max 1000)",
						},
					},
				},
			})
		})
	}

	// Serve static files (HTML, CSS, JS)
	router.Static("/static", "./static")
	router.StaticFile("/", "./templates/index.html")

	// Create HTTP server with optimized settings
	server := &http.Server{
		Addr:           ":" + port,
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   70 * time.Second, // Longer than request timeout to allow proper response
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}

	// Print startup information
	fmt.Println("🚀 TSFlow - Tailscale Network Flow Visualizer")
	fmt.Printf("📊 Tailnet: %s\n", tailnet)
	fmt.Printf("🌐 Server running on http://localhost:%s\n", port)
	fmt.Printf("📖 API Documentation available at http://localhost:%s/api/docs\n", port)

	// Start server in a goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")

	// Create a deadline for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Gracefully shutdown the server
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("✅ Server exited gracefully")
}
