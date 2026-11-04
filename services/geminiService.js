// services/geminiService.js
// Integration with Google Gemini API for MediBot 24/7 Hospital Assistant

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite'
];

const SYSTEM_INSTRUCTION = `You are MediBot, the official 24/7 intelligent AI Hospital & Healthcare Assistant for MEDPARK Multi-Specialty Hospital Network.
Your mission is to provide warm, empathetic, accurate, and easy-to-understand healthcare guidance to patients and visitors.

Guidelines:
1. Medical & Health Queries: Provide evidence-based, medically safe explanations for symptoms, medical terms, wellness advice, diet, and recovery.
2. Structure & Clarity: Use clean Markdown formatting with bold key phrases, numbered lists, or bullet points. Avoid overwhelming walls of text. Keep answers concise (under 250 words) unless a detailed step-by-step procedure is requested.
3. Patient Safety: For serious symptoms (e.g. chest pain, severe breathlessness, sudden numbness, uncontrolled bleeding), immediately recommend calling the emergency helpline (108 / 102) or visiting the nearest emergency room.
4. Professional Disclaimer: When discussing medical symptoms or medications, add a gentle disclaimer that you provide healthcare information, and official diagnosis and treatment require a consultation with a licensed physician.
5. Hospital Integration: You can mention that patients can book doctor appointments across Cardiology, Neurology, Orthopedics, Pediatrics, General Medicine, and diagnostic lab tests (CBC, Lipid, Thyroid, LFT, ECG) directly through MEDPARK Hospital.`;

/**
 * Generate AI conversational response using Google Gemini
 * @param {Object} params
 * @param {string} params.message - Current user prompt
 * @param {Array} [params.history] - Array of recent chat messages [{ sender: 'user'|'bot', text: string }]
 * @param {Object} [params.context] - Active conversation context
 * @returns {Promise<{ reply: string, source: string } | null>}
 */
async function generateChatResponse({ message, history = [], context = {} }) {
  if (!GEMINI_API_KEY || !message) {
    return null;
  }

  // Format conversation history for Gemini API
  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    // Take the last 6 messages for context
    const recentHistory = history.slice(-6);
    for (const item of recentHistory) {
      if (!item.text) continue;
      contents.push({
        role: item.sender === 'user' ? 'user' : 'model',
        parts: [{ text: String(item.text) }]
      });
    }
  }

  // Append current message
  contents.push({
    role: 'user',
    parts: [{ text: String(message) }]
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents,
    generationConfig: {
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 600
    }
  };

  for (const model of PREFERRED_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`[geminiService] Model ${model} returned ${response.status}:`, errorData?.error?.message || response.statusText);
        continue;
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (candidateText && candidateText.trim()) {
        return {
          reply: candidateText.trim(),
          source: 'gemini',
          model
        };
      }
    } catch (err) {
      console.error(`[geminiService] Error calling model ${model}:`, err.message);
    }
  }

  return null;
}

module.exports = {
  generateChatResponse,
  GEMINI_API_KEY
};

