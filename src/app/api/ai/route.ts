import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { command, pageContext, mode = 'interactive' } = body;

    console.log(`🤖 AI API called:`, {
      mode,
      command: command?.substring(0, 100),
      hasPageContext: !!pageContext,
      pageCount: pageContext?.visitedPages?.length || 0
    });

    // Check if API key is available
    if (!process.env.GROQ_API_KEY) {
      console.log(`⚠️ No API key available, using fallback response`);
      
      // Return a fallback response without using the API
      const fallbackResponse = {
        action: {
          type: 'highlight',
          description: mode === 'interactive' ? `Execute command: ${command}` : 'Continue tour',
        },
        narration: mode === 'interactive' 
          ? `I understand you want to: ${command}. Let me help you with that.`
          : 'Welcome to this page. Here you can explore the features and content available.',
      };

      console.log(`✅ Returning fallback response:`, fallbackResponse);

      return NextResponse.json({
        success: true,
        response: fallbackResponse,
        raw: 'API key not configured - using fallback response',
      });
    }

    if (!command && mode === 'interactive') {
      return NextResponse.json(
        { error: 'Command is required for interactive mode' },
        { status: 400 }
      );
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (mode === 'tour') {
      // Automated tour mode
      systemPrompt = `You are an AI demo assistant conducting an automated tour of a website. 
      Based on the page context provided, generate the next logical action and narration for the tour. Spend max 30 seconds on a page and summarize it in this time period. 
      
      Return a JSON response with:
      - action: object with type, target (if applicable), and description
      - narration: what to say about this action
      
      Available actions: click, scroll, navigate, highlight, type
      Focus on key features, navigation elements, and important content areas.`;

      userPrompt = `Current page context: ${JSON.stringify(pageContext)}
      
      Generate the next tour step that showcases important features or content on this page.`;

    } else {
      // Interactive mode
      systemPrompt = `You are an AI demo assistant helping users interact with a website through voice commands.
      Interpret the user's command and convert it into a specific browser action.
      
      Return a JSON response with:
      - action: object with type, target (CSS selector if needed), value (for typing), and description
      - narration: what to say to confirm or explain the action
      
      Available actions:
      - click: Click on an element (needs CSS selector)
      - scroll: Scroll the page (up/down/amount)
      - navigate: Go to a specific page/URL
      - type: Type text into a field (needs selector and text)
      - highlight: Highlight an element for explanation
      
      If you can't determine the exact CSS selector, provide a general description and suggest the user be more specific.`;

      const contextSummary = pageContext?.visitedPages ? 
        `Visited pages: ${pageContext.visitedPages.map((p: any) => `${p.title} (${p.url})`).join(', ')}` :
        'No page context available';

      userPrompt = `User command: "${command}"
      
      Demo Context:
      - Tour completed: ${pageContext?.tourCompleted || false}
      - Pages visited: ${pageContext?.currentPageCount || 0}
      - ${contextSummary}
      
      Current page context: ${JSON.stringify(pageContext?.visitedPages?.[pageContext?.visitedPages?.length - 1] || {})}
      
      Convert this command into a browser action or provide an informative response.`;
    }

    console.log(`🔄 Sending request to Groq with model: llama3-8b-8192`);

    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 500,
    });

    console.log(`✅ Received response from Groq`);

    const aiResponse = response.choices[0]?.message?.content;
    
    if (!aiResponse) {
      console.error(`❌ No content in Groq response`);
      throw new Error('No response from AI');
    }

    console.log(`📄 Raw AI response: "${aiResponse.substring(0, 200)}..."`);

    // Try to parse as JSON, fallback to text response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
      console.log(`✅ Successfully parsed JSON response:`, {
        actionType: parsedResponse.action?.type,
        hasNarration: !!parsedResponse.narration
      });
    } catch (parseError) {
      console.log(`⚠️ JSON parsing failed, using fallback response`);
      // If JSON parsing fails, create a basic response
      parsedResponse = {
        action: {
          type: 'highlight',
          description: 'Unable to parse command clearly',
        },
        narration: aiResponse,
      };
    }

    console.log(`🎉 Returning final response:`, {
      success: true,
      actionType: parsedResponse.action?.type,
      narrationLength: parsedResponse.narration?.length || 0
    });

    return NextResponse.json({
      success: true,
      response: parsedResponse,
      raw: aiResponse,
    });

  } catch (error) {
    console.error('AI processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Generate tour script for a specific website
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    const systemPrompt = `You are an AI demo script generator. Create a comprehensive tour script for the given website URL.
    
    Return a JSON array of tour steps, each with:
    - action: the browser action to take
    - narration: what to say during this step
    - duration: approximate time for this step in seconds
    
    Focus on:
    1. Homepage overview
    2. Key features and navigation
    3. Important sections or pages
    4. Call-to-action elements
    
    Make it engaging and informative for potential users.`;

    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a demo tour script for: ${url}` },
      ],
      model: 'llama3-8b-8192',
      temperature: 0.5,
      max_tokens: 1000,
    });

    const scriptContent = response.choices[0]?.message?.content;
    
    let tourScript;
    try {
      tourScript = JSON.parse(scriptContent || '[]');
    } catch {
      // Fallback basic script
      tourScript = [
        {
          action: { type: 'navigate', target: url, description: 'Load homepage' },
          narration: `Welcome to the demo of ${url}. Let's explore the key features of this website.`,
          duration: 3,
        },
        {
          action: { type: 'scroll', description: 'Scroll through homepage' },
          narration: 'Here you can see the main content and layout of the homepage.',
          duration: 5,
        },
      ];
    }

    return NextResponse.json({
      success: true,
      tourScript,
      url,
    });

  } catch (error) {
    console.error('Tour script generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate tour script' },
      { status: 500 }
    );
  }
}
