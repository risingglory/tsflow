package client

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io"
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
	return &TailscaleClient{
		baseURL:     "https://api.tailscale.com/api/v2",
		accessToken: accessToken,
		tailnet:     tailnet,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *TailscaleClient) makeRequest(endpoint string) (*http.Response, error) {
	url := fmt.Sprintf("%s%s", c.baseURL, endpoint)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.SetBasicAuth(c.accessToken, "")
	req.Header.Set("Accept", "application/json")

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
	params := url.Values{}
	params.Add("start", start.Format(time.RFC3339))
	params.Add("end", end.Format(time.RFC3339))

	endpoint := fmt.Sprintf("/tailnet/%s/logging/network?%s", c.tailnet, params.Encode())

	resp, err := c.makeRequest(endpoint)
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
	endpoint := fmt.Sprintf("/tailnet/%s/devices", c.tailnet)

	resp, err := c.makeRequest(endpoint)
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
	deviceMap := make(map[string]*models.Device)
	ipToDevice := make(map[string]*models.Device)

	// Build device maps
	for i := range devices.Devices {
		device := &devices.Devices[i]
		deviceMap[device.ID] = device

		for _, addr := range device.Addresses {
			ip := strings.Split(addr, "/")[0]
			ipToDevice[ip] = device
		}
	}

	var rawFlows []models.RawFlowEntry
	flowAggregator := make(map[string]*models.FlowData)
	var timeStart, timeEnd time.Time

	// Process each log entry to create raw flows
	for _, log := range logs.Logs {
		if timeStart.IsZero() || log.Start.Before(timeStart) {
			timeStart = log.Start
		}
		if timeEnd.IsZero() || log.End.After(timeEnd) {
			timeEnd = log.End
		}

		// Process virtual traffic
		for _, flow := range log.VirtualTraffic {
			rawFlow := c.createRawFlowEntry(flow, "virtual", log, ipToDevice)
			rawFlows = append(rawFlows, rawFlow)
			c.aggregateFlow(flow, "virtual", log, ipToDevice, flowAggregator)
		}

		// Process physical traffic
		for _, flow := range log.PhysicalTraffic {
			rawFlow := c.createRawFlowEntry(flow, "physical", log, ipToDevice)
			rawFlows = append(rawFlows, rawFlow)
			c.aggregateFlow(flow, "physical", log, ipToDevice, flowAggregator)
		}

		// Process subnet traffic
		for _, flow := range log.SubnetTraffic {
			rawFlow := c.createRawFlowEntry(flow, "subnet", log, ipToDevice)
			rawFlows = append(rawFlows, rawFlow)
			c.aggregateFlow(flow, "subnet", log, ipToDevice, flowAggregator)
		}
	}

	// Convert aggregated flows to slice and sort by bytes
	var flows []models.FlowData
	for _, flow := range flowAggregator {
		flows = append(flows, *flow)
	}

	// Sort aggregated flows by total bytes (descending)
	sort.Slice(flows, func(i, j int) bool {
		return flows[i].TotalBytes > flows[j].TotalBytes
	})

	// Sort raw flows by timestamp (most recent first)
	sort.Slice(rawFlows, func(i, j int) bool {
		return rawFlows[i].Timestamp.After(rawFlows[j].Timestamp)
	})

	return &models.NetworkMap{
		Devices:  devices.Devices,
		Flows:    flows,
		RawFlows: rawFlows,
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

	// Generate unique ID for this flow entry
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

// FilterRawFlows applies filters to raw flow entries
func (c *TailscaleClient) FilterRawFlows(rawFlows []models.RawFlowEntry, filters models.FlowFilters) []models.RawFlowEntry {
	var filtered []models.RawFlowEntry

	for _, flow := range rawFlows {
		// Port filtering
		if len(filters.Ports) > 0 {
			portMatch := false
			for _, port := range filters.Ports {
				if flow.SourcePort == port || flow.DestinationPort == port {
					portMatch = true
					break
				}
			}
			if !portMatch {
				continue
			}
		}

		// Protocol filtering
		if len(filters.Protocols) > 0 {
			protocolMatch := false
			for _, protocol := range filters.Protocols {
				if strings.EqualFold(flow.Protocol, protocol) {
					protocolMatch = true
					break
				}
			}
			if !protocolMatch {
				continue
			}
		}

		// Flow type filtering
		if len(filters.FlowTypes) > 0 {
			flowTypeMatch := false
			for _, flowType := range filters.FlowTypes {
				if flow.FlowType == flowType {
					flowTypeMatch = true
					break
				}
			}
			if !flowTypeMatch {
				continue
			}
		}

		// Device ID filtering
		if len(filters.DeviceIDs) > 0 {
			deviceMatch := false
			for _, deviceID := range filters.DeviceIDs {
				if (flow.SourceDevice != nil && flow.SourceDevice.ID == deviceID) ||
					(flow.DestinationDevice != nil && flow.DestinationDevice.ID == deviceID) {
					deviceMatch = true
					break
				}
			}
			if !deviceMatch {
				continue
			}
		}

		// Bytes filtering
		if filters.MinBytes > 0 && flow.TotalBytes < filters.MinBytes {
			continue
		}
		if filters.MaxBytes > 0 && flow.TotalBytes > filters.MaxBytes {
			continue
		}

		filtered = append(filtered, flow)
	}

	// Sort the filtered results
	c.sortRawFlows(filtered, filters.SortBy, filters.SortOrder)

	// Apply limit
	if filters.Limit > 0 && len(filtered) > filters.Limit {
		filtered = filtered[:filters.Limit]
	}

	return filtered
}

// sortRawFlows sorts raw flows based on the specified criteria
func (c *TailscaleClient) sortRawFlows(flows []models.RawFlowEntry, sortBy, sortOrder string) {
	if sortBy == "" {
		sortBy = "timestamp"
	}
	if sortOrder == "" {
		sortOrder = "desc"
	}

	ascending := strings.ToLower(sortOrder) == "asc"

	sort.Slice(flows, func(i, j int) bool {
		var result bool
		switch strings.ToLower(sortBy) {
		case "timestamp":
			result = flows[i].Timestamp.Before(flows[j].Timestamp)
		case "bytes":
			result = flows[i].TotalBytes < flows[j].TotalBytes
		case "packets":
			result = flows[i].TotalPackets < flows[j].TotalPackets
		case "port":
			// Sort by destination port, then source port
			if flows[i].DestinationPort != flows[j].DestinationPort {
				result = flows[i].DestinationPort < flows[j].DestinationPort
			} else {
				result = flows[i].SourcePort < flows[j].SourcePort
			}
		case "protocol":
			result = flows[i].Protocol < flows[j].Protocol
		default:
			result = flows[i].Timestamp.Before(flows[j].Timestamp)
		}

		if ascending {
			return result
		}
		return !result
	})
}

func (c *TailscaleClient) aggregateFlow(flow models.TrafficFlow, flowType string, log models.NetworkLog, ipToDevice map[string]*models.Device, aggregator map[string]*models.FlowData) {
	srcIP, _ := parseAddress(flow.Src)
	dstIP, dstPort := parseAddress(flow.Dst)

	srcIP = normalizeIP(srcIP)
	dstIP = normalizeIP(dstIP)
	ipVersion := "ipv4"
	if isIPv6(srcIP) || isIPv6(dstIP) {
		ipVersion = "ipv6"
	}
	flowKey := fmt.Sprintf("%s->%s:%s:%s:%s", srcIP, dstIP, getProtocolName(flow.Proto), flowType, ipVersion)

	if existingFlow, exists := aggregator[flowKey]; exists {
		existingFlow.TotalBytes += flow.TxBytes + flow.RxBytes
		existingFlow.TotalPackets += flow.TxPkts + flow.RxPkts
		existingFlow.FlowCount++

		if log.Start.Before(existingFlow.TimeWindow.Start) {
			existingFlow.TimeWindow.Start = log.Start
		}
		if log.End.After(existingFlow.TimeWindow.End) {
			existingFlow.TimeWindow.End = log.End
		}
	} else {
		aggregator[flowKey] = &models.FlowData{
			SourceDevice:      ipToDevice[srcIP],
			DestinationDevice: ipToDevice[dstIP],
			SourceIP:          srcIP,
			DestinationIP:     dstIP,
			Protocol:          getProtocolName(flow.Proto),
			Port:              dstPort,
			TotalBytes:        flow.TxBytes + flow.RxBytes,
			TotalPackets:      flow.TxPkts + flow.RxPkts,
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
