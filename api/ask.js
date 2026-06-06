const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const ALLOWED_SUBJECTS = [
  'Web Development',
  'Machine Learning',
  'Data Science',
  'Cybersecurity',
  'Cloud Computing',
  'Mobile Development',
  'Algorithms and Data Structures',
  'Databases',
  'DevOps and CI/CD',
  'UI/UX Design',
];

module.exports = async (req, res) => {
  // Allow the frontend to call this function
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser preflight check
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { subject, question } = req.body;

  if (!subject || !question) {
    return res.status(400).json({ error: 'Subject and question are required.' });
  }
  if (!ALLOWED_SUBJECTS.includes(subject)) {
    return res.status(400).json({ error: 'Invalid subject.' });
  }
  if (question.trim().length < 3) {
    return res.status(400).json({ error: 'Question is too short.' });
  }
  if (question.length > 500) {
    return res.status(400).json({ error: 'Question is too long.' });
  }

  const prompt = `
You are an expert ${subject} tutor helping university students at a tech campus.

Your rules:
- Answer clearly and concisely, like you are explaining to a smart beginner.
- Stay focused on ${subject} only.
- If the question is unrelated to ${subject}, politely say so and redirect the student.
- Use simple examples where helpful.
- Write in plain text, no markdown formatting like ** or ##.
- Keep the answer under 300 words.

Student's question:
"${question.trim()}"

Your answer:
`.trim();

  // Try Groq first (primary)
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const groqResponse = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      max_tokens: 1024,
    });
    const answer = groqResponse.choices[0]?.message?.content || 'No response generated';
    return res.status(200).json({ answer, provider: 'Groq' });
  } catch (groqErr) {
    console.error('Groq error:', groqErr.message);
    
    // If Groq fails, fallback to Google Generative AI (secondary)
    if (groqErr.message.includes('quota') || groqErr.message.includes('429') || groqErr.message.includes('RESOURCE_EXHAUSTED') || groqErr.status === 429) {
      console.log('Groq quota exceeded, falling back to Google Generative AI...');
      
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(prompt);
        return res.status(200).json({ answer: result.response.text(), provider: 'Google Generative AI (Fallback)' });
      } catch (googleErr) {
        console.error('Google Generative AI fallback error:', googleErr.message);
        return res.status(503).json({ error: 'Both AI providers are temporarily unavailable. Please try again later.' });
      }
    }
    
    // Handle other Groq errors
    if (groqErr.message.includes('API_KEY') || groqErr.message.includes('Unauthorized')) {
      return res.status(500).json({ error: 'Invalid Groq API key. Check your Vercel environment variables.' });
    }
    return res.status(500).json({ error: 'AI service error. Please try again.' });
  }
};