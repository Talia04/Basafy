import * as React from 'react';
import { cn } from './utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-card text-card-foreground flex flex-col gap-6 rounded-xl border', className)}
      {...props}
    />
  );
}
