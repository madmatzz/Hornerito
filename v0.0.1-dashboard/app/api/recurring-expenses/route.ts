import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const recurringExpenses = await prisma.recurringExpense.findMany({
      orderBy: {
        startDate: 'desc'
      },
      where: {
        active: true
      }
    });
    return NextResponse.json(recurringExpenses);
  } catch (error) {
    console.error('Error fetching recurring expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring expenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        amount: data.amount,
        category: data.category,
        description: data.description,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        lastTracked: new Date(data.startDate),
        active: true
      }
    });
    return NextResponse.json(recurringExpense, { status: 201 });
  } catch (error) {
    console.error('Error creating recurring expense:', error);
    return NextResponse.json(
      { error: 'Failed to create recurring expense' },
      { status: 500 }
    );
  }
} 