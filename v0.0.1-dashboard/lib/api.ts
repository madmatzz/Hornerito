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

export interface UpdateExpenseData {
  amount?: number;
  category?: string;
  subcategory?: string;
  description?: string;
  date?: string;
  is_recurring?: boolean;
  frequency?: string | null;
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
export async function getExpenses() {
  return fetchFromApi('/api/expenses');
}

export async function getRecentExpenses() {
  return fetchFromApi('/api/expenses/recent');
}

export async function createExpense(data: CreateExpenseData) {
  return fetchFromApi('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExpense(id: number, data: UpdateExpenseData) {
  return fetchFromApi(`/api/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: number) {
  return fetchFromApi(`/api/expenses/${id}`, {
    method: 'DELETE',
  });
}

// API functions for recurring expenses
export async function getRecurringExpenses() {
  return fetchFromApi('/api/expenses/recurring');
}

export async function createRecurringExpense(data: {
  icon: string;
  description: string;
  amount: number;
  start_date: string;
  is_recurring: boolean;
}) {
  return fetchFromApi('/api/expenses/recurring', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// API functions for analytics
export async function getMonthlyAnalytics() {
  return fetchFromApi('/api/analytics/monthly-overview');
} 