import { render, screen } from '@testing-library/react';

// Simple UI component tests
describe('UI Components', () => {
  it('renders a basic component', () => {
    const TestComponent = () => <div data-testid="test-component">Hello World</div>;
    
    render(<TestComponent />);
    
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders component with props', () => {
    const TestComponent = ({ title }: { title: string }) => (
      <div data-testid="test-component">{title}</div>
    );
    
    render(<TestComponent title="Test Title" />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('handles button clicks', () => {
    const mockHandler = jest.fn();
    const TestButton = ({ onClick }: { onClick: () => void }) => (
      <button data-testid="test-button" onClick={onClick}>
        Click me
      </button>
    );
    
    render(<TestButton onClick={mockHandler} />);
    
    const button = screen.getByTestId('test-button');
    button.click();
    
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('renders lists correctly', () => {
    const items = ['Item 1', 'Item 2', 'Item 3'];
    const TestList = ({ items }: { items: string[] }) => (
      <ul data-testid="test-list">
        {items.map((item, index) => (
          <li key={index} data-testid={`item-${index}`}>
            {item}
          </li>
        ))}
      </ul>
    );
    
    render(<TestList items={items} />);
    
    expect(screen.getByTestId('test-list')).toBeInTheDocument();
    expect(screen.getByTestId('item-0')).toHaveTextContent('Item 1');
    expect(screen.getByTestId('item-1')).toHaveTextContent('Item 2');
    expect(screen.getByTestId('item-2')).toHaveTextContent('Item 3');
  });

  it('handles conditional rendering', () => {
    const TestComponent = ({ showMessage }: { showMessage: boolean }) => (
      <div data-testid="test-component">
        {showMessage && <span data-testid="message">Message shown</span>}
        {!showMessage && <span data-testid="no-message">No message</span>}
      </div>
    );
    
    const { rerender } = render(<TestComponent showMessage={true} />);
    
    expect(screen.getByTestId('message')).toBeInTheDocument();
    expect(screen.queryByTestId('no-message')).not.toBeInTheDocument();
    
    rerender(<TestComponent showMessage={false} />);
    
    expect(screen.queryByTestId('message')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-message')).toBeInTheDocument();
  });

  it('handles form inputs', () => {
    const TestForm = () => (
      <form data-testid="test-form">
        <input 
          data-testid="name-input" 
          type="text" 
          placeholder="Enter name" 
        />
        <input 
          data-testid="email-input" 
          type="email" 
          placeholder="Enter email" 
        />
        <button data-testid="submit-button" type="submit">
          Submit
        </button>
      </form>
    );
    
    render(<TestForm />);
    
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  it('handles loading states', () => {
    const TestComponent = ({ loading }: { loading: boolean }) => (
      <div data-testid="test-component">
        {loading ? (
          <div data-testid="loading">Loading...</div>
        ) : (
          <div data-testid="content">Content loaded</div>
        )}
      </div>
    );
    
    const { rerender } = render(<TestComponent loading={true} />);
    
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    
    rerender(<TestComponent loading={false} />);
    
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('handles error states', () => {
    const TestComponent = ({ error }: { error: string | null }) => (
      <div data-testid="test-component">
        {error ? (
          <div data-testid="error" role="alert">
            Error: {error}
          </div>
        ) : (
          <div data-testid="success">Success!</div>
        )}
      </div>
    );
    
    const { rerender } = render(<TestComponent error="Something went wrong" />);
    
    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
    expect(screen.queryByTestId('success')).not.toBeInTheDocument();
    
    rerender(<TestComponent error={null} />);
    
    expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    expect(screen.getByTestId('success')).toBeInTheDocument();
  });
});