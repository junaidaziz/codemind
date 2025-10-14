import * as React from "react"

interface DialogProps {
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ children }) => {
  return <div>{children}</div>;
};

const DialogTrigger: React.FC<{ 
  asChild?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ onClick, children, ...props }) => {
  const handleClick = () => {
    if (onClick) onClick();
  };
  
  return (
    <div onClick={handleClick} {...props}>
      {children}
    </div>
  );
};

const DialogContent: React.FC<{ 
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 ${className || ''}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto relative">
        {children}
      </div>
    </div>
  );
};

const DialogHeader: React.FC<{ 
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left pb-4 ${className || ''}`}>
    {children}
  </div>
);

const DialogTitle: React.FC<{ 
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <h3 className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`}>
    {children}
  </h3>
);

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
};