'use client';

import { useState } from 'react';
import DemoForm from '@/components/DemoForm';
import VideoStream from '@/components/VideoStream';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [mainUrl, setMainUrl] = useState<string>('');

  const handleStartDemo = async (mainUrl: string, pageUrls: string[]) => {
    setIsLoading(true);
    setPageUrls(pageUrls);
    setMainUrl(mainUrl);
    
    try {
      // Create session
      const sessionResponse = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainUrl, pageUrls }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }

      const { sessionId: newSessionId } = await sessionResponse.json();

      // Initialize browser
      const browserResponse = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: newSessionId, 
          action: 'init',
          url: mainUrl 
        }),
      });

      if (!browserResponse.ok) {
        throw new Error('Failed to initialize browser');
      }

      setSessionId(newSessionId);
    } catch (error) {
      console.error('Demo start error:', error);
      alert('Failed to start demo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndDemo = async () => {
    if (sessionId) {
      try {
        // Close browser session
        await fetch('/api/browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId, 
            action: 'close' 
          }),
        });

        // Delete session
        await fetch(`/api/session?sessionId=${sessionId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Demo end error:', error);
      }
    }
    
    setSessionId(null);
    setPageUrls([]);
    setMainUrl('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {!sessionId ? (
        <DemoForm onStartDemo={handleStartDemo} isLoading={isLoading} />
      ) : (
        <VideoStream sessionId={sessionId} pageUrls={pageUrls} mainUrl={mainUrl} onEndDemo={handleEndDemo} />
      )}
    </div>
  );
}
