'use client';

import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface RecentExpensesProps {
  expenses: Expense[];
  showAll?: boolean;
}

export default function RecentExpenses({ expenses, showAll = false }: RecentExpensesProps) {
  const displayExpenses = showAll ? expenses : expenses.slice(0, 5);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayExpenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="font-medium">
                {expense.description || 'Unnamed expense'}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-100">
                  {expense.displayCategory}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(expense.date).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(expense.amount)}
              </TableCell>
              <TableCell className="text-right">
                {expense.is_recurring ? (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                    Recurring
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-zinc-500/10 text-zinc-500">
                    One-time
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 