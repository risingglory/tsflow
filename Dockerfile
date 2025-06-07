# Multi-stage build for TSFlow with Go backend and React frontend

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies (without --only=production to get dev dependencies needed for build)
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.21-alpine AS backend-build

WORKDIR /app/backend

# Install git (needed for go mod download)
RUN apk add --no-cache git

# Copy go mod files
COPY backend/go.mod backend/go.sum ./

# Download dependencies
RUN go mod download

# Copy backend source
COPY backend/ ./

# Build the backend binary
RUN CGO_ENABLED=0 GOOS=linux go build -o tsflow-backend ./main.go

# Stage 3: Final runtime image
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy the backend binary
COPY --from=backend-build /app/backend/tsflow-backend ./

# Copy the frontend build
COPY --from=frontend-build /app/frontend/dist ./dist

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the backend (which serves the frontend)
CMD ["./tsflow-backend"] 