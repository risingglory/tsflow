# TSFlow - Tailscale Network Flow Visualizer

A modern, real-time web application for visualizing and analyzing network traffic flows within Tailscale networks.


## Quick Start
> **Important:** TSFlow requires the **Tailscale Network Flow Logs** feature. This is available on **Premium** and **Enterprise** plans and must be enabled in your Tailscale admin console. The application will not show any flow data otherwise.

### Run with Docker

The fastest way to get started using pre-built images:

**Using OAuth (Recommended):**
```bash
docker run -d \
  --name tsflow \
  -p 8080:8080 \
  -e TAILSCALE_OAUTH_CLIENT_ID=your-client-id \
  -e TAILSCALE_OAUTH_CLIENT_SECRET=your-client-secret \
  -e TAILSCALE_TAILNET=your-organization \
  -e ENVIRONMENT=production \
  --restart unless-stopped \
  ghcr.io/rajsinghtech/tsflow:latest
```

**Using API Key:**
```bash
docker run -d \
  --name tsflow \
  -p 8080:8080 \
  -e TAILSCALE_API_KEY=your-api-key \
  -e TAILSCALE_TAILNET=your-organization \
  -e ENVIRONMENT=production \
  --restart unless-stopped \
  ghcr.io/rajsinghtech/tsflow:latest
```

Navigate to `http://localhost:8080` to access the dashboard.

## Configuration

### Tailscale Network Logs

Go to the [Logs tab](https://login.tailscale.com/admin/logs) in your Tailscale Admin Console and ensure that Network Flow Logs are **enabled**. **Note**: This requires a **Premium** or **Enterprise** plan.

### Authentication Methods

TSFlow supports two authentication methods with Tailscale. You only need to configure one method.

#### Method 1: OAuth Client Credentials (Recommended)

OAuth provides better security through automatic token refresh and fine-grained permissions.

1. Go to the [OAuth clients page](https://login.tailscale.com/admin/settings/oauth) in your Tailscale Admin Console
2. Create a new OAuth client
3. Copy the Client ID and Client Secret
4. Set the following environment variables:
   - `TAILSCALE_OAUTH_CLIENT_ID=your-client-id`
   - `TAILSCALE_OAUTH_CLIENT_SECRET=your-client-secret`
   - `TAILSCALE_OAUTH_SCOPES=all:read,devices:read,network-logs:read` (optional, defaults to `all:read`)

#### Method 2: API Key (Legacy)

1. Go to the [API keys page](https://login.tailscale.com/admin/settings/keys) in your Tailscale Admin Console
2. Create a new API key
3. Copy the generated API key (starts with `tskey-api-`)
4. Set `TAILSCALE_API_KEY=your-api-key`

#### Organization Name
1. Go to the [Settings page](https://login.tailscale.com/admin/settings/general) in your Tailscale Admin Console
2. Your organization name is displayed in the Organization section (used by the Tailscale API)
3. Use this exact organization name for the `TAILSCALE_TAILNET` variable

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TAILSCALE_TAILNET` | Your organization name | Yes | - |
| **OAuth Method** |
| `TAILSCALE_OAUTH_CLIENT_ID` | OAuth client ID | Yes* | - |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | OAuth client secret | Yes* | - |
| `TAILSCALE_OAUTH_SCOPES` | OAuth scopes (comma-separated) | No | `all:read` |
| **API Key Method** |
| `TAILSCALE_API_KEY` | Your Tailscale API key | Yes* | - |
| **Other** |
| `PORT` | Backend server port | No | `8080` |

*Either OAuth credentials OR API key must be provided

## Deployment Options

### Using Docker Compose

Create a `docker-compose.yml` file:

**Using OAuth (Recommended):**
```yaml
services:
  tsflow:
    image: ghcr.io/rajsinghtech/tsflow:latest
    container_name: tsflow
    ports:
      - "8080:8080"
    environment:
      - TAILSCALE_OAUTH_CLIENT_ID=your-client-id
      - TAILSCALE_OAUTH_CLIENT_SECRET=your-client-secret
      - TAILSCALE_TAILNET=your-organization
      - PORT=8080
    restart: unless-stopped
```

**Using API Key:**
```yaml
services:
  tsflow:
    image: ghcr.io/rajsinghtech/tsflow:latest
    container_name: tsflow
    ports:
      - "8080:8080"
    environment:
      - TAILSCALE_API_KEY=your-api-key
      - TAILSCALE_TAILNET=your-organization
      - PORT=8080
    restart: unless-stopped
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

# Edit kustomization.yaml with your credentials
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
     --from-literal=TAILSCALE_TAILNET="your-organization"
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

2. Set environment variables:
   ```bash
   export TAILSCALE_API_KEY=tskey-api-your-api-key-here
   export TAILSCALE_TAILNET=your-organization-name
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

**Example API calls:**
```bash
# Health check
curl http://localhost:8080/health

# Get devices
curl http://localhost:8080/api/devices

# Get network logs (last 10 minutes)
curl "http://localhost:8080/api/network-logs?start=2024-12-19T10:00:00Z&end=2024-12-19T10:10:00Z"
```

---

Built with ❤️ for the Tailscale community