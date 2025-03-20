import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:3000/api/debug');
    if (!response.ok) {
      throw new Error('Failed to fetch expenses');
    }
    const data = await response.json();
    // Return only the 5 most recent expenses
    return NextResponse.json(data.slice(0, 5));
  } catch (error) {
    console.error('Error fetching recent expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent expenses' },
      { status: 500 }
    );
  }
} 