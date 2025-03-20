require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const path = require('path');
const categorizer = require('./categorizer');
const OpenAI = require('openai');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');

console.log('\n🤖 Starting Hornerito Bot...\n');

const app = express();

// Define dataDir at the top of the file, right after the imports
const dataDir = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
}

// Enable compression
app.use(compression());

// API middleware
console.log('📚 Initializing middleware...');
app.use(express.json());

// Update CORS configuration with caching headers
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
    credentials: true,
    maxAge: 300 // Cache preflight requests for 5 minutes
}));

console.log('🔑 Loading environment variables...');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

console.log('🤖 Initializing Telegram bot...');
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Define localSession outside the try block
let localSession;

try {
    localSession = new LocalSession({
        database: path.join(dataDir, 'session.json'), // Use dataDir here
        property: 'session',
        storage: LocalSession.storageFileSync,
        format: {
            serialize: (obj) => {
                try {
                    return JSON.stringify(obj, null, 2);
                } catch (error) {
                    console.error('Error serializing session:', error);
                    return JSON.stringify({});
                }
            },
            deserialize: (str) => {
                try {
                    return JSON.parse(str);
                } catch (error) {
                    console.error('Error deserializing session, resetting:', error);
                    return {};
                }
            },
        },
        state: {
            editingExpenseId: null,
            originalCategory: null,
            originalAmount: null,
            userId: null
        }
    });

    // Initialize session file if it doesn't exist
    const sessionFile = path.join(dataDir, 'session.json');
    if (!fs.existsSync(sessionFile)) {
        try {
            fs.writeFileSync(sessionFile, JSON.stringify({}), 'utf8');
            console.log('Created empty session file:', sessionFile);
        } catch (error) {
            console.error('Error creating session file:', error);
        }
    }

    // Use the local session middleware directly without wrapping
    bot.use(localSession.middleware());
} catch (error) {
    console.error('❌ Error initializing session middleware:', error);
    // Create a fallback session middleware that does nothing but pass through
    bot.use((ctx, next) => {
        ctx.session = ctx.session || {};
        return next();
    });
}

// Add session debug middleware with more detailed logging
bot.use(async (ctx, next) => {
    if (ctx.from) {
        const sessionId = ctx.from.id || 'unknown';
        const actionType = ctx.updateType || 'unknown';
        const callbackQuery = ctx.callbackQuery ? ctx.callbackQuery.data : 'none';
        
        console.log(`\n🔍 Session state for user ${sessionId}:`, JSON.stringify(ctx.session, null, 2));
        console.log(`   Action type: ${actionType}`);
        
        if (callbackQuery !== 'none') {
            console.log(`   Callback data: ${callbackQuery}`);
        }
        
        if (ctx.message && ctx.message.text) {
            console.log(`   Message text: ${ctx.message.text}`);
        }
    }
    return next();
});

// Use absolute path for database
const DB_PATH = path.join(dataDir, 'hornerito.db');
console.log('💾 Database path:', DB_PATH);

// Update database initialization with better error handling and persistence
console.log('🔌 Connecting to database...');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log('  └─ Successfully connected to database');
});

// Enable foreign keys and WAL mode for better data persistence
console.log('⚙️  Configuring database settings...');
db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
    console.log('  └─ Database settings configured');
});

