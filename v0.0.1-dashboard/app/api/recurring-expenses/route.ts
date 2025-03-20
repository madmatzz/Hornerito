import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:3000/api/debug');
    if (!response.ok) {
      throw new Error('Failed to fetch expenses');
    }
    const data = await response.json();
    // Filter only recurring expenses
    const recurringExpenses = data.filter((expense: any) => expense.is_recurring);
    return NextResponse.json(recurringExpenses);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring expenses' },
      { status: 500 }
    );
  }
} 