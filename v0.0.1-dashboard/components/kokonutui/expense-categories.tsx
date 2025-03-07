'use client';

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

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
}

const normalizeCategory = (category: string) => {
  return category.toLowerCase().trim();
};

const formatCategory = (category: string) => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function ExpenseCategories({ expenses, detailed = false }: ExpenseCategoriesProps) {
  const categorySummary = useMemo(() => {
    if (!expenses?.length) return [];

    const summary = expenses.reduce((acc, expense) => {
      const mainCategory = normalizeCategory(expense.category);
      if (!acc[mainCategory]) {
        acc[mainCategory] = {
          total: 0,
          count: 0,
          displayName: formatCategory(mainCategory),
          transactions: [],
          avgAmount: 0,
          minAmount: Infinity,
          maxAmount: -Infinity
        };
      }
      acc[mainCategory].total += expense.amount;
      acc[mainCategory].count += 1;
      acc[mainCategory].transactions.push(expense);
      acc[mainCategory].minAmount = Math.min(acc[mainCategory].minAmount, expense.amount);
      acc[mainCategory].maxAmount = Math.max(acc[mainCategory].maxAmount, expense.amount);
      return acc;
    }, {} as Record<string, {
      total: number;
      count: number;
      displayName: string;
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
      .map(([category, data]) => ({
        name: data.displayName,
        category: category,
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-zinc-100">{data.name}</p>
            <p className="text-xs text-zinc-400">
              {formatCurrency(data.total)} ({data.percentage.toFixed(1)}%)
            </p>
            <p className="text-xs text-zinc-400">{data.count} transactions</p>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const radian = Math.PI / 180;
    const x = cx + radius * Math.cos(-midAngle * radian);
    const y = cy + radius * Math.sin(-midAngle * radian);
    
    if (percent < 0.03) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="#9CA3AF"
        textAnchor="middle" 
        dominantBaseline="middle"
        className="text-[10px] font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-4">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categorySummary}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={95}
              innerRadius={75}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={1}
              paddingAngle={2}
            >
              {categorySummary.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[index % COLORS.length]}
                  className="hover:opacity-90 transition-opacity cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {categorySummary.map((item, index) => (
          <div 
            key={item.category} 
            className="flex items-center justify-between text-sm hover:bg-zinc-800/50 p-2 rounded transition-colors"
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-zinc-300 text-xs">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-400 text-xs">
                {item.count} items
              </span>
              <span className="text-zinc-300 text-xs font-medium">
                {formatCurrency(item.total)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {detailed && (
        <div className="mt-6 space-y-4">
          {categorySummary.map((category, index) => (
            <Card key={index} className="bg-zinc-900/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <h3 className="text-sm font-medium text-zinc-200">{category.name}</h3>
                  </div>
                  <span className="text-sm font-medium text-zinc-300">
                    {formatCurrency(category.total)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-zinc-400">
                  <div>
                    <p>Average</p>
                    <p className="text-zinc-300">{formatCurrency(category.avgAmount)}</p>
                  </div>
                  <div>
                    <p>Minimum</p>
                    <p className="text-zinc-300">{formatCurrency(category.minAmount)}</p>
                  </div>
                  <div>
                    <p>Maximum</p>
                    <p className="text-zinc-300">{formatCurrency(category.maxAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 