const initDatabase = () => {
    return new Promise((resolve, reject) => {
    try {
        console.log('Initializing database schema...');
        
            // Create expenses table if it doesn't exist
            db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT,
                    subcategory TEXT,
                description TEXT,
                timestamp TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            `, (err) => {
                if (err) {
                    console.error('Error creating expenses table:', err);
                    reject(err);
                    return;
                }

                // Add subcategory column if it doesn't exist
                db.get(`SELECT COUNT(*) as count FROM pragma_table_info('expenses') WHERE name='subcategory'`, [], (err, row) => {
                    if (err) {
                        console.error('Error checking for subcategory column:', err);
                        reject(err);
                        return;
                    }

                    if (row.count === 0) {
                        console.log('Adding subcategory column to expenses table...');
                        db.run(`ALTER TABLE expenses ADD COLUMN subcategory TEXT`, [], (err) => {
                            if (err && !err.message.includes('duplicate column')) {
                                console.error('Error adding subcategory column:', err);
                                reject(err);
                                return;
                            }
                            console.log('Successfully added subcategory column');
                        });
                    }
                });

                // Create recurring_expenses table if it doesn't exist
                db.run(`
            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT,
                        subcategory TEXT,
                description TEXT,
                frequency TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT,
                last_tracked TEXT NOT NULL,
                active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
                `, (err) => {
                    if (err) {
                        console.error('Error creating recurring_expenses table:', err);
                        reject(err);
                        return;
                    }

                    // Add subcategory column if it doesn't exist
                    db.get(`SELECT COUNT(*) as count FROM pragma_table_info('recurring_expenses') WHERE name='subcategory'`, [], (err, row) => {
                        if (err) {
                            console.error('Error checking for subcategory column:', err);
                            reject(err);
                            return;
                        }

                        if (row.count === 0) {
                            console.log('Adding subcategory column to recurring_expenses table...');
                            db.run(`ALTER TABLE recurring_expenses ADD COLUMN subcategory TEXT`, [], (err) => {
                                if (err && !err.message.includes('duplicate column')) {
                                    console.error('Error adding subcategory column:', err);
                                    reject(err);
                                    return;
                                }
                                console.log('Successfully added subcategory column');
                            });
                        }

                        // Add end_date column if it doesn't exist
                        db.get(`SELECT COUNT(*) as count FROM pragma_table_info('recurring_expenses') WHERE name='end_date'`, [], (err, row) => {
                            if (err) {
                                console.error('Error checking for end_date column:', err);
                                reject(err);
                                return;
                            }

                            if (row.count === 0) {
                                console.log('Adding end_date column to recurring_expenses table...');
                                db.run(`ALTER TABLE recurring_expenses ADD COLUMN end_date TEXT`, [], (err) => {
                                    if (err && !err.message.includes('duplicate column')) {
                                        console.error('Error adding end_date column:', err);
                                        reject(err);
                                        return;
                                    }
                                    console.log('Successfully added end_date column');
                                });
                            }
                        });

                        // Verify tables and data
                        db.all(`SELECT COUNT(*) as count FROM expenses`, [], (err, result) => {
                            if (err) {
                                console.error('Error counting expenses:', err);
                            } else {
                                console.log('Current number of expenses:', result[0].count);
                            }
                            resolve();
                        });
                    });
                });
            });
        } catch (error) {
            console.error('Error initializing database:', error);
            reject(error);
        }
    });
};

// Initialize database
initDatabase().catch(console.error);

// API Routes
app.get('/api/expenses', (req, res) => {
    try {
        console.log('Fetching all expenses...');
        
        // Use a single query with UNION to get both regular and recurring expenses
        db.all(`
            SELECT 
                id,
                user_id,
                amount,
                category,
                subcategory,
                description,
                timestamp as date,
                0 as is_recurring,
                NULL as frequency
            FROM expenses 
            UNION ALL
            SELECT 
                id,
                user_id,
                amount,
                category,
                subcategory,
                description,
                last_tracked as date,
                1 as is_recurring,
                frequency
            FROM recurring_expenses
            WHERE active = 1
            ORDER BY date DESC
        `, (err, expenses) => {
            if (err) {
                console.error('Error fetching expenses:', err);
                res.status(500).json({ error: 'Failed to fetch expenses' });
                return;
            }

            // Format expenses
            const formattedExpenses = expenses.map(exp => ({
                ...exp,
                amount: parseFloat(exp.amount),
                category: exp.category || 'Uncategorized',
                subcategory: exp.subcategory || 'Other',
                description: exp.description || 'Unnamed expense'
            }));

            // Set cache headers
            res.set({
                'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
                'Expires': new Date(Date.now() + 300000).toUTCString()
            });

            res.json(formattedExpenses);
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

// Update the recent expenses endpoint
app.get('/api/recent-expenses', (req, res) => {
    try {
        // Get regular expenses
        db.all(`
            SELECT 
                'regular' as type,
                id,
                amount,
                category,
                subcategory,
                description,
                timestamp as date
            FROM expenses 
            ORDER BY timestamp DESC
            LIMIT 5
        `, [], (err, regularExpenses) => {
            if (err) {
                console.error('Error fetching regular expenses:', err);
                res.status(500).json({ error: 'Failed to fetch recent expenses' });
                return;
            }

        // Get recurring expenses
            db.all(`
            SELECT 
                'recurring' as type,
                id,
                amount,
                category,
                    subcategory,
                description,
                last_tracked as date,
                frequency
            FROM recurring_expenses
            WHERE active = 1
            ORDER BY last_tracked DESC
            LIMIT 5
            `, [], (err, recurringExpenses) => {
                if (err) {
                    console.error('Error fetching recurring expenses:', err);
                    res.status(500).json({ error: 'Failed to fetch recent expenses' });
                    return;
                }

        // Combine and format all expenses
                const allExpenses = [...(regularExpenses || []), ...(recurringExpenses || [])]
            .map(exp => ({
                id: exp.id,
                amount: parseFloat(exp.amount),
                category: exp.category || 'Uncategorized',
                        subcategory: exp.subcategory || 'Other',
                        description: exp.description || 'Unnamed expense',
                date: exp.date || new Date().toISOString(),
                is_recurring: exp.type === 'recurring',
                frequency: exp.frequency || null
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        console.log('Sending recent expenses:', allExpenses);
        res.json(allExpenses);
            });
        });
    } catch (error) {
        console.error('Error in recent expenses:', error);
        res.status(500).json({ error: 'Failed to fetch recent expenses' });
    }
});

app.get('/api/recurring-expenses', async (req, res) => {
    try {
        db.all(`
            SELECT * FROM recurring_expenses 
            WHERE active = 1
            ORDER BY frequency, amount
        `, [], (err, expenses) => {
            if (err) {
                console.error('Error fetching recurring expenses:', err);
                res.status(500).json({ error: 'Error fetching recurring expenses' });
                return;
            }

            // Format the expenses to match the expected interface
            const formattedExpenses = expenses.map(exp => ({
                id: exp.id,
                amount: parseFloat(exp.amount),
                category: exp.category || 'Uncategorized',
                subcategory: exp.subcategory || 'Other',
                displayCategory: exp.category?.includes('>') 
                    ? exp.category.split('>')[1].trim() 
                    : exp.category?.trim() || 'Uncategorized',
                description: exp.description || 'Unnamed expense',
                date: exp.last_tracked || new Date().toISOString(),
                is_recurring: true,
                frequency: exp.frequency
            }));

            res.json(formattedExpenses);
        });
    } catch (error) {
        console.error('Error fetching recurring expenses:', error);
        res.status(500).json({ error: 'Error fetching recurring expenses' });
    }
});

// Update the dashboard serving code
app.use('/_next', express.static(path.join(__dirname, 'v0.0.1-dashboard/.next')));
app.use(express.static(path.join(__dirname, 'v0.0.1-dashboard/out')));

// Catch-all route for Next.js pages
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'v0.0.1-dashboard/out/index.html'));
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
  'taxes': 'Bills & Utilities > Taxes',
  'tax': 'Bills & Utilities > Taxes',
  
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
  'Bills & Utilities > Taxes': [
    'tax', 'taxes', 'irs', 'income tax', 'property tax', 'sales tax',
    'tax payment', 'tax bill', 'tax return', 'taxation'
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

async function categorizeExpense(input) {
    try {
        // First try to use GPT for smart categorization
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an expense categorizer. Categorize expenses into these categories:
                    - Food & Drinks (subcategories: Meals, Snacks, Drinks)
                    - Transport (subcategories: Taxis & Rideshares, Fuel / Gas, Public Transport)
                    - Shopping (subcategories: Clothing, Electronics, Groceries)
                    - Entertainment (subcategories: Games, Movies & Streaming, Music / Concerts)
                    - Bills & Utilities (subcategories: Electricity, Water, Internet & Phone, Taxes)
                    - Health (subcategories: Medical, Pharmacy, Fitness)
                    - Miscellaneous (subcategories: Gifts, Subscriptions, Other)
                    
                    Respond ONLY with a JSON object containing 'category' and 'subcategory'.`
                },
                {
                    role: "user",
                    content: `Categorize this expense: ${input}`
                }
            ],
            temperature: 0.3,
            max_tokens: 100
        });

        try {
            const gptResult = JSON.parse(response.choices[0].message.content);
            if (gptResult.category && gptResult.subcategory) {
                console.log('✅ GPT categorized as:', gptResult);
                return gptResult;
            }
        } catch (e) {
            console.log('GPT parsing failed, falling back to basic categorization');
        }
    } catch (error) {
        console.log('OpenAI call failed, falling back to basic categorization');
    }

    // Fallback to basic categorization
  const word = input.toLowerCase().trim();
  
    // First try exact matches from the categoryMap
  if (categoryMap[word]) {
        const [category, subcategory] = categoryMap[word].split(' > ');
        return { category, subcategory: subcategory || 'Other' };
  }

  // Then try to find the best matching category based on keywords
    for (const [fullCategory, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => 
      word.includes(keyword) || keyword.includes(word)
    )) {
            const [category, subcategory] = fullCategory.split(' > ');
            return { category, subcategory: subcategory || 'Other' };
    }
  }

    // Check if it's food-related
  if (isFoodRelated(word)) {
        return { category: 'Food & Drinks', subcategory: 'Meals' };
  }

    // Check for transport-related words
  const transportWords = [
    'transport', 'travel', 'ride', 'vehicle', 'car', 'bus', 'train',
        'taxi', 'uber', 'lyft', 'cab', 'metro', 'subway', 'bike', 'gas', 'fuel'
  ];

  const isTransportRelated = transportWords.some(transportWord => 
    word.includes(transportWord) || transportWord.includes(word)
  );

  if (isTransportRelated) {
        if (word.includes('gas') || word.includes('fuel')) {
            return { category: 'Transport', subcategory: 'Fuel' };
        }
        return { category: 'Transport', subcategory: 'Other' };
  }

  // Default fallback
    return { category: 'Miscellaneous', subcategory: 'Other' };
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
            expenses: db.get(`SELECT COUNT(*) as count FROM expenses`),
            recurring: db.get(`SELECT COUNT(*) as count FROM recurring_expenses WHERE active = 1`),
            expensesColumns: db.all(`PRAGMA table_info(expenses)`),
            recurringColumns: db.all(`PRAGMA table_info(recurring_expenses)`)
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
        const result = db.run('DELETE FROM expenses');
        console.log('Delete all result:', result);
        res.json({ success: true, message: 'All expenses deleted' });
    } catch (error) {
        console.error('Error deleting all expenses:', error);
        res.status(500).json({ error: 'Error deleting all expenses' });
    }
});

