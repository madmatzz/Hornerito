import { NextResponse } from 'next/server';

export async function GET() {
  const expenses = [
    {
      id: 15,
      amount: 30,
      category: 'Shopping',
      subcategory: 'Clothing',
      description: 'Clothing',
      date: '2025-03-08T06:44:47.706Z',
      is_recurring: false,
      frequency: null
    },
    {
      id: 12,
      amount: 50,
      category: 'Bills & Utilities',
      subcategory: 'Taxes',
      description: 'Taxes',
      date: '2025-03-08T06:24:42.875Z',
      is_recurring: false,
      frequency: null
    },
    {
      id: 11,
      amount: 50,
      category: 'Transport',
      subcategory: 'Taxis & Rideshares',
      description: 'Taxi',
      date: '2025-03-08T06:24:38.172Z',
      is_recurring: false,
      frequency: null
    },
    {
      id: 9,
      amount: 50,
      category: 'Food & Drinks',
      subcategory: 'Meals',
      description: 'Restaurant',
      date: '2025-03-08T06:15:12.866Z',
      is_recurring: false,
      frequency: null
    }
  ];

  return NextResponse.json(expenses);
} 