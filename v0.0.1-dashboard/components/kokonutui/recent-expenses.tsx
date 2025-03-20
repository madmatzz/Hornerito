'use client';

import { useState } from "react";
import { formatCurrency, getExpenseEmoji } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import EditExpenseDialog from "./edit-expense-dialog";
import { UpdateExpenseData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Edit2 } from "lucide-react";

interface RecentExpensesProps {
  expenses: Expense[];
  loading?: boolean;
  onUpdateExpense?: (id: number, data: UpdateExpenseData) => Promise<void>;
  onDeleteExpense?: (id: number) => Promise<void>;
}

export function RecentExpenses({
  expenses = [],
  loading = false,
  onUpdateExpense,
  onDeleteExpense
}: RecentExpensesProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="animate-pulse bg-gray-200 h-6 w-48 rounded" />
          <CardDescription className="animate-pulse bg-gray-200 h-4 w-32 rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-200 h-12 w-full rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Expenses</CardTitle>
        <CardDescription>Your latest transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            No expenses found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{expense.category}</span>
                      {expense.subcategory && (
                        <span className="text-xs text-muted-foreground">{expense.subcategory}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(expense.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingExpense(expense)}
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteExpense?.(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <div className="p-6 pt-0">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.location.href = '/dashboard/transactions'}
        >
          View all expenses
        </Button>
      </div>

      <EditExpenseDialog
        expense={editingExpense}
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSave={async (data) => {
          if (editingExpense) {
            await onUpdateExpense?.(editingExpense.id, data);
            setEditingExpense(null);
          }
        }}
      />
    </Card>
  );
} 