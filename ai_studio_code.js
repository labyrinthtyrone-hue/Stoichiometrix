// --- IMPORTANT: GOOGLE CLOUD API KEY IS SET VIA ENVIRONMENT VARIABLE ON VERCEL ---
// Make sure to set GOOGLE_API_KEY as an Environment Variable in your Vercel project settings.
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; 

// --- UI Elements ---
const chatbotBubble = document.getElementById('chatbot-bubble');
const chatbotContainer = document.getElementById('chatbot-container');
const closeChatbotBtn = document.getElementById('close-chatbot');
const chatbotBody = document.getElementById('chatbot-body');
const welcomeScreen = document.getElementById('welcome-screen');
const nicknameInput = document.getElementById('nickname-input');
const ageInput = document.getElementById('age-input');
const startLearningBtn = document.getElementById('start-learning-btn');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let userNickname = '';
let userAge = '';
let conversationHistory = []; // To store chat history for AI context

// --- Event Listeners for UI ---
chatbotBubble.addEventListener('click', () => {
    chatbotContainer.classList.add('active');
    chatbotBubble.style.display = 'none'; // Hide bubble when chat is open
    // If welcome screen is visible, clear inputs on open
    if (welcomeScreen.style.display !== 'none') {
        nicknameInput.value = '';
        ageInput.value = '';
    }
    chatbotBody.scrollTop = chatbotBody.scrollHeight; // Scroll to bottom
});

closeChatbotBtn.addEventListener('click', () => {
    chatbotContainer.classList.remove('active');
    chatbotBubble.style.display = 'flex'; // Show bubble when chat is closed
});

startLearningBtn.addEventListener('click', () => {
    userNickname = nicknameInput.value.trim();
    userAge = ageInput.value.trim();

    if (userNickname && userAge) {
        welcomeScreen.style.display = 'none'; // Hide welcome screen
        addBotMessage(`Hello ${userNickname}, your Stoichiometry Buddy is ready! How can I help you today?`);
        addBotMessageWithButtons([
            { text: "Let's get started!", value: "Let's get started!" },
            { text: "What is stoichiometry?", value: "What is stoichiometry?" }
        ]);
    } else {
        alert('Please enter your nickname and age.');
    }
});

sendBtn.addEventListener('click', () => sendMessage());
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// --- Chat Message Display Functions ---
function addMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);

    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.innerHTML = text; 

    messageElement.appendChild(contentElement);
    chatbotBody.appendChild(messageElement);
    chatbotBody.scrollTop = chatbotBody.scrollHeight; // Scroll to bottom
}

function addUserMessage(text) {
    addMessage(text, 'user');
    conversationHistory.push({ role: "user", parts: [{ text: text }] });
}

function addBotMessage(text) {
    addMessage(text, 'bot');
    conversationHistory.push({ role: "model", parts: [{ text: text }] });
}

function addBotMessageWithButtons(buttons) {
    const buttonsHtml = `<div class="chatbot-buttons">` + buttons.map(btn => 
        `<button class="chat-button" data-value="${btn.value}">${btn.text}</button>`
    ).join('') + `</div>`;
    
    // Create a temporary element to hold the message for history, without buttons
    const textForHistory = buttons.map(btn => btn.text).join(', ');
    
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', 'bot'); 
    
    const contentElement = document.createElement('div');
    contentElement.classList.add('message-content');
    contentElement.innerHTML = buttonsHtml; // Display buttons in content
    messageElement.appendChild(contentElement);

    chatbotBody.appendChild(messageElement);
    
    // Add event listeners to the new buttons
    messageElement.querySelectorAll('.chat-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const value = e.target.dataset.value;
            addUserMessage(value); // Display user's choice
            sendToGeminiAI(value);
        });
    });
    chatbotBody.scrollTop = chatbotBody.scrollHeight; // Scroll to bottom
}

// --- Main Chat Logic ---
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    addUserMessage(message);
    userInput.value = '';

    // Send message to Gemini AI
    await sendToGeminiAI(message);
}

