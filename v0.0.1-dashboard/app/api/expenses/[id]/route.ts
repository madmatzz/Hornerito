import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: {
        id: string;
    };
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const expense = await prisma.expense.findUnique({
            where: {
                id: params.id
            }
        });

        if (!expense) {
            return NextResponse.json(
                { error: 'Expense not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(expense);
    } catch (error) {
        console.error('Error fetching expense:', error);
        return NextResponse.json(
            { error: 'Failed to fetch expense' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const data = await request.json();
        const expense = await prisma.expense.update({
            where: {
                id: params.id
            },
            data: {
                amount: data.amount,
                category: data.category,
                description: data.description,
                date: data.date ? new Date(data.date) : undefined
            }
        });
        return NextResponse.json(expense);
    } catch (error) {
        console.error('Error updating expense:', error);
        return NextResponse.json(
            { error: 'Failed to update expense' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        await prisma.expense.delete({
            where: {
                id: params.id
            }
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error deleting expense:', error);
        return NextResponse.json(
            { error: 'Failed to delete expense' },
            { status: 500 }
        );
    }
} 