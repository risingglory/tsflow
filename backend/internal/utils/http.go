package utils

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func IsRetryable(err error) bool {
	if err == nil || err == context.DeadlineExceeded {
		return true
	}
	
	errStr := err.Error()
	retryableErrors := []string{"status 429", "status 502", "status 503", "status 504", "timeout", "connection refused"}
	
	for _, retryErr := range retryableErrors {
		if strings.Contains(errStr, retryErr) {
			return true
		}
	}
	return false
}

func FormatTimeForAPI(t time.Time) string {
	return t.Format(time.RFC3339)
}

func HTTPError(status int, body string) error {
	switch status {
	case 401:
		return fmt.Errorf("bad auth - check your API key")
	case 403:
		return fmt.Errorf("missing permissions (need logs:network:read)")
	case 404:
		return fmt.Errorf("tailnet not found")
	case 429:
		return fmt.Errorf("rate limited - slow down")
	case 504:
		return fmt.Errorf("timeout - try smaller time range")
	case 503:
		return fmt.Errorf("tailscale API down")
	default:
		return fmt.Errorf("API error %d: %s", status, body)
	}
}