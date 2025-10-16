# Toast Notification System - Quick Reference

## Overview
The toast notification system provides a clean way to display temporary messages to users across the application.

## Installation
Already installed in `/src/app/layout.tsx` via `ToastProvider`.

## Usage

### 1. Import the hook
```tsx
import { useToast } from '@/components/ui/toast';
```

### 2. Use in your component
```tsx
function MyComponent() {
  const { success, error, warning, info } = useToast();
  
  const handleSuccess = () => {
    success('Operation completed successfully!');
  };
  
  const handleError = () => {
    error('Something went wrong. Please try again.');
  };
  
  const handleWarning = () => {
    warning('Please review your changes before submitting.');
  };
  
  const handleInfo = () => {
    info('New features are available!');
  };
  
  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
      <button onClick={handleInfo}>Show Info</button>
    </div>
  );
}
```

### 3. Custom duration (optional)
```tsx
// Default is 5000ms (5 seconds)
success('Saved!', 3000); // Shows for 3 seconds
error('Failed!', 0);     // Never auto-dismiss (user must close)
```

## Toast Types

### Success ✅
- **Use for**: Successful operations, confirmations
- **Color**: Green
- **Example**: "Project created successfully!"

### Error ❌
- **Use for**: Failed operations, validation errors
- **Color**: Red
- **Example**: "Failed to save changes. Please try again."

### Warning ⚠️
- **Use for**: Important notices, potential issues
- **Color**: Yellow
- **Example**: "This action cannot be undone."

### Info ℹ️
- **Use for**: General information, tips, updates
- **Color**: Blue
- **Example**: "You have 3 pending notifications."

## Features

- ✅ **Auto-dismiss**: Automatically disappears after duration
- ✅ **Manual close**: Users can close any toast manually
- ✅ **Stacking**: Multiple toasts stack vertically
- ✅ **Animations**: Smooth slide-in and slide-out
- ✅ **Accessibility**: Proper ARIA labels and keyboard support
- ✅ **Responsive**: Works on all screen sizes

## Best Practices

### DO ✅
- Keep messages short and actionable
- Use appropriate toast types for the context
- Provide clear, user-friendly messages
- Use success toasts for positive feedback
- Use error toasts with helpful guidance

### DON'T ❌
- Don't show multiple toasts for the same action
- Don't use toasts for critical errors (use modals instead)
- Don't make messages too long
- Don't use toasts for permanent information
- Don't disable auto-dismiss for non-critical messages

## Example: Form Submission

```tsx
async function handleSubmit(data: FormData) {
  const { success, error } = useToast();
  
  try {
    await api.saveProject(data);
    success('Project saved successfully!');
    router.push('/projects');
  } catch (err) {
    error('Failed to save project. Please check your connection and try again.');
    console.error(err);
  }
}
```

## Example: API Error Handling

```tsx
async function fetchData() {
  const { error, warning } = useToast();
  
  try {
    const response = await fetch('/api/data');
    
    if (!response.ok) {
      if (response.status === 429) {
        warning('Rate limit exceeded. Please wait a moment.');
      } else {
        error('Failed to load data. Please try again.');
      }
      return;
    }
    
    // Process data...
  } catch (err) {
    error('Network error. Please check your connection.');
  }
}
```

## Styling
Toasts appear in the **top-right** corner by default. Modify `ToastContainer` in `/src/components/ui/toast.tsx` to change position:

```tsx
// Top-left
<div className="fixed top-4 left-4 z-50...">

// Bottom-right
<div className="fixed bottom-4 right-4 z-50...">

// Bottom-left
<div className="fixed bottom-4 left-4 z-50...">
```

## Integration with Existing Code

The toast system is already integrated in the root layout. Any component can use it immediately:

```tsx
'use client';

import { useToast } from '@/components/ui/toast';

export function MyFeature() {
  const toast = useToast();
  
  // Use toast.success(), toast.error(), etc.
  
  return <div>...</div>;
}
```

## TypeScript Support

Full TypeScript support with proper types:

```tsx
import { useToast, type ToastType, type Toast } from '@/components/ui/toast';

const toast = useToast();
// toast.success, toast.error, toast.warning, toast.info are fully typed
```

---

**Location**: `/src/components/ui/toast.tsx`
**Created**: 16 October 2025
**Status**: ✅ Production Ready
