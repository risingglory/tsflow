package client

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
	"tsflow/models"
)

type TailscaleClient struct {
	baseURL     string
	accessToken string
	tailnet     string
	httpClient  *http.Client
}

func NewTailscaleClient(accessToken, tailnet string) *TailscaleClient {
	// Optimize HTTP client with connection pooling and timeouts
	transport := &http.Transport{
		Dial: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).Dial,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 15 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
		MaxConnsPerHost:       50,
		IdleConnTimeout:       90 * time.Second,
	}

	return &TailscaleClient{
		baseURL:     "https://api.tailscale.com/api/v2",
		accessToken: accessToken,
		tailnet:     tailnet,
		httpClient: &http.Client{
			Timeout:   45 * time.Second,
			Transport: transport,
		},
	}
}

func (c *TailscaleClient) makeRequest(endpoint string) (*http.Response, error) {
	return c.makeRequestWithContext(context.Background(), endpoint)
}

func (c *TailscaleClient) makeRequestWithContext(ctx context.Context, endpoint string) (*http.Response, error) {
	url := fmt.Sprintf("%s%s", c.baseURL, endpoint)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.SetBasicAuth(c.accessToken, "")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "TSFlow/1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("making request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return resp, nil
}

func (c *TailscaleClient) GetNetworkLogs(start, end time.Time) (*models.NetworkLogResponse, error) {
	return c.GetNetworkLogsWithContext(context.Background(), start, end)
}

func (c *TailscaleClient) GetNetworkLogsWithContext(ctx context.Context, start, end time.Time) (*models.NetworkLogResponse, error) {
	params := url.Values{}
	params.Add("start", start.Format(time.RFC3339))
	params.Add("end", end.Format(time.RFC3339))

	endpoint := fmt.Sprintf("/tailnet/%s/logging/network?%s", c.tailnet, params.Encode())

	resp, err := c.makeRequestWithContext(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("fetching network logs: %w", err)
	}
	defer resp.Body.Close()

	var logResponse models.NetworkLogResponse
	if err := json.NewDecoder(resp.Body).Decode(&logResponse); err != nil {
		return nil, fmt.Errorf("decoding network logs response: %w", err)
	}

	return &logResponse, nil
}

func (c *TailscaleClient) GetDevices() (*models.DevicesResponse, error) {
	return c.GetDevicesWithContext(context.Background())
}

func (c *TailscaleClient) GetDevicesWithContext(ctx context.Context) (*models.DevicesResponse, error) {
	endpoint := fmt.Sprintf("/tailnet/%s/devices", c.tailnet)

	resp, err := c.makeRequestWithContext(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("fetching devices: %w", err)
	}
	defer resp.Body.Close()

	var devicesResponse models.DevicesResponse
	if err := json.NewDecoder(resp.Body).Decode(&devicesResponse); err != nil {
		return nil, fmt.Errorf("decoding devices response: %w", err)
	}

	return &devicesResponse, nil
}

// ProcessFlowData processes raw network logs into both raw flow entries and aggregated flow data
func (c *TailscaleClient) ProcessFlowData(logs *models.NetworkLogResponse, devices *models.DevicesResponse) *models.NetworkMap {
	return c.ProcessFlowDataWithContext(context.Background(), logs, devices)
}

