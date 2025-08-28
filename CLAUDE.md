# Tailscale API Implementation Notes

## OAuth Authentication

### OAuth Client Credentials
- Client ID: `kKDZmBYhHY11CNTRL`
- Client Secret: `tskey-client-kKDZmBYhHY11CNTRL-fTD51XEu4WBPeGB3akm8WBVBoCCxHm6G`

### OAuth Token Flow
1. Token Endpoint: `https://api.tailscale.com/api/v2/oauth/token`
2. Token expires after 1 hour
3. Use client credentials grant type
4. Required scopes: `devices:core`, `network-logs:read`

### Authentication Implementation
```typescript
// Example OAuth token request
const getAccessToken = async () => {
  const response = await fetch('https://api.tailscale.com/api/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`
    },
    body: 'grant_type=client_credentials&scope=devices:core network-logs:read'
  });
  return response.json();
};
```

## Devices API

### List Devices Endpoint
- **URL**: `GET https://api.tailscale.com/api/v2/tailnet/-/devices`
- **Authentication**: Bearer token in Authorization header
- **Response**: Array of device objects with metadata

### Device Object Structure
- `id`: Unique device identifier
- `name`: Device hostname
- `addresses`: IP addresses assigned
- `os`: Operating system
- `lastSeen`: Last activity timestamp
- `online`: Boolean status
- `tags`: Associated tags
- `user`: Owner information

## Network Logs API

### Network Flow Logs Endpoint
- **URL**: `GET https://api.tailscale.com/api/v2/tailnet/-/logging/network`
- **Parameters**:
  - `start`: ISO 8601 timestamp (e.g., `2025-08-01T20:28:17Z`)
  - `end`: ISO 8601 timestamp
- **Authentication**: Bearer token with `network-logs:read` scope
- **Response**: JSON object with `logs` array

### Response Structure
```json
{
  "logs": [
    {
      "logged": "2025-08-01T20:28:17.633916081Z",  // When log was recorded
      "nodeId": "nB42T4zetL11CNTRL",               // Device that generated log
      "start": "2025-08-01T20:28:11.088314209Z",   // Connection period start
      "end": "2025-08-01T20:28:15.623258929Z",     // Connection period end
      "virtualTraffic": [...],                      // Tailscale network traffic
      "subnetTraffic": [...],                       // Subnet route traffic
      "physicalTraffic": [...]                      // Physical network traffic
    }
  ]
}
```

### Traffic Object Structure
```json
{
  "proto": 6,                    // Protocol: 6=TCP, 17=UDP
  "src": "100.79.211.22:43496",  // Source IP:port
  "dst": "100.85.208.16:80",     // Destination IP:port
  "txPkts": 1,                   // Transmitted packets
  "txBytes": 52,                 // Transmitted bytes
  "rxPkts": 1,                   // Received packets (virtual/subnet only)
  "rxBytes": 75                  // Received bytes (virtual/subnet only)
}
```

### Traffic Types
1. **virtualTraffic**: Direct Tailscale connections (100.x.x.x addresses)
2. **subnetTraffic**: Traffic through subnet routes (non-Tailscale IPs)
3. **physicalTraffic**: Underlying network transport (DERP relays, direct connections)

### Implementation Example
```typescript
const getNetworkLogs = async (minutes: number = 1) => {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  const response = await fetch(
    `https://api.tailscale.com/api/v2/tailnet/-/logging/network?start=${start}&end=${end}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );
  return response.json();
};
```

### Key Insights from Testing
- Logs are batched and may have 5-10 second delay
- Each log entry covers a time period (start/end)
- Physical traffic may show port 0 for NAT traversal
- IPv6 addresses shown in bracket notation
- Multiple concurrent connections tracked separately

### Privacy & Limitations
- Only logs successful connections
- No traffic content inspection
- No user authentication data logged
- Client-side logging (delivery not guaranteed)
- 30-day retention period
- Premium/Enterprise plan required

## Implementation Strategy

### 1. Authentication Service
- Token management with automatic refresh
- Secure credential storage
- Error handling for expired tokens

### 2. API Client
- Reusable HTTP client with auth headers
- Rate limiting awareness
- Error retry logic

### 3. Data Processing
- Device status monitoring
- Network flow visualization
- Real-time updates via polling

### 4. Security Best Practices
- Never expose OAuth credentials in frontend
- Use environment variables for secrets
- Implement proper CORS handling
- Audit log all API access

## Key Considerations
- Use shorthand `-` for current tailnet in URLs
- API requires Owner/Admin/IT admin/Network admin role
- Network logs require destination logging enabled
- Consider SIEM integration for advanced analysis

## TSNet - Building Tailscale Apps

### Overview
TSNet is a Go library that allows you to embed Tailscale directly into your applications, creating services that run on your tailnet as first-class nodes.

### Basic TSNet Server
```go
package main

import (
    "log"
    "net/http"
    "tailscale.com/tsnet"
)

func main() {
    srv := &tsnet.Server{
        Hostname: "myapp",  // Name on tailnet
        Dir:      "./tsnet-state", // Persistent state directory
    }
    
    // Start implicitly called when needed
    ln, err := srv.Listen("tcp", ":80")
    if err != nil {
        log.Fatal(err)
    }
    defer srv.Close()
    
    http.Serve(ln, http.HandlerFunc(handler))
}
```

### Key TSNet Features

#### 1. Configuration Options
```go
srv := &tsnet.Server{
    Hostname:     "myservice",           // Service name on tailnet
    Dir:          "/var/lib/myservice",  // State directory (required)
    AuthKey:      os.Getenv("TS_AUTHKEY"), // For automatic auth
    Ephemeral:    true,                  // Don't persist node
    RunWebClient: true,                  // Enable web UI
    Logf:         log.Printf,            // Custom logging
}
```

#### 2. Network Listeners
```go
// HTTP on tailnet
ln, _ := srv.Listen("tcp", ":80")

