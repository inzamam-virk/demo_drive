import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser, Page } from 'puppeteer';
import { BrowserAction, PageContent } from '@/types';

// Store browser instances and pages
const browserInstances = new Map<string, { browser: Browser; page: Page }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, url } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    let browserData = browserInstances.get(sessionId);

    // Initialize browser if not exists
    if (!browserData && action === 'init') {
      const browser = await puppeteer.launch({
        headless: false, // Set to true for production
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      
      if (url) {
        await page.goto(url, { waitUntil: 'networkidle0' });
      }

      browserData = { browser, page };
      browserInstances.set(sessionId, browserData);

      return NextResponse.json({
        success: true,
        message: 'Browser initialized',
        url: page.url(),
      });
    }

    if (!browserData) {
      return NextResponse.json(
        { error: 'Browser not initialized' },
        { status: 400 }
      );
    }

    const { page } = browserData;

    // Handle different browser actions
    switch (action) {
      case 'navigate':
        if (url) {
          await page.goto(url, { waitUntil: 'networkidle0' });
        }
        break;

      case 'click':
        const { selector } = body;
        if (selector) {
          await page.click(selector);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for potential animations
        }
        break;

      case 'scroll':
        const { direction = 'down', amount = 300 } = body;
        await page.evaluate((scrollAmount, scrollDirection) => {
          window.scrollBy(0, scrollDirection === 'down' ? scrollAmount : -scrollAmount);
        }, amount, direction);
        break;

      case 'type':
        const { text, targetSelector } = body;
        if (targetSelector && text) {
          await page.type(targetSelector, text);
        }
        break;

      case 'screenshot':
        const screenshot = await page.screenshot({ 
          encoding: 'base64',
          fullPage: false 
        });
        return NextResponse.json({
          success: true,
          screenshot: `data:image/png;base64,${screenshot}`,
        });

      case 'getPageContent':
        const title = await page.title();
        const currentUrl = page.url();
        const pageContent = await page.evaluate(() => {
          // Extract comprehensive page content
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(el => el.textContent?.trim()).filter(Boolean);
          
          const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], .btn')).map(el => ({
            text: el.textContent?.trim() || (el as HTMLInputElement).value || 'Button',
            selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className.split(' ')[0]}` : '')
          }));

          const links = Array.from(document.querySelectorAll('a[href]')).map(el => ({
            text: el.textContent?.trim() || 'Link',
            href: (el as HTMLAnchorElement).href,
            selector: 'a[href="' + (el as HTMLAnchorElement).getAttribute('href') + '"]'
          })).filter(link => link.text && link.text.length > 0 && link.text.length < 100);

          const forms = Array.from(document.querySelectorAll('form')).map(form => ({
            inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => 
              (input as HTMLInputElement).placeholder || (input as HTMLInputElement).name || input.tagName.toLowerCase()
            ),
            action: (form as HTMLFormElement).action || undefined
          }));

          const mainContent = Array.from(document.querySelectorAll('p, li, span')).slice(0, 10)
            .map(el => el.textContent?.trim()).filter(Boolean).join(' ').substring(0, 500);

          return { headings, buttons, links, forms, mainContent };
        });

        const fullPageContent: PageContent = {
          url: currentUrl,
          title,
          headings: pageContent.headings,
          buttons: pageContent.buttons,
          links: pageContent.links,
          forms: pageContent.forms,
          mainContent: pageContent.mainContent
        };

        return NextResponse.json({
          success: true,
          pageContent: fullPageContent,
        });

      case 'close':
        if (browserData.browser) {
          await browserData.browser.close();
          browserInstances.delete(sessionId);
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      currentUrl: page.url(),
    });

  } catch (error) {
    console.error('Browser action error:', error);
    return NextResponse.json(
      { error: 'Browser action failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId || !browserInstances.has(sessionId)) {
    return NextResponse.json(
      { error: 'Browser session not found' },
      { status: 404 }
    );
  }

  const { page } = browserInstances.get(sessionId)!;
  
  try {
    const screenshot = await page.screenshot({ 
      encoding: 'base64',
      fullPage: false 
    });

    return NextResponse.json({
      success: true,
      screenshot: `data:image/png;base64,${screenshot}`,
      url: page.url(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to capture screenshot' },
      { status: 500 }
    );
  }
}
