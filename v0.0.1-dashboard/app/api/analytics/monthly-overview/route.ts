import { NextResponse } from 'next/server';

interface DailyData {
  date: string;
  amount: number;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Generate mock data for the last 30 days
    const mockData: DailyData[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      mockData.push({
        date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 1000) + 100 // Random amount between 100 and 1100
      });
    }

    return NextResponse.json(mockData);
  } catch (error) {
    console.error('Error generating monthly overview data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 