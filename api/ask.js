const { GoogleGenerativeAI } = require('@google/generative-ai');

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

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

  try {
    const result = await model.generateContent(prompt);
    return res.status(200).json({ answer: result.response.text() });
  } catch (err) {
    console.error('Gemini error:', err.message);

    if (err.message.includes('API_KEY')) {
      return res.status(500).json({ error: 'Invalid API key. Check your Vercel environment variables.' });
    }
    if (err.message.includes('quota') || err.message.includes('429')) {
      return res.status(429).json({ error: 'Quota exceeded. Please wait and try again.' });
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};