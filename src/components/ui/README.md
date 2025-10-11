# UI Components

This directory contains reusable UI components for the CodeMind application.

## Components

### Spinner Components

#### `<Spinner />`
Basic loading spinner with customizable size and color.
```tsx
<Spinner size="md" color="blue" />
```

#### `<LoadingSpinner />`
Spinner with optional text label.
```tsx
<LoadingSpinner text="Loading..." size="lg" />
```

#### `<FullPageSpinner />`
Full-page centered loading spinner for page-level loading states.
```tsx
<FullPageSpinner text="Loading projects..." />
```

#### `<InlineSpinner />`
Inline spinner for buttons and small UI elements.
```tsx
<InlineSpinner size="sm" color="white">
  Processing...
</InlineSpinner>
```

### Error Components

#### `<ErrorBanner />`
Dismissible error/warning/info banner.
```tsx
<ErrorBanner 
  message="Something went wrong" 
  type="error"
  onDismiss={() => setError(null)}
/>
```

#### `<ErrorPage />`
Full-page error state with actions.
```tsx
<ErrorPage 
  title="Page Not Found"
  message="The page you're looking for doesn't exist."
  showRetry={true}
  onRetry={() => window.location.reload()}
/>
```

#### `<InlineError />`
Small inline error message.
```tsx
<InlineError message="Invalid input" />
```

#### `<ErrorCard />`
Card-style error component with actions.
```tsx
<ErrorCard 
  title="Failed to load"
  message="Could not fetch data"
  onRetry={handleRetry}
/>
```

## Props

### Spinner Props
- `size`: 'sm' | 'md' | 'lg' | 'xl'
- `color`: 'blue' | 'white' | 'gray' | 'green' | 'red' | 'yellow'
- `className`: Additional CSS classes

### Error Props
- `type`: 'error' | 'warning' | 'info'
- `dismissible`: boolean
- `onDismiss`: () => void
- `title`: string (optional)
- `message`: string (required)

## Usage

Import components from the main entry point:
```tsx
import { Spinner, ErrorBanner, FullPageSpinner } from '@/components/ui';
```

All components support dark mode and are fully responsive.