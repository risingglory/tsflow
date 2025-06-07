package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// TailscaleService handles interactions with the Tailscale API
type TailscaleService struct {
	apiKey  string
	tailnet string
	client  *http.Client
}

// Device represents a Tailscale device
type Device struct {
	ID                     string   `json:"id"`
	Name                   string   `json:"name"`
	Hostname               string   `json:"hostname"`
	User                   string   `json:"user"`
	OS                     string   `json:"os"`
	Addresses              []string `json:"addresses"`
	Online                 bool     `json:"online"`
	LastSeen               string   `json:"lastSeen"`
	Authorized             bool     `json:"authorized"`
	KeyExpiryDisabled      bool     `json:"keyExpiryDisabled"`
	Created                string   `json:"created"`
	MachineKey             string   `json:"machineKey"`
	NodeKey                string   `json:"nodeKey"`
	ClientVersion          string   `json:"clientVersion"`
	UpdateAvailable        bool     `json:"updateAvailable"`
	Blocksincomingnonnodes bool     `json:"blocksIncomingnonnodes"`
	EnabledRoutes          []string `json:"enabledRoutes"`
	AdvertisedRoutes       []string `json:"advertisedRoutes"`
}

// DevicesResponse represents the response from the devices API
type DevicesResponse struct {
	Devices []Device `json:"devices"`
}

// NetworkLogEntry represents a network log entry
type NetworkLogEntry struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Source    string `json:"source"`
	Target    string `json:"target"`
	Protocol  string `json:"protocol"`
	Action    string `json:"action"`
}

// NetworkLogsResponse represents the response from the network logs API
type NetworkLogsResponse struct {
	Logs []NetworkLogEntry `json:"logs"`
}

// NewTailscaleService creates a new Tailscale service
func NewTailscaleService(apiKey, tailnet string) *TailscaleService {
	return &TailscaleService{
		apiKey:  apiKey,
		tailnet: tailnet,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// makeRequest makes an authenticated request to the Tailscale API
func (ts *TailscaleService) makeRequest(endpoint string) ([]byte, error) {
	url := fmt.Sprintf("https://api.tailscale.com/api/v2%s", endpoint)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+ts.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := ts.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return body, nil
}

// GetDevices retrieves all devices in the tailnet
func (ts *TailscaleService) GetDevices() (*DevicesResponse, error) {
	endpoint := fmt.Sprintf("/tailnet/%s/devices", ts.tailnet)

	body, err := ts.makeRequest(endpoint)
	if err != nil {
		return nil, err
	}

	var response DevicesResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal devices response: %w", err)
	}

	return &response, nil
}

// GetNetworkLogs retrieves network logs for the tailnet with time range
func (ts *TailscaleService) GetNetworkLogs(start, end string) (interface{}, error) {
	endpoint := fmt.Sprintf("/tailnet/%s/network-logs", ts.tailnet)

	// Add query parameters for time range
	if start != "" && end != "" {
		endpoint += fmt.Sprintf("?start=%s&end=%s", start, end)
	}

	body, err := ts.makeRequest(endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch network logs: %w", err)
	}

	// Parse as generic interface to handle both array and object responses
	var response interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal network logs response: %w", err)
	}

	return response, nil
}

// GetNetworkMap retrieves the network map (simplified version)
func (ts *TailscaleService) GetNetworkMap() (map[string]interface{}, error) {
	// Get devices as the basis for network map
	devices, err := ts.GetDevices()
	if err != nil {
		return nil, err
	}

	// Create a simplified network map
	networkMap := map[string]interface{}{
		"tailnet":       ts.tailnet,
		"devices":       devices.Devices,
		"total_devices": len(devices.Devices),
		"online_devices": func() int {
			count := 0
			for _, device := range devices.Devices {
				if device.Online {
					count++
				}
			}
			return count
		}(),
	}

	return networkMap, nil
}

// GetDeviceFlows retrieves flow data for a specific device
func (ts *TailscaleService) GetDeviceFlows(deviceID string) (map[string]interface{}, error) {
	// Note: This is a placeholder as Tailscale doesn't have a public device flows API
	// In a real implementation, you might need to implement this differently
	// or collect this data through other means

	// For now, return mock data
	flows := map[string]interface{}{
		"device_id": deviceID,
		"flows": []map[string]interface{}{
			{
				"source":      "unknown",
				"destination": "unknown",
				"protocol":    "tcp",
				"bytes":       0,
				"packets":     0,
			},
		},
		"total_flows": 0,
	}

	return flows, nil
}
