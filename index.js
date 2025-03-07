require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sqlite3 = require('better-sqlite3');
const { Telegraf, Markup, session } = require('telegraf');
const path = require('path');
const categorizer = require('./categorizer');
const { Configuration, OpenAIApi } = require('openai');
const Database = require('better-sqlite3');

const app = express();

// API middleware - must come FIRST
app.use(express.json());

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
bot.use(session());

// Create a specific data directory
const DATA_DIR = path.join(__dirname, 'data');
if (!require('fs').existsSync(DATA_DIR)) {
    console.log('Creating data directory:', DATA_DIR);
    require('fs').mkdirSync(DATA_DIR, { recursive: true });
}

// Use absolute path for database
const DB_PATH = path.join(DATA_DIR, 'hornerito.db');
console.log('Database path:', DB_PATH);

// Update database initialization
const db = new Database(DB_PATH);

const initDatabase = () => {
    try {
        console.log('Initializing database schema...');
        
        // Create expenses table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT,
                description TEXT,
                timestamp TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Create recurring_expenses table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT,
                description TEXT,
                frequency TEXT NOT NULL,
                start_date TEXT NOT NULL,
                last_tracked TEXT NOT NULL,
                active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Verify tables were created
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name IN ('expenses', 'recurring_expenses')
        `).all();
        
        console.log('Created tables:', tables);

        // Verify columns in each table
        const expensesColumns = db.prepare("PRAGMA table_info(expenses)").all();
        const recurringColumns = db.prepare("PRAGMA table_info(recurring_expenses)").all();
        
        console.log('Expenses table columns:', expensesColumns.map(c => c.name));
        console.log('Recurring expenses table columns:', recurringColumns.map(c => c.name));

        // Add test data if tables are empty
        const expenseCount = db.prepare('SELECT COUNT(*) as count FROM expenses').get();
        if (expenseCount.count === 0) {
            console.log('Adding test expense data...');
            db.prepare(`
                INSERT INTO expenses (user_id, amount, category, description, timestamp)
                VALUES 
                ('test_user', 50.00, 'Food & Drinks > Meals', 'Test Meal', datetime('now')),
                ('test_user', 30.00, 'Transport > Taxi', 'Test Ride', datetime('now'))
            `).run();
        }

    } catch (error) {
        console.error('Error initializing database:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        throw error;
    }
};

// Initialize database
initDatabase();

// API Routes
app.get('/api/expenses', (req, res) => {
    try {
        console.log('Fetching all expenses...');

        // Get regular expenses
        const regularExpenses = db.prepare(`
            SELECT 
                id,
                user_id,
                amount,
                category,
                description,
                timestamp as date,
                0 as is_recurring,
                NULL as frequency
            FROM expenses 
        `).all() || [];

        console.log('Regular expenses:', regularExpenses);

        // Get recurring expenses
        const recurringExpenses = db.prepare(`
            SELECT 
                id,
                user_id,
                amount,
                category,
                description,
                last_tracked as date,
                1 as is_recurring,
                frequency
            FROM recurring_expenses
            WHERE active = 1
        `).all() || [];

        console.log('Recurring expenses:', recurringExpenses);

        // Combine and format
        const allExpenses = [...regularExpenses, ...recurringExpenses]
            .map(exp => ({
                id: exp.id,
                amount: parseFloat(exp.amount),
                category: exp.category,
                displayCategory: exp.category.includes('>') 
                    ? exp.category.split('>')[1].trim() 
                    : exp.category.trim(),
                description: exp.description || 'Unnamed expense',
                date: exp.date || new Date().toISOString(),
                is_recurring: Boolean(exp.is_recurring),
                frequency: exp.frequency || null
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log('Sending formatted expenses:', allExpenses);
        res.json(allExpenses);

    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Update the recent expenses endpoint
app.get('/api/recent-expenses', (req, res) => {
    try {
        // Get regular expenses
        const regularExpenses = db.prepare(`
            SELECT 
                'regular' as type,
                id,
                amount,
                category,
                description,
                timestamp as date
            FROM expenses 
            ORDER BY timestamp DESC
            LIMIT 5
        `).all() || [];

        // Get recurring expenses
        const recurringExpenses = db.prepare(`
            SELECT 
                'recurring' as type,
                id,
                amount,
                category,
                description,
                last_tracked as date,
                frequency
            FROM recurring_expenses
            WHERE active = 1
            ORDER BY last_tracked DESC
            LIMIT 5
        `).all() || [];

        // Combine and format all expenses
        const allExpenses = [...regularExpenses, ...recurringExpenses]
            .map(exp => ({
                id: exp.id,
                amount: parseFloat(exp.amount),
                category: exp.category || 'Uncategorized',
                displayCategory: exp.category ? exp.category.split('>')[1]?.trim() || exp.category : 'Uncategorized',
                description: exp.description || exp.category || 'Unnamed expense',
                date: exp.date || new Date().toISOString(),
                is_recurring: exp.type === 'recurring',
                frequency: exp.frequency || null
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        console.log('Sending recent expenses:', allExpenses);
        res.json(allExpenses);

    } catch (error) {
        console.error('Error in recent expenses:', error);
        res.status(500).json({ error: 'Failed to fetch recent expenses' });
    }
});

app.get('/api/recurring-expenses', async (req, res) => {
    try {
        const expenses = db.prepare(`
            SELECT * FROM recurring_expenses 
            WHERE active = 1
            ORDER BY frequency, amount
        `).all();

        res.json(expenses);
    } catch (error) {
        console.error('Error fetching recurring expenses:', error);
        res.status(500).json({ error: 'Error fetching recurring expenses' });
    }
});

// Serve the Next.js dashboard
app.use('/_next', express.static(path.join(__dirname, 'v0 dashboard/.next')));
app.use(express.static(path.join(__dirname, 'v0 dashboard/out')));

// Catch-all route for Next.js pages
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'v0 dashboard/out/dashboard.html'));
    }
});

// Add error handling for database connection
process.on('SIGINT', () => {
    console.log('Closing database connection...');
    db.close();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    db.close();
    process.exit(1);
});

// Add this categorization map at the top of your file
const categoryMap = {
  // Food & Drinks
  'food': 'Food & Drinks > Meals',
  'meal': 'Food & Drinks > Meals',
  'lunch': 'Food & Drinks > Meals',
  'dinner': 'Food & Drinks > Meals',
  'breakfast': 'Food & Drinks > Meals',
  'snack': 'Food & Drinks > Snacks',
  'coffee': 'Food & Drinks > Drinks / Sodas > Coffee',
  'coke': 'Food & Drinks > Drinks / Sodas > Coke',
  'beer': 'Food & Drinks > Drinks / Sodas > Beer',
  
  // Transport
  'taxi': 'Transport > Taxis & Rideshares',
  'uber': 'Transport > Taxis & Rideshares',
  'gas': 'Transport > Fuel / Gas',
  'fuel': 'Transport > Fuel / Gas',
  'bus': 'Transport > Public Transport',
  'metro': 'Transport > Public Transport',
  
  // Entertainment
  'game': 'Entertainment > Games',
  'movie': 'Entertainment > Movies & Streaming',
  'netflix': 'Entertainment > Movies & Streaming',
  'concert': 'Entertainment > Music / Concerts',
  
  // Shopping
  'clothes': 'Shopping > Clothing',
  'clothing': 'Shopping > Clothing',
  'electronics': 'Shopping > Electronics',
  'groceries': 'Shopping > Groceries',
  'supermarket': 'Shopping > Groceries',
  
  // Bills & Utilities
  'electricity': 'Bills & Utilities > Electricity',
  'water': 'Bills & Utilities > Water',
  'internet': 'Bills & Utilities > Internet & Phone',
  'phone': 'Bills & Utilities > Internet & Phone',
  
  // Miscellaneous
  'gift': 'Miscellaneous > Gifts',
  'health': 'Miscellaneous > Health & Wellness',
  'medicine': 'Miscellaneous > Health & Wellness',
  'subscription': 'Miscellaneous > Subscriptions'
};

// Define category keywords and their associations
const categoryKeywords = {
  'Food & Drinks > Meals': [
    'food', 'meal', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger', 'sushi',
    'restaurant', 'sandwich', 'tacos', 'pasta', 'salad', 'chicken', 'beef',
    'seafood', 'rice', 'bread', 'meat', 'fish'
  ],
  'Food & Drinks > Snacks': [
    'snack', 'chips', 'cookies', 'candy', 'chocolate', 'popcorn', 'nuts',
    'crackers', 'fruit'
  ],
  'Food & Drinks > Drinks / Sodas > Coffee': [
    'coffee', 'latte', 'espresso', 'cappuccino', 'starbucks'
  ],
  'Food & Drinks > Drinks / Sodas > Coke': [
    'coke', 'soda', 'pepsi', 'sprite', 'fanta'
  ],
  'Food & Drinks > Drinks / Sodas > Beer': [
    'beer', 'alcohol', 'wine', 'drinks', 'bar'
  ],
  'Transport > Taxis & Rideshares': [
    'taxi', 'uber', 'lyft', 'cab', 'ride', 'didi'
  ],
  'Transport > Fuel / Gas': [
    'gas', 'fuel', 'petrol', 'diesel'
  ],
  'Transport > Public Transport': [
    'bus', 'metro', 'subway', 'train', 'transit', 'transport'
  ],
  'Entertainment > Games': [
    'game', 'gaming', 'playstation', 'xbox', 'nintendo', 'steam'
  ],
  'Entertainment > Movies & Streaming': [
    'movie', 'netflix', 'cinema', 'hulu', 'disney', 'amazon', 'theater'
  ],
  'Entertainment > Music / Concerts': [
    'concert', 'music', 'spotify', 'show', 'festival', 'ticket'
  ],
  'Shopping > Clothing': [
    'clothes', 'clothing', 'shirt', 'pants', 'shoes', 'dress', 'jacket'
  ],
  'Shopping > Electronics': [
    'electronics', 'phone', 'computer', 'laptop', 'gadget', 'device'
  ],
  'Shopping > Groceries': [
    'groceries', 'supermarket', 'market', 'store', 'walmart', 'target'
  ],
  'Bills & Utilities > Electricity': [
    'electricity', 'power', 'electric', 'energy'
  ],
  'Bills & Utilities > Water': [
    'water', 'utilities', 'utility'
  ],
  'Bills & Utilities > Internet & Phone': [
    'internet', 'phone', 'mobile', 'wifi', 'data', 'broadband'
  ]
};

// Update the dashboard URL to a valid public URL
const DASHBOARD_URL = 'https://www.google.com';  // Using Google as a temporary URL

// Helper function to check if something is likely food
function isFoodRelated(word) {
  // Common food categories and types
  const foodIndicators = [
    // Meals and dishes
    'food', 'meal', 'dish', 'cuisine', 'restaurant', 'diner',
    // Common foods worldwide
    'pizza', 'burger', 'sandwich', 'pasta', 'rice', 'noodles',
    // Latin American foods
    'empanada', 'taco', 'burrito', 'arepa', 'pupusa', 'tamale',
    'milanesa', 'churrasco', 'ceviche', 'chimichurri', 'asado',
    'enchilada', 'fajita', 'quesadilla', 'torta', 'chilaquiles',
    // European foods
    'pasta', 'pizza', 'risotto', 'paella', 'schnitzel',
    'bratwurst', 'pierogi', 'goulash', 'croissant',
    // Asian foods
    'sushi', 'ramen', 'curry', 'dimsum', 'pho', 'pad thai',
    'tempura', 'sashimi', 'udon', 'bibimbap', 'dumpling',
    // Middle Eastern foods
    'kebab', 'falafel', 'hummus', 'shawarma', 'pita',
    // Meal times
    'breakfast', 'lunch', 'dinner', 'brunch', 'snack',
    // Ingredients
    'meat', 'chicken', 'beef', 'pork', 'fish', 'vegetable',
    'steak', 'pollo', 'carne', 'pescado', 'verdura',
    // Places to eat
    'restaurant', 'cafe', 'bakery', 'deli', 'cafeteria',
    'bistro', 'bar', 'pub', 'fonda', 'cantina',
    // Cooking methods
    'fried', 'baked', 'grilled', 'roasted', 'steamed',
    'frito', 'asado', 'horneado', 'cocido',
    // Generic food words
    'eat', 'food', 'meal', 'dish', 'snack', 'appetizer',
    'comida', 'almuerzo', 'cena', 'merienda', 'plato'
  ];

  // Convert to lowercase for comparison
  word = word.toLowerCase();

  // Check if the word matches any food indicator
  return foodIndicators.some(indicator => 
    word.includes(indicator) || indicator.includes(word) ||
    // Check for common food-related endings in multiple languages
    word.endsWith('ada') || // empanada, enchilada
    word.endsWith('ito') || // burrito, taquito
    word.endsWith('esa') || // milanesa, portuguesa
    word.endsWith('soup') || // any soup
    word.endsWith('pie') || // any pie
    word.endsWith('bread') || // any bread
    word.endsWith('roll') || // any roll
    word.endsWith('burger') || // any burger
    word.endsWith('steak') || // any steak
    word.endsWith('sopa') || // Spanish soup
    word.endsWith('guiso') // Spanish stew
  );
}

function categorizeExpense(input) {
  const word = input.toLowerCase().trim();
  
  // First try exact matches from the previous categoryMap
  if (categoryMap[word]) {
    return categoryMap[word];
  }

  // Then try to find the best matching category based on keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => 
      word.includes(keyword) || keyword.includes(word)
    )) {
      return category;
    }
  }

  // Check if it's food-related using our smart function
  if (isFoodRelated(word)) {
    return 'Food & Drinks > Meals';
  }

  // If still no match, check for transport-related words
  const transportWords = [
    'transport', 'travel', 'ride', 'vehicle', 'car', 'bus', 'train',
    'taxi', 'uber', 'lyft', 'cab', 'metro', 'subway', 'bike'
  ];

  const isTransportRelated = transportWords.some(transportWord => 
    word.includes(transportWord) || transportWord.includes(word)
  );

  if (isTransportRelated) {
    return 'Transport > Other';
  }

  // Default fallback
  return `Miscellaneous > Other > ${input}`;
}

// Add this helper function at the top of your file
function formatLogTime(date = new Date()) {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Add a test endpoint to check database status
app.get('/api/debug', (req, res) => {
    try {
        const dbStatus = {
            expenses: db.prepare('SELECT COUNT(*) as count FROM expenses').get(),
            recurring: db.prepare('SELECT COUNT(*) as count FROM recurring_expenses WHERE active = 1').get(),
            expensesColumns: db.prepare('PRAGMA table_info(expenses)').all(),
            recurringColumns: db.prepare('PRAGMA table_info(recurring_expenses)').all()
        };
        res.json(dbStatus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Make sure this route comes BEFORE the individual delete route
app.delete('/api/expenses/all', (req, res) => {
    try {
        console.log('Attempting to delete all expenses...');
        const result = db.prepare('DELETE FROM expenses').run();
        console.log('Delete all result:', result);
        res.json({ success: true, message: 'All expenses deleted' });
    } catch (error) {
        console.error('Error deleting all expenses:', error);
        res.status(500).json({ error: 'Error deleting all expenses' });
    }
});

// Individual delete route should come after
app.delete('/api/expenses/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Error deleting expense' });
    }
});

// Add this endpoint to check the database status
app.get('/api/status', (req, res) => {
    try {
        const expensesCount = db.prepare('SELECT COUNT(*) as count FROM expenses').get();
        const recurringCount = db.prepare('SELECT COUNT(*) as count FROM recurring_expenses WHERE active = 1').get();
        
        res.json({
            status: 'ok',
            expenses: expensesCount.count,
            recurring: recurringCount.count,
            tables: [
                db.prepare("PRAGMA table_info(expenses)").all(),
                db.prepare("PRAGMA table_info(recurring_expenses)").all()
            ]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Start command
bot.start((ctx) => {
  const welcomeMsg = "👋 Welcome to Hornerito! I can help you track your expenses.\n\nSend an expense (e.g., '30 on food') to get started.";
  ctx.reply(welcomeMsg, {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES')],
      [Markup.button.callback('🛠 Edit Expense', 'EDIT_EXPENSE')],
      [Markup.button.callback('❌ Delete Last Expense', 'DELETE_LAST')],
    ]),
  });
});

// Helper function to escape special characters for MarkdownV2
function escapeMarkdownV2(text) {
  return text
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Add this helper function
async function clearSession(ctx) {
  if (ctx.session) {
    delete ctx.session.editingExpenseId;
    delete ctx.session.editingCategoryId;
    delete ctx.session.originalAmount;
    delete ctx.session.originalCategory;
    delete ctx.session.pendingExpense;
  }
}

// Add a helper function for greetings
function isGreeting(text) {
  const greetings = ['hey', 'hello', 'hi', 'hola', 'help', 'start'];
  return greetings.includes(text.toLowerCase().trim());
}

// Add more responses for different types of messages
const POSITIVE_RESPONSES = ['great', 'good', 'nice', 'thanks', 'thank', 'awesome', 'cool', 'perfect'];
const GREETINGS = ['hey', 'hello', 'hi', 'hola', 'help', 'start'];

// Initialize OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Update the learnNewCategory function to use the correct OpenAI client
async function learnNewCategory(description, userCategory) {
    try {
        // First, let's ask ChatGPT to learn this correction
        const message = `Learn this expense categorization: "${description}" should be categorized as "${userCategory}". 
                        Please update your categorization knowledge accordingly.`;
        
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a helpful expense categorizer. Learn from user corrections to improve future categorizations." },
                { role: "user", content: message }
            ]
        });

        console.log(`✏️ Learning: "${description}" → "${userCategory}"`);
    } catch (error) {
        console.error('Error in learning new category:', error);
    }
}

// Update the showRecurringExpenses function
async function showRecurringExpenses(ctx) {
    try {
        // First check if the table exists
        db.prepare(`
            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                amount REAL,
                category TEXT,
                description TEXT,
                frequency TEXT,
                start_date TEXT,
                last_tracked TEXT,
                active INTEGER DEFAULT 1
            )
        `).run();

        // Log the user ID we're searching for
        const userId = ctx.from.id.toString();
        console.log('Searching for recurring expenses for user:', userId);

        // Check if we have any records at all
        const allRecords = db.prepare('SELECT COUNT(*) as count FROM recurring_expenses').get();
        console.log('Total records in table:', allRecords.count);

        // Then fetch the expenses with explicit column names
        const recurring = db.prepare(`
            SELECT 
                id,
                amount,
                category,
                description,
                frequency,
                start_date,
                last_tracked,
                active
            FROM recurring_expenses 
            WHERE user_id = ? 
            AND active = 1
        `).all(userId);

        console.log('Found recurring expenses:', recurring);

        if (!recurring || recurring.length === 0) {
            await ctx.reply(
                "🔍 You don't have any recurring expenses set up yet!\n\n" +
                "💡 Want to add one? Just say 'add recurring expense'!",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "➕ Add Recurring", callback_data: "ADD_RECURRING" }]
                        ]
                    }
                }
            );
            return;
        }

        // Group expenses by frequency
        const grouped = recurring.reduce((acc, exp) => {
            if (!acc[exp.frequency]) {
                acc[exp.frequency] = [];
            }
            acc[exp.frequency].push(exp);
            return acc;
        }, {});

        let message = "📋 Here are your recurring expenses:\n\n";

        if (grouped.daily) {
            message += "📅 Daily:\n";
            grouped.daily.forEach(exp => {
                message += `• $${parseFloat(exp.amount).toFixed(2)} - ${exp.description} (${exp.category}) 💰\n`;
            });
            message += "\n";
        }

        if (grouped.weekly) {
            message += "📅 Weekly:\n";
            grouped.weekly.forEach(exp => {
                message += `• $${parseFloat(exp.amount).toFixed(2)} - ${exp.description} (${exp.category}) 💰\n`;
            });
            message += "\n";
        }

        if (grouped.monthly) {
            message += "📅 Monthly:\n";
            grouped.monthly.forEach(exp => {
                message += `• $${parseFloat(exp.amount).toFixed(2)} - ${exp.description} (${exp.category}) 💰\n`;
            });
            message += "\n";
        }

        // Calculate totals
        const totals = {
            daily: grouped.daily?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0,
            weekly: grouped.weekly?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0,
            monthly: grouped.monthly?.reduce((sum, exp) => sum + parseFloat(exp.amount), 0) || 0
        };

        message += "💫 Summary:\n";
        if (totals.daily > 0) message += `Daily total: $${totals.daily.toFixed(2)}\n`;
        if (totals.weekly > 0) message += `Weekly total: $${totals.weekly.toFixed(2)}\n`;
        if (totals.monthly > 0) message += `Monthly total: $${totals.monthly.toFixed(2)}\n`;

        // Calculate estimated monthly total
        const estimatedMonthly = totals.monthly + (totals.weekly * 4) + (totals.daily * 30);
        message += `\n🎯 Estimated monthly spending: $${estimatedMonthly.toFixed(2)}`;

        // When sending the message, remove the dashboard button if URL isn't set
        const dashboardUrl = process.env.DASHBOARD_URL;
        let keyboard = [
            [
                { text: "➕ Add New", callback_data: "ADD_RECURRING" },
                { text: "✏️ Edit", callback_data: "EDIT_RECURRING" }
            ]
        ];

        // Only add the dashboard button if we have a valid URL
        if (dashboardUrl && !dashboardUrl.includes('localhost')) {
            keyboard.push([
                { text: "🗑️ Remove One", callback_data: "REMOVE_RECURRING" },
                { text: "🌐 View Dashboard", url: dashboardUrl }
            ]);
        } else {
            keyboard.push([
                { text: "🗑️ Remove One", callback_data: "REMOVE_RECURRING" }
            ]);
        }

        await ctx.reply(message, {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (error) {
        console.error('Error in showRecurringExpenses:', error);
        console.error('Error stack:', error.stack);
        
        // Send a more detailed error message in development
        if (process.env.NODE_ENV === 'development') {
            await ctx.reply(
                `Debug Error Info:\n${error.message}\n\n` +
                "Please check the console for more details."
            );
        } else {
            await ctx.reply(
                "😅 Oops! Something went wrong while fetching your recurring expenses.\n" +
                "Please try again in a moment! 🔄"
            );
        }
    }
}

// Update the text handler
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text.toLowerCase().trim();
        console.log('Received text:', text);

        // First, check for recurring expense list request
        if (['show recurring', 'list recurring', 'recurring expenses', 'show recurring expenses', 'show my recurring expenses'].includes(text)) {
            await showRecurringExpenses(ctx);
            return;
        }

        // Then check for recurring expense setup request
        if (text === 'add recurring expense' || text === 'recurring expense') {
            ctx.session = {
                ...ctx.session,
                addingRecurring: true,
                recurringStep: 'amount'
            };
            
            await ctx.reply(
                "🎯 Awesome! Let's set up a recurring expense together!\n\n" +
                "💰 First, what's the amount you want to track?\n" +
                "Just send me a number (like 25.99) 👇",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                        ]
                    }
                }
            );
            return;
        }

        // If we're in a recurring expense setup flow
        if (ctx.session?.addingRecurring) {
            switch (ctx.session.recurringStep) {
                case 'amount':
                    const amount = parseFloat(text);
                    if (isNaN(amount) || amount <= 0) {
                        await ctx.reply(
                            "❌ Oops! That doesn't look like a valid amount.\n\n" +
                            "🔢 Please send me a number like 25.99 or 100\n" +
                            "Let's try again! 😊"
                        );
                        return;
                    }
                    ctx.session.recurringAmount = amount;
                    ctx.session.recurringStep = 'description';
                    await ctx.reply(
                        "🌟 Perfect! Now, what is this expense for?\n\n" +
                        "💡 Examples:\n" +
                        "• Netflix subscription 📺\n" +
                        "• Gym membership 🏋️‍♂️\n" +
                        "• Monthly bus pass 🚌\n" +
                        "• Phone bill 📱",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                                ]
                            }
                        }
                    );
                    return;

                case 'description':
                    ctx.session.recurringDescription = text;
                    
                    try {
                        console.log('🔍 Categorizing recurring expense:', text);
                        const category = await categorizer.categorize(text);
                        console.log('✅ Category determined:', category);
                        
                        ctx.session.recurringCategory = category;
                        
                        await ctx.reply(
                            `🤔 I think "${text}" belongs in the "${category}" category!\n\n` +
                            "✨ Did I get that right?",
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: "✅ Yes, perfect!", callback_data: "CAT_CONFIRM" },
                                            { text: "✏️ Need to change it", callback_data: "CAT_CHANGE" }
                                        ],
                                        [
                                            { text: "🔄 Start over", callback_data: "CAT_RESTART" },
                                            { text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }
                                        ]
                                    ]
                                }
                            }
                        );
                    } catch (error) {
                        console.error('Error categorizing expense:', error);
                        await ctx.reply(
                            "😅 Oops! I had a bit of trouble categorizing that.\n\n" +
                            "🔄 Could you try describing it again?",
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                                    ]
                                }
                            }
                        );
                    }
                    return;

                case 'manual_category':
                    const userCategory = text;
                    const description = ctx.session.recurringDescription;

                    await learnNewCategory(description, userCategory);
                    ctx.session.recurringCategory = userCategory;

                    try {
                        const suggestedCategory = await categorizer.categorize(description, userCategory);
                        
                        if (suggestedCategory.toLowerCase() !== userCategory.toLowerCase()) {
                            await ctx.reply(
                                "🤔 I have two options for categorizing this:\n\n" +
                                `1️⃣ Your suggestion: "${userCategory}"\n` +
                                `2️⃣ My suggestion: "${suggestedCategory}"\n\n` +
                                "✨ Which one should we use?",
                                {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: "1️⃣ Use mine", callback_data: `USE_CAT_${userCategory}` },
                                                { text: "2️⃣ Use suggestion", callback_data: `USE_CAT_${suggestedCategory}` }
                                            ],
                                            [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                                        ]
                                    }
                                }
                            );
                            return;
                        }
                    } catch (error) {
                        console.error('Error in category validation:', error);
                    }

                    ctx.session.recurringStep = 'frequency';
                    await ctx.reply(
                        `🎯 Great! Category set to "${userCategory}"\n\n` +
                        "⏰ How often should I track this expense?",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: "📅 Daily", callback_data: "FREQ_daily" },
                                        { text: "📅 Weekly", callback_data: "FREQ_weekly" },
                                        { text: "📅 Monthly", callback_data: "FREQ_monthly" }
                                    ],
                                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                                ]
                            }
                        }
                    );
                    return;
            }
        }

        // Finally, handle regular expense logging
        // If we're editing an amount, handle it differently
        if (ctx.session?.editingExpenseId) {
            const amount = parseFloat(text);
            
            if (isNaN(amount)) {
                await ctx.reply(
                    "❌ Please send a valid number for the amount\\.",
                    { parse_mode: 'MarkdownV2' }
                );
                return;
            }

            try {
                const expenseId = ctx.session.editingExpenseId;
                const originalCategory = ctx.session.originalCategory;

                // Update the expense with new amount
                db.prepare('UPDATE expenses SET amount = ? WHERE id = ?')
                    .run(amount, expenseId);

                // Clear the editing session
                delete ctx.session.editingExpenseId;
                delete ctx.session.originalCategory;

                const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(originalCategory);

                await ctx.reply(
                    `✅ Amount updated: \$${escapedAmount} on ${escapedCategory}`,
                    {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    Markup.button.callback('✏️ Edit Amount', `EDIT_${expenseId}`),
                                    Markup.button.callback('🏷️ Edit Category', `EDITCAT_${expenseId}`)
                                ],
                                [
                                    Markup.button.callback('🗑️ Delete', `DELETE_${expenseId}`),
                                    Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                                ],
                                [
                                    Markup.button.callback('❌ Cancel', 'CANCEL')
                                ]
                            ]
                        }
                    }
                );
                return;
            } catch (error) {
                console.error('Error updating amount:', error);
                await ctx.reply(
                    "❌ Error updating amount\\. Please try again\\.",
                    { parse_mode: 'MarkdownV2' }
                );
                return;
            }
        }

        // Handle positive responses
        if (POSITIVE_RESPONSES.some(word => text.includes(word))) {
            await ctx.reply(
                "😊 Glad I could help!\n\n" +
                "If you have any expense to record, just let me know! You can use:\n" +
                "• '30 on food'\n" +
                "• '25 taxi'\n" +
                "• '10 coffee' (simple format works too!)",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ],
                            [
                                Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                            ]
                        ]
                    }
                }
            );
            return;
        }

        // Handle greetings
        if (GREETINGS.some(word => text.includes(word))) {
            const welcomeMsg = 
                "👋 Welcome to Hornerito\\! I can help you track your expenses\\.\n\n" +
                "💡 *How to use me:*\n" +
                "• Send amount and category \\(e\\.g\\. '30 on food'\\)\n" +
                "• View your expenses with the buttons below\n" +
                "• Edit or delete expenses as needed";

            await ctx.reply(welcomeMsg, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                        ],
                        [
                            Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                        ]
                    ]
                }
            });
            return;
        }

        // Handle expense pattern
        const regex = /([0-9]+(?:\.[0-9]+)?)\s*(?:on|in|for)?\s*(.+)/i;
        const match = text.match(regex);

        if (match) {
            try {
                const amount = parseFloat(match[1]);
                const expenseText = match[2].trim();
                console.log('🔍 Categorizing:', JSON.stringify(expenseText));
                const category = await categorizer.categorize(expenseText);
                console.log('✅ Found category:', category);

                const timestamp = new Date().toISOString();
                const result = db.prepare(
                    'INSERT INTO expenses (user_id, amount, category, timestamp) VALUES (?, ?, ?, ?)'
                ).run(ctx.from.id.toString(), amount, category, timestamp);

                const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(category);

                await ctx.reply(`✅ Expense saved: \$${escapedAmount} on ${escapedCategory}`, {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('✏️ Edit Amount', `EDIT_${result.lastInsertRowid}`),
                                Markup.button.callback('🏷️ Edit Category', `EDITCAT_${result.lastInsertRowid}`)
                            ],
                            [
                                Markup.button.callback('🗑️ Delete', `DELETE_${result.lastInsertRowid}`),
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ],
                            [
                                Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                            ]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error saving expense:', error);
                await ctx.reply(
                    "❌ Error saving expense\\. Please try again\\.", 
                    { parse_mode: 'MarkdownV2' }
                );
            }
        } else {
            await ctx.reply(
                "I'm not sure what you mean\\. Try:\n" +
                "• '30 on food'\n" +
                "• '25 taxi' \\(simple format works too\\!\\)\n" +
                "• Or just say 'help' for more info", 
                { 
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ]
                        ]
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error in text handler:', error);
        await ctx.reply(
            "😅 Oops! Something went wrong.\n" +
            "Please try again in a moment! 🔄"
        );
    }
});

// Update the cancel handler
bot.action('CANCEL', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await clearSession(ctx);
        await ctx.reply('❌ Operation cancelled');
    } catch (error) {
        console.error('Error in cancel handler:', error);
    }
});

// Helper function to add permanent buttons to any keyboard
function addPermanentButtons(keyboard = []) {
    const permanentButtons = [
        [
            { text: '📊 View Expenses', callback_data: 'VIEW_EXPENSES' },
            { text: '❌ Cancel', callback_data: 'CANCEL' }
        ]
    ];
    return [...keyboard, ...permanentButtons];
}

// Edit expense handler
bot.action(/^EDIT_(\d+)$/, async (ctx) => {
    const expenseId = ctx.match[1];
    
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    
    if (!expense) {
        await ctx.reply("❌ Expense not found\\.", { parse_mode: 'MarkdownV2' });
        return;
    }

    ctx.session = {
        editingExpenseId: parseInt(expenseId),
        originalCategory: expense.category
    };

    const escapedAmount = expense.amount.toString().replace(/[.\-]/g, '\\$&');
    const escapedCategory = escapeMarkdownV2(expense.category);

    await ctx.reply(
        `✏️ Current expense: \$${escapedAmount} on ${escapedCategory}\n\n` +
        `Send the new amount:`,
        {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [Markup.button.callback('❌ Cancel', 'CANCEL')]
                ]
            }
        }
    );
});

// Handle "Other" category selection
bot.action('cat_other', async (ctx) => {
    try {
        await ctx.answerCbQuery();

        await ctx.reply(
            "You can either:\n\n" +
            "1️⃣ Select from these additional categories:\n" +
            "Or\n" +
            "2️⃣ Type your custom category in the format:\n" +
            "`MainCategory > Subcategory > Type`\n" +
            "Example: `Hobbies > Gaming > Steam`",
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: addPermanentButtons([
                        [
                            { text: "Education", callback_data: "subcat_Education_Studies" },
                            { text: "Hobbies", callback_data: "subcat_Hobbies_General" }
                        ],
                        [
                            { text: "Gifts", callback_data: "subcat_Personal_Gifts" },
                            { text: "Bills", callback_data: "subcat_Home_Bills" }
                        ]
                    ])
                }
            }
        );
    } catch (error) {
        console.error('Error in cat_other handler:', error);
    }
});

// Update the EDITCAT handler
bot.action(/^EDITCAT_(\d+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const expenseId = ctx.match[1];
        
        const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
        
        if (!expense) {
            await ctx.reply("❌ Expense not found\\.", { parse_mode: 'MarkdownV2' });
            return;
        }

        // Store the expense ID and amount in session
        ctx.session = {
            editingCategoryId: parseInt(expenseId),
            originalAmount: expense.amount
        };

        const escapedAmount = expense.amount.toString().replace(/[.\-]/g, '\\$&');
        const escapedCategory = escapeMarkdownV2(expense.category || 'uncategorized');

        await ctx.reply(
            `Current expense: \$${escapedAmount} on ${escapedCategory}\n\n` +
            `Select new category:`,
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🍽️ Food & Drinks", callback_data: "cat_food" },
                            { text: "🚗 Transport", callback_data: "cat_transport" }
                        ],
                        [
                            { text: "🛍️ Shopping", callback_data: "cat_shopping" },
                            { text: "🎮 Entertainment", callback_data: "cat_entertainment" }
                        ],
                        [
                            { text: "💊 Health", callback_data: "cat_health" },
                            { text: "📦 Other", callback_data: "cat_other" }
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "CANCEL" }
                        ]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error in EDITCAT handler:', error);
        await ctx.reply("❌ Error editing category\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

// Update the category selection handler
bot.action(/^cat_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const mainCategory = ctx.match[1];
        
        let subcategories;
        switch (mainCategory.toLowerCase()) {
            case 'food':
                subcategories = [
                    ['Meals', 'Snacks'],
                    ['Drinks', 'Groceries']
                ];
                break;
            case 'transport':
                subcategories = [
                    ['Taxi', 'Public'],
                    ['Fuel', 'Parking']
                ];
                break;
            case 'shopping':
                subcategories = [
                    ['Clothing', 'Electronics'],
                    ['Home', 'Personal']
                ];
                break;
            case 'entertainment':
                subcategories = [
                    ['Movies', 'Games'],
                    ['Events', 'Sports']
                ];
                break;
            case 'health':
                subcategories = [
                    ['Medical', 'Pharmacy'],
                    ['Fitness', 'Personal Care']
                ];
                break;
            case 'other':
                subcategories = [
                    ['Education', 'Business'],
                    ['Gifts', 'Misc']
                ];
                break;
            default:
                subcategories = [['General']];
        }

        const keyboard = subcategories.map(row => 
            row.map(subcat => ({
                text: subcat,
                callback_data: `subcat_${mainCategory}_${subcat.toLowerCase()}`
            }))
        );

        keyboard.push([{ text: "❌ Cancel", callback_data: "CANCEL" }]);

        await ctx.reply(
            `Select a subcategory for ${mainCategory}:`,
            {
                reply_markup: { inline_keyboard: keyboard }
            }
        );
    } catch (error) {
        console.error('Error in category selection:', error);
        await ctx.reply("❌ Error selecting category\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

// Update the subcategory selection handler
bot.action(/^subcat_(.+)_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const mainCategory = ctx.match[1];
        const subCategory = ctx.match[2];
        const fullCategory = `${mainCategory}>${subCategory}`;

        if (ctx.session?.editingCategoryId) {
            const expenseId = ctx.session.editingCategoryId;
            const amount = ctx.session.originalAmount;

            // Update the expense with new category
            db.prepare('UPDATE expenses SET category = ? WHERE id = ?')
                .run(fullCategory, expenseId);

            // Clear the editing session
            delete ctx.session.editingCategoryId;
            delete ctx.session.originalAmount;

            const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
            const escapedCategory = escapeMarkdownV2(fullCategory);

            await ctx.reply(
                `✅ Category updated: \$${escapedAmount} on ${escapedCategory}`,
                {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('✏️ Edit Amount', `EDIT_${expenseId}`),
                                Markup.button.callback('🏷️ Edit Category', `EDITCAT_${expenseId}`)
                            ],
                            [
                                Markup.button.callback('🗑️ Delete', `DELETE_${expenseId}`),
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ],
                            [
                                Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                            ]
                        ]
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error in subcategory selection:', error);
        await ctx.reply("❌ Error updating category\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

// Update VIEW_EXPENSES handler
bot.action('VIEW_EXPENSES', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        const expenses = db.prepare(
            'SELECT * FROM expenses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5'
        ).all(ctx.from.id.toString());

        if (expenses.length === 0) {
            await ctx.reply("No expenses recorded yet\\.", { 
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                        ]
                    ]
                }
            });
            return;
        }

        const message = expenses.map(exp => {
            const date = new Date(exp.timestamp).toLocaleDateString();
            const amount = exp.amount.toString().replace(/[.\-]/g, '\\$&');
            const category = escapeMarkdownV2(exp.category);
            return `📅 ${date}: \$${amount} on ${category}`;
        }).join('\n');

        await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                    ]
                ]
            }
        });
    } catch (error) {
        console.error('Error in VIEW_EXPENSES:', error);
        await ctx.reply("❌ Error viewing expenses\\. Please try again\\.", { 
            parse_mode: 'MarkdownV2'
        });
    }
});

// Delete last expense handler
bot.action('DELETE_LAST', async (ctx) => {
    const lastExpense = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1')
        .get(ctx.from.id.toString());

    if (!lastExpense) {
        await ctx.reply("📭 No expenses recorded yet\\.", { parse_mode: 'MarkdownV2' });
        return;
    }

    // Delete the expense
    db.prepare('DELETE FROM expenses WHERE id = ?').run(lastExpense.id);

    const escapedAmount = lastExpense.amount.toString().replace(/[.\-]/g, '\\$&');
    const escapedCategory = escapeMarkdownV2(lastExpense.category);

    await ctx.reply(
        `🗑 Deleted last expense: \$${escapedAmount} on ${escapedCategory}`,
        { parse_mode: 'MarkdownV2' }
    );
});

// Add a new handler for direct expense deletion
bot.action(/^DELETE_(\d+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const expenseId = ctx.match[1];
        
        const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
        if (!expense) {
            await ctx.reply("❌ Expense not found\\.", { parse_mode: 'MarkdownV2' });
            return;
        }

        // Delete the expense
        db.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);

        const escapedAmount = expense.amount.toString().replace(/[.\-]/g, '\\$&');
        const escapedCategory = escapeMarkdownV2(expense.category);

        await ctx.reply(
            `🗑️ Deleted expense: \$${escapedAmount} on ${escapedCategory}`,
            { 
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            Markup.button.callback('↩️ Undo', `RESTORE_${JSON.stringify({
                                amount: expense.amount,
                                category: expense.category
                            })}`),
                            Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                        ]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error in DELETE handler:', error);
        await ctx.reply("❌ Error deleting expense\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

// Add handler for restoring deleted expenses
bot.action(/^RESTORE_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const data = JSON.parse(ctx.match[1]);
        
        // Insert the restored expense
        const timestamp = new Date().toISOString();
        const result = db.prepare(
            'INSERT INTO expenses (user_id, amount, category, timestamp) VALUES (?, ?, ?, ?)'
        ).run(ctx.from.id.toString(), data.amount, data.category, timestamp);

        const escapedAmount = data.amount.toString().replace(/[.\-]/g, '\\$&');
        const escapedCategory = escapeMarkdownV2(data.category);

        await ctx.reply(
            `✅ Restored expense: \$${escapedAmount} on ${escapedCategory}`,
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            Markup.button.callback('✏️ Edit', `EDIT_${result.lastInsertRowid}`),
                            Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                        ]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error in RESTORE handler:', error);
        await ctx.reply("❌ Error restoring expense\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

// Add a help command handler
bot.action('SHOW_HELP', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        const helpMsg = 
            "🤖 *Hornerito Help*\n\n" +
            "📝 *Adding Expenses*\n" +
            "• Send: `amount on category`\n" +
            "• Example: `30 on food`\n" +
            "• Example: `25.50 for taxi`\n\n" +
            "🔍 *Categories*\n" +
            "• Food & Drinks\n" +
            "• Transport\n" +
            "• Shopping\n" +
            "• Entertainment\n" +
            "• Health\n" +
            "• Other\n\n" +
            "✏️ *Editing*\n" +
            "• Click Edit Amount to change amount\n" +
            "• Click Edit Category to change category\n\n" +
            "📊 *Viewing*\n" +
            "• Click View Last 5 to see recent expenses\n" +
            "• Use the dashboard for detailed analysis";

        await ctx.reply(helpMsg, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES'),
                        Markup.button.callback('📈 View Stats', 'VIEW_STATS')
                    ],
                    [
                        Markup.button.callback('❌ Cancel', 'CANCEL')
                    ]
                ]
            }
        });
    } catch (error) {
        console.error('Error showing help:', error);
        await ctx.reply("❌ Error showing help\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

// Add a stats handler
bot.action('VIEW_STATS', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        const userId = ctx.from.id.toString();
        
        // Get total expenses
        const total = db.prepare(
            'SELECT SUM(amount) as total FROM expenses WHERE user_id = ?'
        ).get(userId);

        // Get today's expenses
        const today = new Date().toISOString().split('T')[0];
        const todayTotal = db.prepare(
            'SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date(timestamp) = ?'
        ).get(userId, today);

        // Get this month's expenses
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        const monthTotal = db.prepare(
            'SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date(timestamp) >= ?'
        ).get(userId, monthStartStr);

        const statsMsg = 
            "📊 *Expense Statistics*\n\n" +
            `💰 *Total Expenses:* \$${(total.total || 0).toFixed(2)}\n` +
            `📅 *Today:* \$${(todayTotal.total || 0).toFixed(2)}\n` +
            `📆 *This Month:* \$${(monthTotal.total || 0).toFixed(2)}`;

        await ctx.reply(statsMsg, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES'),
                        Markup.button.callback('🔄 Refresh Stats', 'VIEW_STATS')
                    ],
                    [
                        Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                    ]
                ]
            }
        });
    } catch (error) {
        console.error('Error in VIEW_STATS:', error);
        await ctx.reply("❌ Error fetching stats\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
    }
});

bot.command('stoprecurring', async (ctx) => {
    const id = ctx.message.text.split(' ')[1];
    if (!id) {
        await ctx.reply(
            "Please provide the expense ID.\n" +
            "Use /listrecurring to see all IDs."
        );
        return;
    }

    try {
        const result = db.prepare(`
            UPDATE recurring_expenses 
            SET active = 0 
            WHERE id = ? AND user_id = ?
        `).run(id, ctx.from.id.toString());

        if (result.changes > 0) {
            await ctx.reply("✅ Recurring expense stopped successfully!");
        } else {
            await ctx.reply("❌ Expense not found or already stopped.");
        }
    } catch (error) {
        console.error('Error stopping recurring expense:', error);
        await ctx.reply("❌ Error stopping recurring expense.");
    }
});

// Add callback handlers for the recurring expense setup
bot.action('CANCEL_RECURRING', async (ctx) => {
    ctx.session = {
        ...ctx.session,
        addingRecurring: false,
        recurringStep: null,
        recurringAmount: null,
        recurringCategory: null,
        recurringDescription: null
    };
    await ctx.answerCbQuery("❌ Cancelled!");
    await ctx.reply("😊 No problem! Let me know if you want to try again later!");
});

bot.action(/FREQ_(.+)/, async (ctx) => {
    const frequency = ctx.match[1];
    const { recurringAmount, recurringCategory, recurringDescription } = ctx.session;

    try {
        const startDate = new Date().toISOString();
        db.prepare(`
            INSERT INTO recurring_expenses 
            (user_id, amount, category, description, frequency, start_date, last_tracked)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            ctx.from.id.toString(),
            recurringAmount,
            recurringCategory,
            recurringDescription,
            frequency,
            startDate,
            startDate
        );

        await ctx.answerCbQuery("✨ All set!");
        await ctx.reply(
            "🎉 Woohoo! Your recurring expense is all set up!\n\n" +
            `💰 Amount: $${recurringAmount}\n` +
            `📂 Category: ${recurringCategory}\n` +
            `📝 Description: ${recurringDescription}\n` +
            `⏰ Frequency: ${frequency}\n\n` +
            "✅ I'll automatically track this for you and let you know each time!\n\n" +
            "💡 Tip: Use /listrecurring to see all your recurring expenses! 📋"
        );

        // Clear the session
        ctx.session = {
            ...ctx.session,
            addingRecurring: false,
            recurringStep: null,
            recurringAmount: null,
            recurringCategory: null,
            recurringDescription: null
        };
    } catch (error) {
        console.error('Error setting up recurring expense:', error);
        await ctx.answerCbQuery("❌ Error!");
        await ctx.reply(
            "😅 Oops! Something went wrong while setting up your recurring expense.\n" +
            "🔄 Could we try that again?"
        );
    }
});

