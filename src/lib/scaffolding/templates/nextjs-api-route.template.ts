/**
 * Next.js 15 API Route Template
 * 
 * Generates a Next.js App Router API route with:
 * - TypeScript types
 * - Request validation
 * - Error handling
 * - Optional authentication
 */

import type { Template } from '../types';

export const nextjsApiRouteTemplate: Template = {
  id: 'nextjs-api-route',
  name: 'Next.js API Route',
  description: 'Next.js 15 App Router API route handler',
  category: 'route',
  framework: 'nextjs',
  tags: ['api', 'route', 'nextjs', 'rest'],
  version: '1.0.0',
  
  variables: [
    {
      name: 'routeName',
      type: 'string',
      required: true,
      description: 'Name of the API route (e.g., users, posts)',
    },
    {
      name: 'methods',
      type: 'array',
      required: false,
      description: 'HTTP methods to support (GET, POST, PUT, DELETE)',
    },
    {
      name: 'withAuth',
      type: 'boolean',
      required: false,
      description: 'Include authentication middleware',
    },
    {
      name: 'withValidation',
      type: 'boolean',
      required: false,
      description: 'Include request validation with Zod',
    },
  ],

  files: [
    {
      path: 'src/app/api/{{kebabCase routeName}}/route.ts',
      content: `{{#if withValidation}}import { z } from 'zod';
{{/if}}import { NextRequest, NextResponse } from 'next/server';
{{#if withAuth}}import { auth } from '@/lib/auth';
{{/if}}{{#if withValidation}}

// Request validation schema
const {{camelCase routeName}}Schema = z.object({
  // Add your validation fields here
  id: z.string().optional(),
  name: z.string().min(1),
});

type {{pascalCase routeName}}Body = z.infer<typeof {{camelCase routeName}}Schema>;
{{/if}}

/**
 * GET /api/{{kebabCase routeName}}
 * Retrieve {{routeName}}
 */
{{#if methods}}{{#each methods}}{{#if (eq this "GET")}}export async function GET(request: NextRequest) {
  try {
{{#if ../withAuth}}    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

{{/if}}    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // TODO: Implement your GET logic here
    const data = {
      message: 'GET {{../routeName}} endpoint',
      id,
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET {{../routeName}} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

{{/if}}{{#if (eq this "POST")}}/**
 * POST /api/{{../kebabCase ../routeName}}
 * Create new {{../routeName}}
 */
export async function POST(request: NextRequest) {
  try {
{{#if ../withAuth}}    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

{{/if}}    // Parse request body
    const body = await request.json();
{{#if ../withValidation}}

    // Validate request
    const validation = {{../camelCase ../routeName}}Schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;
{{else}}
    const data = body;
{{/if}}

    // TODO: Implement your POST logic here
    const result = {
      message: 'Created {{../routeName}}',
      data,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST {{../routeName}} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

{{/if}}{{#if (eq this "PUT")}}/**
 * PUT /api/{{../kebabCase ../routeName}}
 * Update existing {{../routeName}}
 */
export async function PUT(request: NextRequest) {
  try {
{{#if ../withAuth}}    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

{{/if}}    // Parse request body
    const body = await request.json();
{{#if ../withValidation}}

    // Validate request
    const validation = {{../camelCase ../routeName}}Schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;
{{else}}
    const data = body;
{{/if}}

    // TODO: Implement your PUT logic here
    const result = {
      message: 'Updated {{../routeName}}',
      data,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('PUT {{../routeName}} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

{{/if}}{{#if (eq this "DELETE")}}/**
 * DELETE /api/{{../kebabCase ../routeName}}
 * Delete {{../routeName}}
 */
export async function DELETE(request: NextRequest) {
  try {
{{#if ../withAuth}}    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

{{/if}}    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    // TODO: Implement your DELETE logic here
    const result = {
      message: 'Deleted {{../routeName}}',
      id,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE {{../routeName}} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

{{/if}}{{/each}}{{/if}}`,
      language: 'typescript',
      optional: false,
    },
  ],

  examples: [
    '/scaffold "create API route for users"',
    '/scaffold "add posts API with auth"',
  ],
};
