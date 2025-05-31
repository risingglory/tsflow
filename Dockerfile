FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o tsflow .

FROM alpine:latest

RUN apk --no-cache add ca-certificates
RUN adduser -D -s /bin/sh tsflow

WORKDIR /app

COPY --from=builder /app/tsflow .
COPY --from=builder /app/templates ./templates

RUN chown -R tsflow:tsflow /app

USER tsflow

EXPOSE 8080

CMD ["./tsflow"] 