# 🧠 Feynman AI System

An intelligent learning assistant that applies the **Feynman Technique** to simplify academic text, verify factual accuracy using NLI, and generate comprehension quizzes.

## 🏗️ Project Structure

```
feynman-system/
├── frontend/        # React.js UI
├── backend/         # Node.js + Express API server
└── nli-service/     # Python Flask NLI verification microservice
```

---

## ✨ Features

- 📖 **Feynman Simplification** — Explains complex academic text like you're 10 years old
- 🔍 **NLI Fact Verification** — Uses DeBERTa v3 to verify simplified claims against the original
- 🔄 **Auto-Regeneration** — Automatically corrects low-accuracy explanations
- 🧩 **Quiz Generation** — Creates 4-question MCQ quizzes from the source text
- 🤖 **Dual LLM Support** — Gemini 2.5 Flash with Groq (LLaMA 3.3 70B) fallback

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- Gemini API key
- Groq API key (optional, for fallback)

---

### 1. NLI Service (Python)

```bash
cd nli-service
pip install -r requirements.txt
python app.py
# Runs on http://localhost:5001
```

---

### 2. Backend (Node.js)

```bash
cd backend
cp .env.example .env
# Edit .env and add your API keys
npm install
node server.js
# Runs on http://localhost:5000
```

---

### 3. Frontend (React)

```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

---

## ⚙️ Environment Variables

Create `backend/.env` from `backend/.env.example`:

| Variable         | Description                   |
|-----------------|-------------------------------|
| `GEMINI_API_KEY` | Google Gemini API key         |
| `GROQ_API_KEY`   | Groq API key (fallback LLM)   |
| `HTTP_REFERER`   | Optional - your app's URL     |

---

## 🧪 How It Works

```
User Input (academic text)
        │
        ▼
   Backend (Node.js :5000)
        │
        ├──► Gemini 2.5 Flash → Simplify text (Feynman style)
        │
        ├──► Extract factual claims from simplified text
        │
        ├──► NLI Service (Python :5001) → Verify claims vs original
        │
        ├──► If score < 80% → Regenerate & re-verify
        │
        └──► Generate MCQ quiz
        │
        ▼
   Frontend (React :3000) → Display results
```

---

## 📦 Tech Stack

| Layer       | Technology                              |
|------------|------------------------------------------|
| Frontend   | React.js, Axios                          |
| Backend    | Node.js, Express, Axios, dotenv          |
| NLI Service| Python, Flask, HuggingFace Transformers  |
| LLM        | Gemini 2.5 Flash + Groq LLaMA 3.3 70B   |
| NLI Model  | DeBERTa-v3-small, all-MiniLM-L6-v2      |
