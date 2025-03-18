const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize your bot with webhook
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { webHook: { port: 8443 } });

// Serve static files from the dashboard build directory
app.use(express.static(path.join(__dirname, 'v0.0.1-dashboard/.next')));

// Health check endpoint for Cloud Run
app.get('/', (req, res) => {
    res.status(200).send('Service is running!');
});

// Webhook endpoint for Telegram bot
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// Handle all other routes for the dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'v0.0.1-dashboard/.next/index.html'));
});

// Import bot handlers from bot.js
require('./bot.js')(bot);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
    logger.info(`Server is running on port ${PORT}`);
    
    // Set webhook
    try {
        await bot.setWebHook(`https://hornerito-bot-153139743231.us-central1.run.app/webhook`);
        logger.info('Webhook set successfully');
    } catch (error) {
        logger.error('Error setting webhook:', error);
    }
}); 