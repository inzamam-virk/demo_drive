import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { DemoSession } from '@/types';

// In-memory storage for demo purposes
const sessions = new Map<string, DemoSession>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mainUrl, pageUrls } = body;

    if (!mainUrl || !pageUrls || !Array.isArray(pageUrls) || pageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Main URL and page URLs are required' },
        { status: 400 }
      );
    }

    // Create new session
    const sessionId = uuidv4();
    const session: DemoSession = {
      id: sessionId,
      mainUrl,
      pageUrls,
      currentPageIndex: 0,
      status: 'initializing',
      visitedPages: [],
      createdAt: new Date(),
    };

    sessions.set(sessionId, session);

    return NextResponse.json({
      sessionId,
      session,
    });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ session });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  const deleted = sessions.delete(sessionId);
  if (!deleted) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
