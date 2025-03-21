import React from 'react';

interface ContentProps {
    children: React.ReactNode;
    className?: string;
}

export function Content({ children, className = '' }: ContentProps) {
    return (
        <div className={`space-y-4 ${className}`}>
            {children}
        </div>
    );
} 