import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: {
        id: string;
    };
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const recurringExpense = await prisma.recurringExpense.findUnique({
            where: {
                id: params.id
            }
        });

        if (!recurringExpense) {
            return NextResponse.json(
                { error: 'Recurring expense not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(recurringExpense);
    } catch (error) {
        console.error('Error fetching recurring expense:', error);
        return NextResponse.json(
            { error: 'Failed to fetch recurring expense' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const data = await request.json();
        const recurringExpense = await prisma.recurringExpense.update({
            where: {
                id: params.id
            },
            data: {
                amount: data.amount,
                category: data.category,
                description: data.description,
                frequency: data.frequency,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined
            }
        });
        return NextResponse.json(recurringExpense);
    } catch (error) {
        console.error('Error updating recurring expense:', error);
        return NextResponse.json(
            { error: 'Failed to update recurring expense' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        await prisma.recurringExpense.update({
            where: {
                id: params.id
            },
            data: {
                active: false,
                endDate: new Date()
            }
        });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error deleting recurring expense:', error);
        return NextResponse.json(
            { error: 'Failed to delete recurring expense' },
            { status: 500 }
        );
    }
} 