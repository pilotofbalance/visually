# Stage 1: Build the React application
# Use a Node.js image to install dependencies and build the app
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock) first
# This allows Docker to cache the npm install step if dependencies haven't changed
COPY frontend/package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application source code
# This copies your src/ folder, public/ folder, etc.
COPY frontend/. .

# Build the React application for production
# This command typically creates a 'build' folder with optimized static assets
RUN npm run build

# Stage 2: Serve the React application with Nginx
# Use a lightweight Nginx image
FROM nginx:alpine

# Set the working directory to Nginx's default web root
WORKDIR /usr/share/nginx/html

# Remove the default Nginx index.html
RUN rm index.html

# Copy the built React app from the 'builder' stage into Nginx's web root
COPY --from=builder /app/build .

# Copy a custom Nginx configuration if you have one (optional)
# If you have specific Nginx configurations (e.g., for routing, caching),
# place them in your frontend/nginx/nginx.conf and uncomment the line below.
# Otherwise, Nginx's default config is usually fine for simple static serving.
# COPY frontend/nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 3000, which Nginx listens on by default
EXPOSE 3000

# The default Nginx CMD will start the web server
CMD ["nginx", "-g", "daemon off;"]
