// Add DELETE endpoint for expenses
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

// Update the GET endpoint for expenses to match the actual query being used
app.get('/api/expenses', (req, res) => {
    try {
        // Get all expenses, using the same query that's working in index.js
        const expenses = db.prepare(`
            SELECT * FROM expenses 
            ORDER BY timestamp DESC
        `).all();

        // Log the response for debugging
        console.log(`Sending ${expenses.length} expenses to dashboard`);
        console.log('Sample expense:', expenses[0]);

        res.json({ expenses });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Error fetching expenses' });
    }
});

// Make sure database is properly initialized
const db = new sqlite3('data/hornerito.db', {
    fileMustExist: false,
    verbose: console.log
});

// Log database path
console.log('Database path:', path.resolve('data/hornerito.db'));

// Test database connection
try {
    const testQuery = db.prepare('SELECT 1').get();
    console.log('Database connection test:', testQuery);
} catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
}

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Log when server starts
app.listen(3000, () => {
    console.log('Dashboard server running on port 3000');
    console.log('Database location:', path.resolve('data/hornerito.db'));
}); 