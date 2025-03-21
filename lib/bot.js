import TelegramBot from 'node-telegram-bot-api';
import winston from 'winston';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import LocalSession from 'telegraf-session-local';
import axios from 'axios';

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

// Define data directory
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info('Created data directory:', dataDir);
}

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => logger.info('Connected to MongoDB'))
    .catch(err => logger.error('MongoDB connection error:', err));

// Define schemas
const expenseSchema = new mongoose.Schema({
    userId: String,
    amount: Number,
    category: String,
    subcategory: String,
    description: String,
    date: { type: Date, default: Date.now }
});

const recurringExpenseSchema = new mongoose.Schema({
    userId: String,
    amount: Number,
    category: String,
    subcategory: String,
    description: String,
    frequency: String,
    startDate: Date,
    endDate: Date,
    lastTracked: Date,
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', expenseSchema);
const RecurringExpense = mongoose.model('RecurringExpense', recurringExpenseSchema);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize session middleware
const session = new LocalSession({
    database: path.join(dataDir, 'session.json'),
    property: 'session',
    storage: LocalSession.storageFileSync,
    format: {
        serialize: (obj) => {
            try {
                return JSON.stringify(obj, null, 2);
            } catch (error) {
                logger.error('Error serializing session:', error);
                return JSON.stringify({});
            }
        },
        deserialize: (str) => {
            try {
                return JSON.parse(str);
            } catch (error) {
                logger.error('Error deserializing session, resetting:', error);
                return {};
            }
        },
    },
    state: {
        editingExpenseId: null,
        originalCategory: null,
        originalAmount: null,
        userId: null,
        editingRecurringId: null,
        editingFrequency: null,
        editingAmount: null,
        editingCategory: null,
        editingDescription: null
    }
});

// Apply session middleware
bot.use(session.middleware());

// Helper functions
function formatMessage(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

async function categorizeExpense(input) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that categorizes expenses. Respond with only the category name."
                },
                {
                    role: "user",
                    content: input
                }
            ],
            temperature: 0.3,
            max_tokens: 10
        });

        return completion.choices[0].message.content.trim();
    } catch (error) {
        logger.error('Error categorizing expense:', error);
        return 'other';
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

async function getExchangeRate(fromCurrency, toCurrency) {
    try {
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
        return response.data.rates[toCurrency];
    } catch (error) {
        logger.error('Error getting exchange rate:', error);
        return null;
    }
}

// Bot commands
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = formatMessage(`Welcome to Hornerito Bot! 🤖\n\n` +
        `Here are the available commands:\n` +
        `/add <amount> <category> <description> - Add a new expense\n` +
        `/list - Show your recent expenses\n` +
        `/recurring - Manage recurring expenses\n` +
        `/stats - View your expense statistics\n` +
        `/help - Show this help message\n` +
        `/convert <amount> <from> <to> - Convert currency\n` +
        `/categories - View expense categories\n` +
        `/export - Export your expenses`);
    
    await bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const expenseText = match[1];

    try {
        // Parse expense text (format: amount category description)
        const [amount, category, ...descriptionParts] = expenseText.split(' ');
        const description = descriptionParts.join(' ');

        if (!amount || !category) {
            await bot.sendMessage(chatId, 'Please provide amount and category. Example: /add 100 food dinner');
            return;
        }

        // If no category provided, try to categorize using AI
        const finalCategory = category === 'auto' ? await categorizeExpense(description) : category;

        const expense = new Expense({
            userId: userId.toString(),
            amount: parseFloat(amount),
            category: finalCategory,
            description: description || 'No description'
        });

        await expense.save();
        await bot.sendMessage(chatId, `✅ Expense added: ${formatCurrency(amount)} ${finalCategory} - ${description || 'No description'}`);
    } catch (error) {
        logger.error('Error adding expense:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error adding your expense.');
    }
});

bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const expenses = await Expense.find({ userId: userId.toString() })
            .sort({ date: -1 })
            .limit(10);

        if (expenses.length === 0) {
            await bot.sendMessage(chatId, 'No expenses found.');
            return;
        }

        const message = expenses.map(exp => 
            `${formatCurrency(exp.amount)} ${exp.category} - ${exp.description} (${exp.date.toLocaleDateString()})`
        ).join('\n');

        await bot.sendMessage(chatId, `Your recent expenses:\n${message}`);
    } catch (error) {
        logger.error('Error listing expenses:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error listing your expenses.');
    }
});

bot.onText(/\/recurring/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const recurringExpenses = await RecurringExpense.find({ 
            userId: userId.toString(),
            active: true 
        });

        if (recurringExpenses.length === 0) {
            await bot.sendMessage(chatId, 'No active recurring expenses found.');
            return;
        }

        const message = recurringExpenses.map(exp => 
            `${formatCurrency(exp.amount)} ${exp.category} - ${exp.description}\n` +
            `Frequency: ${exp.frequency}\n` +
            `Next: ${exp.lastTracked.toLocaleDateString()}`
        ).join('\n\n');

        await bot.sendMessage(chatId, `Your recurring expenses:\n\n${message}`);
    } catch (error) {
        logger.error('Error listing recurring expenses:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error listing your recurring expenses.');
    }
});