// ProcessFlowDataWithContext processes flow data with context support and optimization
func (c *TailscaleClient) ProcessFlowDataWithContext(ctx context.Context, logs *models.NetworkLogResponse, devices *models.DevicesResponse) *models.NetworkMap {
	// Build device maps once for efficiency
	deviceMap := make(map[string]*models.Device, len(devices.Devices))
	ipToDevice := make(map[string]*models.Device)

	for i := range devices.Devices {
		device := &devices.Devices[i]
		deviceMap[device.ID] = device

		for _, addr := range device.Addresses {
			ip := strings.Split(addr, "/")[0]
			ipToDevice[ip] = device
		}
	}

	// Process flows sequentially to avoid race conditions
	var allRawFlows []models.RawFlowEntry
	globalAggregator := make(map[string]*models.FlowData)
	var timeStart, timeEnd time.Time

	for _, log := range logs.Logs {
		select {
		case <-ctx.Done():
			break
		default:
		}

		if timeStart.IsZero() || log.Start.Before(timeStart) {
			timeStart = log.Start
		}
		if timeEnd.IsZero() || log.End.After(timeEnd) {
			timeEnd = log.End
		}

		// Process virtual traffic
		for _, flow := range log.VirtualTraffic {
			rawFlow := c.createRawFlowEntry(flow, "virtual", log, ipToDevice)
			allRawFlows = append(allRawFlows, rawFlow)
			c.aggregateFlow(flow, "virtual", log, ipToDevice, globalAggregator)
		}

		// Process physical traffic
		for _, flow := range log.PhysicalTraffic {
			rawFlow := c.createRawFlowEntry(flow, "physical", log, ipToDevice)
			allRawFlows = append(allRawFlows, rawFlow)
			c.aggregateFlow(flow, "physical", log, ipToDevice, globalAggregator)
		}

		// Process subnet traffic
		for _, flow := range log.SubnetTraffic {
			rawFlow := c.createRawFlowEntry(flow, "subnet", log, ipToDevice)
			allRawFlows = append(allRawFlows, rawFlow)
			c.aggregateFlow(flow, "subnet", log, ipToDevice, globalAggregator)
		}
	}

	// Convert aggregated flows to slice and sort by bytes
	flows := make([]models.FlowData, 0, len(globalAggregator))
	for _, flow := range globalAggregator {
		flows = append(flows, *flow)
	}

	// Sort aggregated flows by total bytes (descending)
	sort.Slice(flows, func(i, j int) bool {
		return flows[i].TotalBytes > flows[j].TotalBytes
	})

	// Sort raw flows by timestamp (most recent first)
	sort.Slice(allRawFlows, func(i, j int) bool {
		return allRawFlows[i].Timestamp.After(allRawFlows[j].Timestamp)
	})

	return &models.NetworkMap{
		Devices:  devices.Devices,
		Flows:    flows,
		RawFlows: allRawFlows,
		TimeRange: models.TimeWindow{
			Start: timeStart,
			End:   timeEnd,
		},
	}
}

// createRawFlowEntry creates a raw flow entry from a traffic flow
func (c *TailscaleClient) createRawFlowEntry(flow models.TrafficFlow, flowType string, log models.NetworkLog, ipToDevice map[string]*models.Device) models.RawFlowEntry {
	srcIP, srcPort := parseAddress(flow.Src)
	dstIP, dstPort := parseAddress(flow.Dst)

	srcIP = normalizeIP(srcIP)
	dstIP = normalizeIP(dstIP)

	// Generate unique ID for this flow entry - more efficient hashing
	flowID := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%s-%s-%s-%s-%s-%d-%d",
		log.NodeID, srcIP, dstIP, srcPort, dstPort, log.Start.Unix(), flow.Proto))))

	// Determine direction
	direction := "bidirectional"
	if flow.TxBytes > 0 && flow.RxBytes == 0 {
		direction = "outbound"
	} else if flow.RxBytes > 0 && flow.TxBytes == 0 {
		direction = "inbound"
	}

	return models.RawFlowEntry{
		ID:                flowID,
		NodeID:            log.NodeID,
		Timestamp:         log.Logged,
		StartTime:         log.Start,
		EndTime:           log.End,
		SourceDevice:      ipToDevice[srcIP],
		DestinationDevice: ipToDevice[dstIP],
		SourceIP:          srcIP,
		DestinationIP:     dstIP,
		SourcePort:        srcPort,
		DestinationPort:   dstPort,
		Protocol:          getProtocolName(flow.Proto),
		ProtocolNumber:    flow.Proto,
		TxBytes:           flow.TxBytes,
		RxBytes:           flow.RxBytes,
		TxPackets:         flow.TxPkts,
		RxPackets:         flow.RxPkts,
		TotalBytes:        flow.TxBytes + flow.RxBytes,
		TotalPackets:      flow.TxPkts + flow.RxPkts,
		FlowType:          flowType,
		Direction:         direction,
	}
}

