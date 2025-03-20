'use client';

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

// Modern color palette
const COLORS = [
  '#2DD4BF', // Teal
  '#8B5CF6', // Purple
  '#F43F5E', // Pink/Red
  '#0EA5E9', // Sky Blue
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#EC4899', // Hot Pink
  '#84CC16', // Lime
  '#14B8A6', // Light Teal
];

interface ExpenseCategoriesProps {
  expenses: Expense[];
  detailed?: boolean;
  loading?: boolean;
}

const normalizeCategory = (category: string) => {
  return category?.toLowerCase().trim() || 'uncategorized';
};

const formatCategory = (category: string) => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function ExpenseCategories({ expenses = [], detailed = false, loading = false }: ExpenseCategoriesProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);

  const categorySummary = useMemo(() => {
    if (!expenses?.length) return [];

    const summary = expenses.reduce((acc, expense) => {
      const mainCategory = normalizeCategory(expense.category);
      const subCategory = normalizeCategory(expense.subcategory);
      const categoryKey = `${mainCategory}>${subCategory}`;

      if (!acc[categoryKey]) {
        acc[categoryKey] = {
          total: 0,
          count: 0,
          displayName: `${formatCategory(mainCategory)} - ${formatCategory(subCategory)}`,
          mainCategory: formatCategory(mainCategory),
          subCategory: formatCategory(subCategory),
          transactions: [],
          avgAmount: 0,
          minAmount: Infinity,
          maxAmount: -Infinity
        };
      }
      acc[categoryKey].total += expense.amount;
      acc[categoryKey].count += 1;
      acc[categoryKey].transactions.push(expense);
      acc[categoryKey].minAmount = Math.min(acc[categoryKey].minAmount, expense.amount);
      acc[categoryKey].maxAmount = Math.max(acc[categoryKey].maxAmount, expense.amount);
      return acc;
    }, {} as Record<string, {
      total: number;
      count: number;
      displayName: string;
      mainCategory: string;
      subCategory: string;
      transactions: Expense[];
      avgAmount: number;
      minAmount: number;
      maxAmount: number;
    }>);

    Object.values(summary).forEach(cat => {
      cat.avgAmount = cat.total / cat.count;
    });

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    return Object.entries(summary)
      .map(([categoryKey, data]) => ({
        name: data.displayName,
        category: data.mainCategory,
        subcategory: data.subCategory,
        total: data.total,
        count: data.count,
        percentage: (data.total / totalAmount) * 100,
        value: data.total,
        avgAmount: data.avgAmount,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="animate-pulse bg-gray-200 h-6 w-48 rounded" />
          <CardDescription className="animate-pulse bg-gray-200 h-4 w-32 rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 h-48 w-48 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-3">
              <p className="text-sm font-medium text-zinc-100">{data.category}</p>
              <p className="text-xs text-zinc-400">{data.subcategory}</p>
              <p className="text-xs text-zinc-400">
                {formatCurrency(data.total)} ({data.percentage.toFixed(1)}%)
              </p>
              <p className="text-xs text-zinc-400">{data.count} transactions</p>
            </CardContent>
          </Card>
        </motion.div>
      );
    }
    return null;
  };

  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, name, percent, index, payload } = props;
    const RADIAN = Math.PI / 180;
    
    // Calculate the position for the line's end point
    const radius = outerRadius * 1.2;
    const x1 = cx + (outerRadius + 10) * Math.cos(-midAngle * RADIAN);
    const y1 = cy + (outerRadius + 10) * Math.sin(-midAngle * RADIAN);
    const x2 = cx + radius * Math.cos(-midAngle * RADIAN);
    const y2 = cy + radius * Math.sin(-midAngle * RADIAN);

    // Calculate the position for the text
    const textAnchor = x2 > cx ? 'start' : 'end';
    const textX = x2 + (x2 > cx ? 5 : -5);

    if (percent < 0.03) return null;

    // Get only the main category name (before the hyphen)
    const mainCategory = payload.category;

    return (
      <g>
        {/* Line from pie to label */}
        <path
          d={`M${x1},${y1}L${x2},${y2}`}
          stroke={COLORS[index % COLORS.length]}
          fill="none"
          strokeWidth={1}
        />
        {/* Label text */}
        <text
          x={textX}
          y={y2}
          fill="#9CA3AF"
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className="text-[11px] font-medium"
        >
          {`${mainCategory} ${(percent * 100).toFixed(1)}%`}
        </text>
      </g>
    );
  };

  const displayedCategories = showAllCategories ? categorySummary : categorySummary.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Categories</CardTitle>
        <CardDescription>Distribution by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categorySummary}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                innerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {categorySummary.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {data.category}
                        </p>
                        {data.subcategory && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {data.subcategory}
                          </p>
                        )}
                        <div className="mt-2 space-y-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(data.total)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {data.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {displayedCategories.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCurrency(item.total)} ({item.percentage.toFixed(1)}%)
              </div>
            </div>
          ))}
          {categorySummary.length > 5 && (
            <Button
              variant="ghost"
              className="w-full mt-2"
              onClick={() => setShowAllCategories(!showAllCategories)}
            >
              <span className="mr-2">
                {showAllCategories ? 'Show Less' : `Show All (${categorySummary.length})`}
              </span>
              {showAllCategories ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {detailed && (
          <div className="mt-8 space-y-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
              Detailed Analysis
            </h3>
            <div className="space-y-6">
              {categorySummary.map((category) => (
                <div key={category.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {category.category}
                      </h4>
                      {category.subcategory && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {category.subcategory}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(category.total)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {category.count} transactions
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${category.percentage}%`,
                          backgroundColor: COLORS[categorySummary.indexOf(category) % COLORS.length]
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Average: {formatCurrency(category.avgAmount)}</span>
                      <span>Max: {formatCurrency(category.maxAmount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 