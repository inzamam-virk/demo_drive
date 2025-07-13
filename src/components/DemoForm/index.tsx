'use client';

import { useState } from 'react';

interface DemoFormProps {
  onStartDemo: (mainUrl: string, pageUrls: string[]) => void;
  isLoading: boolean;
}

export default function DemoForm({ onStartDemo, isLoading }: DemoFormProps) {
  const [mainUrl, setMainUrl] = useState('https://inzamamvirk.vercel.app/');
  const [pageUrls, setPageUrls] = useState<string[]>([
    'https://inzamamvirk.vercel.app/about',
    'https://inzamamvirk.vercel.app/articles',
    'https://inzamamvirk.vercel.app/projects'
  ]);
  const [newPageUrl, setNewPageUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mainUrl.trim() && pageUrls.length > 0) {
      onStartDemo(mainUrl.trim(), pageUrls.filter(url => url.trim()));
    }
  };

  const addPageUrl = () => {
    if (newPageUrl.trim() && !pageUrls.includes(newPageUrl.trim())) {
      setPageUrls([...pageUrls, newPageUrl.trim()]);
      setNewPageUrl('');
    }
  };

  const removePageUrl = (index: number) => {
    setPageUrls(pageUrls.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          AI Demo Platform
        </h1>
        <p className="text-lg text-gray-600">
          Enter a website URL and let our AI guide you through an interactive demo
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="mainUrl" className="block text-sm font-medium text-black mb-2">
            Main Website URL
          </label>
          <input
            type="url"
            id="mainUrl"
            value={mainUrl}
            onChange={(e) => setMainUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-4 py-3 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-black">
            Pages to Demo ({pageUrls.length} pages)
          </label>

          
          {/* Add new page URL */}
          <div className="flex gap-2 mb-3">
            <input
              type="url"
              value={newPageUrl}
              onChange={(e) => setNewPageUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={addPageUrl}
              disabled={isLoading || !newPageUrl.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {/* Page URLs list */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {pageUrls.map((pageUrl, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="flex-1 text-sm truncate text-black">{pageUrl}</span>
                <button
                  type="button"
                  onClick={() => removePageUrl(index)}
                  disabled={isLoading}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !mainUrl.trim() || pageUrls.length === 0}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Starting Demo...' : `Start Demo (${pageUrls.length} pages)`}
        </button>
      </form>

      {isLoading && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Initializing browser session...</span>
          </div>
        </div>
      )}
    </div>
  );
}
