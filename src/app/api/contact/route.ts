import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
// import prisma from '@/app/lib/db'; // Uncomment when ContactSubmission model is added

// Validation schema
const contactSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = contactSchema.parse(body);

    // Store contact submission in database (you can create a ContactSubmission model)
    // For now, we'll just log it and return success
    console.log('Contact form submission:', {
      fullName: validatedData.fullName,
      email: validatedData.email,
      message: validatedData.message,
      submittedAt: new Date()
    });

    // TODO: Send email notification
    // TODO: Store in database if ContactSubmission model exists

    // Optional: Store in a generic table or log
    try {
      // You can add a ContactSubmission model to your Prisma schema later
      // await prisma.contactSubmission.create({
      //   data: {
      //     fullName: validatedData.fullName,
      //     email: validatedData.email,
      //     message: validatedData.message
      //   }
      // });
    } catch (dbError) {
      console.error('Database error (non-critical):', dbError);
      // Continue even if DB storage fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for contacting us! We will get back to you soon.'
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation error',
          errors: error.issues
        },
        { status: 400 }
      );
    }

    console.error('Contact form error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}
