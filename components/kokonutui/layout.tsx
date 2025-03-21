import React from 'react';
import Link from 'next/link';

interface LayoutProps {
    children: React.ReactNode;
    className?: string;
}

export function Layout({ children, className = '' }: LayoutProps) {
    return (
        <div className={`min-h-screen bg-background ${className}`}>
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center">
                    <div className="mr-4 flex">
                        <Link className="mr-6 flex items-center space-x-2" href="/">
                            <span className="font-bold">Hornerito</span>
                        </Link>
                    </div>
                </div>
            </header>
            <main className="container py-6">
                {children}
            </main>
        </div>
    );
} 