# Build stage for the dashboard
FROM node:18-slim AS dashboard-builder
WORKDIR /app
COPY v0.0.1-dashboard/package*.json ./
RUN npm install
COPY v0.0.1-dashboard/ .
RUN npm run build

# Final stage
FROM node:18-slim
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the built dashboard
COPY --from=dashboard-builder /app/.next ./v0.0.1-dashboard/.next

# Copy bot and server files
COPY bot.js .
COPY server.js .

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"] 