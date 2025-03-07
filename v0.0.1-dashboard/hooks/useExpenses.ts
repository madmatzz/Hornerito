'use client';

import { useState, useEffect } from 'react';
import { getExpenses, getRecentExpenses, getRecurringExpenses } from '@/lib/api';

export interface Expense {
  id: number;
  amount: number;
  category: string;
  displayCategory: string;
  description: string;
  date: string;
  is_recurring: boolean;
  frequency?: string | null;
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('Starting to fetch expenses data...');
        setLoading(true);
        setError(null); // Reset error state
        
        console.log('Fetching all expenses...');
        try {
          const allExp = await getExpenses();
          console.log('All expenses received:', allExp);
          if (!Array.isArray(allExp)) {
            console.error('Expenses data is not an array:', allExp);
            throw new Error('Invalid expenses data format');
          }
          setExpenses(allExp);
        } catch (error) {
          console.error('Failed to fetch all expenses:', error);
          if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
          }
          throw error; // Re-throw to be caught by outer try-catch
        }
        
        console.log('Fetching recent expenses...');
        try {
          const recentExp = await getRecentExpenses();
          console.log('Recent expenses received:', recentExp);
          if (!Array.isArray(recentExp)) {
            console.error('Recent expenses data is not an array:', recentExp);
            throw new Error('Invalid recent expenses data format');
          }
          setRecentExpenses(recentExp);
        } catch (error) {
          console.error('Failed to fetch recent expenses:', error);
          if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
          }
          throw error; // Re-throw to be caught by outer try-catch
        }
        
        console.log('Fetching recurring expenses...');
        try {
          const recurringExp = await getRecurringExpenses();
          console.log('Recurring expenses received:', recurringExp);
          if (!Array.isArray(recurringExp)) {
            console.error('Recurring expenses data is not an array:', recurringExp);
            throw new Error('Invalid recurring expenses data format');
          }
          setRecurringExpenses(recurringExp);
        } catch (error) {
          console.error('Failed to fetch recurring expenses:', error);
          if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
          }
          throw error; // Re-throw to be caught by outer try-catch
        }

        setLoading(false);
        console.log('All data fetched successfully');
      } catch (err) {
        console.error('Error in useExpenses:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch expenses'));
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return {
    expenses,
    recentExpenses,
    recurringExpenses,
    loading,
    error
  };
} 