// Add new category confirmation handlers
bot.action('CAT_CONFIRM', async (ctx) => {
    ctx.session.recurringStep = 'frequency';
    await ctx.answerCbQuery("✅ Perfect!");
    await ctx.reply(
        "⏰ How often should I track this expense?",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "📅 Daily", callback_data: "FREQ_daily" },
                        { text: "📅 Weekly", callback_data: "FREQ_weekly" },
                        { text: "📅 Monthly", callback_data: "FREQ_monthly" }
                    ],
                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                ]
            }
        }
    );
});

bot.action('CAT_CHANGE', async (ctx) => {
    ctx.session.recurringStep = 'manual_category';
    await ctx.answerCbQuery("✏️ Let's fix that!");
    await ctx.reply(
        "📝 What category should we use instead?\n\n" +
        "💡 Examples:\n" +
        "• Food 🍜\n" +
        "• Transport 🚌\n" +
        "• Entertainment 🎮\n" +
        "• Bills 📱",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                ]
            }
        }
    );
});

bot.action('CAT_RESTART', async (ctx) => {
    ctx.session = {
        ...ctx.session,
        addingRecurring: true,
        recurringStep: 'amount',
        recurringAmount: null,
        recurringCategory: null,
        recurringDescription: null
    };
    
    await ctx.answerCbQuery("🔄 Starting over!");
    await ctx.reply(
        "🆕 Let's start fresh!\n\n" +
        "💰 What's the amount for this recurring expense?",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                ]
            }
        }
    );
});