// FilterRawFlows applies filters to raw flows with optimizations
func (c *TailscaleClient) FilterRawFlows(rawFlows []models.RawFlowEntry, filters models.FlowFilters) []models.RawFlowEntry {
	if len(rawFlows) == 0 {
		return rawFlows
	}

	// Pre-allocate slice with estimated capacity
	estimatedSize := len(rawFlows) / 2
	if estimatedSize > filters.Limit {
		estimatedSize = filters.Limit
	}
	filtered := make([]models.RawFlowEntry, 0, estimatedSize)

	// Create maps for faster lookup
	portMap := make(map[string]bool, len(filters.Ports))
	for _, port := range filters.Ports {
		portMap[port] = true
	}

	protocolMap := make(map[string]bool, len(filters.Protocols))
	for _, protocol := range filters.Protocols {
		protocolMap[strings.ToLower(protocol)] = true
	}

	flowTypeMap := make(map[string]bool, len(filters.FlowTypes))
	for _, flowType := range filters.FlowTypes {
		flowTypeMap[strings.ToLower(flowType)] = true
	}

	deviceIDMap := make(map[string]bool, len(filters.DeviceIDs))
	for _, deviceID := range filters.DeviceIDs {
		deviceIDMap[deviceID] = true
	}

	for i := range rawFlows {
		flow := &rawFlows[i]

		// Early exit if we've reached the limit
		if len(filtered) >= filters.Limit {
			break
		}

		// Port filter
		if len(portMap) > 0 {
			if !portMap[flow.SourcePort] && !portMap[flow.DestinationPort] {
				continue
			}
		}

		// Protocol filter
		if len(protocolMap) > 0 {
			if !protocolMap[strings.ToLower(flow.Protocol)] {
				continue
			}
		}

		// Flow type filter
		if len(flowTypeMap) > 0 {
			if !flowTypeMap[strings.ToLower(flow.FlowType)] {
				continue
			}
		}

		// Device ID filter
		if len(deviceIDMap) > 0 {
			sourceMatch := flow.SourceDevice != nil && deviceIDMap[flow.SourceDevice.ID]
			destMatch := flow.DestinationDevice != nil && deviceIDMap[flow.DestinationDevice.ID]
			if !sourceMatch && !destMatch {
				continue
			}
		}

		// Bytes filter
		if filters.MinBytes > 0 && flow.TotalBytes < filters.MinBytes {
			continue
		}

		if filters.MaxBytes > 0 && flow.TotalBytes > filters.MaxBytes {
			continue
		}

		filtered = append(filtered, *flow)
	}

	// Sort the filtered results
	c.sortRawFlows(filtered, filters.SortBy, filters.SortOrder)

	// Apply limit after sorting
	if len(filtered) > filters.Limit {
		filtered = filtered[:filters.Limit]
	}

	return filtered
}

