'use client';

import { useEffect, useRef, useState } from 'react';
import VoiceChat from '@/components/VoiceChat';

interface VideoStreamProps {
  sessionId: string;
  pageUrls: string[];
  mainUrl: string;
  onEndDemo: () => void;
}

export default function VideoStream({ sessionId, pageUrls, mainUrl, onEndDemo }: VideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tourStatus, setTourStatus] = useState<'starting' | 'running' | 'completed'>('starting');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);

  useEffect(() => {
    initializeTour();
  }, [sessionId]);

  const initializeTour = async () => {
    try {
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
      startAutomatedTour();
    } catch (error) {
      console.error('Tour initialization error:', error);
    }
  };

  const startAutomatedTour = async () => {
    setTourStatus('running');
    
    for (let i = 0; i < pageUrls.length; i++) {
      setCurrentPageIndex(i);
      await tourPage(pageUrls[i], i === 0);
      
      // Wait between pages
      if (i < pageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setTourStatus('completed');
  };

  const tourPage = async (pageUrl: string, isFirstPage: boolean = false) => {
    try {
      // Only navigate if it's not the first page or if the URL is different from mainUrl
      const needsNavigation = !isFirstPage || pageUrl !== mainUrl;
      
      if (needsNavigation) {
        // Navigate to page
        await fetch('/api/browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId, 
            action: 'navigate',
            url: pageUrl 
          }),
        });

        // Wait for page load
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // If it's the first page and same as mainUrl, just wait a bit for any loading to finish
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get page content
      const pageContentResponse = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          action: 'getPageContent'
        }),
      });

      const { pageContent } = await pageContentResponse.json();

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

      const { narration } = await narrationResponse.json();

      // Speak narration
      setIsNarrating(true);
      await speakText(narration);
      setIsNarrating(false);

      // Update screenshot
      updateScreenshot();

    } catch (error) {
      console.error('Page tour error:', error);
    }
  };

  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        utterance.onend = () => resolve();
        speechSynthesis.speak(utterance);
      } else {
        resolve();
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
      // Send command to AI for interpretation
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command,
          mode: 'interactive',
          sessionId 
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.response;
      
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      // Execute the action if available
      if (aiResponse.action && aiResponse.action.type) {
        await fetch('/api/browser', {
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
      }

      // Speak the response
      if (aiResponse.narration) {
        await speakText(aiResponse.narration);
      } else {
        await speakText(`Command processed: ${command}`);
      }

      // Update screenshot
      updateScreenshot();

    } catch (error) {
      console.error('Voice command error:', error);
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
      </div>
    </div>
  );
}
