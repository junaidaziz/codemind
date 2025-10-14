import * as React from "react"

interface AvatarProps {
  className?: string;
  children: React.ReactNode;
}

const Avatar: React.FC<AvatarProps> = ({ className, children }) => (
  <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className || ''}`}>
    {children}
  </div>
);

interface AvatarImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

const AvatarImage: React.FC<AvatarImageProps> = ({ src, alt, className }) => {
  if (!src) return null;
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`aspect-square h-full w-full ${className || ''}`}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};

interface AvatarFallbackProps {
  className?: string;
  children: React.ReactNode;
}

const AvatarFallback: React.FC<AvatarFallbackProps> = ({ className, children }) => (
  <div className={`flex h-full w-full items-center justify-center rounded-full bg-muted ${className || ''}`}>
    {children}
  </div>
);

export { Avatar, AvatarImage, AvatarFallback };