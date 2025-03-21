import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface DailyData {
    date: string;
    amount: number;
}

interface MonthlyOverviewChartProps {
    data: DailyData[];
}

export function MonthlyOverviewChart({ data }: MonthlyOverviewChartProps) {
    const chartData = {
        labels: data.map(item => item.date),
        datasets: [
            {
                label: 'Daily Expenses',
                data: data.map(item => item.amount),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }
        ]
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Monthly Expense Overview'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: number) => `$${value.toFixed(2)}`
                }
            }
        }
    };

    return (
        <div className="w-full h-[400px]">
            <Line data={chartData} options={options} />
        </div>
    );
} 