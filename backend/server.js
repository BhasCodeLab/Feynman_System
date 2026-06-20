const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

console.log("🔑 GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY ? "YES" : "NO");

//  4 PROMPTS 
const SIMPLIFIER_PROMPT = `You are a structured AI system. Always follow the format exactly.
Return ONLY valid JSON. Do not add explanations.
Ensure all outputs are 100% consistent with the original text. Never hallucinate or invent information.

You are an expert teacher using the Feynman Technique.

Task: Explain this academic passage **as if teaching a 10-year-old child** who has never studied this subject.

STRICT RULES - YOU MUST FOLLOW ALL OF THEM:
- Do NOT copy ANY sentence, phrase, or wording from the original passage.
- Explain the original passage using very easy terms.
- Explain like you are talking to a young child.
- Break the idea into very small, easy-to-understand steps.
- Use everyday words instead of academic terms whenever possible.
- If a hard word is necessary, define it in simple words.
- The simplified explanation must be clearly reworded and not look like the source text.

Also do these two things:
- Create ONE very simple, everyday analogy (example: compare it to something in daily life like playing games or cooking).
- Explain in very simple words WHY the concept works.

Return JSON in this exact format:
{
  "simplified_explanation": "string",
  "steps": ["step1", "step2", "step3"],
  "analogy": {
    "text": "string",
    "mapping": [{"concept": "string", "analogy": "string"}]
  },
  "why_explanation": "string"
}

Input:
`;

const SIMPLIFIER_REWRITE_PROMPT = `You are a structured AI system. Always follow the format exactly.
Return ONLY valid JSON. Do not add explanations.
Do not add new facts and do not remove key meaning.

Task: Rewrite the candidate explanation so it is clearly simpler and different from the source wording.

Hard rules:
- Do NOT copy any full sentence from the source text.
- Use short sentences and common everyday words.
- Keep the same meaning and factual content.
- Avoid academic tone.

Return JSON:
{
  "simplified_explanation": "string"
}

Source text:
`;

const CLAIM_EXTRACTION_PROMPT = `You are a structured AI system. Always follow the format exactly.
Return ONLY valid JSON. Do not add explanations.
Ensure all outputs are 100% consistent with the given simplified explanation.

Extract maximum 6 short factual claims from the **simplified explanation**.

Rules:
- Each claim must be short, clear, and atomic
- Only include statements that appear in the simplified explanation
- Do not include opinions or examples
- Keep claims faithful to the simplified text

Return JSON:
{
  "claims": ["claim1", "claim2"]
}

Input (Simplified Explanation):
`;

const REGENERATION_PROMPT = `You are a structured AI system. Always follow the format exactly.
Return ONLY valid JSON. Do not add explanations.

Rewrite the explanation ONLY using the provided source text. Remove any unsupported or incorrect information.

Return JSON:
{
  "corrected_explanation": "string"
}

Source:
`;

const QUIZ_PROMPT = `You are a structured AI system. Always follow the format exactly.
Return ONLY valid JSON. Do not add explanations.

Generate 4 multiple choice questions based ONLY on the given text.

Rules:
- Exactly 4 questions
- 4 options (A, B, C, D) each
- Only one correct answer
- Questions should test real understanding

Return JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "answer": "A"
    }
  ]
}

Input:
`;

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCopiedSentence(original, simplified) {
  const originalNorm = normalizeText(original);
  const simplifiedSentences = simplified
    .split(/(?<=[.!?])\s+/)
    .map(s => normalizeText(s))
    .filter(s => s.length >= 30);

  return simplifiedSentences.some(sentence => originalNorm.includes(sentence));
}

function uniqueWordJaccard(a, b) {
  const setA = new Set(normalizeText(a).split(" ").filter(Boolean));
  const setB = new Set(normalizeText(b).split(" ").filter(Boolean));

  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  setA.forEach(word => {
    if (setB.has(word)) intersection += 1;
  });

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isTooSimilarToOriginal(original, simplified) {
  if (!simplified || typeof simplified !== "string") return true;

  const originalNorm = normalizeText(original);
  const simplifiedNorm = normalizeText(simplified);

  if (!simplifiedNorm) return true;
  if (originalNorm === simplifiedNorm) return true;
  if (hasCopiedSentence(original, simplified)) return true;

  const similarity = uniqueWordJaccard(original, simplified);
  const lengthRatio = simplifiedNorm.length / Math.max(1, originalNorm.length);

  // High lexical overlap + close length usually means near-copy simplification.
  return similarity >= 0.72 && lengthRatio >= 0.7;
}

// ==================== CALL LLM WITH PROPER FALLBACK ====================
async function callOpenAI(systemPrompt, userText, retryCount = 0) {
  const MAX_RETRIES = 2;

  // Try Gemini first
  try {
    console.log("🔑 Trying Gemini 2.5 Flash...");

    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let content = response.data.choices[0].message.content.trim();
    content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    console.log("✅ Gemini succeeded");
    return JSON.parse(content);

  } catch (err) {
    const status = err.response?.status;

    if (status === 429) {
      console.log("⏳ Gemini rate limit (429) reached. Trying Groq fallback...");
    } else {
      console.log("⚠️ Gemini failed with error:", status || err.message);
    }

    //  Groq fallback ONLY 
    if (process.env.GROQ_API_KEY) {
      try {
        console.log("🔄 Trying Groq fallback (llama-3.3-70b)...");

        const groqResponse = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 2000
          },
          {
            headers: {
              "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        let content = groqResponse.data.choices[0].message.content.trim();
        content = content.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];

        console.log("✅ Groq fallback succeeded");
        return JSON.parse(content);

      } catch (groqErr) {
        console.error("❌ Groq fallback also failed:", groqErr.message);
      }
    } else {
      console.log("⚠️ No GROQ_API_KEY found in .env - skipping fallback");
    }

    // If both failed and it's a rate limit, give helpful message
    if (status === 429) {
      throw new Error("Gemini rate limit reached. Please wait 30-60 seconds and try again.");
    }

    throw new Error("Both Gemini and Groq failed. Please try again later.");
  }
}

// MAIN PROCESS ENDPOINT 
app.post("/process", async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: "Please provide sufficient text" });
  }

  try {
    console.log("📝 Processing text...");

    // 1. Simplify the text
    const simplified = await callOpenAI(SIMPLIFIER_PROMPT, text);

    if (isTooSimilarToOriginal(text, simplified.simplified_explanation)) {
      console.log("🔄 Simplified text too similar to source. Rewriting in easier terms...");

      const rewritten = await callOpenAI(
        SIMPLIFIER_REWRITE_PROMPT + text,
        simplified.simplified_explanation
      );

      if (rewritten?.simplified_explanation) {
        simplified.simplified_explanation = rewritten.simplified_explanation;
      }
    }

    // 2. Extract claims from the SIMPLIFIED explanation (This is the key fix)
    const claimsData = await callOpenAI(CLAIM_EXTRACTION_PROMPT, simplified.simplified_explanation);
    let claims = claimsData.claims || [];

    // 3. Verify claims against the ORIGINAL text
    let verifyRes = await axios.post("http://localhost:5001/verify", {
      original: text,
      claims
    });
    let verification = verifyRes.data;

    // 4. Regeneration if support score is low
    if (verification.support_score < 80) {
      console.log(`🔄 Low score (${verification.support_score}%) → Regenerating`);

      const regen = await callOpenAI(REGENERATION_PROMPT + text, simplified.simplified_explanation);
      simplified.simplified_explanation = regen.corrected_explanation;

      // Re-extract claims from the corrected simplified explanation
      const newClaimsData = await callOpenAI(CLAIM_EXTRACTION_PROMPT, simplified.simplified_explanation);
      claims = newClaimsData.claims || [];

      // Re-verify
      verifyRes = await axios.post("http://localhost:5001/verify", { 
        original: text, 
        claims 
      });
      verification = verifyRes.data;
    }

    // 5. Generate Quiz from original text
    const quiz = await callOpenAI(QUIZ_PROMPT, text);

    console.log(`✅ Processing completed. Support Score: ${verification.support_score}%`);

    res.json({
      simplified,
      verification,
      quiz
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
  console.log("🚀 Feynman AI System ready - Claims now extracted from Simplified Explanation");
});