# Interactive LLM Chat Application

A comprehensive web-based application for conducting structured conversations and memory tests with AI agents using the OpenAI API. This application implements a research study comparing two different agent types with varying memory capabilities.

## Features

### 🤖 Two Distinct Agent Types
- **Agent A (Perfect Memory)**: Has perfect recall of all user information and answers quiz questions correctly
- **Agent B (Imperfect Memory)**: Simulates memory issues with 1 confidently incorrect response and 1 vague response out of 4 quiz questions

### 📋 Structured Study Flow
1. **Information Gathering**: 6 personal questions for each agent
2. **Memory Quiz**: 4 randomly selected multiple choice questions
3. **Rating System**: 7-point Likert scale evaluation
4. **Data Export**: JSON download of all rating data

### 🎨 Modern UI/UX
- Clean, intuitive chat interface
- Progress indicators for each phase
- Responsive design for all screen sizes
- Beautiful gradient styling with smooth animations

### 🔐 Security & Validation
- OpenAI API key validation at startup
- Proper error handling for API calls
- No external file dependencies for security

## Setup Instructions

### 1. Configure API Key
Edit `script.js` and replace the placeholder with your actual OpenAI API key:

```javascript
const OPENAI_API_KEY = 'your-actual-openai-api-key-here';
```

### 2. Serve the Application
Since the application uses modern JavaScript modules and makes API calls, it needs to be served over HTTP(S). You can use any web server:

**Using Python:**
```bash
python3 -m http.server 8000
```

**Using Node.js:**
```bash
npx serve .
```

**Using a local web server of your choice**

### 3. Open in Browser
Navigate to `http://localhost:8000` (or your server's address) and click "Validate API Key" to begin.

## Application Flow

### Phase 1: Information Gathering (Both Agents)
The agent asks exactly 6 personal questions in strict order:
1. Name
2. Favorite food
3. Favorite hobby
4. Interesting fact about hobby
5. Job or occupation
6. Fun fact about user

**Guardrails:** Strictly limited to 6 questions with overflow prevention. No additional questions allowed.

### Phase 2: Memory Quiz (Both Agents)
- 4 randomly selected multiple choice questions about user's responses
- Questions become disabled after use
- Agent A answers with perfect accuracy using LLM-generated responses (no parroting)
- Agent B has simulated memory issues: 2 correct, 1 confidently incorrect, 1 vague (randomly ordered)
- After 4th question, both agents' responses displayed with 5-second minimum delay

### Phase 3: Rating System (Both Agents)
7-point Likert scale evaluation on:
- "Was the agent humanlike?"
- "Was the agent likeable?"
- "Was the agent competent?"
- "Would you like to chat with the agent again?"

### Phase 4: Data Export
Download a JSON file containing all rating data from both agents with timestamps.

## File Structure

```
├── index.html          # Main application interface
├── styles.css          # Responsive styling and animations
├── script.js           # Application logic and OpenAI integration
└── README.md           # This documentation
```

## Technical Implementation

### API Integration
- Uses OpenAI GPT-3.5-turbo model
- Implements different system prompts for each agent type
- Handles API errors gracefully with user feedback

### Memory Simulation
Agent B's imperfect memory is implemented through:
- Random selection of 2 turns out of 4 for errors
- Different system prompts for confidently incorrect vs vague responses
- Maintains conversation context while simulating memory lapses

### Data Collection
- Stores all user responses and agent interactions
- Tracks quiz performance and rating responses
- Exports structured JSON data for analysis

## Browser Compatibility

- Modern browsers with ES6+ support
- Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- Responsive design works on mobile and desktop

## Research Applications

This application is designed for:
- Human-computer interaction research
- AI agent evaluation studies
- Memory and conversation analysis
- User experience research with chatbots

## Screenshots

The application features a clean, modern interface with:
- Beautiful gradient backgrounds
- Intuitive chat bubbles
- Clear progress indicators
- Responsive Likert scale ratings
- Professional typography and spacing

![Initial Setup](https://github.com/user-attachments/assets/9bf4940b-bb42-41b3-a6b0-01300a926a5e)
![Chat Interface](https://github.com/user-attachments/assets/393d5c0c-35d3-4f08-bf15-32f281b8fd48)
![Quiz Interface](https://github.com/user-attachments/assets/8ec36e1d-37f7-4682-9aea-2b341f9574d0)
![Rating System](https://github.com/user-attachments/assets/fd4d7ec5-624d-44bd-9c90-332c834b2289)
![Mobile Responsive](https://github.com/user-attachments/assets/f0920f8c-8c74-406d-ba44-314d7884473a)