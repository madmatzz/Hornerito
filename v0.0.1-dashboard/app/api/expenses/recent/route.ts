import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Mock data store - using the same data from expenses route
let mockExpenses = [
  {
    id: 1,
    amount: 50.00,
    description: "Groceries",
    category: "Food",
    date: new Date().toISOString(),
  },
  {
    id: 2,
    amount: 30.00,
    description: "Gas",
    category: "Transportation",
    date: new Date().toISOString(),
  }
];

export async function GET() {
  try {
    // Return only the 10 most recent expenses
    const recentExpenses = mockExpenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    
    return NextResponse.json(recentExpenses);
  } catch (error) {
    console.error('Error fetching recent expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch recent expenses' }, { status: 500 });
  }
} 