const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const winston = require('winston');
const { connectDB } = require('./database');
require('dotenv').config();

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
app.use(express.static(path.join(__dirname, '.next')));

// Health check endpoint
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
    res.sendFile(path.join(__dirname, '.next/index.html'));
});

// Import bot handlers from lib/bot.js
const { handleUpdate } = require('./lib/bot');
bot.on('message', handleUpdate);

// Start the server
const PORT = process.env.PORT || 8080;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        
        // Start Express server
        app.listen(PORT, async () => {
            logger.info(`Server is running on port ${PORT}`);
            
            // Set webhook
            try {
                const webhookUrl = process.env.WEBHOOK_URL || `https://your-render-url.onrender.com/webhook`;
                await bot.setWebHook(webhookUrl);
                logger.info('Webhook set successfully');
            } catch (error) {
                logger.error('Error setting webhook:', error);
            }
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer(); 