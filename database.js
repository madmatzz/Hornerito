const mongoose = require('mongoose');
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

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        logger.info(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

// Define schemas
const expenseSchema = new mongoose.Schema({
    userId: String,
    amount: Number,
    category: String,
    description: String,
    date: { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = {
    connectDB,
    Expense
};
