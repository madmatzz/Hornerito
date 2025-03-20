import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Mock data store
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
    return NextResponse.json(mockExpenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newExpense = {
      id: mockExpenses.length + 1,
      amount: body.amount,
      description: body.description,
      category: body.category,
      date: body.date || new Date().toISOString(),
    };
    mockExpenses.push(newExpense);
    return NextResponse.json({ message: 'Expense added successfully', expense: newExpense });
  } catch (error) {
    console.error('Error adding expense:', error);
    return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 });
  }
} 