// sortRawFlows sorts flows based on criteria with optimizations
func (c *TailscaleClient) sortRawFlows(flows []models.RawFlowEntry, sortBy, sortOrder string) {
	ascending := strings.ToLower(sortOrder) == "asc"

	switch strings.ToLower(sortBy) {
	case "bytes":
		sort.Slice(flows, func(i, j int) bool {
			if ascending {
				return flows[i].TotalBytes < flows[j].TotalBytes
			}
			return flows[i].TotalBytes > flows[j].TotalBytes
		})
	case "packets":
		sort.Slice(flows, func(i, j int) bool {
			if ascending {
				return flows[i].TotalPackets < flows[j].TotalPackets
			}
			return flows[i].TotalPackets > flows[j].TotalPackets
		})
	case "port":
		sort.Slice(flows, func(i, j int) bool {
			if ascending {
				return flows[i].DestinationPort < flows[j].DestinationPort
			}
			return flows[i].DestinationPort > flows[j].DestinationPort
		})
	case "protocol":
		sort.Slice(flows, func(i, j int) bool {
			if ascending {
				return flows[i].Protocol < flows[j].Protocol
			}
			return flows[i].Protocol > flows[j].Protocol
		})
	default: // timestamp
		sort.Slice(flows, func(i, j int) bool {
			if ascending {
				return flows[i].Timestamp.Before(flows[j].Timestamp)
			}
			return flows[i].Timestamp.After(flows[j].Timestamp)
		})
	}
}

// aggregateFlow aggregates traffic flows for summary statistics
func (c *TailscaleClient) aggregateFlow(flow models.TrafficFlow, flowType string, log models.NetworkLog, ipToDevice map[string]*models.Device, aggregator map[string]*models.FlowData) {
	srcIP, _ := parseAddress(flow.Src)
	dstIP, dstPort := parseAddress(flow.Dst)

	srcIP = normalizeIP(srcIP)
	dstIP = normalizeIP(dstIP)

	// Create aggregation key
	key := fmt.Sprintf("%s:%s:%s:%s:%s", srcIP, dstIP, getProtocolName(flow.Proto), dstPort, flowType)

	totalBytes := flow.TxBytes + flow.RxBytes
	totalPackets := flow.TxPkts + flow.RxPkts

	if existing, exists := aggregator[key]; exists {
		existing.TotalBytes += totalBytes
		existing.TotalPackets += totalPackets
		existing.FlowCount++
		if log.Start.Before(existing.TimeWindow.Start) {
			existing.TimeWindow.Start = log.Start
		}
		if log.End.After(existing.TimeWindow.End) {
			existing.TimeWindow.End = log.End
		}
	} else {
		aggregator[key] = &models.FlowData{
			SourceDevice:      ipToDevice[srcIP],
			DestinationDevice: ipToDevice[dstIP],
			SourceIP:          srcIP,
			DestinationIP:     dstIP,
			Protocol:          getProtocolName(flow.Proto),
			Port:              dstPort,
			TotalBytes:        totalBytes,
			TotalPackets:      totalPackets,
			FlowType:          flowType,
			FlowCount:         1,
			TimeWindow: models.TimeWindow{
				Start: log.Start,
				End:   log.End,
			},
		}
	}
}

func parseAddress(addr string) (ip, port string) {
	if strings.HasPrefix(addr, "[") {
		// IPv6 address with port: [::1]:8080
		if idx := strings.LastIndex(addr, "]:"); idx != -1 {
			ip = addr[1:idx]
			port = addr[idx+2:]
			return
		}
		// IPv6 address without port: [::1]
		ip = strings.Trim(addr, "[]")
		return
	}

	// IPv4 address with port: 192.168.1.1:8080
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		// Check if this is actually a port (numeric)
		potentialPort := addr[idx+1:]
		if potentialPort != "" && isNumeric(potentialPort) {
			ip = addr[:idx]
			port = potentialPort
			return
		}
	}

	// No port found
	ip = addr
	return
}

func isNumeric(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return len(s) > 0
}

func getProtocolName(proto int) string {
	switch proto {
	case 0:
		return "proto-0"
	case 1:
		return "ICMP"
	case 6:
		return "TCP"
	case 17:
		return "UDP"
	case 255:
		return "RAW"
	default:
		return fmt.Sprintf("proto-%d", proto)
	}
}

func isIPv6(ip string) bool {
	return strings.Contains(ip, ":")
}

func normalizeIP(ip string) string {
	if idx := strings.Index(ip, "%"); idx != -1 {
		ip = ip[:idx]
	}

	if isIPv6(ip) {
		return strings.ToLower(ip)
	}

	return ip
}
