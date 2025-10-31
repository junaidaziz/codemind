import Link from 'next/link';
import { ReactNode } from 'react';

export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  linkLabel?: string;
  linkColorClass?: string; // e.g. text-blue-600 dark:text-blue-400
  className?: string;
}

/**
 * Reusable marketing feature card with consistent surface styling.
 * Automatically applies hover lift and shadow transitions.
 */
export function FeatureCard({ icon, title, description, href, linkLabel = 'Learn More', linkColorClass = 'text-blue-600 dark:text-blue-400', className = '' }: FeatureCardProps) {
  return (
    <div className={`surface-card p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1 ${className}`}>      
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-opacity-100">{icon}</div>
      <h3 className="card-title text-xl mb-3">{title}</h3>
      <p className="text-secondary mb-4">{description}</p>
      <Link href={href} className={`${linkColorClass} font-medium hover:underline flex items-center`}>
        {linkLabel}
        <span className="ml-1 inline-block" aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default FeatureCard;
