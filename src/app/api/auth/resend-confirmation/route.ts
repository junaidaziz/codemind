import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '../../../lib/supabase';
import { z } from 'zod';

const ResendEmailSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = ResendEmailSchema.parse(body);

    const supabase = createServerClient();

    // First, try to resend the confirmation email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://codemind-delta.vercel.app'}/auth/callback`,
      },
    });

    if (error) {
      console.error('Resend confirmation error:', error);
      
      // If the error is about the user already being confirmed, that's actually good
      if (error.message.includes('already confirmed') || error.message.includes('email_confirmed_at')) {
        return NextResponse.json({
          success: true,
          message: 'Email is already confirmed. You can sign in now.',
        });
      }

      // If rate limited, provide helpful message
      if (error.message.includes('rate limit') || error.message.includes('too many')) {
        return NextResponse.json({
          success: false,
          error: 'Please wait a few minutes before requesting another confirmation email.',
        }, { status: 429 });
      }

      return NextResponse.json({
        success: false,
        error: error.message || 'Failed to resend confirmation email',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent successfully. Please check your inbox.',
    });

  } catch (error) {
    console.error('Resend confirmation API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid email format',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}