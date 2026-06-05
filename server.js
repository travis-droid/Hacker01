// ──────────────────────────────────────────────────────────────
//  StudyBuddy AI  –  server.js
//  Express backend that receives subject + question from the
//  frontend and calls the Gemini API to generate an answer.
// ──────────────────────────────────────────────────────────────

// 1. Load environment variables from .env file
//    (This is how we keep the API key out of our code)
require('dotenv').config();

// 2. Import our packages
const express = require('express');
const path    = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 3. Create the Express app
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────
// Lets Express read JSON bodies from POST requests
app.use(express.json());

// Serves everything inside the /public folder as static files
// So when a browser opens http://localhost:3000  →  it gets index.html
app.use(express.static(path.join(__dirname, 'public')));

// ── Connect to Gemini ──────────────────────────────────────────
// We read the API key from the .env file (never hardcode it!)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// We'll use Gemini 1.5 Flash — it's fast, free-tier friendly,
// and perfect for a hackathon demo.
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ── The list of allowed subjects ───────────────────────────────
// We only accept these so random topics can't slip through.
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

// ── POST /api/ask  ─────────────────────────────────────────────
// This is the only route the frontend calls.
// It receives:  { subject: "...", question: "..." }
// It returns:   { answer: "..." }
app.post('/api/ask', async (req, res) => {

  const { subject, question } = req.body;

  // ── Basic validation ──────────────────────────────────────
  if (!subject || !question) {
    return res.status(400).json({ error: 'Both subject and question are required.' });
  }

  if (!ALLOWED_SUBJECTS.includes(subject)) {
    return res.status(400).json({ error: 'Invalid subject selected.' });
  }

  if (question.trim().length < 3) {
    return res.status(400).json({ error: 'Question is too short.' });
  }

  if (question.length > 500) {
    return res.status(400).json({ error: 'Question is too long (max 500 characters).' });
  }

  // ── Build the prompt ──────────────────────────────────────
  // This is the core concept:
  //   We tell Gemini WHO it is → it stays on that subject.
  //   The student's question is injected at the end.
  const prompt = `
You are an expert ${subject} tutor helping university students at a tech campus.

Your rules:
- Answer clearly and concisely — like you are explaining to a smart beginner.
- Keep your answer focused on ${subject} only.
- If the question is not related to ${subject}, politely say so and redirect the student.
- Use simple examples where helpful.
- Do not use markdown formatting like ** or ##. Write in plain text.
- Keep the answer under 300 words.

Student's question:
"${question.trim()}"

Your answer:
`.trim();

  // ── Call the Gemini API ───────────────────────────────────
  try {
    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    // Send the answer back to the frontend
    return res.json({ answer });

  } catch (err) {

    console.error('Gemini API error:', err.message);

    // Give a friendly error message depending on what went wrong
    if (err.message.includes('API_KEY')) {
      return res.status(500).json({
        error: 'Invalid or missing Gemini API key. Check your .env file.',
      });
    }

    if (err.message.includes('quota') || err.message.includes('429')) {
      return res.status(429).json({
        error: 'Gemini API quota exceeded. Please wait a moment and try again.',
      });
    }

    return res.status(500).json({
      error: 'Something went wrong while generating the answer. Please try again.',
    });
  }
});

// ── Catch-all: serve index.html for any unknown route ──────────
// This makes sure refreshing the page still works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start the server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ✅  StudyBuddy AI is running!');
  console.log(`  🌐  Open in your browser: http://localhost:${PORT}`);
  console.log('');
});
