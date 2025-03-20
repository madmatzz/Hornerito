import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getExpenseEmoji(description: string, category: string, subcategory: string): string {
  // Convert all to lowercase for easier matching
  const desc = description.toLowerCase();
  const cat = category.toLowerCase();
  const subcat = subcategory.toLowerCase();

  // Common expense patterns
  const patterns = {
    // Food & Drinks
    food: '🍽️',
    meal: '🍽️',
    restaurant: '🍽️',
    lunch: '🥪',
    dinner: '🍛',
    breakfast: '🍳',
    coffee: '☕',
    drinks: '🥤',
    snack: '🍿',
    groceries: '🛒',
    
    // Transport
    uber: '🚗',
    taxi: '🚕',
    car: '🚗',
    gas: '⛽',
    fuel: '⛽',
    bus: '🚌',
    metro: '🚇',
    train: '🚂',
    parking: '🅿️',
    
    // Shopping
    shopping: '🛍️',
    clothes: '👕',
    clothing: '👕',
    electronics: '📱',
    phone: '📱',
    computer: '💻',
    laptop: '💻',
    
    // Entertainment
    movie: '🎬',
    cinema: '🎬',
    netflix: '🎬',
    game: '🎮',
    spotify: '🎵',
    music: '🎵',
    concert: '🎫',
    ticket: '🎟️',
    
    // Health
    doctor: '👨‍⚕️',
    medical: '🏥',
    medicine: '💊',
    pharmacy: '💊',
    dentist: '🦷',
    gym: '🏋️',
    fitness: '🏃',
    
    // Bills & Utilities
    bill: '📄',
    rent: '🏠',
    electricity: '⚡',
    water: '💧',
    internet: '🌐',
    phone: '📱',
    taxes: '📊',
    insurance: '🔒',
    
    // Others
    gift: '🎁',
    book: '📚',
    education: '📚',
    pet: '🐾',
    travel: '✈️',
    hotel: '🏨',
    subscription: '🔄'
  };

  // First try to match the description
  for (const [key, emoji] of Object.entries(patterns)) {
    if (desc.includes(key)) {
      return emoji;
    }
  }

  // If no match in description, try subcategory
  for (const [key, emoji] of Object.entries(patterns)) {
    if (subcat.includes(key)) {
      return emoji;
    }
  }

  // If still no match, use category-based defaults
  const categoryDefaults: { [key: string]: string } = {
    'food & drinks': '🍽️',
    'transport': '🚗',
    'shopping': '🛍️',
    'entertainment': '🎮',
    'health': '🏥',
    'bills & utilities': '📄',
    'miscellaneous': '📦'
  };

  for (const [key, emoji] of Object.entries(categoryDefaults)) {
    if (cat.includes(key)) {
      return emoji;
    }
  }

  // Default emoji if no matches found
  return '💰';
}