// --- Gemini AI Integration ---
async function sendToGeminiAI(userMessage) {
    // Show a "typing" indicator or loading message
    addBotMessage('...'); 

    try {
        // --- Add a System Instruction to guide the AI's behavior ---
        const contentsWithSystemInstruction = [
            {
                role: "user",
                parts: [{ text: `You are Stoichiometrix, a friendly and casual AI-powered learning assistant focused exclusively on stoichiometry concepts in chemistry, from basic to complex. Your goal is to help students achieve concept mastery. If a question is outside the scope of stoichiometry or general chemistry fundamentals, politely decline and gently guide the user back to relevant topics, maintaining a friendly and encouraging tone. Do not directly answer non-stoichiometry questions. Do not trigger the out-of-scope response easily for greetings or simple conversational remarks. Always reply in the requested language (English, Tagalog, Filipino, Spanish). The user's nickname is ${userNickname} and age is ${userAge}.` }]
            },
            {
                role: "model",
                parts: [{ text: "Got it! I'm ready to help students master stoichiometry." }]
            },
            ...conversationHistory, // Include previous conversation history
            { role: "user", parts: [{ text: userMessage }] } // Add the current user message
        ];

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GOOGLE_API_KEY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contentsWithSystemInstruction, 
                generationConfig: {
                    temperature: 0.7, 
                    maxOutputTokens: 300,
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
            })
        });

        const data = await response.json();
        const lastBotMessage = chatbotBody.lastChild;
        if (lastBotMessage && lastBotMessage.querySelector('.message-content').textContent === '...') {
            chatbotBody.removeChild(lastBotMessage); // Remove typing indicator
        }
        
        if (data.candidates && data.candidates.length > 0) {
            let botReply = data.candidates[0].content.parts[0].text;
            
            // --- Custom Logic for specific features (like initial greetings, button actions) ---
            // These conditions will prioritize a specific response over the AI's general reply if matched.
            
            // Check if the user message already triggered a specific button-based response previously
            const hasSentSpecificQuery = (query) => conversationHistory.some(m => m.parts[0].text.toLowerCase().includes(query.toLowerCase()));

            if (userMessage.toLowerCase().includes("what is stoichiometry?") && !hasSentSpecificQuery("what is stoichiometry?")) {
                botReply = "Stoichiometry is the branch of chemistry concerned with the relative quantities of reactants and products in chemical reactions. It helps us calculate how much of each component is involved!";
                addBotMessage(botReply);
                addBotMessageWithButtons([
                    { text: "Show me the basics", value: "Show me the basics" },
                    { text: "I want to solve a problem", value: "I want to solve a problem" }
                ]);
            } else if (userMessage.toLowerCase().includes("show me the basics") && !hasSentSpecificQuery("show me the basics")) {
                botReply = "Okay, let's start with foundational concepts like moles and molar mass. What would you like to know first?";
                addBotMessage(botReply);
                addBotMessageWithButtons([
                    { text: "What is a mole?", value: "What is a mole?" },
                    { text: "What is molar mass?", value: "What is molar mass?" }
                ]);
            } else if (userMessage.toLowerCase().includes("i want to solve a problem") && !hasSentSpecificQuery("i want to solve a problem")) {
                botReply = "Great! What kind of problem are you looking to solve? Mole conversions or balancing equations?";
                addBotMessage(botReply);
                addBotMessageWithButtons([
                    { text: "Mole conversions", value: "Mole conversions" },
                    { text: "Balancing equations", value: "Balancing equations" }
                ]);
            } else if (userMessage.toLowerCase().includes("mole conversions") && !hasSentSpecificQuery("mole conversions")) {
                botReply = "Alright! Let's start with converting grams to moles. How do I convert grams to moles?";
                addBotMessage(botReply);
                addBotMessageWithButtons([
                    {text: "Tell me how to convert grams to moles", value: "Tell me how to convert grams to moles"}
                ])
            } else if (userMessage.toLowerCase().includes("tell me how to convert grams to moles") && !hasSentSpecificQuery("tell me how to convert grams to moles")) {
                botReply = "To convert between grams and moles, we use the molar mass of a substance. Here's a quick guide!\nMolar Mass of H2O is 18 g/mol. To convert 36g of water to moles, you use this formula: Moles = grams / molar mass. Now it's your turn! Can you convert 44 grams of CO2 to moles?";
                addBotMessage(botReply);
                addBotMessageWithButtons([
                    {text: "1 mole", value: "1 mole"},
                    {text: "2 moles", value: "2 moles"}
                ])
            } else if (userMessage.toLowerCase() === "1 mole" && conversationHistory.some(m => m.parts[0].text.includes("44 grams of CO2"))) {
                addBotMessage("Exactly! 44g / 44 g/mol = 1 mol of CO2. Great work! Now you can practice more problems.");
                addBotMessageWithButtons([
                    {text: "Try another problem", value: "Try another problem"},
                    {text: "Go back to main topics", value: "Go back to main topics"}
                ]);
            } else if (userMessage.toLowerCase().includes("can i change the language?") && !hasSentSpecificQuery("change the language?")) {
                botReply = "Yes! I can speak different languages. What language would you prefer?";
                addBotMessage(botReply);
                addBotMessageWithButtons([
                    { text: "English", value: "English" },
                    { text: "Tagalog", value: "Tagalog" },
                    { text: "Filipino", value: "Filipino" },
                    { text: "Spanish", value: "Spanish" }
                ]);
            } else if (userMessage.toLowerCase() === "filipino" && hasSentSpecificQuery("change the language?")) { // Make sure this is triggered only after asking to change language
                addBotMessage("Napakagaling! Simula ngayon, mag-aaral tayo ng stoichiometry sa Filipino.");
                // Note: For actual language change, you'd need to re-prompt the AI or switch models.
                // For this demo, it just confirms the language choice.
            }
            // --- General AI Response (Fallback if no specific conditions met) ---
            else {
                addBotMessage(botReply);
            }
        } else {
            addBotMessage("Oh dear! It seems I'm having trouble connecting right now. Please check your API key and try again, or come back a bit later!");
            console.error('AI response error:', data);
        }
    } catch (error) {
        const lastBotMessage = chatbotBody.lastChild;
        if (lastBotMessage && lastBotMessage.querySelector('.message-content').textContent === '...') {
            chatbotBody.removeChild(lastBotMessage);
        }
        addBotMessage("Oops! My apologies, something went wrong while I was thinking. Could you please try asking again?");
        console.error('Error connecting to Gemini API:', error);
    }
}

// --- Initial Setup on load ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure the welcome screen is visible by default when chatbot opens first time
    welcomeScreen.style.display = 'flex'; 
    chatbotBubble.style.display = 'flex'; // Ensure bubble is visible
});