# TSFlow - Tailscale Network Flow Visualizer

A modern, interactive network flow visualizer for Tailscale networks, built with Go and D3.js. TSFlow provides a comprehensive web interface to visualize, analyze, and explore network traffic flows in your Tailscale network (tailnet).

![TSFlow Interface](https://via.placeholder.com/800x400?text=TSFlow+Network+Visualization)

## ✨ Features

### 🌐 **Interactive Network Visualization**
- **Force-directed topology** - Dynamic network graphs with real-time positioning
- **Circular layout** - Organized ring view of your tailnet devices
- **Grid layout** - Structured arrangement for systematic analysis
- **Multiple view modes** - Switch between visualization styles seamlessly

### 📊 **Advanced Flow Analysis**
- **Real-time traffic monitoring** - Live bandwidth and packet analysis
- **Protocol breakdown** - TCP, UDP, ICMP flow categorization
- **Flow aggregation** - Smart grouping of related network flows
- **Traffic volume visualization** - Bandwidth-based link thickness scaling

### 🎯 **Smart Filtering & Search**
- **Dynamic search** - Advanced query syntax (`protocol:tcp`, `traffic:>10mb`, `tag:exit-node`)
- **Device-centric views** - Focus on specific machines and their connections
- **External IP filtering** - Show/hide connections to external networks
- **Protocol filters** - Filter by TCP, UDP, ICMP, or custom protocols

### ⏰ **Flexible Time Analysis**
- **Time range selection** - From 1 hour to 7 days of historical data
- **Custom date ranges** - Pick specific start and end times
- **Performance optimization** - Smart limits for large datasets
- **Real-time updates** - Manual refresh with loading indicators

### 🎨 **Modern Interface**
- **Tailscale-inspired design** - Authentic dark theme matching Tailscale
- **Responsive layout** - Works on desktop, tablet, and mobile
- **Collapsible sidebar** - Maximizes visualization space
- **Interactive controls** - Zoom, pan, and drag functionality

### 📈 **Comprehensive Analytics**
- **Device status monitoring** - Online/offline state tracking
- **Traffic statistics** - Throughput, packet counts, and flow summaries
- **Connection mapping** - Source-destination relationship analysis
- **Export capabilities** - JSON data export for external analysis

## 🚀 Quick Start

### Prerequisites

- **Go 1.21+** - Modern Go runtime
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
  tsflow:latest
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

### Visualization Controls

- **🖱️ Mouse Controls**: Click to select, drag to reposition
- **🔍 Zoom**: Mouse wheel or toolbar buttons
- **📱 Touch**: Pinch to zoom, tap to select
- **⌨️ Keyboard**: Space to pause simulation

### Layout Options

1. **Force Layout** - Dynamic positioning based on connections
2. **Circular Layout** - Devices arranged in a circle  
3. **Grid Layout** - Systematic grid arrangement

## 🏗️ Architecture

### Project Structure
```
tsflow/
├── main.go              # Application entry point & routing
├── handlers/api.go      # HTTP handlers & API endpoints  
├── client/tailscale.go  # Tailscale API client & data processing
├── models/tailscale.go  # Data models & structures
├── templates/index.html # Web interface (Vue-like SPA)
├── Dockerfile          # Container build configuration
├── docker-compose.yml  # Multi-container setup
└── go.mod              # Go dependencies
```

### Data Flow
```
Tailscale API → Client → Processing → API Handlers → Web Interface
     ↓              ↓         ↓           ↓             ↓
Network Logs → Flow Data → Aggregation → JSON API → Visualization
Device Info  → Metadata → Enhancement → REST API → Interactive UI
```

### Technology Stack
- **Backend**: Go 1.21, Gin web framework
- **Frontend**: Vanilla JavaScript, D3.js, Tailwind CSS
- **API**: Tailscale REST API v2
- **Deployment**: Docker, Docker Compose

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
    build: .
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
# Build
docker build -t tsflow .

# Run  
docker run -d \
  --name tsflow \
  -p 8080:8080 \
  -e TAILSCALE_ACCESS_TOKEN="your-token" \
  -e TAILSCALE_TAILNET="your-tailnet" \
  tsflow:latest
```

## 🛠️ Development

### Development Setup
```bash
# Clone repository
git clone https://github.com/your-org/tsflow.git
cd tsflow

# Install dependencies
go mod tidy

# Run in development mode
go run main.go -debug \
  -token "your-token" \
  -tailnet "your-tailnet"
```

### Building
```bash
# Local build
go build -o tsflow

# Cross-platform builds
GOOS=linux GOARCH=amd64 go build -o tsflow-linux-amd64
GOOS=darwin GOARCH=amd64 go build -o tsflow-darwin-amd64  
GOOS=windows GOARCH=amd64 go build -o tsflow-windows-amd64.exe
```

### Testing
```bash
# Run tests
go test ./...

# Test with coverage
go test -cover ./...

# Integration tests
./test_api.sh  # If test script exists
```

## 🚨 Troubleshooting

### Common Issues

#### ❌ "Failed to fetch network logs"
**Solutions:**
- Verify API token has **network logging permissions**
- Ensure network flow logging is **enabled** for your tailnet
- Check that the time range has **available data**
- Verify **tailnet name** format (e.g., `example.org.github`)

#### ❌ "No devices found"  
**Solutions:**
- Double-check **tailnet name** spelling
- Verify API token has **device read permissions**
- Ensure devices are **connected** to the tailnet

#### ❌ Empty or slow visualization
**Solutions:**
- Try a **different time range** with known activity
- Reduce time range for better **performance**
- Check browser **console** for JavaScript errors
- Verify devices had **network activity** during selected period

#### ❌ "Time range too large" errors
**Solutions:**
- Use smaller time ranges (**≤24 hours for device flows**, **≤7 days for network map**)
- Network logging has **30-day retention** limit
- Large ranges may **timeout** - use pagination

### Performance Tips

- **Limit time ranges** for faster loading
- **Use filters** to reduce data volume  
- **Hide external IPs** for internal-only analysis
- **Focus on specific devices** to reduce complexity
- **Export data** for offline analysis of large datasets

### Browser Compatibility

- **Chrome 90+** ✅ (Recommended)
- **Firefox 88+** ✅
- **Safari 14+** ✅  
- **Edge 90+** ✅

### Network Requirements

- **HTTPS** required for Tailscale API
- **Port 8080** (default) or custom port
- **Internet access** for Tailscale API calls

## 📊 Monitoring & Observability

### Health Monitoring
```bash
# Health check
curl http://localhost:8080/api/health

# Metrics (if available)
curl http://localhost:8080/metrics
```

### Logging
```bash
# Debug mode
./tsflow -debug

# Docker logs
docker logs tsflow
```

## 🔐 Security Considerations

- **API tokens** are sensitive - use environment variables
- **Network flow data** may contain sensitive information
- Run on **internal networks** or behind authentication
- Consider **rate limiting** for production deployments
- **Rotate API tokens** regularly

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Process
1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes  
4. **Add** tests if applicable
5. **Submit** a pull request

## 🙏 Acknowledgments

- **[Cilium Hubble](https://github.com/cilium/hubble)** - Inspiration for network observability
- **[Tailscale](https://tailscale.com/)** - Amazing networking platform and API
- **[D3.js](https://d3js.org/)** - Powerful data visualization library
- **[Tailwind CSS](https://tailwindcss.com/)** - Modern CSS framework
- **[Go](https://golang.org/)** - Efficient backend language

## 🔗 Related Projects

- **[Tailscale](https://tailscale.com/)** - Zero-config VPN built on WireGuard
- **[Headscale](https://github.com/juanfont/headscale)** - Open source Tailscale control server  
- **[Cilium Hubble](https://github.com/cilium/hubble)** - Network observability for Kubernetes

---

**⚠️ Disclaimer**: This project is not officially affiliated with Tailscale Inc. It's a community tool built using Tailscale's public API for network analysis and visualization.

**📧 Support**: For issues and questions, please use the [GitHub Issues](https://github.com/your-org/tsflow/issues) page. 