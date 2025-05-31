FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o tsflow .

FROM alpine:latest

# Add OCI labels for proper GitHub repository linking
LABEL org.opencontainers.image.source=https://github.com/rajsinghtech/tsflow
LABEL org.opencontainers.image.description="Network flow viewer for Tailscale networks"
LABEL org.opencontainers.image.licenses=MIT

RUN apk --no-cache add ca-certificates
RUN adduser -D -s /bin/sh tsflow

WORKDIR /app

COPY --from=builder /app/tsflow .
COPY --from=builder /app/templates ./templates

RUN chown -R tsflow:tsflow /app

USER tsflow

EXPOSE 8080

CMD ["./tsflow"] 