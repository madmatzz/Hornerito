// Temporary in-memory data store
const mockData = {
  expenses: [
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
  ],
  recurring_expenses: [
    {
      id: 1,
      amount: 14.99,
      description: "Netflix Subscription",
      category: "Entertainment",
      frequency: "Monthly",
      next_date: new Date().toISOString(),
    }
  ]
};

export const db = {
  all: async (query: string, params?: any[]): Promise<any[]> => {
    if (query.includes('expenses')) {
      return mockData.expenses;
    }
    if (query.includes('recurring_expenses')) {
      return mockData.recurring_expenses;
    }
    return [];
  },
  
  get: async (query: string, params?: any[]): Promise<any> => {
    if (query.includes('expenses')) {
      return mockData.expenses[0];
    }
    if (query.includes('recurring_expenses')) {
      return mockData.recurring_expenses[0];
    }
    return null;
  },

  run: async (query: string, params?: any[]): Promise<void> => {
    // Mock implementation for insert/update/delete
    console.log('Mock query executed:', query, params);
  }
}; 