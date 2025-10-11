import '../../../test-utils/jest-dom';
import { renderWithProviders, mockUser, mockAdminUser } from '../../../test-utils';

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides initial user when passed', () => {
    const TestComponent = () => {
      return <div data-testid="test-component">Test</div>;
    };

    const { getByTestId } = renderWithProviders(<TestComponent />, {
      initialUser: mockUser,
    });

    const authProvider = getByTestId('auth-provider');
    expect(authProvider).toHaveAttribute('data-user', mockUser.id);
  });

  it('provides anonymous context when no user', () => {
    const TestComponent = () => {
      return <div data-testid="test-component">Test</div>;
    };

    const { getByTestId } = renderWithProviders(<TestComponent />, {
      initialUser: null,
    });

    const authProvider = getByTestId('auth-provider');
    expect(authProvider).toHaveAttribute('data-user', 'anonymous');
  });

  it('handles admin user correctly', () => {
    const TestComponent = () => {
      return <div data-testid="test-component">Test</div>;
    };

    const { getByTestId } = renderWithProviders(<TestComponent />, {
      initialUser: mockAdminUser,
    });

    const authProvider = getByTestId('auth-provider');
    expect(authProvider).toHaveAttribute('data-user', mockAdminUser.id);
  });

  describe('user roles', () => {
    it('distinguishes between user and admin roles', () => {
      expect(mockUser.role).toBe('user');
      expect(mockAdminUser.role).toBe('admin');
    });

    it('contains required user profile fields', () => {
      expect(mockUser.profile).toEqual({
        firstName: 'Test',
        lastName: 'User',
        avatar: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('has valid user timestamps', () => {
      expect(mockUser.createdAt).toBeInstanceOf(Date);
      expect(mockUser.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('authentication utilities', () => {
    it('generates valid test users', () => {
      const user1 = { ...mockUser, id: 'custom-id-1' };
      const user2 = { ...mockUser, id: 'custom-id-2' };

      expect(user1.id).toBe('custom-id-1');
      expect(user2.id).toBe('custom-id-2');
      expect(user1.email).toBe(mockUser.email);
      expect(user2.email).toBe(mockUser.email);
    });

    it('maintains user data integrity', () => {
      const testUser = { ...mockUser };
      
      expect(testUser).toEqual({
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          avatar: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('type safety', () => {
    it('enforces role types correctly', () => {
      const userRole: 'user' | 'admin' = mockUser.role;
      const adminRole: 'user' | 'admin' = mockAdminUser.role;

      expect(['user', 'admin']).toContain(userRole);
      expect(['user', 'admin']).toContain(adminRole);
    });

    it('maintains proper user structure', () => {
      const validateUser = (user: typeof mockUser | typeof mockAdminUser) => {
        expect(typeof user.id).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(['user', 'admin']).toContain(user.role);
        expect(user.profile).toBeDefined();
        expect(user.createdAt).toBeInstanceOf(Date);
        expect(user.updatedAt).toBeInstanceOf(Date);
      };

      validateUser(mockUser);
      validateUser(mockAdminUser);
    });
  });
});