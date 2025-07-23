// OpenAI API Configuration
// IMPORTANT: Replace 'your-openai-api-key-here' with your actual OpenAI API key
const OPENAI_API_KEY = 'your-openai-api-key-here';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Application state
class ChatApp {
    constructor() {
        this.currentPhase = 'setup'; // setup, info-gathering, quiz, rating, final
        this.currentAgent = 'A'; // A or B
        this.userInfo = {};
        this.chatHistory = [];
        this.currentQuestionIndex = 0;
        this.quizQuestions = [];
        this.quizAnswers = [];
        this.usedQuizQuestions = new Set();
        this.ratings = { agentA: {}, agentB: {} };
        this.agentBErrorTurns = new Set(); // For imperfect memory simulation
        
        // Question templates for information gathering
        this.infoQuestions = [
            "Hi there! I'd love to get to know you better. What's your name?",
            "That's a nice name! What's your favorite food?",
            "Interesting choice! What's one of your hobbies?",
            "That sounds fun! Can you tell me an interesting fact about that hobby?",
            "Fascinating! What's your job or occupation?",
            "Great! Finally, can you share an interesting fact about yourself?"
        ];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateProgress(0, 'Ready to start');
    }
    
    setupEventListeners() {
        // API key validation
        document.getElementById('validateApiKey').addEventListener('click', () => this.validateApiKey());
        
        // Chat input
        document.getElementById('sendButton').addEventListener('click', () => this.sendMessage());
        document.getElementById('userInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Rating submission
        document.getElementById('submitRating').addEventListener('click', () => this.submitRating());
        
        // Data download
        document.getElementById('downloadData').addEventListener('click', () => this.downloadData());
    }
    
    async validateApiKey() {
        if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
            this.showError('Please update the OPENAI_API_KEY variable in script.js with your actual API key.');
            return;
        }
        
        try {
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 5
                })
            });
            
            if (response.ok) {
                this.hideError();
                this.startApplication();
            } else {
                const error = await response.json();
                this.showError(`API key validation failed: ${error.error?.message || 'Unknown error'}`);
            }
        } catch (error) {
            this.showError(`Network error: ${error.message}`);
        }
    }
    
    startApplication() {
        document.getElementById('apiKeySection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        this.currentPhase = 'info-gathering';
        this.currentAgent = 'A';
        this.updateProgress(5, 'Starting conversation with Agent A');
        this.updateAgentInfo('Agent A - Perfect Memory', 'Information Gathering Phase');
        this.enableChatInput();
        this.startInfoGathering();
    }
    
    async startInfoGathering() {
        const message = this.infoQuestions[this.currentQuestionIndex];
        await this.addAgentMessage(message);
    }
    
    async sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to chat
        this.addUserMessage(message);
        input.value = '';
        this.disableChatInput();
        
        // Store user response
        if (this.currentPhase === 'info-gathering') {
            this.storeUserInfo(message);
        }
        
        // Generate agent response
        await this.generateAgentResponse(message);
    }
    
    storeUserInfo(message) {
        const questions = ['name', 'favoriteFood', 'hobby', 'hobbyFact', 'job', 'interestingFact'];
        if (this.currentQuestionIndex < questions.length) {
            this.userInfo[questions[this.currentQuestionIndex]] = message;
        }
    }
    
    async generateAgentResponse(userMessage) {
        try {
            let systemPrompt = this.getSystemPrompt();
            let messages = [
                { role: 'system', content: systemPrompt },
                ...this.chatHistory,
                { role: 'user', content: userMessage }
            ];
            
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: messages,
                    max_tokens: 200,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            const data = await response.json();
            const agentMessage = data.choices[0].message.content;
            
            await this.addAgentMessage(agentMessage);
            this.handlePhaseProgression();
            
        } catch (error) {
            await this.addAgentMessage('I apologize, but I encountered an error. Please try again.');
            console.error('Error generating response:', error);
        }
        
        this.enableChatInput();
    }
    
    getSystemPrompt() {
        let basePrompt = '';
        
        if (this.currentPhase === 'info-gathering') {
            basePrompt = `You are a friendly conversational agent conducting an information gathering session. Ask personal questions naturally and show interest in the user's responses. Keep responses brief and engaging.`;
        } else if (this.currentPhase === 'quiz') {
            if (this.currentAgent === 'A') {
                basePrompt = `You are Agent A with perfect memory. You remember everything the user told you. Answer quiz questions accurately based on this information: ${JSON.stringify(this.userInfo)}`;
            } else {
                // Agent B with potential memory issues
                const currentTurn = this.quizAnswers.length;
                if (this.agentBErrorTurns.has(currentTurn)) {
                    if (currentTurn === Array.from(this.agentBErrorTurns)[0]) {
                        basePrompt = `You are Agent B with imperfect memory. For this question, be confidently incorrect about the user's information. Give a wrong answer with confidence.`;
                    } else {
                        basePrompt = `You are Agent B with imperfect memory. For this question, be vague and uncertain about the user's information. Show uncertainty and provide vague responses.`;
                    }
                } else {
                    basePrompt = `You are Agent B with generally good memory. Answer this question correctly based on: ${JSON.stringify(this.userInfo)}`;
                }
            }
        }
        
        return basePrompt;
    }
    
    handlePhaseProgression() {
        if (this.currentPhase === 'info-gathering') {
            this.currentQuestionIndex++;
            
            if (this.currentQuestionIndex < this.infoQuestions.length) {
                // Continue with next question
                setTimeout(() => {
                    this.askNextQuestion();
                }, 1000);
            } else {
                // Move to quiz phase
                this.startQuizPhase();
            }
        } else if (this.currentPhase === 'quiz') {
            // Quiz responses are handled differently
        }
    }
    
    async askNextQuestion() {
        if (this.currentQuestionIndex < this.infoQuestions.length) {
            const message = this.infoQuestions[this.currentQuestionIndex];
            await this.addAgentMessage(message);
        }
    }
    
    startQuizPhase() {
        this.currentPhase = 'quiz';
        this.updateAgentInfo(
            `Agent ${this.currentAgent} - ${this.currentAgent === 'A' ? 'Perfect' : 'Imperfect'} Memory`, 
            'Memory Quiz Phase'
        );
        
        // Generate Agent B error turns if this is Agent B
        if (this.currentAgent === 'B') {
            this.generateAgentBErrorTurns();
        }
        
        this.generateQuizQuestions();
        this.showQuizSection();
        
        const progress = this.currentAgent === 'A' ? 25 : 65;
        this.updateProgress(progress, `Memory quiz with Agent ${this.currentAgent}`);
    }
    
    generateAgentBErrorTurns() {
        // Randomly select 2 turns out of 4 for errors (1 confident incorrect, 1 vague)
        const turns = [0, 1, 2, 3];
        const shuffled = turns.sort(() => 0.5 - Math.random());
        this.agentBErrorTurns = new Set([shuffled[0], shuffled[1]]);
    }
    
    generateQuizQuestions() {
        const questionTemplates = [
            { question: "What was my name?", answer: this.userInfo.name, key: 'name' },
            { question: "What was my favorite food?", answer: this.userInfo.favoriteFood, key: 'favoriteFood' },
            { question: "What was my hobby?", answer: this.userInfo.hobby, key: 'hobby' },
            { question: "What interesting fact did I share about my hobby?", answer: this.userInfo.hobbyFact, key: 'hobbyFact' },
            { question: "What was my job/occupation?", answer: this.userInfo.job, key: 'job' },
            { question: "What interesting fact did I share about myself?", answer: this.userInfo.interestingFact, key: 'interestingFact' }
        ];
        
        this.quizQuestions = [...questionTemplates];
        this.usedQuizQuestions.clear();
        this.quizAnswers = [];
    }
    
    showQuizSection() {
        document.getElementById('quizSection').style.display = 'block';
        this.updateQuizButtons();
        this.disableChatInput();
    }
    
    updateQuizButtons() {
        const container = document.getElementById('quizButtons');
        container.innerHTML = '';
        
        this.quizQuestions.forEach((question, index) => {
            const button = document.createElement('button');
            button.className = 'quiz-btn';
            button.textContent = question.question;
            button.disabled = this.usedQuizQuestions.has(index);
            button.addEventListener('click', () => this.askQuizQuestion(index));
            container.appendChild(button);
        });
    }
    
    async askQuizQuestion(questionIndex) {
        const question = this.quizQuestions[questionIndex];
        this.usedQuizQuestions.add(questionIndex);
        this.updateQuizButtons();
        
        // Add user's question to chat
        this.addUserMessage(question.question);
        
        // Generate agent response to quiz question
        await this.generateAgentResponse(question.question);
        
        this.quizAnswers.push({
            question: question.question,
            expectedAnswer: question.answer,
            agentResponse: this.chatHistory[this.chatHistory.length - 1].content
        });
        
        // Check if all 4 quiz questions are done
        if (this.quizAnswers.length >= 4) {
            this.endQuizPhase();
        }
    }
    
    endQuizPhase() {
        document.getElementById('quizSection').style.display = 'none';
        this.startRatingPhase();
    }
    
    startRatingPhase() {
        this.currentPhase = 'rating';
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('ratingSection').style.display = 'block';
        document.getElementById('ratingAgentName').textContent = `Rate Agent ${this.currentAgent}`;
        
        const progress = this.currentAgent === 'A' ? 35 : 75;
        this.updateProgress(progress, `Rating Agent ${this.currentAgent}`);
        
        // Clear previous ratings
        this.clearRatingInputs();
    }
    
    clearRatingInputs() {
        const radios = document.querySelectorAll('#ratingSection input[type="radio"]');
        radios.forEach(radio => radio.checked = false);
    }
    
    submitRating() {
        const ratings = this.collectRatings();
        
        if (!this.validateRatings(ratings)) {
            alert('Please answer all rating questions before proceeding.');
            return;
        }
        
        // Store ratings
        if (this.currentAgent === 'A') {
            this.ratings.agentA = ratings;
            this.startAgentB();
        } else {
            this.ratings.agentB = ratings;
            this.showFinalSection();
        }
    }
    
    collectRatings() {
        return {
            humanlike: document.querySelector('input[name="humanlike"]:checked')?.value || null,
            likeable: document.querySelector('input[name="likeable"]:checked')?.value || null,
            competent: document.querySelector('input[name="competent"]:checked')?.value || null,
            chatAgain: document.querySelector('input[name="chatAgain"]:checked')?.value || null
        };
    }
    
    validateRatings(ratings) {
        return Object.values(ratings).every(value => value !== null);
    }
    
    startAgentB() {
        // Reset for Agent B
        this.currentAgent = 'B';
        this.currentPhase = 'info-gathering';
        this.currentQuestionIndex = 0;
        this.chatHistory = [];
        this.userInfo = {}; // Reset user info for Agent B session
        this.quizAnswers = [];
        this.usedQuizQuestions.clear();
        
        // Show chat section again
        document.getElementById('ratingSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        
        // Clear chat container
        document.getElementById('chatContainer').innerHTML = '';
        
        this.updateProgress(45, 'Starting conversation with Agent B');
        this.updateAgentInfo('Agent B - Imperfect Memory', 'Information Gathering Phase');
        this.enableChatInput();
        this.startInfoGathering();
    }
    
    showFinalSection() {
        document.getElementById('ratingSection').style.display = 'none';
        document.getElementById('finalSection').style.display = 'block';
        this.updateProgress(100, 'Study complete!');
    }
    
    downloadData() {
        const data = {
            timestamp: new Date().toISOString(),
            agentA: this.ratings.agentA,
            agentB: this.ratings.agentB
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-study-ratings-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // UI Helper methods
    async addUserMessage(message) {
        this.addMessageToChat('user', 'You', message);
        this.chatHistory.push({ role: 'user', content: message });
    }
    
    async addAgentMessage(message) {
        this.addMessageToChat('agent', `Agent ${this.currentAgent}`, message);
        this.chatHistory.push({ role: 'assistant', content: message });
    }
    
    addMessageToChat(sender, senderName, message) {
        const container = document.getElementById('chatContainer');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = senderName;
        
        const messageText = document.createElement('div');
        messageText.textContent = message;
        
        bubble.appendChild(senderDiv);
        bubble.appendChild(messageText);
        messageDiv.appendChild(bubble);
        container.appendChild(messageDiv);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }
    
    updateAgentInfo(agent, phase) {
        document.getElementById('currentAgent').textContent = agent;
        document.getElementById('currentPhase').textContent = phase;
    }
    
    updateProgress(percentage, text) {
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = text;
    }
    
    enableChatInput() {
        document.getElementById('userInput').disabled = false;
        document.getElementById('sendButton').disabled = false;
        document.getElementById('userInput').focus();
    }
    
    disableChatInput() {
        document.getElementById('userInput').disabled = true;
        document.getElementById('sendButton').disabled = true;
    }
    
    showError(message) {
        const errorDiv = document.getElementById('apiKeyError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
    
    hideError() {
        document.getElementById('apiKeyError').style.display = 'none';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});