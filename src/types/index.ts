export interface DemoSession {
  id: string;
  mainUrl: string;
  pageUrls: string[];
  currentPageIndex: number;
  status: 'initializing' | 'tour' | 'interactive' | 'ended';
  visitedPages: string[];
  createdAt: Date;
}

export interface BrowserAction {
  type: 'click' | 'scroll' | 'navigate' | 'highlight' | 'type';
  target?: string;
  value?: string;
  description: string;
}

export interface VoiceCommand {
  text: string;
  timestamp: Date;
  confidence: number;
}

export interface AIResponse {
  action: BrowserAction;
  narration: string;
}

export interface PageContent {
  url: string;
  title: string;
  headings: string[];
  buttons: Array<{ text: string; selector: string }>;
  links: Array<{ text: string; href: string; selector: string }>;
  forms: Array<{ inputs: string[]; action?: string }>;
  mainContent: string;
}

export interface TourStep {
  pageUrl: string;
  pageContent: PageContent;
  narrationText: string;
  actions: BrowserAction[];
}
