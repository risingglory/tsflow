# TSFlow - Tailscale Network Flow Visualizer

A modern, real-time web application for visualizing and analyzing network traffic flows within Tailscale networks.

## Architecture Overview

TSFlow uses a **Go backend + React frontend** architecture for optimal performance and security:

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   React App     │    │   Go Backend    │    │   Tailscale API  │
│   (Frontend)    │◄──►│   (Gin Server)  │◄──►│  api.tailscale.  │
│                 │    │                 │    │       com        │
└─────────────────┘    └─────────────────┘    └──────────────────┘
```

**Benefits:**
- ✅ **No CORS Issues**: Backend handles all Tailscale API calls
- ✅ **Better Security**: API keys stored server-side only
- ✅ **Improved Performance**: Efficient Go backend with caching
- ✅ **Production Ready**: Single Docker image with both components

## Features

### 🌐 **Network Topology Visualization**
- Interactive force-directed graph showing device connections
- Real-time traffic flow animation with D3.js
- Multiple layout algorithms (force-directed, circular, grid, hierarchical)
- Zoom and pan controls for detailed exploration

### 📊 **Comprehensive Analytics**
- Real-time traffic metrics and statistics
- Protocol and port usage analysis (TCP, UDP, ICMP)
- Device activity monitoring across your tailnet
- Historical data visualization with customizable time ranges

### 🔍 **Advanced Filtering**
- Flexible time range selection (5min, 1hour, 24hours, custom)
- Protocol-based filtering (TCP, UDP, ICMP)
- Traffic type filtering (virtual, subnet, physical)
- IP category filtering (Tailscale, private, public)
- Bandwidth and connection threshold filtering

### 🎯 **Device Management**
- Real-time device status monitoring (online/offline)
- Detailed device information and metadata
- Operating system detection and iconography
- Tag-based organization and filtering

### ⚡ **Modern Tech Stack**
- **Go (Gin)** backend for high-performance API serving
- **React 18** with TypeScript for type safety
- **Vite** for lightning-fast frontend development
- **Tailwind CSS** for beautiful, responsive design
- **D3.js** for powerful network visualization
- **SWR** for efficient data fetching and caching

## Quick Start

### Prerequisites
- **Tailscale API key** with appropriate permissions
- **Docker** (recommended) or Go 1.21+ and Node.js 18+

### Option 1: Using Docker (Recommended)

The fastest way to get started:

```bash
# Create environment file
cp env.example .env
# Edit .env with your Tailscale credentials

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f tsflow
```

Then navigate to `http://localhost:8080` to start exploring your network!

### Option 2: Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/rajsinghtech/tsflow.git
   cd tsflow
   ```

2. **Configure environment**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your Tailscale credentials:
   ```env
   TAILSCALE_API_KEY=tskey-api-your-api-key-here
   TAILSCALE_TAILNET=your-tailnet-name
   PORT=8080
   ENVIRONMENT=development
   ```

3. **Build the frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. **Run the backend**
   ```bash
   cd backend
   go mod download
   go run main.go
   ```

5. **Open your browser**
   Navigate to `http://localhost:8080` to start exploring your network!

## Docker Deployment

### Using Pre-built Images (Recommended)

Pre-built container images are automatically built and published to GitHub Container Registry:

```bash
# Pull and run the latest image
docker run -d \
  -p 8080:8080 \
  -e TAILSCALE_API_KEY=your-api-key \
  -e TAILSCALE_TAILNET=your-tailnet \
  --name tsflow \
  ghcr.io/rajsinghtech/tsflow:latest
```

**Available tags:**
- `latest` - Latest stable release from main branch
- `<commit-sha>` - Specific commit builds
- `<version>` - Tagged releases

### Using Docker Compose (Recommended)

The included `docker-compose.yml` file provides the easiest deployment:

