import { fetchFromApi } from '../api';

export interface MonthlyOverviewData {
  date: string;
  amount: number;
}

export async function getMonthlyOverview(): Promise<MonthlyOverviewData[]> {
  // Mock monthly overview data
  const currentDate = new Date();
  const mockData: MonthlyOverviewData[] = [];

  // Generate last 30 days of mock data
  for (let i = 0; i < 30; i++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - i);
    
    mockData.push({
      date: date.toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 200) + 50 // Random amount between 50 and 250
    });
  }

  return mockData.reverse(); // Return in chronological order
} 