// Individual delete route should come after
app.delete('/api/expenses/:id', (req, res) => {
    const expenseId = req.params.id;
    
    db.run('DELETE FROM expenses WHERE id = ?', [expenseId], function(err) {
        if (err) {
            console.error('Error deleting expense:', err);
            return res.status(500).json({ error: 'Failed to delete expense' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        
        res.json({ message: 'Expense deleted successfully' });
    });
});

// Add this endpoint to check the database status
app.get('/api/status', (req, res) => {
    try {
        const expensesCount = db.get(`SELECT COUNT(*) as count FROM expenses`);
        const recurringCount = db.get(`SELECT COUNT(*) as count FROM recurring_expenses WHERE active = 1`);
        
        res.json({
            status: 'ok',
            expenses: expensesCount.count,
            recurring: recurringCount.count,
            tables: [
                db.all(`PRAGMA table_info(expenses)`),
                db.all(`PRAGMA table_info(recurring_expenses)`)
            ]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add PUT endpoint for updating expenses
app.put('/api/expenses/:id', (req, res) => {
    const expenseId = req.params.id;
    const { amount, category, subcategory, description, date, is_recurring, frequency } = req.body;
    
    try {
        if (is_recurring) {
            db.run(
                `UPDATE recurring_expenses 
                SET amount = ?, category = ?, subcategory = ?, description = ?, 
                    last_tracked = ?, frequency = ?
                WHERE id = ?`,
                [amount, category, subcategory, description, date, frequency, expenseId],
                function(err) {
                    if (err) {
                        console.error('Error updating recurring expense:', err);
                        return res.status(500).json({ error: 'Failed to update expense' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Expense not found' });
                    }
                    
                    res.json({ message: 'Expense updated successfully' });
                }
            );
        } else {
            db.run(
                `UPDATE expenses 
                SET amount = ?, category = ?, subcategory = ?, description = ?, 
                    timestamp = ?
                WHERE id = ?`,
                [amount, category, subcategory, description, date, expenseId],
                function(err) {
                    if (err) {
                        console.error('Error updating expense:', err);
                        return res.status(500).json({ error: 'Failed to update expense' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Expense not found' });
                    }
                    
                    res.json({ message: 'Expense updated successfully' });
                }
            );
        }
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('\n🚀 Server is ready!');
    console.log(`   └─ Running on port ${PORT}`);
    console.log(`   └─ Dashboard: http://localhost:3000`);
    console.log(`   └─ API endpoint: http://localhost:${PORT}/api`);
});

// Start command
bot.start((ctx) => {
  const welcomeMsg = "👋 Welcome to Hornerito! I can help you track your expenses.\n\nSend an expense (e.g., '30 on food') to get started.";
  ctx.reply(welcomeMsg, {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES')],
      [Markup.button.callback('❓ Help', 'SHOW_HELP')]
    ]),
  });
});

// Helper function to escape special characters for MarkdownV2
function escapeMarkdownV2(text) {
  return text
    .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Update the clearSession function to include userId
async function clearSession(ctx) {
  if (ctx.session) {
    delete ctx.session.editingExpenseId;
    delete ctx.session.editingCategoryId;
    delete ctx.session.originalAmount;
    delete ctx.session.originalCategory;
    delete ctx.session.pendingExpense;
    delete ctx.session.userId;
    
    // Force session save after clearing
    await localSession.saveSession(ctx.session);
    console.log(`Cleared session for user ${ctx.from?.id || 'unknown'}`);
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
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Update the learnNewCategory function to use the correct OpenAI client
async function learnNewCategory(description, userCategory) {
    try {
        // First, let's ask ChatGPT to learn this correction
        const message = `Learn this expense categorization: "${description}" should be categorized as "${userCategory}". 
                        Please update your categorization knowledge accordingly.`;
        
        const completion = await openai.chat.completions.create({
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
        db.run(`
            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                amount REAL,
                category TEXT,
                subcategory TEXT,
                description TEXT,
                frequency TEXT,
                start_date TEXT,
                end_date TEXT,
                last_tracked TEXT,
                active INTEGER DEFAULT 1
            )
        `);

        // Log the user ID we're searching for
        const userId = ctx.from.id.toString();
        console.log('Searching for recurring expenses for user:', userId);

        // Check if we have any records at all
        const allRecords = db.get(`SELECT COUNT(*) as count FROM recurring_expenses`);
        console.log('Total records in table:', allRecords.count);

        // Then fetch the expenses with explicit column names
        const recurring = db.all(`
            SELECT 
                id,
                amount,
                category,
                subcategory,
                description,
                frequency,
                start_date,
                end_date,
                last_tracked,
                active
            FROM recurring_expenses 
            WHERE user_id = ? 
            AND active = 1
        `, userId);

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
                message += `• $${parseFloat(exp.amount).toFixed(2)} - ${exp.description}\n`;
                message += `  📂 ${exp.category || 'Uncategorized'} - 🏷️ ${exp.subcategory || 'Other'}\n`;
            });
            message += "\n";
        }

        if (grouped.weekly) {
            message += "📅 Weekly:\n";
            grouped.weekly.forEach(exp => {
                message += `• $${parseFloat(exp.amount).toFixed(2)} - ${exp.description}\n`;
                message += `  📂 ${exp.category || 'Uncategorized'} - 🏷️ ${exp.subcategory || 'Other'}\n`;
            });
            message += "\n";
        }

        if (grouped.monthly) {
            message += "📅 Monthly:\n";
            grouped.monthly.forEach(exp => {
                message += `• $${parseFloat(exp.amount).toFixed(2)} - ${exp.description}\n`;
                message += `  📂 ${exp.category || 'Uncategorized'} - 🏷️ ${exp.subcategory || 'Other'}\n`;
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

// Helper function to extract amount and description from text
async function parseExpenseMessage(text) {
  try {
    // First try to find any number in the text
    const numberMatch = text.match(/\d+(?:\.\d{1,2})?/);
    if (!numberMatch) return null;

    const amount = parseFloat(numberMatch[0]);
    if (isNaN(amount)) return null;

    // Remove the amount from the text to get the description
    let description = text.replace(numberMatch[0], '').trim()
      .replace(/^(on|in|for)\s+/i, '') // Remove common prepositions at start
      .replace(/\s+(on|in|for)\s+/i, ' ') // Remove prepositions in middle
      .trim();

    if (!description) return null;

    try {
      // Try to use GPT to clean up the description
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "You are a helpful expense parser. Given text about an expense, extract the amount and description. Respond ONLY with a JSON object containing 'amount' and 'description'. Clean up and standardize the description."
        }, {
          role: "user",
          content: `Parse this expense: ${text}`
        }],
        temperature: 0.3,
        max_tokens: 100
      });

      try {
        const gptResult = JSON.parse(response.choices[0].message.content);
        description = gptResult.description || description;
      } catch (e) {
        // If GPT parsing fails, continue with our original description
        console.log('GPT parsing failed, using original description');
      }
                    } catch (error) {
      // If OpenAI call fails, just continue with our original parsing
      console.log('OpenAI call failed, using original description');
    }

    // Return the parsed expense
    return { amount, description };
                    } catch (error) {
    console.error('Error parsing expense message:', error);
    return null;
  }
}

// Add a helper function for greetings and casual conversation
function isConversational(text) {
    const conversationalPhrases = [
        // Greetings
        'hey', 'hello', 'hi', 'hola', 'help', 'start',
        // How are you variations
        'how are you', 'how r u', 'how you doing', "what's up", 'whats up', 'sup',
        // Questions about the bot
        'what are you doing', 'what do you do', 'who are you', 'what is this',
        // General conversation
        'thanks', 'thank you', 'good morning', 'good afternoon', 'good evening',
        'nice to meet you', 'pleasure'
    ];

    text = text.toLowerCase().trim();
    return conversationalPhrases.some(phrase => 
        text.includes(phrase) || 
        text === phrase || 
        text.startsWith(phrase + ' ') ||
        text.endsWith(' ' + phrase)
    );
}

// Add this function to generate appropriate system prompts
function getSystemPrompt(text) {
    text = text.toLowerCase().trim();
    
    // How are you variations
    if (text.includes('how are you') || text.includes('how r u') || text.includes("what's up")) {
        return `You are Hornerito. Reply with ONE of these ONLY:
            'Hey! Doing great, just counting numbers. 👋 Ready to track expenses? 💰'
            'All good here! Just helping people save money. 🤖 Want to track an expense? 💰'
            'Fantastic! Been helping people track their spending. 📊 Want to try? 💰'
            'Doing great! Ready to help you manage your money. ✨ Got an expense to track? 💰'`;
    }
    
    // What do you do variations
    if (text.includes('what are you doing') || text.includes('what do you do') || text.includes('who are you')) {
        return `You are Hornerito. Reply with ONE of these ONLY:
            'I help track expenses! 🤖 Try me with: 30 food 💰'
            'I'm your personal expense tracker! ✨ Try: 25 taxi 💰'
            'I keep track of your spending! 📊 Example: 50 groceries 💰'
            'I'm here to help you manage money! 🎯 Try: 40 coffee 💰'`;
    }
    
    // General greetings
    if (text.match(/^(hi|hey|hello|hola)(\s|$)/)) {
        return `You are Hornerito. Reply with ONE of these ONLY:
            'Hi there! 👋 Ready to track some expenses? 💰'
            'Hey! Need help tracking your spending? ✨'
            'Hello! Let's manage your expenses together! 📊'
            'Hi! I can help you track your money! 🎯'`;
    }
    
    // Thank you variations
    if (text.includes('thank') || text.includes('thanks')) {
        return `You are Hornerito. Reply with ONE of these ONLY:
            'You're welcome! 🌟 Remember, I'm here to help track expenses! 💰'
            'Anytime! 👋 Keep those expenses coming! 📊'
            'Happy to help! ✨ Got more expenses to track? 💰'
            'My pleasure! 🤖 Ready for your next expense! 💰'`;
    }
    
    // Default conversational prompt
    return `You are Hornerito. Reply with ONE of these ONLY:
        'Hi! 👋 Send me an expense like: 30 food 💰'
        'Hello! Ready to track expenses? Try: 25 taxi 💰'
        'Hey there! Want to track spending? Example: 40 coffee 💰'
        'Greetings! Let's track expenses! Try: 50 groceries 💰'`;
}

// Update the text handler
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text.trim();
        const userId = ctx.from.id.toString();

        console.log('Received text:', text);
        console.log('Current session state:', JSON.stringify(ctx.session, null, 2));

        // Check if we're in the middle of editing an amount
        if (ctx.session?.editingExpenseId) {
            console.log(`Processing amount edit for expense ${ctx.session.editingExpenseId}`);
            
            const amount = parseFloat(text);
            if (isNaN(amount)) {
                await ctx.reply(
                    "❌ Please send a valid number\\.",
                    { parse_mode: 'MarkdownV2' }
                );
                return;
            }

            try {
                // Store the expense ID before clearing session
                const editedExpenseId = ctx.session.editingExpenseId;
                const originalCategory = ctx.session.originalCategory || 'Uncategorized';

                // Update the expense amount with user_id check
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE expenses SET amount = ? WHERE id = ? AND user_id = ?`,
                        [amount, editedExpenseId, userId],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this);
                        }
                    );
                });

                const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(originalCategory);

                await ctx.reply(
                    `✅ Amount updated: \$${escapedAmount} on ${escapedCategory}`,
                    {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    Markup.button.callback('✏️ Edit Amount Again', `EDIT_${editedExpenseId}`),
                                    Markup.button.callback('📝 Edit Category', `EDITCAT_${editedExpenseId}`)
                                ],
                                [
                                    Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES'),
                                    Markup.button.callback('🏠 Main Menu', 'START')
                                ]
                            ]
                        }
                    }
                );

                // Clear the editing session
                ctx.session = {
                    ...ctx.session,
                    editingExpenseId: null,
                    originalCategory: null,
                    originalAmount: null,
                    userId: null
                };
                await localSession.saveSession(ctx.session);
                console.log('Session cleared after successful edit');
                return;
            } catch (error) {
                console.error('Error updating amount:', error);
                await ctx.reply("❌ Error updating amount\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
                return;
            }
        }

        // Only proceed with conversation/expense handling if not editing
        if (isConversational(text)) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: getSystemPrompt(text)
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    max_tokens: 50,
                    temperature: 0.3
                });

                const response = completion.choices[0].message.content;
                
                await ctx.reply(response, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES'),
                                Markup.button.callback('❓ Help', 'SHOW_HELP')
                            ]
                        ]
                    }
                });
                return;
            } catch (error) {
                console.error('Error generating AI response:', error);
                // Fallback response if AI fails
                await ctx.reply(
                    "Hi! 👋 Try: '30 food' or '25 taxi' 💰",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES'),
                                    Markup.button.callback('❓ Help', 'SHOW_HELP')
                                ]
                            ]
                        }
                    }
                );
                return;
            }
        }

        // Try to parse the expense message
        const parsedExpense = await parseExpenseMessage(text);
        
        if (parsedExpense) {
            try {
                const { amount, description } = parsedExpense;
                
                // Capitalize the first letter of each word in the description
                const expenseDescription = description
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');

                console.log('🔍 Categorizing:', description);
                
                // Use the categorizeExpense function (now async)
                const { category, subcategory } = await categorizeExpense(description);
                console.log('✅ Categorized as:', { category, subcategory });

                if (!category) {
                    throw new Error('Could not determine category');
                }

                const timestamp = new Date().toISOString();
                
                // Use a Promise to properly capture the lastID
                const result = await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO expenses (user_id, amount, category, subcategory, description, timestamp) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [ctx.from.id.toString(), amount, category, subcategory || 'Other', expenseDescription, timestamp],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ lastID: this.lastID });
                        }
                    );
                });

                const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(category);
                const escapedSubcategory = escapeMarkdownV2(subcategory || 'Other');
                const escapedDescription = escapeMarkdownV2(expenseDescription);

                await ctx.reply(
                    `✅ Expense saved: \$${escapedAmount}\n` +
                    `📝 Description: ${escapedDescription}\n` +
                    `📂 Category: ${escapedCategory}\n` +
                    `🏷️ Subcategory: ${escapedSubcategory}`,
                    {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('✏️ Edit Amount', `EDIT_${result.lastID}`),
                                Markup.button.callback('📝 Edit Category', `EDITCAT_${result.lastID}`)
                            ],
                            [
                                Markup.button.callback('🗑️ Delete', `DELETE_${result.lastID}`),
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ],
                            [
                                Markup.button.callback('🌐 View Dashboard', 'VIEW_DASHBOARD')
                            ]
                        ]
                    }
                    }
                );
            } catch (error) {
                console.error('Error saving expense:', error);
                await ctx.reply(
                    "❌ Error saving expense\\. Please try again\\.", 
                    { parse_mode: 'MarkdownV2' }
                );
            }
        } else {
            // If not a greeting and not an expense, try to understand with AI
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are Hornerito. Reply with ONLY: 'Hi! 👋 Send me an expense like: 30 food 💰'"
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    max_tokens: 50,
                    temperature: 0.3
                });

                await ctx.reply(completion.choices[0].message.content, {
                    reply_markup: {
                        inline_keyboard: [
                            [Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES')]
                        ]
                    }
                });
            } catch (error) {
                console.error('Error generating AI response:', error);
                // Only show help if it seems like they were trying to track an expense
                if (text.match(/\d+/) || text.toLowerCase().includes('spent')) {
                    await ctx.reply(
                        "Try: `30 food`, `25 taxi`, `100 groceries` 💰",
                        { parse_mode: 'MarkdownV2' }
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error in text handler:', error);
    }
});

// Update the cancel handler
bot.action('CANCEL', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        // Check if session exists
        if (!ctx.session) {
            ctx.session = {};
        }
        
        // Clear the editing session
        ctx.session = {
            ...ctx.session,
            editingExpenseId: null,
            originalCategory: null,
            originalAmount: null,
            userId: null
        };
        
        // Save session using localSession middleware
        await localSession.saveSession(ctx.session);
        console.log('Session cleared after cancel:', ctx.session);
        
        await ctx.reply("✅ Operation cancelled.");
    } catch (error) {
        console.error('Error in CANCEL handler:', error);
        await ctx.reply("❌ Error cancelling operation. Please try again.");
    }
});

// Helper function to add permanent buttons to any keyboard
function addPermanentButtons(keyboard = []) {
    const permanentButtons = [
        [
            { text: '📊 View Expenses', callback_data: 'VIEW_EXPENSES' },
            { text: '❓ Help', callback_data: 'SHOW_HELP' }
        ],
        [
            { text: '❌ Cancel', callback_data: 'CANCEL' }
        ]
    ];
    return [...keyboard, ...permanentButtons];
}

// Edit expense handler with improved session handling and logging
bot.action(/^EDIT_(\d+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const expenseId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        console.log(`\n📝 Starting edit process for expense ${expenseId} by user ${userId}`);

        // Get the expense first
        db.get(
            `SELECT * FROM expenses WHERE id = ? AND user_id = ?`, 
            [expenseId, userId], 
            async (err, expense) => {
                if (err) {
                    console.error('Error fetching expense:', err);
                    await ctx.reply("❌ Error editing expense. Please try again.");
                    return;
                }

                if (!expense) {
                    await ctx.reply("❌ Expense not found.");
                    return;
                }

                // Update session state with original values
                ctx.session.editingExpenseId = expenseId;
                ctx.session.editMode = 'amount';
                ctx.session.userId = userId;
                ctx.session.originalCategory = expense.category; // Store original category
                ctx.session.originalAmount = expense.amount;

                await localSession.saveSession(ctx.session);

                const escapedAmount = expense.amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(expense.category || 'Uncategorized');

                await ctx.reply(
                    `✏️ Editing expense in category: ${escapedCategory}\n` +
                    `Current amount: \$${escapedAmount}\n\n` +
                    `Send the new amount:`,
                    {
                        parse_mode: 'MarkdownV2',
                        reply_markup: { remove_keyboard: true }
                    }
                );
            }
        );
    } catch (error) {
        console.error('Error in EDIT handler:', error);
        await ctx.reply("❌ Error editing expense. Please try again.");
    }
});

// Update the text handler to check for editing mode FIRST
bot.on('text', async (ctx) => {
    try {
        const text = ctx.message.text.trim();
        const userId = ctx.from.id.toString();

        // Check if we're in edit mode FIRST
        if (ctx.session?.editingExpenseId && ctx.session?.editMode === 'amount') {
            console.log('Processing amount edit for expense', ctx.session.editingExpenseId);
            
            const amount = parseFloat(text);
            if (isNaN(amount)) {
                await ctx.reply("❌ Please send a valid number.");
                return;
            }

            try {
                await new Promise((resolve, reject) => {
                    db.run(
                        `UPDATE expenses SET amount = ? WHERE id = ? AND user_id = ?`,
                        [amount, ctx.session.editingExpenseId, userId],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this);
                        }
                    );
                });

                // Store values before clearing session
                const editedExpenseId = ctx.session.editingExpenseId;
                const originalCategory = ctx.session.originalCategory || 'Uncategorized';

                // Clear the editing state
                ctx.session.editingExpenseId = null;
                ctx.session.editMode = null;
                ctx.session.originalAmount = null;
                ctx.session.originalCategory = null;
                await localSession.saveSession(ctx.session);

                const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(originalCategory);

                await ctx.reply(
                    `✅ Amount updated: \$${escapedAmount} on ${escapedCategory}`,
                    {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    Markup.button.callback('✏️ Edit Amount Again', `EDIT_${editedExpenseId}`),
                                    Markup.button.callback('📝 Edit Category', `EDITCAT_${editedExpenseId}`)
                                ],
                                [
                                    Markup.button.callback('📊 View Expenses', 'VIEW_EXPENSES'),
                                    Markup.button.callback('🏠 Main Menu', 'START')
                                ]
                            ]
                        }
                    }
                );
                return;
            } catch (error) {
                console.error('Error updating amount:', error);
                await ctx.reply("❌ Error updating amount. Please try again.");
                return;
            }
        }

        // If not in edit mode, proceed with normal message handling
        // ... rest of your existing message handling code ...
        
    } catch (error) {
        console.error('Error in text handler:', error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
});

// Handle "Other" category selection
bot.action('cat_other', async (ctx) => {
    try {
        await ctx.answerCbQuery();

        await ctx.reply(
            "*Additional Categories*\n\n" +
            "Select from these categories:\n\n" +
            "• Education & Learning\n" +
            "• Hobbies & Leisure\n" +
            "• Gifts & Donations\n" +
            "• Bills & Utilities",
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📚 Education", callback_data: "subcat_Education_Studies" },
                            { text: "🎨 Hobbies", callback_data: "subcat_Hobbies_General" }
                        ],
                        [
                            { text: "🎁 Gifts", callback_data: "subcat_Personal_Gifts" },
                            { text: "📄 Bills", callback_data: "subcat_Home_Bills" }
                        ],
                        [
                            Markup.button.callback('❓ Help', 'SHOW_HELP')
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "CANCEL" }
                        ]
                    ]
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
        // Answer callback query immediately
        await ctx.answerCbQuery();
        
        // Get expense ID from the callback data
        const expenseId = ctx.match[1];
        const userId = ctx.from.id.toString();

        console.log(`EDITCAT handler called for expense ${expenseId} by user ${userId}`);

        // First verify that this expense belongs to the user
        const expense = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM expenses WHERE id = ? AND user_id = ?',
                [expenseId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!expense) {
            await ctx.reply("❌ Expense not found or unauthorized.");
            return;
        }
        
        // Initialize session if it doesn't exist
        if (!ctx.session) {
            ctx.session = {};
        }
        
        // Store the expense ID and user ID in session
        ctx.session.editingExpenseId = expenseId;
        ctx.session.userId = userId;
        
        // Force session save
        await localSession.saveSession(ctx.session);
        
        // Log the updated session state
        console.log(`Updated session state for user ${userId}:`, JSON.stringify(ctx.session, null, 2));
        
        // Send category selection menu
        await ctx.reply(
            "Select a category:",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🍽️ Food & Drinks", callback_data: `cat_food` },
                            { text: "🚗 Transport", callback_data: `cat_transport` }
                        ],
                        [
                            { text: "🛍️ Shopping", callback_data: `cat_shopping` },
                            { text: "🎮 Entertainment", callback_data: `cat_entertainment` }
                        ],
                        [
                            { text: "💊 Health", callback_data: `cat_health` },
                            { text: "📦 Other", callback_data: `cat_other` }
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
        await ctx.reply("❌ Error editing category. Please try again.");
    }
});

// Add handler for main categories
bot.action(/^cat_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        // Check if session exists
        if (!ctx.session) {
            ctx.session = {};
            console.log('Session initialized in cat_ handler');
        }
        
        // Check if editing expense ID exists in session
        if (!ctx.session.editingExpenseId || !ctx.session.userId) {
            console.log('No editing expense ID or user ID in session:', ctx.session);
            await ctx.reply("❌ No expense selected for editing.");
            return;
        }

        const mainCategory = ctx.match[1];
        console.log(`Selected main category: ${mainCategory} for expense ${ctx.session.editingExpenseId}`);
        
        let subcategories = [];
        
        switch(mainCategory) {
            case 'food':
                subcategories = ["Groceries", "Restaurant", "Snacks", "Coffee"];
                break;
            case 'transport':
                subcategories = ["Public", "Taxi", "Fuel", "Maintenance"];
                break;
            case 'shopping':
                subcategories = ["Clothes", "Electronics", "Home", "Personal"];
                break;
            case 'entertainment':
                subcategories = ["Movies", "Games", "Sports", "Events"];
                break;
            case 'health':
                subcategories = ["Medical", "Pharmacy", "Fitness", "Wellness"];
                break;
            case 'other':
                subcategories = ["Bills", "Gifts", "Education", "Misc"];
                break;
        }
        
        const keyboard = subcategories.map(subcat => ({
            text: subcat,
            callback_data: `subcat_${mainCategory}_${subcat.toLowerCase()}`
        }));
        
        await ctx.reply(
            "Select a subcategory:",
            {
                reply_markup: {
                    inline_keyboard: [
                        ...chunk(keyboard, 2),
                        [{ text: "❌ Cancel", callback_data: "CANCEL" }]
                    ]
                }
            }
        );
        
        // Force session save
        await localSession.saveSession(ctx.session);
        console.log('Session saved in cat_ handler:', ctx.session);
    } catch (error) {
        console.error('Error in category selection:', error);
        await ctx.reply("❌ Error selecting category. Please try again.");
    }
});

// Helper function to chunk array into groups
function chunk(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Update the subcategory selection handler
bot.action(/^subcat_(.+)_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const mainCategory = ctx.match[1];
        const subCategory = ctx.match[2];
        const fullCategory = `${mainCategory} > ${subCategory}`;

        // Check if session exists
        if (!ctx.session) {
            ctx.session = {};
            console.log('Session initialized in subcat_ handler');
        }

        console.log('Session in subcat_ handler:', ctx.session);

        if (!ctx.session.editingExpenseId || !ctx.session.userId) {
            console.log('No editing expense ID or user ID in session:', ctx.session);
            await ctx.reply("❌ No expense selected for editing.");
            return;
        }

        const expenseId = ctx.session.editingExpenseId;
        const userId = ctx.session.userId;
        
        console.log(`Updating expense ${expenseId} for user ${userId} to category ${fullCategory}`);
        
        // Get the current expense to preserve the amount and verify ownership
        db.get(
            `SELECT amount FROM expenses WHERE id = ? AND user_id = ?`, 
            [expenseId, userId], 
            async (err, expense) => {
                if (err) {
                    console.error('Error fetching expense:', err);
                    await ctx.reply("❌ Error updating category. Please try again.");
                    return;
                }

                if (!expense) {
                    console.error('Expense not found or unauthorized:', expenseId, userId);
                    await ctx.reply("❌ Expense not found or unauthorized.");
                    return;
                }

                console.log(`Found expense with amount ${expense.amount}`);

                // Update the expense with new category
                db.run(
                    `UPDATE expenses SET category = ?, subcategory = ? WHERE id = ? AND user_id = ?`,
                    [mainCategory, subCategory, expenseId, userId],
                    async function(err) {
                        if (err) {
                            console.error('Error updating category:', err);
                            await ctx.reply("❌ Error updating category. Please try again.");
                            return;
                        }

                        if (this.changes === 0) {
                            console.error('No rows updated:', expenseId, userId);
                            await ctx.reply("❌ Failed to update category.");
                            return;
                        }

                        console.log(`Successfully updated expense ${expenseId} to category ${fullCategory}`);

                        // Send success message
                        await ctx.reply(
                            `✅ Category updated: $${expense.amount} on ${mainCategory} > ${subCategory}`,
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES'),
                                            Markup.button.callback('❓ Help', 'SHOW_HELP')
                                        ]
                                    ]
                                }
                            }
                        );

                        // Clear the editing session
                        delete ctx.session.editingExpenseId;
                        delete ctx.session.userId;
                        
                        // Force session save
                        await localSession.saveSession(ctx.session);
                        console.log('Session cleared after update:', ctx.session);
                    }
                );
            }
        );
    } catch (error) {
        console.error('Error in subcategory selection:', error);
        await ctx.reply("❌ Error updating category. Please try again.");
    }
});

// Update VIEW_EXPENSES handler
bot.action('VIEW_EXPENSES', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        
        db.all(`SELECT * FROM expenses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5`, [ctx.from.id.toString()], async (err, expenses) => {
            if (err) {
                console.error('Error fetching expenses:', err);
                await ctx.reply("❌ Error viewing expenses\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
                return;
            }

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
                const category = escapeMarkdownV2(exp.category || 'Uncategorized');
                const subcategory = escapeMarkdownV2(exp.subcategory || 'Other');
                return `📅 ${date}: \$${amount}\n📂 ${category} \\- 🏷️ ${subcategory}`;
            }).join('\n\n');

            // Create buttons for each expense
            const buttons = expenses.map(exp => [
                [
                    Markup.button.callback(`✏️ Edit Amount`, `EDIT_${exp.id}`),
                    Markup.button.callback(`📝 Edit Category`, `EDITCAT_${exp.id}`)
                ],
                [
                    Markup.button.callback(`🗑️ Delete $${exp.amount} (${exp.category || 'Uncategorized'})`, `DELETE_${exp.id}`)
                ]
            ]).flat();

            // Add dashboard button
            buttons.push([
                Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
            ]);

            await ctx.reply(message, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: buttons
                }
            });
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
    const lastExpense = db.get(`SELECT * FROM expenses WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1`, ctx.from.id.toString());

    if (!lastExpense) {
        await ctx.reply("📭 No expenses recorded yet\\.", { parse_mode: 'MarkdownV2' });
        return;
    }

    // Delete the expense
    const result = db.run(`DELETE FROM expenses WHERE id = ?`, lastExpense.id);

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
        await ctx.answerCbQuery("Deleting expense...");
        const expenseId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        console.log(`Attempting to delete expense ${expenseId} for user ${userId}`);

        // Get the expense first
        db.get(`SELECT * FROM expenses WHERE id = ? AND user_id = ?`, [expenseId, userId], async (err, expense) => {
            if (err) {
                console.error('Error fetching expense:', err);
                await ctx.reply("❌ Error deleting expense\\. Please try again\\.", { parse_mode: 'MarkdownV2' });
                return;
            }

            if (!expense) {
                await ctx.reply("❌ Expense not found\\.", { parse_mode: 'MarkdownV2' });
                return;
            }

            console.log('Found expense to delete:', expense);

            // Delete the expense using a Promise to handle the async operation properly
            try {
                await new Promise((resolve, reject) => {
                    db.run(
                        `DELETE FROM expenses WHERE id = ? AND user_id = ?`,
                        [expenseId, userId],
                        function(err) {
                            if (err) {
                                console.error('SQL error in delete operation:', err);
                                reject(err);
                            } else {
                                console.log('Delete operation result:', this);
                                resolve(this);
                            }
                        }
                    );
                });

                // Prepare data for restore button - keep it minimal to avoid Telegram API limits
                const restoreData = {
                    a: expense.amount, // amount
                    c: expense.category, // category
                    s: expense.subcategory, // subcategory
                    d: expense.description ? expense.description.substring(0, 50) : '' // truncated description
                };

                const escapedAmount = expense.amount.toString().replace(/[.\-]/g, '\\$&');
                const escapedCategory = escapeMarkdownV2(expense.category || 'Uncategorized');
                const escapedDescription = expense.description ? 
                    escapeMarkdownV2(expense.description.substring(0, 50)) : 
                    'No description';

                console.log('Sending delete confirmation message');
                await ctx.reply(
                    `🗑️ *Expense deleted successfully*\n\n` +
                    `Amount: \$${escapedAmount}\n` +
                    `Category: ${escapedCategory}\n` +
                    `Description: ${escapedDescription}`,
                    { 
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    Markup.button.callback('↩️ Undo', `RESTORE_${JSON.stringify(restoreData)}`),
                                    Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                                ]
                            ]
                        }
                    }
                );
                console.log('Delete confirmation message sent successfully');
            } catch (error) {
                console.error('Error in delete operation:', error);
                await ctx.reply("❌ Failed to delete expense\\. Error: " + escapeMarkdownV2(error.message), 
                    { parse_mode: 'MarkdownV2' });
            }
        });
    } catch (error) {
        console.error('Error in DELETE handler:', error);
        await ctx.reply("❌ An error occurred while deleting the expense\\. Please try again\\.", { 
            parse_mode: 'MarkdownV2' 
        });
    }
});

// Add handler for restoring deleted expenses
bot.action(/^RESTORE_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery("Restoring expense...");
        console.log('Restore action triggered with data:', ctx.match[1]);
        
        // Parse the data with error handling
        let data;
        try {
            data = JSON.parse(ctx.match[1]);
            console.log('Parsed restore data:', data);
        } catch (error) {
            console.error('Error parsing restore data:', error);
            await ctx.reply("❌ Error restoring expense: Invalid data format", { parse_mode: 'MarkdownV2' });
            return;
        }
        
        // Map compact keys back to full names
        const amount = data.a || data.amount || 0;
        const category = data.c || data.category || 'Uncategorized';
        const subcategory = data.s || data.subcategory || 'Other';
        const description = data.d || data.description || '';
        
        // Insert the restored expense with all fields
        const timestamp = new Date().toISOString();
        console.log('Inserting restored expense:', { amount, category, subcategory, description });
        
        try {
            const result = await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO expenses (user_id, amount, category, subcategory, description, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        ctx.from.id.toString(),
                        amount,
                        category,
                        subcategory,
                        description,
                        timestamp
                    ],
                    function(err) {
                        if (err) {
                            console.error('SQL error in restore operation:', err);
                            reject(err);
                        } else {
                            console.log('Restore operation result:', this);
                            resolve(this);
                        }
                    }
                );
            });

            const escapedAmount = amount.toString().replace(/[.\-]/g, '\\$&');
            const escapedCategory = escapeMarkdownV2(category);

            console.log('Sending restore confirmation message');
            await ctx.reply(
                `✅ Restored expense: \$${escapedAmount} on ${escapedCategory}`,
                {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('✏️ Edit', `EDIT_${result.lastID}`),
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ]
                        ]
                    }
                }
            );
            console.log('Restore confirmation message sent successfully');
        } catch (error) {
            console.error('Error in restore operation:', error);
            await ctx.reply("❌ Error restoring expense: " + escapeMarkdownV2(error.message), 
                { parse_mode: 'MarkdownV2' });
        }
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
        const total = await new Promise((resolve, reject) => {
            db.get(
                'SELECT SUM(amount) as total FROM expenses WHERE user_id = ?',
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        // Get today's expenses
        const today = new Date().toISOString().split('T')[0];
        const todayTotal = await new Promise((resolve, reject) => {
            db.get(
                'SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date(timestamp) = date(?)',
                [userId, today],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        // Get this month's expenses
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        const monthTotal = await new Promise((resolve, reject) => {
            db.get(
                'SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date(timestamp) >= date(?)',
                [userId, monthStartStr],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        // Format amounts with proper escaping for MarkdownV2
        const totalAmount = ((total?.total || 0).toFixed(2)).replace(/\./g, '\\.');
        const todayAmount = ((todayTotal?.total || 0).toFixed(2)).replace(/\./g, '\\.');
        const monthAmount = ((monthTotal?.total || 0).toFixed(2)).replace(/\./g, '\\.');

        const statsMsg = 
            "📊 *Expense Statistics*\n\n" +
            `💰 *Total Expenses:* \\$${totalAmount}\n` +
            `📅 *Today:* \\$${todayAmount}\n` +
            `📆 *This Month:* \\$${monthAmount}`;

        await ctx.reply(statsMsg, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES'),
                        Markup.button.callback('🔄 Refresh Stats', 'VIEW_STATS')
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
        const result = db.run(`UPDATE recurring_expenses SET active = 0 WHERE id = ? AND user_id = ?`, id, ctx.from.id.toString());

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
        recurringDescription: null
    };
    await ctx.answerCbQuery("❌ Cancelled!");
    await ctx.reply("😊 No problem! Let me know if you want to try again later!");
});

bot.action(/FREQ_(.+)/, async (ctx) => {
    const frequency = ctx.match[1];
    const { recurringAmount, recurringDescription: rawDescription } = ctx.session;

    try {
        const startDate = new Date().toISOString();
        
        // Capitalize the first letter of each word in the description
        const recurringDescription = rawDescription
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        // Use async categorization
        const { category, subcategory } = await categorizeExpense(rawDescription);

        if (!category) {
            throw new Error('Could not determine category');
        }

        const result = db.run(
            `INSERT INTO recurring_expenses (user_id, amount, category, subcategory, description, frequency, start_date, last_tracked) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
            ctx.from.id.toString(),
            recurringAmount,
            category,
            subcategory || 'Other',
            recurringDescription,
            frequency,
            startDate,
            startDate
        );

        await ctx.answerCbQuery("✨ All set!");
        await ctx.reply(
            "🎉 Woohoo! Your recurring expense is all set up!\n\n" +
            `💰 Amount: $${recurringAmount}\n` +
            `📝 Description: ${recurringDescription}\n` +
            `📂 Category: ${category}\n` +
            `🏷️ Subcategory: ${subcategory || 'Other'}\n` +
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
        const recurring = db.all(`SELECT id, amount, description, frequency FROM recurring_expenses WHERE user_id = ? AND active = 1 ORDER BY frequency, amount`, ctx.from.id.toString());

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
        const recurring = db.all(`SELECT id, amount, description, frequency FROM recurring_expenses WHERE user_id = ? AND active = 1 ORDER BY frequency, amount`, ctx.from.id.toString());

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
        
        const result = db.run(`UPDATE recurring_expenses SET active = 0 WHERE id = ? AND user_id = ?`, id, ctx.from.id.toString());

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
    console.log('✅ Telegram bot is running');
}).catch(error => {
    console.error('❌ Error starting Telegram bot:', error);
    process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    bot.stop('SIGINT');
    db.close(() => {
        console.log('  └─ Database connection closed');
        console.log('  └─ Bot stopped');
        console.log('✅ Shutdown complete\n');
    });
});
process.once('SIGTERM', () => {
    console.log('\n👋 Shutting down...');
    bot.stop('SIGTERM');
    db.close(() => {
        console.log('  └─ Database connection closed');
        console.log('  └─ Bot stopped');
        console.log('✅ Shutdown complete\n');
    });
});

// Add this function to handle amount editing if it doesn't exist
bot.action(/edit_amount_(\d+)/, async (ctx) => {
    try {
        const expenseId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        console.log(`📝 Starting edit amount process for expense ${expenseId} by user ${userId}`);
        
        // Store the editing state in the session
        ctx.session.editingExpenseId = expenseId;
        ctx.session.editMode = 'amount';
        ctx.session.userId = userId;
        
        // Fetch the current expense to show the user what they're editing
        db.get('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [expenseId, userId], async (err, expense) => {
            if (err) {
                console.error('Error fetching expense for editing:', err);
                return await ctx.reply('❌ Error fetching expense details. Please try again.');
            }
            
            if (!expense) {
                return await ctx.reply('❌ Expense not found or you do not have permission to edit it.');
            }
            
            console.log('Found expense:', expense);
            
            // Store original amount for reference
            ctx.session.originalAmount = expense.amount;
            
            // Prompt user for new amount
            await ctx.reply(`Current amount: ${expense.amount}\nPlease enter the new amount:`);
            console.log('Edit amount prompt sent successfully');
            console.log('Current session state:', ctx.session);
        });
        
        return await ctx.answerCbQuery('Please enter the new amount');
    } catch (error) {
        console.error('Error in edit_amount action:', error);
        return await ctx.reply('❌ An error occurred. Please try again.');
    }
});

// Update the message handler to check for editing mode
bot.on('message', async (ctx) => {
    try {
        // Check if we're in edit mode
        if (ctx.session.editMode === 'amount' && ctx.session.editingExpenseId) {
            const text = ctx.message.text.trim();
            console.log(`Received potential amount edit: ${text}`);
            
            // Validate that the input is a number
            const newAmount = parseFloat(text);
            if (isNaN(newAmount)) {
                return await ctx.reply('❌ Please enter a valid number for the amount.');
            }
            
            const expenseId = ctx.session.editingExpenseId;
            const userId = ctx.session.userId || ctx.from.id.toString();
            
            console.log(`Updating expense ${expenseId} amount to ${newAmount}`);
            
            // Update the expense in the database
            db.run(
                'UPDATE expenses SET amount = ? WHERE id = ? AND user_id = ?',
                [newAmount, expenseId, userId],
                async function(err) {
                    if (err) {
                        console.error('Error updating expense amount:', err);
                        return await ctx.reply('❌ Error updating expense. Please try again.');
                    }
                    
                    if (this.changes === 0) {
                        return await ctx.reply('❌ Expense not found or you do not have permission to edit it.');
                    }
                    
                    // Clear the editing state
                    ctx.session.editingExpenseId = null;
                    ctx.session.editMode = null;
                    ctx.session.originalAmount = null;
                    
                    await ctx.reply(`✅ Amount updated from ${ctx.session.originalAmount} to ${newAmount}`);
                    console.log(`Amount updated successfully for expense ${expenseId}`);
                }
            );
            
            return;
        }
        
        // If not in edit mode, handle as a regular message
        // ... existing message handling code ...
    } catch (error) {
        console.error('Error in message handler:', error);
        await ctx.reply('❌ An error occurred. Please try again.');
    }
});
