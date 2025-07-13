import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { PageContent, TourStep } from '@/types';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Session memory storage for tour progress
const tourMemory = new Map<string, {
  pages: string[];
  currentIndex: number;
  visitedPages: PageContent[];
  tourSteps: TourStep[];
}>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, pageContent, pageUrls } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start':
        // Initialize tour for session
        if (!pageUrls || !Array.isArray(pageUrls)) {
          return NextResponse.json(
            { error: 'Page URLs are required to start tour' },
            { status: 400 }
          );
        }

        tourMemory.set(sessionId, {
          pages: pageUrls,
          currentIndex: 0,
          visitedPages: [],
          tourSteps: []
        });

        return NextResponse.json({
          success: true,
          message: 'Tour initialized',
          totalPages: pageUrls.length,
          currentPage: pageUrls[0]
        });

      case 'generateNarration':
        // Generate narration for current page
        if (!pageContent) {
          return NextResponse.json(
            { error: 'Page content is required for narration' },
            { status: 400 }
          );
        }

        const memory = tourMemory.get(sessionId);
        if (!memory) {
          return NextResponse.json(
            { error: 'Tour not initialized' },
            { status: 400 }
          );
        }

        // Generate narration using LLM
        const narration = await generatePageNarration(pageContent, memory.visitedPages);
        
        // Update memory
        memory.visitedPages.push(pageContent);
        const tourStep: TourStep = {
          pageUrl: pageContent.url,
          pageContent,
          narrationText: narration,
          actions: []
        };
        memory.tourSteps.push(tourStep);

        return NextResponse.json({
          success: true,
          narration,
          tourStep,
          pageIndex: memory.currentIndex,
          totalPages: memory.pages.length
        });

      case 'nextPage':
        const sessionMemory = tourMemory.get(sessionId);
        if (!sessionMemory) {
          return NextResponse.json(
            { error: 'Tour not initialized' },
            { status: 400 }
          );
        }

        sessionMemory.currentIndex++;
        const hasNextPage = sessionMemory.currentIndex < sessionMemory.pages.length;
        const nextPageUrl = hasNextPage ? sessionMemory.pages[sessionMemory.currentIndex] : null;

        return NextResponse.json({
          success: true,
          hasNextPage,
          nextPageUrl,
          currentIndex: sessionMemory.currentIndex,
          totalPages: sessionMemory.pages.length,
          tourComplete: !hasNextPage
        });

      case 'getProgress':
        const progress = tourMemory.get(sessionId);
        if (!progress) {
          return NextResponse.json(
            { error: 'Tour not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          currentIndex: progress.currentIndex,
          totalPages: progress.pages.length,
          visitedPages: progress.visitedPages.length,
          tourSteps: progress.tourSteps
        });

      case 'end':
        tourMemory.delete(sessionId);
        return NextResponse.json({
          success: true,
          message: 'Tour ended'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Tour API error:', error);
    return NextResponse.json(
      { error: 'Tour operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function generatePageNarration(pageContent: PageContent, visitedPages: PageContent[]): Promise<string> {
  try {
    console.log('process.env.GROQ_API_KEY: ', process.env.GROQ_API_KEY)
    // Check if API key is available
    if (!process.env.GROQ_API_KEY) {
      // Generate a simple fallback narration
      const contextText = visitedPages.length > 0 
        ? ` We've already visited ${visitedPages.length} page${visitedPages.length > 1 ? 's' : ''}.`
        : ' This is our first page.';
      
      const featuresText = pageContent.headings.length > 0 
        ? ` The main sections include: ${pageContent.headings.slice(0, 3).join(', ')}.`
        : '';
      
      const interactiveText = pageContent.buttons.length > 0 
        ? ` There are ${pageContent.buttons.length} interactive elements you can use.`
        : '';
      
      return `Welcome to ${pageContent.title}.${contextText}${featuresText}${interactiveText} Feel free to explore the features on this page.`;
    }

    const contextSummary = visitedPages.length > 0 
      ? `Previously visited: ${visitedPages.map(p => p.title).join(', ')}`
      : 'This is the first page of the demo.';

    const systemPrompt = `You are an AI demo narrator providing engaging, informative commentary about website pages during an automated tour.

Guidelines:
- Speak in a conversational, professional tone
- Highlight key features, navigation, and content areas
- Keep narration concise but informative (30-60 seconds when spoken)
- Mention important buttons, forms, and interactive elements
- Don't repeat information from previously visited pages
- Focus on what makes this page unique and valuable

Context: ${contextSummary}`;

    const userPrompt = `Create engaging narration for this page:

Title: ${pageContent.title}
URL: ${pageContent.url}

Key headings: ${pageContent.headings.join(', ')}
Interactive elements: ${pageContent.buttons.map(b => b.text).join(', ')}
Main content preview: ${pageContent.mainContent}
Forms available: ${pageContent.forms.length > 0 ? 'Yes' : 'No'}
Navigation links: ${pageContent.links.slice(0, 5).map(l => l.text).join(', ')}

Generate natural, engaging narration that explains what users can see and do on this page.`;

    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama3-8b-8192',
      temperature: 0.7,
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || 
           `Welcome to ${pageContent.title}. This page features ${pageContent.headings.join(', ')} and provides ${pageContent.buttons.length} interactive elements for user engagement.`;

  } catch (error) {
    console.error('Narration generation error:', error);
    return `Welcome to ${pageContent.title}. This page contains various features and content for users to explore.`;
  }
}
