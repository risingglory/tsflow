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

## Features

**Network Topology Visualization**
- Interactive force-directed graph showing device connections
- Real-time traffic flow animation with D3.js
- Multiple layout algorithms (force-directed, circular, grid, hierarchical)
- Zoom and pan controls for detailed exploration

**Comprehensive Analytics**
- Real-time traffic metrics and statistics
- Protocol and port usage analysis (TCP, UDP, ICMP)
- Device activity monitoring across your tailnet
- Historical data visualization with customizable time ranges

**Advanced Filtering**
- Flexible time range selection (5min, 1hour, 24hours, custom)
- Protocol-based filtering (TCP, UDP, ICMP)
- Traffic type filtering (virtual, subnet, physical)
- IP category filtering (Tailscale, private, public)
- Bandwidth and connection threshold filtering

**Device Management**
- Real-time device status monitoring (online/offline)
- Detailed device information and metadata
- Operating system detection and iconography
- Tag-based organization and filtering

**Modern Tech Stack**
- Go (Gin) backend for high-performance API serving
- React 18 with TypeScript for type safety
- Vite for lightning-fast frontend development
- Tailwind CSS for responsive design
- D3.js for powerful network visualization
- SWR for efficient data fetching and caching

## Quick Start

### Prerequisites
- Tailscale API key with appropriate permissions
- Docker (recommended) or Go 1.21+ and Node.js 18+

### Using Docker Compose

```bash
# Create environment file
cp env.example .env
# Edit .env with your Tailscale credentials

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f tsflow
```

Navigate to `http://localhost:8080` to access the dashboard.

## Deployment Options

### Docker Deployment

#### Using Pre-built Images

```bash
docker run -d \
  --name tsflow \
  -p 8080:8080 \
  -e TAILSCALE_API_KEY=your-api-key \
  -e TAILSCALE_TAILNET=your-tailnet \
  -e ENVIRONMENT=production \
  --restart unless-stopped \
  ghcr.io/rajsinghtech/tsflow:latest
```

**Available image tags:**
- `latest` - Latest stable release from main branch
- `<version>` - Tagged releases (e.g., `v1.0.0`)
- `<commit-sha>` - Specific commit builds

#### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  tsflow:
    image: ghcr.io/rajsinghtech/tsflow:latest
    container_name: tsflow
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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Commands:**
```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f tsflow

# Update to latest version
docker-compose pull && docker-compose up -d

# Stop the application
docker-compose down
```

### Kubernetes Deployment

Deploy TSFlow on Kubernetes using the provided manifests:

#### Quick Deploy with Kustomize

```bash
git clone https://github.com/rajsinghtech/tsflow.git
cd tsflow/k8s

export TAILSCALE_API_KEY="your-api-key-here"
export TAILSCALE_TAILNET="your-tailnet-name"

kubectl apply -k .
```

#### Manual Deployment

1. Create the namespace:
   ```bash
   kubectl create namespace tailscale
   ```

2. Create the secret with your credentials:
   ```bash
   kubectl create secret generic tsflow \
     --namespace=tailscale \
     --from-literal=TAILSCALE_API_KEY="your-api-key" \
     --from-literal=TAILSCALE_TAILNET="your-tailnet"
   ```

3. Deploy the application:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   kubectl apply -f k8s/httproute.yaml  # Optional: Gateway API
   ```

4. Access the application:
   ```bash
   kubectl port-forward -n tailscale svc/tsflow 8080:80
   ```

### Local Development

For developers who want to build and run TSFlow locally:

#### Prerequisites
- Go 1.21+ for backend development
- Node.js 18+ and npm for frontend development

#### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/rajsinghtech/tsflow.git
   cd tsflow
   ```

2. Configure environment:
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

3. Build and run the frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

4. Run the backend:
   ```bash
   cd backend
   go mod download
   go run main.go
   ```

5. Development workflow:
   ```bash
   # For frontend development with hot reload
   cd frontend
   npm run dev  # Runs on port 5173 with proxy to backend
   
   # For backend development with auto-reload
   cd backend
   go install github.com/cosmtrek/air@latest
   air  # Auto-reloads on Go file changes
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
| `TAILSCALE_API_KEY` | Your Tailscale API key | Yes | - |
| `TAILSCALE_TAILNET` | Your tailnet name | Yes | - |
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


---

Built with ❤️ for the Tailscale community