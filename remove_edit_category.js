const fs = require('fs');

// Read the index.js file
let content = fs.readFileSync('index.js', 'utf8');

// Replace all "Edit Category" buttons
content = content.replace(/Markup\.button\.callback\('🏷️ Edit Category', `EDITCAT_\${[^}]+\}`\)/g, '');

// Simplify the EDITCAT handler
const editcatHandlerStart = 'bot.action(/^EDITCAT_(\\d+)$/, async (ctx) => {';
const editcatHandlerEnd = '});';
const editcatHandlerSimplified = `bot.action(/^EDITCAT_(\\d+)$/, async (ctx) => {
    try {
        // Answer callback query immediately
        await ctx.answerCbQuery();
        
        // Inform the user that the feature is disabled
        await ctx.reply("⚠️ Category editing has been disabled.");
    } catch (error) {
        console.error('Error in EDITCAT handler:', error);
    }
});`;

// Find the EDITCAT handler and replace it
const editcatHandlerRegex = new RegExp(`${editcatHandlerStart}[\\s\\S]*?${editcatHandlerEnd}`);
content = content.replace(editcatHandlerRegex, editcatHandlerSimplified);

// Update the help text
content = content.replace(
    '"• Click Edit Amount to change amount\\n" +\n            "• Click Edit Category to change category\\n\\n" +',
    '"• Click Delete to remove an expense\\n\\n" +'
);

// Write the updated content back to index.js
fs.writeFileSync('index.js', content);

console.log('Successfully removed "Edit Category" functionality from index.js'); 