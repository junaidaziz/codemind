/**
 * API Client Utilities for authenticated requests
 * Handles adding authentication headers to fetch requests
 */

import { createBrowserClient } from '../app/lib/supabase';

/**
 * Get the current access token from Supabase session
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Make an authenticated fetch request
 * Automatically adds Authorization header with access token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make an authenticated GET request and parse JSON response
 */
export async function apiGet<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Make an authenticated POST request and parse JSON response
 */
export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Make an authenticated PUT request and parse JSON response
 */
export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Make an authenticated PATCH request and parse JSON response
 */
export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Make an authenticated DELETE request and parse JSON response
 */
export async function apiDelete<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}
