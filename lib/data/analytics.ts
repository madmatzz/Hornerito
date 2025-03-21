interface DailyData {
    date: string;
    amount: number;
}

export async function getMonthlyOverview(): Promise<DailyData[]> {
    try {
        const response = await fetch('/api/analytics/monthly-overview');
        if (!response.ok) {
            throw new Error('Failed to fetch monthly overview data');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching monthly overview:', error);
        return [];
    }
}

export async function getExpensesByCategory(): Promise<{ category: string; amount: number }[]> {
    try {
        const response = await fetch('/api/analytics/expenses-by-category');
        if (!response.ok) {
            throw new Error('Failed to fetch category data');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching category data:', error);
        return [];
    }
}

export async function getExpenseTrends(): Promise<{ month: string; amount: number }[]> {
    try {
        const response = await fetch('/api/analytics/expense-trends');
        if (!response.ok) {
            throw new Error('Failed to fetch expense trends');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching expense trends:', error);
        return [];
    }
} 