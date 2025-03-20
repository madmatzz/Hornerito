# Build stage for the dashboard
FROM node:18-slim AS dashboard-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Final stage
FROM node:18-slim
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the built dashboard
COPY --from=dashboard-builder /app/.next ./.next

# Copy bot and server files
COPY lib/bot.js ./lib/
COPY server.js .
COPY database.js .

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"] 