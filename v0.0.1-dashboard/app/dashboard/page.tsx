'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { getExpenses, getRecurringExpenses, updateExpense, deleteExpense, createRecurringExpense } from '@/lib/api';
import type { UpdateExpenseData } from '@/lib/api';
import { Layout } from '@/components/kokonutui/layout';
import { Content } from '@/components/kokonutui/content';
import { RecentExpenses } from '@/components/kokonutui/recent-expenses';
import { ExpenseCategories } from '@/components/kokonutui/expense-categories';
import { ExpenseOverview } from '@/components/kokonutui/expense-overview';
import { RecurringExpenses } from '@/components/kokonutui/recurring-expenses';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [allExpensesRes, recurringExp] = await Promise.all([
        getExpenses(),
        getRecurringExpenses()
      ]);
      
      if (Array.isArray(allExpensesRes)) {
        // Sort expenses by date in descending order
        const sortedExpenses = [...allExpensesRes].sort((a, b) => 
          new Date(b.date || b.timestamp).getTime() - new Date(a.date || a.timestamp).getTime()
        );
        
        setExpenses(sortedExpenses);
        // Get the 10 most recent expenses
        setRecentExpenses(sortedExpenses.slice(0, 10));
        
        // Update last update timestamp
        setLastUpdate(new Date());
      } else {
        console.error('Invalid expenses data:', allExpensesRes);
        toast.error('Received invalid data from server');
      }

      if (Array.isArray(recurringExp)) {
        setRecurringExpenses(recurringExp);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();

    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchData, 300000);

    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const handleManualRefresh = () => {
    fetchData();
  };

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <Button
              onClick={handleManualRefresh}
              className="mt-4"
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </>
              )}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Content>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="default"
              onClick={() => window.open('https://t.me/Hornerito_bot', '_blank')}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Open Telegram Bot
            </Button>
            <Button
              variant="default"
              size="default"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {refreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Dashboard
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="grid gap-6">
          <ExpenseOverview expenses={expenses} loading={loading} />
          <div className="grid gap-6 lg:grid-cols-2">
            <ExpenseCategories expenses={expenses} loading={loading} />
            <RecurringExpenses 
              expenses={recurringExpenses} 
              loading={loading}
              onAddExpense={async (data) => {
                try {
                  await createRecurringExpense(data);
                  toast.success('Recurring expense added successfully');
                  // Refresh data to show the new expense
                  await fetchData();
                } catch (err) {
                  console.error('Error adding recurring expense:', err);
                  toast.error('Failed to add recurring expense');
                }
              }}
            />
          </div>
          <RecentExpenses 
            expenses={recentExpenses} 
            loading={loading}
            onUpdateExpense={async (id: number, data: UpdateExpenseData) => {
              try {
                await updateExpense(id, data);
                toast.success('Expense updated successfully');
                // Manually refresh data after update
                await fetchData();
              } catch (err) {
                console.error('Error updating expense:', err);
                toast.error('Failed to update expense');
              }
            }}
            onDeleteExpense={async (id: number) => {
              try {
                await deleteExpense(id);
                toast.success('Expense deleted successfully');
                // Manually refresh data after delete
                await fetchData();
              } catch (err) {
                console.error('Error deleting expense:', err);
                toast.error('Failed to delete expense');
              }
            }}
          />
        </div>
      </Content>
    </Layout>
  );
}

