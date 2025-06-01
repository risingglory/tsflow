# TSFlow - Tailscale Network Flow Visualizer

A modern, interactive network flow visualizer for Tailscale networks, built with Go and D3.js. TSFlow provides a comprehensive web interface to visualize, analyze, and explore network traffic flows in your Tailscale network (tailnet).

## ✨ Features

- 🌐 **Interactive Visualization** - Force-directed, circular, and grid network layouts
- 📊 **Traffic Analysis** - Real-time bandwidth monitoring and protocol breakdown
- 🎯 **Smart Search** - Advanced filtering (`protocol:tcp`, `traffic:>10mb`, `tag:exit-node`)
- ⏰ **Time Range Control** - Flexible historical data exploration (1 hour to 7 days)
- 🎨 **Modern UI** - Tailscale-inspired dark theme with responsive design
- 📈 **Device Analytics** - Online/offline status, traffic stats, and connection mapping
- 💾 **Data Export** - JSON export for external analysis
- 🔍 **Zoom & Pan** - Interactive controls with device-centric views

## 🚀 Quick Start

### Prerequisites

- **Tailscale API token** - With network logging permissions
- **Network flow logging** - Enabled on your tailnet (Premium/Enterprise)

### Installation

#### Build from Source
```bash
git clone git@github.com:rajsinghtech/tsflow.git
cd tsflow
go mod tidy
go build -o tsflow && ./tsflow -token "INSERT" -tailnet "INSERT"
```

#### Docker
```bash
docker run -p 8080:8080 \
  -e TAILSCALE_ACCESS_TOKEN="INSERT" \
  -e TAILSCALE_TAILNET="INSERT" \
  ghcr.io/rajsinghtech/tsflow:latest
```

### Configuration

#### 1. Get Tailscale API Token
1. Visit [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Generate access token with **Network Logs** permission
3. Copy token (format: `tskey-api-xxxxxx`)

#### 2. Enable Network Flow Logging
- Logs retained for **30 days**
- Requires Tailscale client **v1.34+** on devices

#### 3. Find Your Tailnet Name
- Format: `example.org.github` or `user@domain.com`
- Available in Tailscale Admin Console

Then open: **http://localhost:8080**

## 🔧 Command Line Options

```bash
./tsflow [options]

Flags:
  -token string     Tailscale API access token (required)
  -tailnet string   Tailnet name (required)  
  -port string      Server port (default: "8080")
  -debug           Enable debug logging (default: false)
  -help            Show help message
```

## 🌐 API Reference

TSFlow provides a comprehensive REST API for programmatic access:

### Network Map
```http
GET /api/network-map
GET /api/network-map?start=2025-05-30T00:00:00.000Z&end=2025-05-31T10:00:00.000Z
```
Returns complete network topology with devices and flows.

### Devices
```http
GET /api/devices
```
Lists all devices in the tailnet with metadata.

### Device Flows  
```http
GET /api/devices/{deviceId}/flows
GET /api/devices/{deviceId}/flows?limit=100&start=...&end=...
```
Returns flows for a specific device with optional filtering.

### Health Check
```http
GET /api/health
```
Service health and status information.

### API Documentation
```http
GET /api/docs
```
Complete API documentation with examples.

## 🎮 Using the Interface

### Search & Filtering

TSFlow supports advanced search syntax:

```bash
# Protocol filtering
protocol:tcp
protocol:udp

# Traffic volume filtering  
traffic:>10mb
traffic:>1gb
traffic:<100kb

# Tag-based filtering
tag:exit-node
tag:ssh
has:tags

# IP address filtering
ip:192.168.1.100
type:external
type:internal

# Combined queries
protocol:tcp traffic:>10mb tag:server
```



### Technology Stack
- **Backend**: Go 1.21, Gin web framework
- **Frontend**: Vanilla JavaScript, D3.js, Tailwind CSS
- **API**: Tailscale REST API v2

## 🔄 Flow Types Explained

### Virtual Traffic
Direct communication between Tailscale devices within your tailnet. This represents the "logical" network topology.

### Physical Traffic  
Actual network paths including relay usage and direct connections. Shows real packet routes.

### Subnet Traffic
Communication through subnet routers to access local networks and resources.

## 🐳 Docker Deployment

### Docker Compose (Recommended)
```yaml
version: '3.8'
services:
  tsflow:
    image: ghcr.io/rajsinghtech/tsflow:latest
    ports:
      - "8080:8080"
    environment:
      - TAILSCALE_ACCESS_TOKEN=${TAILSCALE_ACCESS_TOKEN}
      - TAILSCALE_TAILNET=${TAILSCALE_TAILNET}
    restart: unless-stopped
```

```bash
# Setup
echo "TAILSCALE_ACCESS_TOKEN=your-token" > .env
echo "TAILSCALE_TAILNET=your-tailnet" >> .env

# Run
docker-compose up -d
```

### Standalone Docker
```bash
# Run latest version
docker run -d \
  --name tsflow \
  -p 8080:8080 \
  -e TAILSCALE_ACCESS_TOKEN="your-token" \
  -e TAILSCALE_TAILNET="your-tailnet" \
  ghcr.io/rajsinghtech/tsflow:latest
```