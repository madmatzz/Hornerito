'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ExpenseOverviewProps {
  expenses: Expense[];
}

export default function ExpenseOverview({ expenses }: ExpenseOverviewProps) {
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const recurringExpenses = expenses.filter(expense => expense.is_recurring);
  const totalRecurring = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const averageExpense = totalSpent / (expenses.length || 1);
  const largestExpense = Math.max(...expenses.map(expense => expense.amount));

  const overviewCards = [
    {
      title: "Total Spent",
      value: formatCurrency(totalSpent),
      description: "Total expenses this period"
    },
    {
      title: "Recurring Expenses",
      value: formatCurrency(totalRecurring),
      description: `${recurringExpenses.length} recurring payments`
    },
    {
      title: "Average Expense",
      value: formatCurrency(averageExpense),
      description: "Per transaction"
    },
    {
      title: "Largest Expense",
      value: formatCurrency(largestExpense),
      description: "Highest single expense"
    }
  ];

  return (
    <>
      {overviewCards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </>
  );
} 