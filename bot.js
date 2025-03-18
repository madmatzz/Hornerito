const TelegramBot = require('node-telegram-bot-api');
const winston = require('winston');
const express = require('express');

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

// Health check endpoint for Cloud Run
app.get('/', (req, res) => {
    res.status(200).send('Bot is running!');
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

module.exports = function(bot) {
    // Handle callback queries for delete actions
    bot.on('callback_query', async (callbackQuery) => {
        // Immediate debug logging
        console.log('Raw callback query received:', JSON.stringify(callbackQuery, null, 2));

        if (!callbackQuery.message) {
            logger.error('Callback query message is undefined', { callbackQuery });
            return;
        }

        const message = callbackQuery.message;
        const chatId = message.chat.id;
        const messageId = message.message_id;
        const data = callbackQuery.data;

        // Enhanced debug logging
        console.log('Processing callback query:', {
            chatId,
            messageId,
            data,
            userId: callbackQuery.from.id,
            callbackQueryId: callbackQuery.id
        });

        logger.info('Received callback query', {
            chatId,
            messageId,
            data,
            userId: callbackQuery.from.id
        });

        try {
            // Verify callback data exists
            if (!data) {
                logger.error('Callback data is undefined');
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '❌ Invalid callback data',
                    show_alert: true
                });
                return;
            }

            // Check if it's a delete action
            if (data.startsWith('delete_')) {
                console.log('Delete action detected, checking permissions...');

                // Check bot permissions in the chat
                const chatMember = await bot.getChatMember(chatId, bot.token.split(':')[0]);
                if (!chatMember.can_delete_messages) {
                    logger.error('Bot lacks delete permissions', { chatId });
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '❌ Bot lacks permission to delete messages in this chat.',
                        show_alert: true
                    });
                    return;
                }

                // Extract the item ID or any other identifier from callback data
                const itemId = data.split('_')[1];
                console.log('Attempting to delete message with ID:', messageId);

                // Attempt to delete the message
                await bot.deleteMessage(chatId, messageId);

                logger.info('Message deleted successfully', {
                    chatId,
                    messageId,
                    itemId
                });

                // Confirm deletion to user
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '✅ Item deleted successfully!',
                    show_alert: true
                });
            } else {
                console.log('Unhandled callback data:', data);
            }
        } catch (error) {
            console.error('Delete operation error:', error);
            logger.error('Error in delete operation', {
                error: error.message,
                stack: error.stack,
                chatId,
                messageId
            });

            // Handle specific error cases
            let errorMessage = '❌ Failed to delete the message. Please try again later.';

            if (error.response && error.response.statusCode === 403) {
                errorMessage = '❌ Bot lacks necessary permissions.';
            } else if (error.response && error.response.statusCode === 400) {
                errorMessage = '❌ Message is too old to delete.';
            }

            // Notify user of the error
            try {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: errorMessage,
                    show_alert: true
                });
            } catch (answerError) {
                console.error('Failed to send error message:', answerError);
            }
        }
    });

    // Modify the createDeleteButton function to ensure proper formatting
    function createDeleteButton(itemId) {
        console.log('Creating delete button with itemId:', itemId);
        return {
            inline_keyboard: [[
                {
                    text: '🗑️ Delete',
                    callback_data: `delete_${itemId}`
                }
            ]]
        };
    }

    // Example usage to send a message with delete button
    bot.onText(/\/example/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            await bot.sendMessage(chatId, 'Test message with delete button', {
                reply_markup: createDeleteButton('123')
            });
        } catch (error) {
            logger.error('Error sending message with delete button', {
                error: error.message,
                chatId
            });
        }
    });
}; 