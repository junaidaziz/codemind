import * as React from "react"

interface ProgressProps {
  value?: number;
  max?: number;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({ 
  value = 0, 
  max = 100, 
  className 
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-secondary ${className || ''}`}>
      <div 
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ 
          transform: `translateX(-${100 - percentage}%)` 
        }}
      />
    </div>
  );
};

export { Progress };