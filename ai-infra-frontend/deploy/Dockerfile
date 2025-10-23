# syntax=docker/dockerfile:1

# Build stage: install dependencies and build the Vite app
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies based on the lockfile
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy the rest of the frontend source code
COPY . .

# Build the production bundle
RUN npm run build

# Runtime stage: serve the static assets with Nginx
FROM nginx:1.27-alpine AS runtime

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build output to nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration if present
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Expose the default nginx port
EXPOSE 80

# Start nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
