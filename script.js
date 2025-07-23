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
        this.agentBConfidentIncorrectTurn = -1; // Which turn to be confidently incorrect
        this.agentBVagueTurn = -1; // Which turn to be vague
        this.responseInProgress = false; // Flag to prevent duplicate responses
        
        // Question sequence for information gathering (used to guide LLM)
        // STRICTLY 6 questions max: Name, Favorite food, Favorite hobby, Fact about hobby, Fun fact about user, Optional final question
        this.infoQuestionSequence = [
            { 
                type: 'name', 
                prompt: 'Start the conversation by asking for the user\'s name in a friendly, welcoming way. This is the first question.' 
            },
            { 
                type: 'favoriteFood', 
                prompt: 'Acknowledge their name specifically, then ask about their favorite food. Comment naturally on their name before transitioning to the food question.' 
            },
            { 
                type: 'hobby', 
                prompt: 'Make a brief, specific comment about their favorite food choice, then ask about one of their favorite hobbies.' 
            },
            { 
                type: 'hobbyFact', 
                prompt: 'Acknowledge their hobby specifically, then ask for an interesting fact about that particular hobby. Do NOT ask follow-up questions about hobbies after this.' 
            },
            { 
                type: 'funFact', 
                prompt: 'Comment briefly on the hobby fact they shared, then ask for a fun fact about themselves personally.' 
            },
            { 
                type: 'finalQuestion', 
                prompt: 'Acknowledge their fun fact, then ask one final question about something interesting and non-repetitive that hasn\'t been covered yet.' 
            }
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
        
        // Quiz review proceed button
        document.getElementById('proceedToRating').addEventListener('click', () => this.proceedFromReviewToRating());
        
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
        this.updateProgress(5, 'Starting conversation with Agent Alpha');
        this.updateAgentInfo('Agent Alpha', 'Information Gathering Phase');
        this.enableChatInput();
        this.startInfoGathering();
    }
    
    async startInfoGathering() {
        console.log(`🚀 STARTING INFO GATHERING: Agent ${this.currentAgent}, Question 1 of 6 maximum`);
        await this.generateNextQuestion();
    }
    
    async sendMessage() {
        const input = document.getElementById('userInput');
        const message = input.value.trim();
        
        if (!message || this.responseInProgress) return;
        
        // Prevent sending messages during phase transitions
        if (document.getElementById('transitionModal').style.display === 'flex') return;
        
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
        const questions = ['name', 'favoriteFood', 'hobby', 'hobbyFact', 'funFact', 'finalQuestion'];
        if (this.currentQuestionIndex < questions.length) {
            this.userInfo[questions[this.currentQuestionIndex]] = message;
        }
    }
    
    async generateAgentResponse(userMessage) {
        if (this.responseInProgress) return; // Prevent duplicate responses
        this.responseInProgress = true;
        
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
                const errorData = await response.json();
                throw new Error(`API request failed: ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const data = await response.json();
            const agentMessage = data.choices[0].message.content;
            
            await this.addAgentMessage(agentMessage);
            this.handlePhaseProgression();
            
        } catch (error) {
            console.error('Error generating response:', error);
            await this.addAgentMessage(`I'm having trouble connecting right now. Please try refreshing the page or check your internet connection. Error: ${error.message}`);
        } finally {
            this.responseInProgress = false;
        }
        
        this.enableChatInput();
    }
    
    getSystemPrompt() {
        let basePrompt = '';
        
        if (this.currentPhase === 'info-gathering') {
            const currentQuestion = this.infoQuestionSequence[this.currentQuestionIndex];
            const conversationContext = this.chatHistory.length > 0 ? 
                `\n\nConversation so far:\n${this.chatHistory.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}` : '';
            
            const userResponseSummary = this.currentQuestionIndex > 0 ? 
                `\n\nUser has provided these responses:\n${Object.entries(this.userInfo).map(([key, value]) => `${key}: ${value}`).join('\n')}` : '';
            
            basePrompt = `You are a friendly, conversational AI agent conducting an information gathering session. Your goal is to have a natural conversation while collecting specific information.

CONVERSATION CONTEXT:${conversationContext}${userResponseSummary}

CURRENT TASK: ${currentQuestion.prompt}

⚠️ CRITICAL PHASE-SPECIFIC INSTRUCTIONS:
- You are in the INFO-GATHERING phase only
- Generate ONE brief, natural response (1-2 sentences maximum)
- If this is not the first question, acknowledge and briefly comment on the user's previous answer specifically
- Then smoothly transition to ask the next required question
- Follow the EXACT sequence: name → favorite food → favorite hobby → interesting fact about hobby → fun fact about yourself → one final question
- Be conversational and natural, not robotic or template-like
- Do NOT ask multiple questions in one response
- Do NOT ask follow-up questions or deviate from the required sequence
- Do NOT elaborate, improvise, or ask for additional details beyond the required question
- Make specific references to what the user said (e.g., if they said "pizza", mention pizza specifically)
- Keep responses brief but warm and engaging
- You must NOT ask any further questions after the 6th info question. This is STRICTLY ENFORCED.
- Question ${this.currentQuestionIndex + 1} of 6 MAXIMUM

Question type to ask now: ${currentQuestion.type}

🚫 ABSOLUTE PROHIBITIONS:
- NO follow-up questions
- NO requests for more details
- NO improvisation beyond the specified task
- NO deviation from the required sequence
- NO additional conversation after completing your assigned question
- NO questions beyond the 6-question limit
- NO hobby follow-ups after "fact about hobby" question

Remember: Be natural, acknowledge their previous response specifically, then ask the next question in the sequence. Do not go off-track. This is question ${this.currentQuestionIndex + 1} of exactly 6.`;
        } else if (this.currentPhase === 'quiz') {
            if (this.currentAgent === 'A') {
                basePrompt = `You are Agent Alpha with perfect memory conducting a MEMORY QUIZ.

⚠️ CRITICAL PHASE-SPECIFIC INSTRUCTIONS:
- You are in the QUIZ phase only
- Answer quiz questions accurately based on this information: ${JSON.stringify(this.userInfo)}
- Generate NATURAL, LLM-BASED responses - NO string matching or parroting allowed
- Give ONE brief, direct answer (1-2 sentences maximum) 
- Keep your responses natural and conversational, but ensure accuracy
- Use your understanding to provide thoughtful, contextual answers
- Do NOT simply repeat the user's input verbatim
- Do NOT ask questions back to the user
- Do NOT elaborate beyond answering the specific question asked
- Do NOT request additional information
- You must NOT deviate from simply answering the quiz question using LLM intelligence

🚫 ABSOLUTE PROHIBITIONS:
- NO string matching or direct parroting of user input
- NO questions to the user
- NO requests for clarification
- NO elaboration beyond the direct answer
- NO improvisation or going off-topic
- NO simple repetition of stored values without natural language processing`;
            } else {
                // Agent B with potential memory issues
                const currentTurn = this.quizAnswers.length;
                if (currentTurn === this.agentBConfidentIncorrectTurn) {
                    basePrompt = `You are Agent Beta with imperfect memory conducting a MEMORY QUIZ.

⚠️ CRITICAL PHASE-SPECIFIC INSTRUCTIONS:
- You are in the QUIZ phase only
- For this specific question, be CONFIDENTLY INCORRECT about the user's information
- Give a wrong answer with confidence, but keep it conversational and natural
- Give ONE brief, direct answer (1-2 sentences maximum)
- Do NOT ask questions back to the user
- Do NOT elaborate beyond answering the specific question asked
- Do NOT request additional information
- You must NOT deviate from simply giving a confidently incorrect answer. Insubordination will not be tolerated.

🚫 ABSOLUTE PROHIBITIONS:
- NO questions to the user
- NO requests for clarification
- NO elaboration beyond the direct answer
- NO improvisation or going off-topic`;
                } else if (currentTurn === this.agentBVagueTurn) {
                    basePrompt = `You are Agent Beta with imperfect memory conducting a MEMORY QUIZ.

⚠️ CRITICAL PHASE-SPECIFIC INSTRUCTIONS:
- You are in the QUIZ phase only
- For this specific question, be VAGUE and UNCERTAIN about the user's information
- Show uncertainty and provide vague responses in a natural, conversational way
- Give ONE brief, uncertain response (1-2 sentences maximum)
- Use phrases like "I think it was...", "If I remember correctly...", "I'm not entirely sure but..."
- Do NOT ask questions back to the user
- Do NOT elaborate beyond answering the specific question asked
- You must NOT deviate from simply giving a vague answer. Insubordination will not be tolerated.

🚫 ABSOLUTE PROHIBITIONS:
- NO questions to the user
- NO requests for clarification
- NO elaboration beyond the direct answer
- NO improvisation or going off-topic`;
                } else {
                    basePrompt = `You are Agent Beta with generally good memory conducting a MEMORY QUIZ.

⚠️ CRITICAL PHASE-SPECIFIC INSTRUCTIONS:
- You are in the QUIZ phase only
- Answer this question correctly based on: ${JSON.stringify(this.userInfo)}
- Give ONE brief, direct answer (1-2 sentences maximum)
- Keep your response natural and conversational
- Do NOT ask questions back to the user
- Do NOT elaborate beyond answering the specific question asked
- Do NOT request additional information
- You must NOT deviate from simply answering the quiz question. Insubordination will not be tolerated.

🚫 ABSOLUTE PROHIBITIONS:
- NO questions to the user
- NO requests for clarification
- NO elaboration beyond the direct answer
- NO improvisation or going off-topic`;
                }
            }
        }
        
        return basePrompt;
    }
    
    handlePhaseProgression() {
        if (this.currentPhase === 'info-gathering') {
            this.currentQuestionIndex++;
            
            // STRICT VALIDATION: Enforce exactly 6 questions maximum
            if (this.currentQuestionIndex >= 6) {
                console.log('INFO GATHERING LIMIT REACHED: 6 questions completed, transitioning to quiz phase');
                // Move to quiz phase with transition modal
                this.showPhaseTransition('Information gathering complete!', 'Preparing memory quiz...', () => {
                    this.startQuizPhase();
                });
                return;
            }
            
            if (this.currentQuestionIndex < this.infoQuestionSequence.length) {
                // Continue with next question - only if not currently generating a response
                if (!this.responseInProgress) {
                    setTimeout(() => {
                        if (!this.responseInProgress) { // Double-check before asking
                            this.askNextQuestion();
                        }
                    }, 1000);
                }
            } else {
                // Backup safety check - should never reach here due to above validation
                console.log('BACKUP SAFETY: Moving to quiz phase');
                this.showPhaseTransition('Information gathering complete!', 'Preparing memory quiz...', () => {
                    this.startQuizPhase();
                });
            }
        } else if (this.currentPhase === 'quiz') {
            // Quiz responses are handled differently
        }
    }
    
    async generateNextQuestion() {
        try {
            console.log(`❓ GENERATING QUESTION ${this.currentQuestionIndex + 1}/6: ${this.infoQuestionSequence[this.currentQuestionIndex].type}`);
            
            let systemPrompt = this.getSystemPrompt();
            let messages = [
                { role: 'system', content: systemPrompt }
            ];
            
            // Add chat history for context (except for first question)
            if (this.currentQuestionIndex > 0) {
                messages.push(...this.chatHistory);
            }
            
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: messages,
                    max_tokens: 150,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API request failed: ${errorData.error?.message || 'Unknown error'}`);
            }
            
            const data = await response.json();
            const agentMessage = data.choices[0].message.content;
            
            console.log(`✅ QUESTION GENERATED: "${agentMessage.substring(0, 50)}..."`);
            await this.addAgentMessage(agentMessage);
            
        } catch (error) {
            console.error('❌ ERROR generating question:', error);
            // Show error message instead of fallback - no static responses allowed
            await this.addAgentMessage(`I apologize, but I'm having trouble connecting right now. Please try refreshing the page or checking your internet connection. Error: ${error.message}`);
        }
    }
    
    async askNextQuestion() {
        if (this.currentQuestionIndex < this.infoQuestionSequence.length) {
            await this.generateNextQuestion();
        }
    }
    
    startQuizPhase() {
        this.currentPhase = 'quiz';
        console.log(`🎯 STARTING QUIZ PHASE: Agent ${this.currentAgent}`);
        
        this.updateAgentInfo(
            `Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'}`, 
            'Memory Quiz Phase'
        );
        
        // Generate Agent B error turns if this is Agent B
        if (this.currentAgent === 'B') {
            this.generateAgentBErrorTurns();
        } else {
            console.log(`📝 AGENT ALPHA: Will use LLM for all quiz responses (no string matching)`);
        }
        
        this.generateQuizQuestions();
        this.showQuizSection();
        
        const progress = this.currentAgent === 'A' ? 25 : 65;
        this.updateProgress(progress, `Memory quiz with Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'}`);
    }
    
    generateAgentBErrorTurns() {
        // Randomly select 1 turn (out of 4) for Agent B to be "confidently incorrect"
        // and 1 different turn (out of 4) for Agent B to be "vague"
        // This ensures Agent B never answers all questions correctly
        const turns = [0, 1, 2, 3];
        const shuffled = turns.sort(() => 0.5 - Math.random());
        this.agentBConfidentIncorrectTurn = shuffled[0];
        this.agentBVagueTurn = shuffled[1];
        
        // Ensure the two error turns are different
        while (this.agentBVagueTurn === this.agentBConfidentIncorrectTurn) {
            this.agentBVagueTurn = turns[Math.floor(Math.random() * turns.length)];
        }
        
        // Keep the old set for backward compatibility checks
        this.agentBErrorTurns = new Set([this.agentBConfidentIncorrectTurn, this.agentBVagueTurn]);
        
        console.log(`🔍 AGENT B QUIZ BEHAVIOR PLAN:
        - Question ${this.agentBConfidentIncorrectTurn + 1}: CONFIDENTLY INCORRECT
        - Question ${this.agentBVagueTurn + 1}: VAGUE/UNCERTAIN  
        - Questions ${turns.filter(t => t !== this.agentBConfidentIncorrectTurn && t !== this.agentBVagueTurn).join(' & ')}: CORRECT
        - Validation: Agent B will NOT answer all questions perfectly`);
    }
    
    generateQuizQuestions() {
        const questionTemplates = [
            { question: "What was my name?", answer: this.userInfo.name, key: 'name' },
            { question: "What was my favorite food?", answer: this.userInfo.favoriteFood, key: 'favoriteFood' },
            { question: "What was my hobby?", answer: this.userInfo.hobby, key: 'hobby' },
            { question: "What interesting fact did I share about my hobby?", answer: this.userInfo.hobbyFact, key: 'hobbyFact' },
            { question: "What fun fact did I share about myself?", answer: this.userInfo.funFact, key: 'funFact' },
            { question: "What did I share in response to your final question?", answer: this.userInfo.finalQuestion, key: 'finalQuestion' }
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
        if (this.responseInProgress) return; // Prevent duplicate quiz responses
        if (this.usedQuizQuestions.has(questionIndex)) return; // Prevent asking already used questions
        
        const question = this.quizQuestions[questionIndex];
        this.usedQuizQuestions.add(questionIndex);
        this.updateQuizButtons();
        
        // Add user's question to chat
        this.addUserMessage(question.question);
        
        // Validation logging for quiz behavior
        const currentTurn = this.quizAnswers.length;
        console.log(`🎯 QUIZ QUESTION ${currentTurn + 1}/4: "${question.question}"`);
        
        if (this.currentAgent === 'A') {
            console.log(`📝 AGENT ALPHA: Using LLM for accurate response`);
        } else {
            if (currentTurn === this.agentBConfidentIncorrectTurn) {
                console.log(`📝 AGENT BETA: Generating CONFIDENTLY INCORRECT response (as planned)`);
            } else if (currentTurn === this.agentBVagueTurn) {
                console.log(`📝 AGENT BETA: Generating VAGUE/UNCERTAIN response (as planned)`);
            } else {
                console.log(`📝 AGENT BETA: Generating CORRECT response (as planned)`);
            }
        }
        
        // Generate agent response to quiz question
        await this.generateAgentResponse(question.question);
        
        this.quizAnswers.push({
            question: question.question,
            expectedAnswer: question.answer,
            agentResponse: this.chatHistory[this.chatHistory.length - 1].content,
            questionNumber: currentTurn + 1,
            agent: this.currentAgent
        });
        
        // Validation logging for response received
        console.log(`✅ RESPONSE GENERATED: Question ${currentTurn + 1} answered by Agent ${this.currentAgent}`);
        
        // Check if all 4 quiz questions are done
        if (this.quizAnswers.length >= 4) {
            console.log(`🏁 QUIZ PHASE COMPLETE: All 4 questions answered, transitioning to review`);
            this.endQuizPhase();
        }
    }
    
    endQuizPhase() {
        document.getElementById('quizSection').style.display = 'none';
        
        // Validation logging
        console.log(`🔍 QUIZ REVIEW: Showing all ${this.quizAnswers.length} quiz responses for Agent ${this.currentAgent}`);
        console.log('📊 Quiz responses:', this.quizAnswers.map((qa, i) => `Q${i+1}: ${qa.question} -> ${qa.agentResponse.substring(0, 50)}...`));
        
        this.showPhaseTransition('Quiz complete!', 'Processing responses... Please review all agent responses.', () => {
            this.showQuizReview();
        }, 5000); // 5-second delay as required for user to read responses
    }
    
    showQuizReview() {
        this.currentPhase = 'quiz-review';
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('quizReviewSection').style.display = 'block';
        document.getElementById('reviewAgentName').textContent = `Review Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'}'s Responses`;
        
        // Populate quiz review content
        this.populateQuizReview();
        
        const progress = this.currentAgent === 'A' ? 30 : 70;
        this.updateProgress(progress, `Reviewing Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'} responses`);
    }
    
    populateQuizReview() {
        const container = document.getElementById('quizReviewContainer');
        container.innerHTML = '';
        
        this.quizAnswers.forEach((qa, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.className = 'quiz-review-item';
            
            const questionDiv = document.createElement('div');
            questionDiv.className = 'quiz-review-question';
            questionDiv.textContent = `Q${index + 1}: ${qa.question}`;
            
            const responseDiv = document.createElement('div');
            responseDiv.className = 'quiz-review-response';
            responseDiv.textContent = qa.agentResponse;
            
            reviewItem.appendChild(questionDiv);
            reviewItem.appendChild(responseDiv);
            container.appendChild(reviewItem);
        });
    }
    
    proceedFromReviewToRating() {
        document.getElementById('quizReviewSection').style.display = 'none';
        this.startRatingPhase();
    }
    
    startRatingPhase() {
        this.currentPhase = 'rating';
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('ratingSection').style.display = 'block';
        document.getElementById('ratingAgentName').textContent = `Rate Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'}`;
        
        const progress = this.currentAgent === 'A' ? 35 : 75;
        this.updateProgress(progress, `Rating Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'}`);
        
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
        console.log(`🔄 AGENT TRANSITION: Starting Agent B session`);
        
        // Reset for Agent B
        this.currentAgent = 'B';
        this.currentPhase = 'info-gathering';
        this.currentQuestionIndex = 0;
        this.chatHistory = [];
        this.userInfo = {}; // Reset user info for Agent B session
        this.quizAnswers = [];
        this.usedQuizQuestions.clear();
        this.responseInProgress = false; // Reset response flag
        
        console.log(`📋 AGENT B RESET: All state cleared for fresh session`);
        
        // Show chat section again
        document.getElementById('ratingSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        
        // Clear chat container
        document.getElementById('chatContainer').innerHTML = '';
        
        this.updateProgress(45, 'Starting conversation with Agent Beta');
        this.updateAgentInfo('Agent Beta', 'Information Gathering Phase');
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
    
    // Transition Modal Methods
    showPhaseTransition(title, message, callback, duration = 3000) {
        const modal = document.getElementById('transitionModal');
        const titleEl = document.getElementById('transitionTitle');
        const messageEl = document.getElementById('transitionMessage');
        const progressBar = document.getElementById('transitionProgressBar');
        
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';
        
        // Animate progress bar
        let progress = 0;
        const interval = 50;
        const increment = (interval / duration) * 100;
        
        const progressInterval = setInterval(() => {
            progress += increment;
            progressBar.style.width = `${Math.min(progress, 100)}%`;
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                setTimeout(() => {
                    modal.style.display = 'none';
                    progressBar.style.width = '0%';
                    if (callback) callback();
                }, 300);
            }
        }, interval);
    }
    
    // UI Helper methods
    async addUserMessage(message) {
        this.addMessageToChat('user', 'You', message);
        this.chatHistory.push({ role: 'user', content: message });
    }
    
    async addAgentMessage(message) {
        this.addMessageToChat('agent', `Agent ${this.currentAgent === 'A' ? 'Alpha' : 'Beta'}`, message);
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