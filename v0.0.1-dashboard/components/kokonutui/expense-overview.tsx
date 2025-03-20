'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownIcon, ArrowUpIcon, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpenseOverviewProps {
  expenses: any[];
  loading?: boolean;
}

export function ExpenseOverview({ expenses = [], loading = false }: ExpenseOverviewProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="animate-pulse bg-gray-200 h-4 w-24 rounded" />
              <div className="animate-pulse bg-gray-200 h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="animate-pulse bg-gray-200 h-7 w-32 rounded mb-2" />
              <p className="animate-pulse bg-gray-200 h-4 w-20 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const thisMonthExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
  });

  const lastMonthDate = new Date(currentDate);
  lastMonthDate.setMonth(currentMonth - 1);
  const lastMonthExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === lastMonthDate.getMonth() && expenseDate.getFullYear() === lastMonthDate.getFullYear();
  });

  const totalThisMonth = thisMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalLastMonth = lastMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const percentageChange = totalLastMonth ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : 0;

  const recurringExpenses = expenses.filter(expense => expense.is_recurring);
  const totalRecurring = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const largestExpense = thisMonthExpenses.length > 0 
    ? Math.max(...thisMonthExpenses.map(e => e.amount))
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalThisMonth)}</div>
          <p className="text-xs text-muted-foreground">
            {percentageChange > 0 ? (
              <span className="text-red-600 flex items-center gap-1">
                <ArrowUpIcon className="h-4 w-4" />
                {percentageChange.toFixed(1)}% from last month
              </span>
            ) : (
              <span className="text-green-600 flex items-center gap-1">
                <ArrowDownIcon className="h-4 w-4" />
                {Math.abs(percentageChange).toFixed(1)}% from last month
              </span>
            )}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Recurring</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalRecurring)}</div>
          <p className="text-xs text-muted-foreground">
            {recurringExpenses.length} recurring expenses
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average per Day</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(totalThisMonth / new Date().getDate())}
          </div>
          <p className="text-xs text-muted-foreground">
            This month's daily average
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Largest Expense</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(largestExpense)}
          </div>
          <p className="text-xs text-muted-foreground">
            Highest single expense this month
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 