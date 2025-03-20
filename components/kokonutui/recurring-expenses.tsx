import React, { useState } from 'react';

interface RecurringExpense {
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

interface RecurringExpensesProps {
  expenses: RecurringExpense[];
  loading: boolean;
}

export const RecurringExpenses: React.FC<RecurringExpensesProps> = ({ expenses, loading }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recurring Expenses</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
        >
          Add New
        </button>
      </div>
      <div className="space-y-2">
        {expenses.length === 0 ? (
          <p className="text-gray-500 text-sm">No recurring expenses yet</p>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="flex justify-between items-center">
              <span>{expense.description}</span>
              <span className="font-medium">{expense.amount}</span>
            </div>
          ))
        )}
      </div>
      
      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Add Recurring Expense</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Enter description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}; 