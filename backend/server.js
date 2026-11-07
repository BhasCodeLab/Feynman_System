const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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
function saveEvaluation(evaluation) {
  if (!process.env.EVALUATION_LOG_DIR) return;
  fs.mkdirSync(process.env.EVALUATION_LOG_DIR, { recursive: true });
  const filename = path.join(process.env.EVALUATION_LOG_DIR, evaluation.request_id + ".json");
  fs.writeFileSync(filename, JSON.stringify(evaluation, null, 2), { flag: "w" });
}

function recordAttempt(evaluation, provider, model, outcome, error, response) {
  if (!evaluation) return;
  evaluation.llm_attempts.push({
    stage: evaluation.current_stage, provider, model, outcome,
    error: error ? { status: error.response?.status || null, message: error.message } : null,
    response: response || null
  });
  saveEvaluation(evaluation);
}

async function callOpenAI(systemPrompt, userText, evaluation = null) {
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
        temperature: 0.7,
        max_tokens: 8192
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
    try {
      const parsed = JSON.parse(content);
      recordAttempt(evaluation, "Gemini", "gemini-2.5-flash", "success", null, parsed);
      return parsed;
    } catch (parseErr) {
      console.error("❌ Gemini JSON parse failed. Raw content (first 300 chars):", content.slice(0, 300));
      throw parseErr;
    }

  } catch (err) {
    recordAttempt(evaluation, "Gemini", "gemini-2.5-flash", "failure", err);
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
            model: "llama3-70b-8192",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText }
            ],
            temperature: 0.7,
            max_tokens: 8192
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
        try {
          const parsed = JSON.parse(content);
          recordAttempt(evaluation, "Groq", "llama3-70b-8192", "success", null, parsed);
          return parsed;
        } catch (parseErr) {
          console.error("❌ Groq JSON parse failed. Raw content (first 300 chars):", content.slice(0, 300));
          throw parseErr;
        }

      } catch (groqErr) {
        recordAttempt(evaluation, "Groq", "llama3-70b-8192", "failure", groqErr);
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

const evaluationConfig = () => ({
  support_threshold: 80,
  temperature: 0.7,
  max_tokens: 8192,
  primary_model: "gemini-2.5-flash",
  fallback_model: "llama3-70b-8192",
  nli_service_url: process.env.NLI_SERVICE_URL || "http://localhost:5001",
  prompts: {
    simplifier: SIMPLIFIER_PROMPT, rewrite: SIMPLIFIER_REWRITE_PROMPT,
    claims: CLAIM_EXTRACTION_PROMPT, regeneration: REGENERATION_PROMPT, quiz: QUIZ_PROMPT
  },
  server_sha256: crypto.createHash("sha256").update(fs.readFileSync(__filename)).digest("hex")
});

app.get("/health", (req, res) => res.json({ status: "ok" }));
if (process.env.EVALUATION_LOG_DIR) {
  app.get("/evaluation/config", (req, res) => res.json(evaluationConfig()));
}

app.post("/process", async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== "string" || text.trim().length < 50) {
    return res.status(400).json({ error: "Please provide at least 50 characters of academic text" });
  }
  const evaluation = {
    request_id: crypto.randomUUID(),
    run_id: typeof req.body.run_id === "string" ? req.body.run_id : null,
    started_at: new Date().toISOString(),
    source_text: text,
    source_sha256: crypto.createHash("sha256").update(text).digest("hex"),
    config: evaluationConfig(),
    llm_attempts: [],
    initial: null,
    final: null,
    regenerated: false,
    regeneration_completed: false,
    current_stage: "simplification"
  };
  const started = performance.now();
  const call = (stage, prompt, input) => {
    evaluation.current_stage = stage;
    saveEvaluation(evaluation);
    return callOpenAI(prompt, input, evaluation);
  };
  const verify = async (stage, claims) => {
    evaluation.current_stage = stage;
    saveEvaluation(evaluation);
    return (await axios.post(
      evaluation.config.nli_service_url + "/verify", { original: text, claims }
    )).data;
  };
  try {
    const simplified = await call("simplification", SIMPLIFIER_PROMPT, text);
    if (isTooSimilarToOriginal(text, simplified.simplified_explanation)) {
      const rewritten = await call(
        "wording_rewrite", SIMPLIFIER_REWRITE_PROMPT + text, simplified.simplified_explanation
      );
      if (rewritten?.simplified_explanation) {
        simplified.simplified_explanation = rewritten.simplified_explanation;
      }
    }
    const claimsData = await call(
      "initial_claim_extraction", CLAIM_EXTRACTION_PROMPT, simplified.simplified_explanation
    );
    let claims = claimsData.claims || [];
    let verification = await verify("initial_verification", claims);
    evaluation.initial = {
      explanation: simplified.simplified_explanation,
      claims: [...claims], verification: JSON.parse(JSON.stringify(verification))
    };
    saveEvaluation(evaluation);
    if (verification.support_score < evaluation.config.support_threshold) {
      evaluation.regenerated = true;
      const regen = await call(
        "regeneration", REGENERATION_PROMPT + text, simplified.simplified_explanation
      );
      simplified.simplified_explanation = regen.corrected_explanation;
      const newClaimsData = await call(
        "final_claim_extraction", CLAIM_EXTRACTION_PROMPT, simplified.simplified_explanation
      );
      claims = newClaimsData.claims || [];
      verification = await verify("final_verification", claims);
      evaluation.regeneration_completed = true;
    }
    evaluation.final = {
      explanation: simplified.simplified_explanation,
      claims: [...claims], verification: JSON.parse(JSON.stringify(verification))
    };
    saveEvaluation(evaluation);
    const quiz = await call("quiz", QUIZ_PROMPT, text);
    evaluation.current_stage = "complete";
    evaluation.completed_at = new Date().toISOString();
    evaluation.server_elapsed_seconds = (performance.now() - started) / 1000;
    saveEvaluation(evaluation);
    res.json({ simplified, verification, quiz, evaluation });
  } catch (err) {
    const nliFailure = /verification$/.test(evaluation.current_stage);
    evaluation.error = {
      stage: evaluation.current_stage,
      message: err.message,
      upstream_status: err.response?.status || null
    };
    evaluation.completed_at = new Date().toISOString();
    evaluation.server_elapsed_seconds = (performance.now() - started) / 1000;
    saveEvaluation(evaluation);
    res.status(nliFailure ? 503 : 500).json({
      error: nliFailure
        ? "NLI verification unavailable. Check the local NLI service and try again."
        : err.message || "Server error",
      verification_available: nliFailure ? false : null,
      evaluation
    });
  }
});

const PORT = process.env.PORT || 5000;

if (require.main === module) app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log("🚀 Feynman AI System ready");
});
module.exports = { app, evaluationConfig };
