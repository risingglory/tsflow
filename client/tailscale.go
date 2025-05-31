package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

// ProcessFlowData processes raw network logs into structured flow data with aggregation
func (c *TailscaleClient) ProcessFlowData(logs *models.NetworkLogResponse, devices *models.DevicesResponse) *models.NetworkMap {
	deviceMap := make(map[string]*models.Device)
	ipToDevice := make(map[string]*models.Device)

	for i := range devices.Devices {
		device := &devices.Devices[i]
		deviceMap[device.ID] = device

		for _, addr := range device.Addresses {
			ip := strings.Split(addr, "/")[0]
			ipToDevice[ip] = device
		}
	}

	flowAggregator := make(map[string]*models.FlowData)
	var timeStart, timeEnd time.Time

	for _, log := range logs.Logs {
		if timeStart.IsZero() || log.Start.Before(timeStart) {
			timeStart = log.Start
		}
		if timeEnd.IsZero() || log.End.After(timeEnd) {
			timeEnd = log.End
		}

		for _, flow := range log.VirtualTraffic {
			c.aggregateFlow(flow, "virtual", log, ipToDevice, flowAggregator)
		}

		for _, flow := range log.PhysicalTraffic {
			c.aggregateFlow(flow, "physical", log, ipToDevice, flowAggregator)
		}

		for _, flow := range log.SubnetTraffic {
			c.aggregateFlow(flow, "subnet", log, ipToDevice, flowAggregator)
		}
	}

	var flows []models.FlowData
	for _, flow := range flowAggregator {
		flows = append(flows, *flow)
	}
	for i := 0; i < len(flows)-1; i++ {
		for j := i + 1; j < len(flows); j++ {
			if flows[i].TotalBytes < flows[j].TotalBytes {
				flows[i], flows[j] = flows[j], flows[i]
			}
		}
	}

	return &models.NetworkMap{
		Devices: devices.Devices,
		Flows:   flows,
		TimeRange: models.TimeWindow{
			Start: timeStart,
			End:   timeEnd,
		},
	}
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
		if idx := strings.LastIndex(addr, "]:"); idx != -1 {
			ip = addr[1:idx]
			port = addr[idx+2:]
			return
		}
		ip = strings.Trim(addr, "[]")
		return
	}

	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		ip = addr[:idx]
		port = addr[idx+1:]
		return
	}

	ip = addr
	return
}

func getProtocolName(proto int) string {
	switch proto {
	case 1:
		return "ICMP"
	case 6:
		return "TCP"
	case 17:
		return "UDP"
	case 255:
		return "RAW"
	default:
		return fmt.Sprintf("Proto-%d", proto)
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
