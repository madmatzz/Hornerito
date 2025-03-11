const fs = require('fs');

// Read the index.js file
let content = fs.readFileSync('index.js', 'utf8');

// Find the inline keyboard in the expense confirmation message
const keyboardPattern = /reply_markup: \{\s*inline_keyboard: \[\s*\[\s*Markup\.button\.callback\('📊 View Last 5', 'VIEW_EXPENSES'\),\s*Markup\.button\.callback\('❓ Help', 'SHOW_HELP'\)\s*\],\s*\[\s*Markup\.button\.url\('🌐 View Dashboard', DASHBOARD_URL\)\s*\]/g;

// Replace with the updated keyboard that includes a Delete button
const updatedKeyboard = `reply_markup: {
                        inline_keyboard: [
                            [
                                Markup.button.callback('🗑️ Delete', \`DELETE_\${result.lastID}\`),
                                Markup.button.callback('📊 View Last 5', 'VIEW_EXPENSES')
                            ],
                            [
                                Markup.button.callback('❓ Help', 'SHOW_HELP')
                            ],
                            [
                                Markup.button.url('🌐 View Dashboard', DASHBOARD_URL)
                            ]`;

// Update the content
content = content.replace(keyboardPattern, updatedKeyboard);

// Write the updated content back to index.js
fs.writeFileSync('index.js', content);

console.log('Successfully added "Delete" button to the expense confirmation message in index.js'); 