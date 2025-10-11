'use client';

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../../types';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
  requireAdmin?: boolean;
  projectOwnerId?: string;
  fallback?: React.ReactNode;
}

/**
 * Component to conditionally render content based on user roles
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRole,
  requiredRoles,
  requireAdmin = false,
  projectOwnerId,
  fallback = null,
}) => {
  const { user, userRole } = useAuth();

  // Check admin access
  if (requireAdmin && userRole !== 'admin') {
    return <>{fallback}</>;
  }

  // Check specific role
  if (requiredRole && userRole !== requiredRole) {
    return <>{fallback}</>;
  }

  // Check any of multiple roles
  if (requiredRoles && (!userRole || !requiredRoles.includes(userRole))) {
    return <>{fallback}</>;
  }

  // Check project ownership (admins can always access)
  if (projectOwnerId && userRole !== 'admin' && user?.id !== projectOwnerId) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component to show content only to admin users
 */
export const AdminOnly: React.FC<AdminOnlyProps> = ({ children, fallback = null }) => {
  return (
    <RoleGuard requireAdmin fallback={fallback}>
      {children}
    </RoleGuard>
  );
};

interface ProjectOwnerOnlyProps {
  children: React.ReactNode;
  ownerId: string;
  fallback?: React.ReactNode;
}

/**
 * Component to show content only to project owners and admins
 */
export const ProjectOwnerOnly: React.FC<ProjectOwnerOnlyProps> = ({ 
  children, 
  ownerId, 
  fallback = null 
}) => {
  return (
    <RoleGuard projectOwnerId={ownerId} fallback={fallback}>
      {children}
    </RoleGuard>
  );
};

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

/**
 * Badge component to display user role
 */
export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({ role, className = '' }) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const roleClasses = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    user: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  return (
    <span className={`${baseClasses} ${roleClasses[role]} ${className}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
};

/**
 * Hook to get current user's role information
 */
export const useUserRole = () => {
  const { user, userRole } = useAuth();

  return {
    role: userRole,
    isAdmin: userRole === 'admin',
    hasRole: (role: UserRole) => userRole === role,
    hasAnyRole: (roles: UserRole[]) => userRole ? roles.includes(userRole) : false,
    canManageProject: (ownerId: string) => userRole === 'admin' || user?.id === ownerId,
  };
};