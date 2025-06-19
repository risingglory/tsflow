# TSFlow Backend

A Go-based backend server that provides a REST API for interacting with the Tailscale API and serves the React frontend.

## Features

- **Tailscale API Integration**: Handles all Tailscale API calls server-side, eliminating CORS issues
- **Static File Serving**: Serves the built React frontend
- **Health Checks**: Built-in health check endpoint
- **Environment Configuration**: Configurable via environment variables
- **CORS Support**: Properly configured CORS for development

## Requirements

- Go 1.21 or later
- Tailscale API key and tailnet

## Quick Start

1. **Set up environment variables**:
   ```bash
   export TAILSCALE_API_KEY=your-api-key
   export TAILSCALE_TAILNET=your-tailnet
   ```

2. **Run in development mode**:
   ```bash
   go run main.go
   ```

3. **Build for production**:
   ```bash
   go build -o tsflow-backend main.go
   ./tsflow-backend
   ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TAILSCALE_API_KEY` | Yes | - | Your Tailscale API key |
| `TAILSCALE_TAILNET` | Yes | - | Your tailnet name |
| `PORT` | No | `8080` | Server port |

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Tailscale API
- `GET /api/devices` - List all devices in the tailnet
- `GET /api/network-logs` - Get network logs (placeholder)
- `GET /api/network-map` - Get network map data
- `GET /api/devices/:deviceId/flows` - Get device flows (placeholder)

### Static Files
- `GET /` - Serves the React frontend (production only)
- `GET /static/*` - Serves static assets

## Development

The backend is designed to work with the React frontend:

- **Development**: Frontend runs on port 3000, backend on port 8080
- **Production**: Backend serves both API and frontend on port 8080

### Project Structure

```
backend/
├── main.go                 # Main server file
├── internal/
│   ├── config/            # Configuration management
│   ├── handlers/          # HTTP handlers
│   └── services/          # Business logic (Tailscale API)
├── go.mod                 # Go module file
└── README.md             # This file
```

## Docker

The backend is designed to be built with Docker using the multi-stage Dockerfile in the project root.

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Notes

- The server automatically serves the frontend build from `../dist` in production
- CORS is configured to allow the frontend development server
- All Tailscale API calls are made server-side to avoid CORS issues
- Some endpoints (network-logs, device-flows) are placeholders as Tailscale doesn't provide public APIs for all features 