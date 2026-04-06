import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
