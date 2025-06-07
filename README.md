# TSFlow - Tailscale Network Flow Visualizer

A modern, real-time web application for visualizing and analyzing network traffic flows within Tailscale networks.

<!-- ![TSFlow Dashboard](https://via.placeholder.com/800x400/0ea5e9/ffffff?text=TSFlow+Dashboard) -->

## Features

### 🌐 **Network Topology Visualization**
- Interactive force-directed graph showing device connections
- Real-time traffic flow animation
- Multiple layout algorithms (force-directed, circular, grid, hierarchical)
- Zoom and pan controls for detailed exploration

### 📊 **Comprehensive Analytics**
- Real-time traffic metrics and statistics
- Protocol and port usage analysis
- Device activity monitoring
- Historical data visualization with interactive charts

### 🔍 **Advanced Filtering**
- Filter by time range (last hour, day, week, or custom)
- Protocol and port-based filtering
- Device tag filtering
- Traffic threshold filtering
- Advanced search with query syntax

### 🎯 **Device Management**
- Device status monitoring (online/offline)
- Detailed device information and metadata
- Operating system detection and iconography
- Tag-based organization

### ⚡ **Modern Tech Stack**
- **React 18** with TypeScript for type safety
- **Vite** for lightning-fast development
- **Tailwind CSS** for beautiful, responsive design
- **D3.js** for powerful data visualization
- **SWR** for efficient data fetching and caching
- **Zustand** for state management
- **Recharts** for interactive charts

## Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Tailscale API key with appropriate permissions
- Access to a Tailscale network

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/tsflow.git
   cd tsflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your Tailscale credentials:
   ```env
   VITE_TAILSCALE_API_KEY=tskey-client-your-api-key-here
   VITE_TAILSCALE_TAILNET=your-tailnet-name
   ```

4. **Start the application**
   ```bash
   # Start both frontend and API proxy
   npm run dev:full
   
   # Or run separately:
   npm run server  # API proxy (port 3001)
   npm run dev     # Frontend (port 3000)
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` to start exploring your network!

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Using Docker directly

```bash
# Build image
docker build -t tsflow .

# Run container
docker run -d \
  -p 3000:3000 \
  -p 3001:3001 \
  -e VITE_TAILSCALE_API_KEY=your-api-key \
  -e VITE_TAILSCALE_TAILNET=your-tailnet \
  --name tsflow \
  tsflow
```

### Production Build (Manual)

```bash
npm run build
npm run preview
```

## Configuration

### Tailscale API Setup

1. Go to the [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Create a new API key with the following permissions:
   - `devices:read` - To fetch device information
   - `logs:read` - To access network flow logs (if available)
3. Copy the API key to your `.env` file

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_TAILSCALE_API_KEY` | Your Tailscale API key | Required |
| `VITE_TAILSCALE_TAILNET` | Your tailnet name | Required |
| `VITE_TAILSCALE_BASE_URL` | API base URL | `http://localhost:3001/api/v2` |

## Usage

### Dashboard Overview
The dashboard provides a high-level view of your network:
- **Metrics Cards**: Total devices, network traffic, active connections, and online rate
- **Traffic Chart**: Real-time visualization of network traffic over time
- **Device List**: Overview of all devices with status indicators
- **Quick Actions**: One-click access to detailed views

### Network Visualization
The network view offers interactive topology visualization:
- **Layout Controls**: Switch between different layout algorithms
- **Playback Controls**: Play/pause real-time updates
- **Zoom Controls**: Zoom in/out for detailed exploration
- **Filter Panel**: Apply filters to focus on specific data
- **Device Selection**: Click devices to view detailed information

### Search and Filtering
Use advanced search syntax to filter data:
```
device:laptop protocol:tcp port:22
tag:server traffic:>1MB
```

Supported filter types:
- `device:name` - Filter by device name
- `protocol:tcp|udp|icmp` - Filter by protocol
- `port:number` - Filter by port number
- `tag:name` - Filter by device tag
- `traffic:>value` - Filter by traffic amount

## Troubleshooting

### No Network Logs Showing

1. **Enable logging**: Network logging must be enabled in [Tailscale admin console](https://login.tailscale.com/admin/logs)
2. **Check permissions**: API key needs appropriate permissions
3. **Traffic activity**: Logs only show when there's actual network traffic
4. **Time range**: Try different time ranges, recent activity is more likely

### API Connection Issues

1. **Check credentials**: Verify API key and tailnet name in settings
2. **Test with curl**: 
   ```bash
   curl -u "your-api-key:" "https://api.tailscale.com/api/v2/tailnet/your-tailnet/devices"
   ```
3. **Server running**: Ensure the proxy server (port 3001) is running
4. **CORS**: The proxy server handles CORS - don't access Tailscale API directly from browser

### Docker Issues

1. **Environment variables**: Ensure `.env` file is present and correct
2. **Port conflicts**: Make sure ports 3000 and 3001 are available
3. **Build cache**: Try `docker-compose build --no-cache` if having build issues

## Architecture

The application uses a proxy server to handle CORS and API authentication:

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   React App     │    │   Node.js API   │    │   Tailscale API  │
│   (Port 3000)   │◄──►│   Proxy Server  │◄──►│  api.tailscale.  │
│                 │    │   (Port 3001)   │    │       com        │
└─────────────────┘    └─────────────────┘    └──────────────────┘
```

TSFlow follows modern web development best practices:

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx      # Main application layout
│   ├── NetworkVisualization.tsx  # D3.js network graph
│   ├── MetricCard.tsx  # Dashboard metric cards
│   └── ...
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── NetworkView.tsx # Network topology view
│   └── ...
├── lib/                # Utilities and configuration
│   ├── api.ts         # Tailscale API client
│   ├── store.ts       # Zustand state management
│   └── ...
├── types/              # TypeScript type definitions
│   └── tailscale.ts   # Tailscale API types
└── ...
```

### Key Design Decisions

- **Component-based architecture** for reusability and maintainability
- **TypeScript throughout** for type safety and better developer experience
- **Zustand for state management** - lightweight and intuitive
- **SWR for data fetching** - automatic caching, revalidation, and error handling
- **Tailwind CSS** for rapid UI development with consistent design
- **Vite for build tooling** - fast development and optimized production builds

## API Integration

TSFlow integrates with the Tailscale REST API to fetch:
- Device information and status
- Network topology data
- Traffic flow logs (when available)
- Device connectivity metrics

The API client includes:
- Automatic authentication with API keys
- Error handling and retry logic
- Type-safe request/response handling
- Caching for improved performance

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code style (Prettier configuration included)
- Write descriptive commit messages
- Add tests for new functionality

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tailscale](https://tailscale.com/) for the amazing network platform
- [D3.js](https://d3js.org/) for powerful data visualization capabilities
- [React](https://reactjs.org/) and the broader React ecosystem
- [Tailwind CSS](https://tailwindcss.com/) for the design system

## Support

- 📚 [Documentation](https://github.com/your-username/tsflow/wiki)
- 🐛 [Issue Tracker](https://github.com/your-username/tsflow/issues)
- 💬 [Discussions](https://github.com/your-username/tsflow/discussions)

---

Built with ❤️ for the Tailscale community