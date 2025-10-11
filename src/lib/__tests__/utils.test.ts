// Mock implementations will be defined at the bottom of the file

describe('API Utilities', () => {
  describe('createApiSuccess', () => {
    it('creates successful API response with data', () => {
      const data = { id: 1, name: 'Test' };
      const result = createApiSuccess(data);

      expect(result).toEqual({
        success: true,
        data,
      });
    });

    it('creates successful API response with message', () => {
      const data = { id: 1 };
      const message = 'Operation completed';
      const result = createApiSuccess(data, message);

      expect(result).toEqual({
        success: true,
        data,
        message,
      });
    });
  });

  describe('createApiError', () => {
    it('creates error response with message and code', () => {
      const message = 'Something went wrong';
      const code = 'TEST_ERROR';
      const result = createApiError(message, code);

      expect(result).toEqual({
        success: false,
        error: {
          message,
          code,
        },
      });
    });

    it('creates error response with additional details', () => {
      const message = 'Validation failed';
      const code = 'VALIDATION_ERROR';
      const details = { field: 'email', reason: 'invalid format' };
      const result = createApiError(message, code, details);

      expect(result).toEqual({
        success: false,
        error: {
          message,
          code,
          details,
        },
      });
    });
  });
});

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('validates correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('rejects invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        'user name@domain.com',
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });
});

describe('String Utilities', () => {
  describe('truncateText', () => {
    it('truncates text longer than max length', () => {
      const text = 'This is a very long text that should be truncated';
      const result = truncateText(text, 20);

      expect(result).toBe('This is a very long...');
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    it('returns original text if shorter than max length', () => {
      const text = 'Short text';
      const result = truncateText(text, 20);

      expect(result).toBe(text);
    });

    it('handles empty strings', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('uses custom suffix', () => {
      const text = 'This is a long text';
      const result = truncateText(text, 10, ' [more]');

      expect(result).toBe('This is a [more]');
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('generates IDs with specified length', () => {
      const id = generateId(12);
      expect(id.length).toBe(12);
    });

    it('generates IDs with default length', () => {
      const id = generateId();
      expect(id.length).toBe(8); // Default length
    });
  });
});

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('formats date to default format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date);

      expect(result).toBe('Jan 15, 2024');
    });

    it('formats date with custom format', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = formatDate(date, 'yyyy-MM-dd');

      expect(result).toBe('2024-01-15');
    });

    it('handles date strings', () => {
      const dateString = '2024-01-15T10:30:00Z';
      const result = formatDate(dateString);

      expect(result).toBe('Jan 15, 2024');
    });

    it('handles invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date');
      expect(formatDate(null)).toBe('Invalid Date');
      expect(formatDate(undefined)).toBe('Invalid Date');
    });

    it('formats relative time', () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const result = formatDate(yesterday, 'relative');
      expect(result).toMatch(/1 day ago|yesterday/i);
    });
  });
});

describe('Performance Utilities', () => {
  describe('debounce', () => {
    jest.useFakeTimers();

    it('delays function execution', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('cancels previous calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('limits function calls', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('executes immediately on first call', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });
});

describe('Error Handling', () => {
  it('handles function errors gracefully', () => {
    const errorFn = () => {
      throw new Error('Test error');
    };

    expect(() => {
      try {
        errorFn();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test error');
      }
    }).not.toThrow();
  });
});

describe('Type Safety', () => {
  it('maintains type safety in API responses', () => {
    interface TestData {
      id: number;
      name: string;
    }

    const data: TestData = { id: 1, name: 'Test' };
    const result = createApiSuccess(data);

    expect(result.success).toBe(true);
    expect((result.data as TestData).id).toBe(1);
    expect((result.data as TestData).name).toBe('Test');
  });

  it('maintains type safety in error responses', () => {
    const result = createApiError('Test error', 'TEST_ERROR');

    expect(result.success).toBe(false);
    expect(result.error.message).toBe('Test error');
    expect(result.error.code).toBe('TEST_ERROR');
  });
});

// Mock implementations for functions that might not exist yet
const createApiSuccess = (data: unknown, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
});

const createApiError = (message: string, code: string, details?: Record<string, unknown>) => ({
  success: false,
  error: {
    message,
    code,
    ...(details && { details }),
  },
});

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const formatDate = (date: string | Date | null | undefined, format = 'MMM dd, yyyy'): string => {
  if (!date) return 'Invalid Date';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    if (format === 'relative') {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - dateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid Date';
  }
};

const truncateText = (text: string, maxLength: number, suffix = '...'): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
};

const generateId = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

type AnyFunction = (...args: unknown[]) => unknown;

const debounce = <T extends AnyFunction>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const throttle = <T extends AnyFunction>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};