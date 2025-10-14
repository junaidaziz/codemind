"use client";

import * as React from "react";

interface DialogContextValue {
  open: boolean;
  setOpen: (o: boolean) => void;
  titleId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

interface DialogProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Dialog: React.FC<DialogProps> = ({ children, defaultOpen = false, onOpenChange }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const titleId = React.useId();

  const setOpenWrapped = React.useCallback((o: boolean) => {
    setOpen(o);
    onOpenChange?.(o);
  }, [onOpenChange]);

  // Scroll lock while open
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenWrapped(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpenWrapped]);

  const value: DialogContextValue = { open, setOpen: setOpenWrapped, titleId };
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

const useDialog = () => {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used within <Dialog>');
  return ctx;
};

const DialogTrigger: React.FC<{ 
  asChild?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, children, className, ...props }) => {
  const { setOpen } = useDialog();
  const handleClick = () => {
    setOpen(true);
    onClick?.();
  };
  return (
    <div onClick={handleClick} className={className} {...props}>
      {children}
    </div>
  );
};

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
  align?: 'center' | 'top';
}

const DialogContent: React.FC<DialogContentProps> = ({ className, children, align = 'top' }) => {
  const { open, setOpen, titleId } = useDialog();

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-state={open ? 'open' : 'closed'}
      className={`fixed inset-0 z-50 flex ${align === 'center' ? 'items-center' : 'items-start pt-20'} justify-center px-4 sm:px-6 md:px-8 bg-black/60 backdrop-blur-sm overflow-y-auto`}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full mx-auto transform transition-all duration-200 ease-out ${className || 'max-w-4xl'} bg-white/95 dark:bg-gray-800/95 backdrop-saturate-150 border border-gray-200/70 dark:border-gray-700/60 shadow-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95`}
      >
        <button
          type="button"
            aria-label="Close dialog"
          data-close="true"
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
};

const DialogHeader: React.FC<{ 
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div className={`flex flex-col space-y-1.5 text-left pb-4 ${className || ''}`}>
    {children}
  </div>
);

const DialogTitle: React.FC<{ 
  className?: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  const { titleId } = useDialog();
  return (
    <h3 id={titleId} className={`text-xl font-semibold tracking-tight ${className || ''}`}>
      {children}
    </h3>
  );
};

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle };