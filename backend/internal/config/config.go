package config

import (
	"errors"
	"os"
)

// Config holds the application configuration
type Config struct {
	TailscaleAPIKey  string
	TailscaleTailnet string
	Port             string
	Environment      string
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		TailscaleAPIKey:  os.Getenv("TAILSCALE_API_KEY"),
		TailscaleTailnet: os.Getenv("TAILSCALE_TAILNET"),
		Port:             getEnvWithDefault("PORT", "8080"),
		Environment:      getEnvWithDefault("ENVIRONMENT", "development"),
	}
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.TailscaleAPIKey == "" {
		return errors.New("TAILSCALE_API_KEY is required")
	}
	if c.TailscaleTailnet == "" {
		return errors.New("TAILSCALE_TAILNET is required")
	}
	return nil
}

// getEnvWithDefault returns the environment variable value or a default value
func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
