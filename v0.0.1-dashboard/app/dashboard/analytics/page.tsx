'use client';

import { Card, CardContent } from "@/components/ui/card";
import { MonthlyOverviewChart } from "@/components/analytics/MonthlyOverviewChart";
import { Layout } from "@/components/kokonutui/layout";
import { Content } from "@/components/kokonutui/content";
import { useEffect, useState } from "react";
import { getMonthlyOverview } from "@/lib/data/analytics";

interface DailyData {
  date: string;
  amount: number;
}

export default function AnalyticsPage() {
  const [monthlyData, setMonthlyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMonthlyOverview();
        setMonthlyData(data);
      } catch (error) {
        console.error('Error fetching monthly data:', error);
        setError('Failed to load monthly data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <Layout>
      <Content>
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex justify-center items-center h-[400px]">
                <p>Loading...</p>
              </div>
            ) : error ? (
              <div className="flex justify-center items-center h-[400px] text-red-500">
                <p>{error}</p>
              </div>
            ) : (
              <MonthlyOverviewChart data={monthlyData} />
            )}
          </CardContent>
        </Card>
      </Content>
    </Layout>
  );
} 