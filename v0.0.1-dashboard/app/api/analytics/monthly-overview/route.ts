import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Generate mock data for the last 30 days
    const mockData = [];
    const currentDate = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);
      
      mockData.push({
        date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 200) + 50 // Random amount between 50 and 250
      });
    }

    return NextResponse.json(mockData.reverse());
  } catch (error) {
    console.error('Error generating monthly overview:', error);
    return NextResponse.json({ error: 'Failed to generate monthly overview' }, { status: 500 });
  }
} 