import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Mock data store
let mockRecurringExpenses = [
  {
    id: 1,
    amount: 14.99,
    description: "Netflix Subscription",
    category: "Entertainment",
    frequency: "Monthly",
    next_date: new Date().toISOString(),
  }
];

export async function GET() {
  try {
    return NextResponse.json(mockRecurringExpenses);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring expenses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newExpense = {
      id: mockRecurringExpenses.length + 1,
      amount: body.amount,
      description: body.description,
      category: body.category,
      frequency: body.frequency,
      next_date: body.next_date || new Date().toISOString(),
    };
    mockRecurringExpenses.push(newExpense);
    return NextResponse.json({ message: 'Recurring expense added successfully', expense: newExpense });
  } catch (error) {
    console.error('Error adding recurring expense:', error);
    return NextResponse.json({ error: 'Failed to add recurring expense' }, { status: 500 });
  }
} 