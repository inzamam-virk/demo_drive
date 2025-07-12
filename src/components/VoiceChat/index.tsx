'use client';

import { useState, useRef, useEffect } from 'react';

interface VoiceChatProps {
  sessionId: string;
  isEnabled: boolean;
  onVoiceCommand: (command: string) => void;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function VoiceChat({ sessionId, isEnabled, onVoiceCommand }: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionAPI) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognitionAPI();
      
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(interimTranscript);

        if (finalTranscript) {
          onVoiceCommand(finalTranscript.trim());
          setTranscript('');
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onVoiceCommand]);

  const startListening = () => {
    if (recognitionRef.current && isSupported) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      // Use a more natural voice if available
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Neural') || voice.name.includes('Enhanced'))
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      speechSynthesis.speak(utterance);
    }
  };

  // Expose speak function to parent component
  useEffect(() => {
    (window as any).demoSpeak = speak;
    return () => {
      delete (window as any).demoSpeak;
    };
  }, []);

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
        <p className="text-yellow-800">
          Voice features are not supported in this browser. Please use Chrome, Edge, or Safari for the best experience.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border-t">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Voice Commands</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm text-gray-600">
              {isEnabled ? 'Ready' : 'Tour in progress...'}
            </span>
          </div>
        </div>

        {isEnabled && (
          <>
            <div className="flex items-center justify-center space-x-4 mb-4">
              <button
                onClick={isListening ? stopListening : startListening}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isListening
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isListening ? '🛑 Stop Listening' : '🎤 Start Voice Commands'}
              </button>
            </div>

            {isListening && (
              <div className="text-center">
                <div className="inline-flex items-center space-x-2 text-gray-600 mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Listening...</span>
                </div>
                {transcript && (
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <p className="text-gray-800 italic">"{transcript}"</p>
                  </div>
                )}
              </div>
            )}

            {isEnabled && !isListening && (
              <div className="text-center text-gray-600">
                <p className="mb-2">Try saying commands like:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Show me the contact page",
                    "Click on the about button", 
                    "Scroll down",
                    "Tell me about this feature",
                    "Go back to homepage"
                  ].map((example, index) => (
                    <span key={index} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                      "{example}"
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
