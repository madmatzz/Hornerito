const natural = require('natural');
const nlp = require('compromise');
const { NlpManager } = require('node-nlp');
const OpenAI = require('openai');

class SmartCategorizer {
  constructor() {
    // Configure NlpManager with minimal logging
    this.manager = new NlpManager({ 
      languages: ['en', 'es'],
      nlu: { log: false },
      nerManager: { log: false },
      classificationThreshold: 0.6
    });
    
    this.classifier = new natural.BayesClassifier();
    
    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    console.log('🤖 Initializing categorizer...');

    // Initialize categories
    this.categories = {
      'Food & Drinks': {
        'Meals': ['restaurant', 'lunch', 'dinner', 'breakfast', 'pizza', 'burger', 'sushi', 'food', 'meat'],
        'Snacks': ['snack', 'chips', 'candy'],
        'Drinks': ['coffee', 'beer', 'soda', 'coke', 'beverage'],
        'Groceries': ['supermarket', 'grocery', 'market']
      },
      'Transport': {
        'Taxis': ['uber', 'taxi', 'cab', 'ride'],
        'Public': ['bus', 'metro', 'train', 'subway'],
        'Fuel': ['gas', 'petrol', 'diesel']
      },
      'Shopping': {
        'Clothing': ['clothes', 'shoes', 'fashion'],
        'Electronics': ['gadget', 'phone', 'computer']
      },
      'Entertainment': {
        'Movies': ['movie', 'film'],
        'Music': ['music', 'song']
      },
      'Health': {
        'Medical': ['doctor', 'hospital', 'medicine'],
        'Pharmacy': ['pharmacy', 'drugstore']
      }
    };

    this.initializeCategories();
    console.log('✅ Categorizer initialized successfully');
  }

  initializeCategories() {
    try {
      // Train NLP manager for each category
      for (const [mainCat, subCats] of Object.entries(this.categories)) {
        for (const [subCat, keywords] of Object.entries(subCats)) {
          keywords.forEach(keyword => {
            this.manager.addDocument('en', keyword, `${mainCat}>${subCat}`);
            // Add Spanish equivalents
            this.addSpanishKeywords(keyword, `${mainCat}>${subCat}`);
          });
        }
      }

      // Train synchronously
      this.manager.train();
      console.log('📚 Categories trained successfully');
    } catch (error) {
      console.error('❌ Error initializing categories:', error);
    }
  }

  addSpanishKeywords(keyword, category) {
    // Manual Spanish translations for common words
    const translations = {
      'food': 'comida',
      'restaurant': 'restaurante',
      'lunch': 'almuerzo',
      'dinner': 'cena',
      'breakfast': 'desayuno',
      'snack': 'merienda',
      'coffee': 'café',
      'beer': 'cerveza',
      'taxi': 'taxi',
      'bus': 'autobús',
      'train': 'tren',
      'gas': 'gasolina',
      'clothes': 'ropa',
      'shoes': 'zapatos',
      'phone': 'teléfono'
    };

    if (translations[keyword]) {
      this.manager.addDocument('es', translations[keyword], category);
    }
  }

  async askGPT(item) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "You are a helpful expense categorizer. Categorize items into these categories: Food & Drinks (Meals, Snacks, Drinks, Groceries), Transport (Taxis, Public, Fuel), Shopping (Clothing, Electronics), Entertainment (Movies, Music), Health (Medical, Pharmacy). Respond ONLY with the category path in format 'MainCategory>Subcategory'."
        }, {
          role: "user",
          content: `Categorize this expense item: ${item}`
        }],
        temperature: 0.3,
        max_tokens: 20
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('GPT API error:', error);
      return null;
    }
  }

  async categorize(text) {
    try {
      console.log(`🔍 Categorizing: "${text}"`);
      
      // First try our basic categorization
      const basicResult = this.findMainCategory(text.toLowerCase());
      
      if (basicResult) {
        console.log(`✅ Found category: ${basicResult}`);
        return basicResult;
      }

      // If basic categorization fails, ask GPT
      console.log('⏳ Asking GPT for categorization...');
      const gptCategory = await this.askGPT(text);
      
      if (gptCategory && gptCategory.includes('>')) {
        console.log(`✅ GPT suggested category: ${gptCategory}`);
        await this.learnFromCorrection(text, gptCategory);
        return gptCategory;
      }

      console.log('❌ No category found');
      return null;
    } catch (error) {
      console.error('❌ Categorization error:', error);
      return null;
    }
  }

  findMainCategory(text) {
    text = text.toLowerCase();
    
    for (const [mainCat, subCats] of Object.entries(this.categories)) {
      for (const [subCat, keywords] of Object.entries(subCats)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          return `${mainCat}>${subCat}`;
        }
      }
    }
    
    return null;
  }

  async learnFromCorrection(text, correctCategory) {
    // Add to training data
    this.manager.addDocument('en', text.toLowerCase(), correctCategory);
    await this.manager.train();
  }
}

module.exports = new SmartCategorizer(); 