package models

import "time"

type NetworkLogResponse struct {
	Logs []NetworkLog `json:"logs"`
}

type NetworkLog struct {
	NodeID          string        `json:"nodeId"`
	Logged          time.Time     `json:"logged"`
	Start           time.Time     `json:"start"`
	End             time.Time     `json:"end"`
	VirtualTraffic  []TrafficFlow `json:"virtualTraffic,omitempty"`
	PhysicalTraffic []TrafficFlow `json:"physicalTraffic,omitempty"`
	SubnetTraffic   []TrafficFlow `json:"subnetTraffic,omitempty"`
}

type TrafficFlow struct {
	Proto   int    `json:"proto"`
	Src     string `json:"src"`
	Dst     string `json:"dst"`
	TxPkts  int    `json:"txPkts"`
	TxBytes int    `json:"txBytes"`
	RxPkts  int    `json:"rxPkts"`
	RxBytes int    `json:"rxBytes"`
}

type DevicesResponse struct {
	Devices []Device `json:"devices"`
}

type Device struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Hostname       string    `json:"hostname"`
	MachineKey     string    `json:"machineKey"`
	NodeKey        string    `json:"nodeKey"`
	User           string    `json:"user"`
	Tags           []string  `json:"tags"`
	Addresses      []string  `json:"addresses"`
	OS             string    `json:"os"`
	LastSeen       time.Time `json:"lastSeen"`
	Created        time.Time `json:"created"`
	Online         bool      `json:"online"`
	ExitNode       bool      `json:"exitNode"`
	ExitNodeOption bool      `json:"exitNodeOption"`
}

type FlowData struct {
	SourceDevice      *Device    `json:"sourceDevice"`
	DestinationDevice *Device    `json:"destinationDevice"`
	SourceIP          string     `json:"sourceIP"`
	DestinationIP     string     `json:"destinationIP"`
	Protocol          string     `json:"protocol"`
	Port              string     `json:"port"`
	TotalBytes        int        `json:"totalBytes"`
	TotalPackets      int        `json:"totalPackets"`
	FlowType          string     `json:"flowType"`
	FlowCount         int        `json:"flowCount"`
	TimeWindow        TimeWindow `json:"timeWindow"`
}

type TimeWindow struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

type NetworkMap struct {
	Devices   []Device   `json:"devices"`
	Flows     []FlowData `json:"flows"`
	TimeRange TimeWindow `json:"timeRange"`
}
