const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const winston = require('winston');
const { connectDB } = require('./database');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 8080;

// Initialize Next.js
const app = next({ dev, dir: './v0.0.1-dashboard' });
const handle = app.getRequestHandler();

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
const server = express();
server.use(express.json());

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { webHook: { port: 8443 } });

// Health check endpoint
server.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Webhook endpoint for Telegram bot
server.post('/api/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// Serve static files from the standalone build
server.use(express.static(path.join(__dirname, 'v0.0.1-dashboard/.next/static')));
server.use('/_next/static', express.static(path.join(__dirname, 'v0.0.1-dashboard/.next/static')));

// Import and use the standalone server
const nextServer = require('./v0.0.1-dashboard/.next/standalone/server.js');

// Prepare and start the server
app.prepare().then(() => {
    // Handle all other routes with Next.js
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    // Start the server
    server.listen(port, () => {
        logger.info(`Server is running on port ${port}`);
        
        // Set webhook for Telegram bot
        const webhookUrl = process.env.WEBHOOK_URL || `https://your-render-url.onrender.com/api/webhook`;
        bot.setWebHook(webhookUrl).then(() => {
            logger.info('Webhook set successfully');
        }).catch((error) => {
            logger.error('Error setting webhook:', error);
        });
    });
}).catch((err) => {
    logger.error('Error starting server:', err);
    process.exit(1);
}); 