// HTTPS with automatic certs
tlsLn, _ := srv.ListenTLS("tcp", ":443")

// Funnel - expose to internet
funnelLn, _ := srv.ListenFunnel("tcp", ":443")

// Funnel-only (no tailnet access)
publicLn, _ := srv.ListenFunnel("tcp", ":443", tsnet.FunnelOnly())
```

#### 3. Making Outbound Requests
```go
// Get HTTP client for tailnet requests
client := srv.HTTPClient()
resp, err := client.Get("https://another-service.ts.net")
```

#### 4. Multiple Instances
```go
// Run multiple Tailscale nodes in one process
for _, name := range []string{"web", "api", "db"} {
    srv := &tsnet.Server{
        Hostname: name,
        Dir:      filepath.Join("/data", name),
    }
    go runService(srv)
}
```

### Real-World Example: Golink
Golink is a production tsnet app that provides a private URL shortener for tailnets:

```go
// Simplified from golink implementation
srv := &tsnet.Server{
    ControlURL: ipn.DefaultControlURL,
    Dir:        configDir,
    Hostname:   "go",
    RunWebClient: true,
}

if err := srv.Start(); err != nil {
    return err
}

// Wait for connection
localClient, _ = srv.LocalClient()
status, _ := srv.Up(ctx)

// Serve on both HTTP and HTTPS
httpLn, _ := srv.Listen("tcp", ":80")
httpsLn, _ := srv.ListenTLS("tcp", ":443")
```

### TSNet Best Practices

1. **State Directory**: Always specify a persistent directory for node state
2. **Graceful Shutdown**: Always call `srv.Close()` to clean up
3. **Auth Keys**: Use ephemeral auth keys for automated deployments
4. **Logging**: Set custom `Logf` for production debugging
5. **Health Checks**: Use `srv.LocalClient()` to check connection status

### TSNet vs Traditional Tailscale
- **TSNet**: Embedded in your app, programmatic control, custom services
- **Tailscale**: System-wide VPN, general connectivity, existing apps

### OAuth-Based Auth Key Generation
TSNet can use OAuth clients to dynamically create auth keys:

```go
// OAuth client with auth_keys scope
client := tailscale.NewClient(oauthConfig)

// Create auth key with specific tags
authKey, err := client.CreateAuthKey(ctx, []string{"tag:k8s", "tag:prod"})
if err != nil {
    return err
}

// Use the auth key for TSNet
srv := &tsnet.Server{
    Hostname: "myservice",
    AuthKey:  authKey,
}
```

**Benefits:**
- No manual auth key management
- Automatic key rotation possible
- Tags enforce ACL policies
- Audit trail via OAuth client

**Requirements:**
- OAuth client needs `auth_keys` scope
- Must specify tags (required by OAuth)
- Keys are single-use by default

### Common TSNet Patterns

#### Service Discovery
```go
// Use MagicDNS for service discovery
apiURL := "https://api.ts.net/v1/data"
dbURL := "postgres://db.ts.net:5432/mydb"
```

#### Auth Integration with WhoIs
```go
// Get caller identity from Tailscale using WhoIs
localClient, _ := srv.LocalClient()

// In your HTTP handler:
whois, err := localClient.WhoIs(r.Context(), r.RemoteAddr)
if err != nil {
    http.Error(w, "Unable to identify caller", 401)
    return
}

// Access user information
userEmail := whois.UserProfile.LoginName
userID := whois.UserProfile.ID
displayName := whois.UserProfile.DisplayName
profilePicURL := whois.UserProfile.ProfilePicURL

// Access node information
nodeName := whois.Node.ComputedName
nodeID := whois.Node.ID
nodeTags := whois.Node.Tags // e.g., ["tag:server", "tag:prod"]

// Example: Simple ACL based on tags
func requireTag(tag string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        whois, err := localClient.WhoIs(r.Context(), r.RemoteAddr)
        if err != nil || !whois.Node.Tags.Contains(tag) {
            http.Error(w, "Access denied", 403)
            return
        }
        next(w, r)
    }
}

// Example: User-based access control
func requireUser(allowedEmails []string, next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        whois, err := localClient.WhoIs(r.Context(), r.RemoteAddr)
        if err != nil {
            http.Error(w, "Authentication required", 401)
            return
        }
        
        allowed := false
        for _, email := range allowedEmails {
            if whois.UserProfile.LoginName == email {
                allowed = true
                break
            }
        }
        
        if !allowed {
            http.Error(w, "Access denied", 403)
            return
        }
        
        // Pass user info to handler via context
        ctx := context.WithValue(r.Context(), "userEmail", whois.UserProfile.LoginName)
        next(w, r.WithContext(ctx))
    }
}
```

#### WhoIs Response Structure
```go
type WhoIsResponse struct {
    Node *Node
    UserProfile *UserProfile
    CapMap CapabilityMap
}

type UserProfile struct {
    ID            UserID
    LoginName     string  // email
    DisplayName   string  // human-readable name
    ProfilePicURL string  // avatar URL
}

type Node struct {
    ID           NodeID
    StableID     StableNodeID
    Name         string  // DNS name
    ComputedName string  // display name
    Addresses    []netip.Addr  // Tailscale IPs
    Tags         []string      // ACL tags
    Online       bool
    LastSeen     *time.Time
}
```

#### Metrics & Monitoring
```go
// Expose metrics on tailnet only
metricsLn, _ := srv.Listen("tcp", ":9090")
http.Serve(metricsLn, promhttp.Handler())
```