```yaml
services:
  tsflow:
    build: .
    ports:
      - "8080:8080"
    environment:
      - TAILSCALE_API_KEY=${TAILSCALE_API_KEY}
      - TAILSCALE_TAILNET=${TAILSCALE_TAILNET}
      - PORT=8080
      - ENVIRONMENT=production
    env_file:
      - .env
    restart: unless-stopped
```

**Commands:**
```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f tsflow

# Rebuild and restart
docker-compose up --build -d

# Stop the application
docker-compose down
```

### Building from Source

```bash
# Build the image
docker build -t tsflow .

# Run the container
docker run -d \
  -p 8080:8080 \
  -e TAILSCALE_API_KEY=your-api-key \
  -e TAILSCALE_TAILNET=your-tailnet \
  --name tsflow \
  tsflow
```

## Configuration

### Tailscale API Setup

1. Go to the [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Create a new API key with the following permissions:
   - `devices:read` - To fetch device information
   - `logs:read` - To access network flow logs
3. Copy the API key to your `.env` file

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TAILSCALE_API_KEY` | Your Tailscale API key | ✅ Yes | - |
| `TAILSCALE_TAILNET` | Your tailnet name | ✅ Yes | - |
| `PORT` | Backend server port | No | `8080` |
| `ENVIRONMENT` | Runtime environment | No | `development` |

## Project Structure

```
tsflow/
├── backend/                    # Go backend server
│   ├── main.go                # Main server entry point
│   ├── go.mod                 # Go module definition
│   ├── internal/              # Internal packages
│   │   ├── config/           # Configuration management
│   │   ├── handlers/         # HTTP request handlers
│   │   └── services/         # Business logic services
│   └── README.md             # Backend documentation
├── frontend/                  # React frontend application
│   ├── src/                  # Source code
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities and API client
│   │   └── types/           # TypeScript definitions
│   ├── package.json         # Frontend dependencies
│   └── dist/               # Built frontend (after build)
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile               # Multi-stage Docker build
├── .env                    # Environment variables
└── README.md              # This file
```

## Usage

### Dashboard Overview
The dashboard provides a high-level view of your network:
- **Metrics Cards**: Total devices, network traffic, active connections, and online rate
- **Traffic Chart**: Real-time visualization of network traffic over time
- **Device List**: Overview of all devices with status indicators
- **Quick Actions**: One-click access to detailed views

### Network Visualization
The network view offers interactive topology visualization:
- **Interactive Graph**: D3.js powered network topology
- **Real-time Updates**: Live traffic flow animation
- **Filter Controls**: Time range, protocol, and traffic type filters
- **Device Details**: Click devices to view detailed information
- **Layout Options**: Multiple graph layout algorithms

### Network Logs
Detailed log view with comprehensive filtering:
- **Traffic Analysis**: Virtual, subnet, and physical traffic breakdown
- **Protocol Details**: TCP, UDP, and ICMP traffic inspection
- **Time Range Selection**: From 5 minutes to custom date ranges
- **Search and Filter**: Advanced filtering by source, destination, protocol
- **Export Capability**: Download logs for external analysis

## API Endpoints

The Go backend exposes the following REST API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/api/devices` | GET | List all Tailscale devices |
| `/api/network-logs` | GET | Fetch network logs with time range |
| `/api/network-map` | GET | Get network topology data |

**Example API calls:**
```bash
# Health check
curl http://localhost:8080/health

# Get devices
curl http://localhost:8080/api/devices

# Get network logs (last 10 minutes)
curl "http://localhost:8080/api/network-logs?start=2024-12-19T10:00:00Z&end=2024-12-19T10:10:00Z"
```

## Troubleshooting

### No Network Logs Showing

1. **Enable logging**: Network logging must be enabled in [Tailscale admin console](https://login.tailscale.com/admin/logs)
2. **Check permissions**: API key needs `logs:read` permission
3. **Recent activity**: Try a shorter time range - logs may only be available for recent activity
4. **Backend logs**: Check `docker-compose logs tsflow` for error messages

### API Connection Issues

1. **Check credentials**: Verify API key and tailnet name in `.env` file
2. **Test backend directly**: 
   ```bash
   curl -H "Authorization: Bearer your-api-key" \
        "https://api.tailscale.com/api/v2/tailnet/your-tailnet/devices"
   ```
3. **Backend health**: Ensure backend is running: `curl http://localhost:8080/health`
4. **Environment variables**: Verify `.env` file is properly loaded

### Docker Issues

1. **Environment file**: Ensure `.env` file exists and contains correct values
2. **Port conflicts**: Make sure port 8080 is available
3. **Build cache**: Try `docker-compose build --no-cache` for clean rebuild
4. **Container logs**: Check `docker-compose logs tsflow` for detailed error messages

### Development Issues

1. **Go dependencies**: Run `go mod download` in backend directory
2. **Frontend build**: Run `npm run build` in frontend directory
3. **Port conflicts**: Backend runs on 8080, ensure it's available
4. **API connectivity**: Backend must be able to reach api.tailscale.com

## Architecture Deep Dive

### Backend (Go + Gin)
The Go backend serves as a secure API gateway:

- **API Gateway**: Proxies and caches Tailscale API calls
- **Static Serving**: Serves the built React frontend
- **Authentication**: Handles Tailscale API authentication
- **Error Handling**: Provides consistent error responses
- **Health Checks**: Built-in monitoring endpoints

**Key Components:**
- `internal/config/` - Environment configuration
- `internal/handlers/` - HTTP request/response handling  
- `internal/services/` - Tailscale API integration
- `main.go` - Server initialization and routing

### Frontend (React + TypeScript)
The React frontend provides a modern, responsive UI:

- **Component Architecture**: Modular, reusable components
- **State Management**: SWR for server state, React hooks for UI state
- **Data Visualization**: D3.js for network graphs, charts for metrics
- **Responsive Design**: Tailwind CSS with mobile-first approach
- **Type Safety**: Full TypeScript coverage

**Key Components:**
- `pages/Dashboard.tsx` - Main overview page
- `pages/NetworkView.tsx` - Interactive network topology
- `pages/Logs.tsx` - Detailed log analysis
- `lib/api.ts` - Backend API client
- `components/` - Reusable UI components

### Docker Multi-stage Build

The Dockerfile uses a multi-stage build for optimal image size:

1. **Frontend Build Stage**: Node.js environment to build React app
2. **Backend Build Stage**: Go environment to compile binary
3. **Runtime Stage**: Minimal Alpine image with static files and binary

This results in a production-ready image under 50MB.

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes in the appropriate directory (`frontend/` or `backend/`)
4. Test your changes locally
5. Run linting: `npm run lint` (frontend) or `go fmt` (backend)
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style

- **Frontend**: TypeScript, Prettier formatting, ESLint rules
- **Backend**: Go standard formatting (`go fmt`), clear error handling
- **Commits**: Use conventional commit messages
- **Documentation**: Update README and inline comments

### Testing

```bash
# Frontend testing
cd frontend
npm run test
npm run lint
npm run type-check

# Backend testing
cd backend
go test ./...
go fmt ./...
go vet ./...
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tailscale](https://tailscale.com/) for the amazing network platform and API
- [Gin](https://gin-gonic.com/) for the fast Go web framework
- [D3.js](https://d3js.org/) for powerful data visualization capabilities
- [React](https://reactjs.org/) and the broader React ecosystem
- [Tailwind CSS](https://tailwindcss.com/) for the design system

## Support

- 📚 [Documentation](https://github.com/rajsinghtech/tsflow/wiki)
- 🐛 [Issue Tracker](https://github.com/rajsinghtech/tsflow/issues)
- 💬 [Discussions](https://github.com/rajsinghtech/tsflow/discussions)

---

Built with ❤️ for the Tailscale community