bot.onText(/\/convert (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const [amount, fromCurrency, toCurrency] = match[1].split(' ');

    try {
        if (!amount || !fromCurrency || !toCurrency) {
            await bot.sendMessage(chatId, 'Please provide amount and currencies. Example: /convert 100 USD EUR');
            return;
        }

        const rate = await getExchangeRate(fromCurrency.toUpperCase(), toCurrency.toUpperCase());
        if (!rate) {
            await bot.sendMessage(chatId, '❌ Error getting exchange rate. Please try again later.');
            return;
        }

        const convertedAmount = parseFloat(amount) * rate;
        await bot.sendMessage(chatId, 
            `${formatCurrency(amount)} ${fromCurrency.toUpperCase()} = ${formatCurrency(convertedAmount)} ${toCurrency.toUpperCase()}\n` +
            `Rate: 1 ${fromCurrency.toUpperCase()} = ${rate.toFixed(4)} ${toCurrency.toUpperCase()}`
        );
    } catch (error) {
        logger.error('Error converting currency:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error converting the currency.');
    }
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const expenses = await Expense.find({ userId: userId.toString() });
        
        if (expenses.length === 0) {
            await bot.sendMessage(chatId, 'No expenses found to generate statistics.');
            return;
        }

        // Calculate total expenses
        const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        // Calculate expenses by category
        const byCategory = expenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
        }, {});

        // Format category breakdown
        const categoryBreakdown = Object.entries(byCategory)
            .map(([category, amount]) => `${category}: ${formatCurrency(amount)}`)
            .join('\n');

        const message = `📊 Your Expense Statistics:\n\n` +
            `Total Expenses: ${formatCurrency(total)}\n\n` +
            `Breakdown by Category:\n${categoryBreakdown}`;

        await bot.sendMessage(chatId, message);
    } catch (error) {
        logger.error('Error generating statistics:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error generating your statistics.');
    }
});

bot.onText(/\/export/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const expenses = await Expense.find({ userId: userId.toString() })
            .sort({ date: -1 });

        if (expenses.length === 0) {
            await bot.sendMessage(chatId, 'No expenses found to export.');
            return;
        }

        // Create CSV content
        const csvContent = [
            ['Date', 'Amount', 'Category', 'Description'],
            ...expenses.map(exp => [
                exp.date.toLocaleDateString(),
                exp.amount,
                exp.category,
                exp.description
            ])
        ].map(row => row.join(',')).join('\n');

        // Send as file
        await bot.sendDocument(chatId, Buffer.from(csvContent), {
            filename: 'expenses.csv'
        });
    } catch (error) {
        logger.error('Error exporting expenses:', error);
        await bot.sendMessage(chatId, '❌ Sorry, there was an error exporting your expenses.');
    }
});

// Handle callback queries for delete actions
bot.on('callback_query', async (callbackQuery) => {
    if (!callbackQuery.message) {
        logger.error('Callback query message is undefined', { callbackQuery });
        return;
    }

    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const messageId = message.message_id;
    const data = callbackQuery.data;

    try {
        if (!data) {
            logger.error('Callback data is undefined');
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '❌ Invalid callback data',
                show_alert: true
            });
            return;
        }

        if (data.startsWith('delete_')) {
            const chatMember = await bot.getChatMember(chatId, bot.token.split(':')[0]);
            if (!chatMember.can_delete_messages) {
                logger.error('Bot lacks delete permissions', { chatId });
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '❌ Bot lacks permission to delete messages in this chat.',
                    show_alert: true
                });
                return;
            }

            const itemId = data.split('_')[1];
            await bot.deleteMessage(chatId, messageId);

            logger.info('Message deleted successfully', {
                chatId,
                messageId,
                itemId
            });

            await bot.answerCallbackQuery(callbackQuery.id, {
                text: '✅ Item deleted successfully!',
                show_alert: true
            });
        }
    } catch (error) {
        logger.error('Error in callback query handler', {
            error: error.message,
            stack: error.stack,
            chatId,
            messageId
        });

        let errorMessage = '❌ Failed to delete the message. Please try again later.';
        if (error.response && error.response.statusCode === 403) {
            errorMessage = '❌ Bot lacks necessary permissions.';
        } else if (error.response && error.response.statusCode === 400) {
            errorMessage = '❌ Message is too old to delete.';
        }

        try {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: errorMessage,
                show_alert: true
            });
        } catch (answerError) {
            logger.error('Failed to send error message:', answerError);
        }
    }
});

// Export the bot instance and handler function
export { bot };
export const handleUpdate = (update) => bot.handleUpdate(update); 