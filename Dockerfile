FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port for Cloud Run
EXPOSE 8080

# Start the bot
CMD ["node", "bot.js"] 