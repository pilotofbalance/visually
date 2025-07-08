# Stage 1: Build the Go application
# Use a specific, stable Go version for consistency
FROM golang:1.22-alpine AS builder

# Set necessary environment variables for Go modules and cross-compilation
ENV GO111MODULE=on \
    CGO_ENABLED=0 \
    GOOS=linux \
    GOARCH=amd64

# Set the working directory inside the builder container
WORKDIR /app

# Copy go.mod and go.sum first. This allows Docker to cache module downloads
# if your go.mod/go.sum don't change, speeding up subsequent builds.
# These files should be in your 'backend/' directory.
COPY backend/go.mod .

COPY backend/go.sum .



# Download Go modules. This step is only re-run if go.mod/go.sum change.
RUN go mod download

# Copy the rest of the application source code.
# Your main.go and any other Go source files should be in your 'backend/' directory.
COPY backend/. .

# Build the Go application.
# -o app: Specifies the output binary name as 'app'.
# -ldflags="-s -w": Reduces the binary size by stripping debug information and symbol tables.
RUN go build -o app -ldflags="-s -w" .

# Stage 2: Create the final lean image
# Use 'scratch' for the smallest possible image, as it contains nothing but what we add.
FROM scratch

# Set the working directory inside the final container.
WORKDIR /app

# Copy the compiled Go binary from the 'builder' stage into the final image.
COPY --from=builder /app/app .

# Expose the port that your Go application listens on.
# This is for documentation and container linking, actual host port mapping is in docker-compose.
EXPOSE 8080

# --- THIS IS THE CRUCIAL LINE THAT WAS LIKELY MISSING/MISPLACED ---
# Command to run the executable when the container starts.
CMD ["/app/app"]
