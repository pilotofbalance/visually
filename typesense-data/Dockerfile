# Start from the official Typesense image
FROM typesense/typesense:0.25.1

# Install curl (and its dependencies if needed) for the health check and data loading script
# Use apt-get for Debian/Ubuntu based images (which Typesense uses)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy your data loading script into the container
# This path matches the entrypoint below
COPY typesense-data/load_data.sh /docker-entrypoint-initdb.d/load_data.sh

# Ensure the script is executable inside the container
RUN chmod +x /docker-entrypoint-initdb.d/load_data.sh

# Set the entrypoint to your custom script.
# This script will then start Typesense and handle data loading.
ENTRYPOINT ["/docker-entrypoint-initdb.d/load_data.sh"]