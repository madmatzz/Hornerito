import axios from 'axios';

export interface Expense {
    id: string;
    amount: number;
    category: string;
    description: string;
    date: string;
}

export interface RecurringExpense {
    id: string;
    amount: number;
    category: string;
    description: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    lastTracked: string;
    active: boolean;
}

export interface UpdateExpenseData {
    amount?: number;
    category?: string;
    description?: string;
    date?: string;
}

export interface CreateRecurringExpenseData {
    amount: number;
    category: string;
    description: string;
    frequency: string;
    startDate: string;
    endDate?: string;
}

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || '/api'
});

export async function getExpenses(): Promise<Expense[]> {
    try {
        const response = await api.get('/expenses');
        return response.data;
    } catch (error) {
        console.error('Error fetching expenses:', error);
        throw new Error('Failed to fetch expenses');
    }
}

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
    try {
        const response = await api.get('/recurring-expenses');
        return response.data;
    } catch (error) {
        console.error('Error fetching recurring expenses:', error);
        throw new Error('Failed to fetch recurring expenses');
    }
}

export async function updateExpense(id: string, data: UpdateExpenseData): Promise<Expense> {
    try {
        const response = await api.patch(`/expenses/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating expense:', error);
        throw new Error('Failed to update expense');
    }
}

export async function deleteExpense(id: string): Promise<void> {
    try {
        await api.delete(`/expenses/${id}`);
    } catch (error) {
        console.error('Error deleting expense:', error);
        throw new Error('Failed to delete expense');
    }
}

export async function createRecurringExpense(data: CreateRecurringExpenseData): Promise<RecurringExpense> {
    try {
        const response = await api.post('/recurring-expenses', data);
        return response.data;
    } catch (error) {
        console.error('Error creating recurring expense:', error);
        throw new Error('Failed to create recurring expense');
    }
}

export async function deleteRecurringExpense(id: string): Promise<void> {
    try {
        await api.delete(`/recurring-expenses/${id}`);
    } catch (error) {
        console.error('Error deleting recurring expense:', error);
        throw new Error('Failed to delete recurring expense');
    }
}

export async function updateRecurringExpense(id: string, data: Partial<CreateRecurringExpenseData>): Promise<RecurringExpense> {
    try {
        const response = await api.patch(`/recurring-expenses/${id}`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating recurring expense:', error);
        throw new Error('Failed to update recurring expense');
    }
}

// Helper function to handle API responses
async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'API request failed');
  }
  return response.json();
}

export async function fetchFromApi(endpoint: string, options: RequestInit = {}) {
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(endpoint, {
    ...defaultOptions,
    ...options,
  });

  return handleResponse(response);
}

export interface CreateExpenseData {
  amount: number;
  category: string;
  subcategory?: string;
  description?: string;
  date?: string;
  is_recurring?: boolean;
  frequency?: string | null;
}

// API functions for expenses
export async function getRecentExpenses() {
  return fetchFromApi('/api/expenses/recent');
}

export async function createExpense(data: CreateExpenseData) {
  return fetchFromApi('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// API functions for analytics
export async function getMonthlyAnalytics() {
  return fetchFromApi('/api/analytics/monthly-overview');
} 