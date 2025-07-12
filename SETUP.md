# AI Demo Platform Setup

## Environment Variables

To use the full AI capabilities, you need to set up your API keys in the `.env.local` file:

```bash
# Copy the provided GROQ API key
GROQ_API_KEY=your_groq_api_key_here

# Optional: Tavily API key if needed for web search features
TAVILY_API_KEY=your_tavily_api_key_here
```

## API Key Setup

1. **Groq API Key**: 
   - Visit https://console.groq.com/
   - Create an account and generate an API key
   - Add it to your `.env.local` file

2. **Without API Keys**:
   - The platform will work with fallback responses
   - Basic narration and command interpretation will still function
   - Voice recognition and text-to-speech will work normally

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000 in your browser

## Features

### With API Keys:
- AI-powered page narration
- Intelligent voice command interpretation
- Dynamic content-aware responses

### Without API Keys (Fallback Mode):
- Basic page narration based on content structure
- Simple command interpretation
- Full voice recognition and speech synthesis
- Complete browser automation

## Troubleshooting

- **401 API Key Error**: Check that your GROQ_API_KEY is correctly set in `.env.local`
- **TypeError on voice commands**: Fixed with improved error handling
- **Browser not opening**: Make sure Puppeteer can access your system's Chrome installation
