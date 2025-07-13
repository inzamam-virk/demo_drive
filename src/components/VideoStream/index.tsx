'use client';

import { useEffect, useRef, useState } from 'react';
import VoiceChat from '@/components/VoiceChat';

interface VideoStreamProps {
  sessionId: string;
  pageUrls: string[];
  onEndDemo: () => void;
}

export default function VideoStream({ sessionId, pageUrls, onEndDemo }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tourStatus, setTourStatus] = useState<'starting' | 'running' | 'completed'>('starting');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);
  const [pageContexts, setPageContexts] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized && sessionId) {
      initializeTour();
    }
  }, [sessionId, isInitialized]);

  const initializeTour = async () => {
    try {
      console.log(`🎯 Initializing tour for session: ${sessionId}`);
      setIsInitialized(true);
      
      // Initialize tour
      await fetch('/api/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          action: 'start',
          pageUrls 
        }),
      });

      setIsConnected(true);
      console.log(`🎯 Tour API initialized, starting automated tour...`);
      startAutomatedTour();
    } catch (error) {
      console.error('Tour initialization error:', error);
      setIsInitialized(false);
    }
  };

  const startAutomatedTour = async () => {
    setTourStatus('running');
    console.log(`🎬 Starting automated tour for ${pageUrls.length} pages`);
    
    for (let i = 0; i < pageUrls.length; i++) {
      console.log(`📍 Tour progress: ${i + 1}/${pageUrls.length} - ${pageUrls[i]}`);
      setCurrentPageIndex(i);
      await tourPage(pageUrls[i]);
      
      // Wait between pages (only if not the last page)
      if (i < pageUrls.length - 1) {
        console.log(`⏸️ Waiting 2 seconds before next page...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`🎉 Tour completed! Total pages visited: ${pageUrls.length}`);
    setTourStatus('completed');
  };

  const tourPage = async (pageUrl: string) => {
    try {
      console.log(`🚀 Starting tour for page: ${pageUrl}`);
      
      // Navigate to page
      const navResponse = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          action: 'navigate',
          url: pageUrl 
        }),
      });

      if (!navResponse.ok) {
        throw new Error(`Navigation failed: ${navResponse.status}`);
      }

      console.log(`✅ Navigation completed for: ${pageUrl}`);

      // Wait for page load (shorter for same-page navigation)
      const isSamePage = pageUrl === pageUrls[0];
      const waitTime = isSamePage ? 1500 : 3000;
      console.log(`⏳ Waiting ${waitTime}ms for page to load...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Get page content
      const pageContentResponse = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          action: 'getPageContent'
        }),
      });

      if (!pageContentResponse.ok) {
        throw new Error(`Page content extraction failed: ${pageContentResponse.status}`);
      }

      const { pageContent } = await pageContentResponse.json();
      console.log(`📄 Page content extracted:`, { 
        title: pageContent.title, 
        headings: pageContent.headings.length,
        buttons: pageContent.buttons.length 
      });

      // Store page context for voice commands
      setPageContexts(prev => [...prev, pageContent]);

      // Generate narration
      const narrationResponse = await fetch('/api/tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          action: 'generateNarration',
          pageContent 
        }),
      });

      if (!narrationResponse.ok) {
        throw new Error(`Narration generation failed: ${narrationResponse.status}`);
      }

      const { narration } = await narrationResponse.json();
      console.log(`🎤 Generated narration: "${narration.substring(0, 100)}..."`);

      // Update screenshot first (before speaking)
      await updateScreenshot();

      // Speak narration
      setIsNarrating(true);
      console.log(`🔊 Starting speech synthesis...`);
      await speakText(narration);
      setIsNarrating(false);
      console.log(`✅ Speech synthesis completed for: ${pageUrl}`);

    } catch (error) {
      console.error(`❌ Page tour error for ${pageUrl}:`, error);
      setIsNarrating(false);
    }
  };

  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      console.log(`🔊 Attempting to speak: "${text.substring(0, 50)}..."`);
      
      if (!('speechSynthesis' in window)) {
        console.error(`❌ Speech synthesis not supported`);
        resolve();
        return;
      }

      // Wait for voices to load
      const initSpeech = () => {
        const voices = speechSynthesis.getVoices();
        console.log(`🎙️ Available voices: ${voices.length}`);
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        
        // Choose a good voice
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.localService
        );
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log(`🎤 Using voice: ${preferredVoice.name}`);
        }

        utterance.onstart = () => {
          console.log(`▶️ Speech started`);
        };

        utterance.onend = () => {
          console.log(`✅ Speech completed`);
          resolve();
        };

        utterance.onerror = (event) => {
          console.error(`❌ Speech error:`, event.error);
          resolve(); // Don't fail the whole process
        };

        console.log(`🎵 Starting speech synthesis...`);
        speechSynthesis.speak(utterance);
      };

      // Check if voices are already loaded
      if (speechSynthesis.getVoices().length > 0) {
        initSpeech();
      } else {
        // Wait for voices to load
        console.log(`⏳ Waiting for voices to load...`);
        speechSynthesis.onvoiceschanged = () => {
          console.log(`🔄 Voices loaded, initializing speech...`);
          initSpeech();
        };
        
        // Fallback timeout in case voices never load
        setTimeout(() => {
          console.log(`⏰ Voice loading timeout, trying anyway...`);
          initSpeech();
        }, 2000);
      }
    });
  };

  const updateScreenshot = async () => {
    try {
      const response = await fetch(`/api/browser?sessionId=${sessionId}`);
      const { screenshot: newScreenshot } = await response.json();
      setScreenshot(newScreenshot);
    } catch (error) {
      console.error('Screenshot update error:', error);
    }
  };

  const handleVoiceCommand = async (command: string) => {
    try {
      console.log(`🎙️ Voice command received: "${command}"`);
      console.log(`📋 Available page contexts: ${pageContexts.length} pages`);
      
      // Prepare comprehensive context for AI
      const allPageContext = {
        visitedPages: pageContexts,
        currentPageCount: pageContexts.length,
        pageUrls: pageUrls,
        tourCompleted: tourStatus === 'completed'
      };

      console.log(`🔄 Sending to AI with context:`, {
        command,
        pageCount: pageContexts.length,
        tourStatus
      });

      // Send command to AI for interpretation
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command,
          pageContext: allPageContext,
          mode: 'interactive',
          sessionId 
        }),
      });

      console.log(`📨 AI API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ AI API error: ${response.status} - ${errorText}`);
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`🤖 AI response data:`, data);
      
      const aiResponse = data.response;
      
      if (!aiResponse) {
        console.error(`❌ No AI response in data:`, data);
        throw new Error('No response from AI');
      }

      console.log(`✅ AI interpretation:`, {
        action: aiResponse.action,
        narration: aiResponse.narration?.substring(0, 100) + '...'
      });

      // Execute the action if available
      if (aiResponse.action && aiResponse.action.type) {
        console.log(`🎬 Executing browser action: ${aiResponse.action.type}`);
        
        const browserResponse = await fetch('/api/browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId,
            action: aiResponse.action.type,
            selector: aiResponse.action.target,
            text: aiResponse.action.value,
            url: aiResponse.action.url,
            direction: aiResponse.action.direction,
            amount: aiResponse.action.amount
          }),
        });

        console.log(`🔧 Browser action response: ${browserResponse.status}`);
        
        if (!browserResponse.ok) {
          console.error(`❌ Browser action failed: ${browserResponse.status}`);
        }
      }

      // Speak the response
      if (aiResponse.narration) {
        console.log(`🔊 Speaking AI response...`);
        await speakText(aiResponse.narration);
      } else {
        console.log(`🔊 Speaking fallback response...`);
        await speakText(`Command processed: ${command}`);
      }

      // Update screenshot
      console.log(`📸 Updating screenshot...`);
      await updateScreenshot();

    } catch (error) {
      console.error(`❌ Voice command error for "${command}":`, error);
      await speakText('Sorry, I had trouble processing that command. Please try again.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium text-gray-900">
                {tourStatus === 'starting' && 'Initializing...'}
                {tourStatus === 'running' && `Tour Running (${currentPageIndex + 1}/${pageUrls.length})`}
                {tourStatus === 'completed' && 'Tour Completed'}
              </span>
              {isNarrating && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Speaking...</span>
                </div>
              )}
            </div>
            <button
              onClick={onEndDemo}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              End Demo
            </button>
          </div>
        </div>

        {/* Browser View */}
        <div className="relative bg-gray-100 min-h-96">
          {screenshot ? (
            <img
              src={screenshot}
              alt="Browser screenshot"
              className="w-full h-auto max-h-96 object-contain mx-auto"
            />
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {tourStatus === 'starting' && 'Loading browser...'}
                  {tourStatus === 'running' && 'Navigating to page...'}
                  {tourStatus === 'completed' && 'Tour completed!'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tour Progress */}
        {tourStatus === 'running' && (
          <div className="px-6 py-3 bg-blue-50 border-b">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                Current: {pageUrls[currentPageIndex]}
              </span>
              <div className="flex-1 mx-4">
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentPageIndex + 1) / pageUrls.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm text-blue-700">
                {currentPageIndex + 1} / {pageUrls.length}
              </span>
            </div>
          </div>
        )}

        {/* Voice Chat Component */}
        <VoiceChat
          sessionId={sessionId}
          isEnabled={tourStatus === 'completed'}
          onVoiceCommand={handleVoiceCommand}
        />

        {/* Debug Speech Button */}
        <div className="p-4 bg-gray-100 border-t">
          <div className="text-center">
            <button
              onClick={() => speakText('Testing speech synthesis. This is a test message to verify that speech is working correctly.')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              🔊 Test Speech
            </button>
            <span className="ml-4 text-sm text-gray-600">
              Debug: Click to test speech synthesis
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