// Add handler for category choice
bot.action(/USE_CAT_(.+)/, async (ctx) => {
    const chosenCategory = ctx.match[1];
    ctx.session.recurringCategory = chosenCategory;
    ctx.session.recurringStep = 'frequency';
    
    await ctx.answerCbQuery();
    await ctx.reply(
        `Category set to "${chosenCategory}"\n\n` +
        "How often should this repeat?",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "📅 Daily", callback_data: "FREQ_daily" },
                        { text: "📅 Weekly", callback_data: "FREQ_weekly" },
                        { text: "📅 Monthly", callback_data: "FREQ_monthly" }
                    ],
                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                ]
            }
        }
    );
});

// Add handlers for the new inline buttons
bot.action('ADD_RECURRING', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session = {
        ...ctx.session,
        addingRecurring: true,
        recurringStep: 'amount'
    };
    
    await ctx.reply(
        "🎯 Awesome! Let's set up a new recurring expense!\n\n" +
        "💰 First, what's the amount you want to track?\n" +
        "Just send me a number (like 25.99) 👇",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                ]
            }
        }
    );
});

bot.action('EDIT_RECURRING', async (ctx) => {
    try {
        const recurring = db.prepare(`
            SELECT id, amount, description, frequency 
            FROM recurring_expenses 
            WHERE user_id = ? AND active = 1
            ORDER BY frequency, amount
        `).all(ctx.from.id.toString());

        if (recurring.length === 0) {
            await ctx.answerCbQuery("No recurring expenses to edit!");
            return;
        }

        const buttons = recurring.map(exp => [{
            text: `$${exp.amount} - ${exp.description} (${exp.frequency})`,
            callback_data: `EDIT_REC_${exp.id}`
        }]);

        await ctx.answerCbQuery();
        await ctx.reply(
            "✏️ Which recurring expense would you like to edit?",
            {
                reply_markup: {
                    inline_keyboard: [
                        ...buttons,
                        [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error showing edit options:', error);
        await ctx.answerCbQuery("Error loading expenses!");
    }
});

bot.action('REMOVE_RECURRING', async (ctx) => {
    try {
        const recurring = db.prepare(`
            SELECT id, amount, description, frequency 
            FROM recurring_expenses 
            WHERE user_id = ? AND active = 1
            ORDER BY frequency, amount
        `).all(ctx.from.id.toString());

        if (recurring.length === 0) {
            await ctx.answerCbQuery("No recurring expenses to remove!");
            return;
        }

        const buttons = recurring.map(exp => [{
            text: `$${exp.amount} - ${exp.description} (${exp.frequency})`,
            callback_data: `REMOVE_REC_${exp.id}`
        }]);

        await ctx.answerCbQuery();
        await ctx.reply(
            "🗑️ Which recurring expense would you like to remove?",
            {
                reply_markup: {
                    inline_keyboard: [
                        ...buttons,
                        [{ text: "❌ Cancel", callback_data: "CANCEL_RECURRING" }]
                    ]
                }
            }
        );
    } catch (error) {
        console.error('Error showing remove options:', error);
        await ctx.answerCbQuery("Error loading expenses!");
    }
});

// Update the remove handler
bot.action(/REMOVE_REC_(\d+)/, async (ctx) => {
    try {
        const id = ctx.match[1];
        
        db.prepare(`
            UPDATE recurring_expenses 
            SET active = 0 
            WHERE id = ? AND user_id = ?
        `).run(id, ctx.from.id.toString());

        await ctx.answerCbQuery("✅ Removed!");
        await ctx.reply("✨ Recurring expense removed successfully!");
        
        // Show updated list using the helper function
        await showRecurringExpenses(ctx);
    } catch (error) {
        console.error('Error removing recurring expense:', error);
        await ctx.answerCbQuery("Error removing expense!");
        await ctx.reply(
            "😅 Oops! Something went wrong while removing the expense.\n" +
            "Please try again in a moment! 🔄"
        );
    }
});

bot.launch().then(() => {
    console.log('✅ Bot is running');
}).catch(error => {
    console.error('❌ Error starting bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
