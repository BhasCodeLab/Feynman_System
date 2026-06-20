import React, { useState } from "react";
import axios from "axios";

interface SimplifiedResult {
  simplified_explanation: string;
  steps: string[];
  analogy: { text: string; mapping: Array<{ concept: string; analogy: string }> };
  why_explanation: string;
}

interface VerificationResult {
  results: Array<{ claim: string; status: string; evidence: string; confidence: number }>;
  support_score: number;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

interface FullResult {
  simplified: SimplifiedResult;
  verification: VerificationResult;
  quiz: { questions: QuizQuestion[] };
}

function App() {
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<FullResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);

  const processText = async () => {
    if (!text.trim()) return alert("Please enter some text");

    setLoading(true);
    setLoadingStep("Simplifying with Feynman Technique...");
    setSelectedAnswers({});
    setShowResults(false);
    setResult(null);

    try {
      // Step 1: Simplifying
      setLoadingStep("Simplifying with Feynman Technique...");
      await new Promise(resolve => setTimeout(resolve, 800)); // smooth feel

      // Step 2: Processing
      setLoadingStep("Extracting claims and verifying...");
      
      const res = await axios.post("http://localhost:5000/process", { text });
      
      setLoadingStep("Generating quiz questions...");
      await new Promise(resolve => setTimeout(resolve, 600));

      setResult(res.data);
    } catch (err: any) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleAnswerSelect = (questionIndex: number, selectedOption: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: selectedOption
    }));
  };

  const checkAnswers = () => {
    setShowResults(true);
  };

  return (
    <div style={{
      padding: "40px 16px",
      maxWidth: "1200px",
      width: "100%",
      boxSizing: "border-box",
      margin: "0 auto",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: "#f8fafc",
      minHeight: "100vh"
    }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ 
          fontSize: "2.8rem", 
          color: "#1e3a8a", 
          fontWeight: "700",
          marginBottom: "8px"
        }}>
          🧠 Feynman AI
        </h1>
        <p style={{ color: "#64748b", fontSize: "1.1rem" }}>
          Simplify • Verify • Learn
        </p>
      </div>

      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "30px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        marginBottom: "40px",
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden"
      }}>
        <textarea
          rows={9}
          style={{
            width: "100%",
            display: "block",
            boxSizing: "border-box",
            padding: "18px",
            fontSize: "16.5px",
            borderRadius: "12px",
            border: "2px solid #e2e8f0",
            resize: "vertical",
            minHeight: "180px",
            outline: "none",
            transition: "border 0.2s"
          }}
          placeholder="Paste your academic text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button
          onClick={processText}
          disabled={loading}
          style={{
            marginTop: "20px",
            width: "100%",
            display: "block",
            boxSizing: "border-box",
            padding: "16px",
            fontSize: "18px",
            fontWeight: "600",
            background: loading ? "#64748b" : "#1e40af",
            color: "white",
            border: "none",
            borderRadius: "12px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(30, 64, 175, 0.3)"
          }}
        >
          {loading ? (
            <span>⏳ {loadingStep || "Processing..."}</span>
          ) : (
            "Simplify, Verify & Generate Quiz"
          )}
        </button>
      </div>

      {result && (
        <div style={{ display: "grid", gap: "40px" }}>
          {/* Simplified Explanation */}
          <div style={{ background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h2 style={{ color: "#1e3a8a", marginBottom: "20px" }}> Simplified Explanation</h2>
            <p style={{ fontSize: "18px", lineHeight: "1.75", color: "#1f2937" }}>
              {result.simplified.simplified_explanation}
            </p>

            <h3 style={{ marginTop: "25px" }}>Steps</h3>
            <ol style={{ paddingLeft: "20px" }}>
              {result.simplified.steps.map((step, i) => (
                <li key={i} style={{ marginBottom: "10px", fontSize: "17px" }}>{step}</li>
              ))}
            </ol>

            <h3 style={{ marginTop: "25px" }}>Analogy</h3>
            <p style={{ fontWeight: "600", fontSize: "17.5px" }}>{result.simplified.analogy.text}</p>
            
            <h3 style={{ marginTop: "25px" }}>Why it works</h3>
            <p style={{ color: "#374151" }}>{result.simplified.why_explanation}</p>
          </div>

          {/* Verification */}
          <div style={{ background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h2 style={{ color: "#1e3a8a" }}> Verification Results</h2>
            <h3 style={{ margin: "15px 0" }}>
              Support Score: <span style={{ 
                color: result.verification.support_score >= 80 ? "#16a34a" : "#ef4444", 
                fontSize: "28px", 
                fontWeight: "bold" 
              }}>
                {result.verification.support_score}%
              </span>
            </h3>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "14px", textAlign: "left" }}>Claim</th>
                  <th style={{ padding: "14px", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "14px", textAlign: "left" }}>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {result.verification.results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "14px" }}>{r.claim}</td>
                    <td style={{ padding: "14px", fontWeight: "600",
                      color: r.status === "SUPPORTED" ? "#16a34a" : r.status === "CONTRADICTED" ? "#ef4444" : "#f59e0b" }}>
                      {r.status}
                    </td>
                    <td style={{ padding: "14px", color: "#64748b", fontSize: "15px" }}>{r.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quiz Section */}
          <div style={{ background: "white", padding: "30px", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h2 style={{ color: "#1e3a8a", marginBottom: "10px" }}>📝 Quiz (4 Questions)</h2>
            <p style={{ color: "#64748b", marginBottom: "25px" }}>Choose your answers and check at the end</p>

            {result.quiz.questions.map((q, index) => {
              const userAnswer = selectedAnswers[index];
              const correctAnswer = q.answer;
              const isCorrect = userAnswer === correctAnswer;

              return (
                <div key={index} style={{
                  marginBottom: "40px",
                  padding: "25px",
                  background: "#f8fafc",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0"
                }}>
                  <p style={{ fontWeight: "600", fontSize: "17.5px", marginBottom: "18px" }}>
                    {index + 1}. {q.question}
                  </p>

                  <div>
                    {q.options.map((option, i) => {
                      const optionLetter = option.charAt(0);
                      const isSelected = userAnswer === optionLetter;
                      const isRightAnswer = optionLetter === correctAnswer;

                      let bgColor = "#ffffff";
                      if (showResults) {
                        if (isRightAnswer) bgColor = "#dcfce7";
                        else if (isSelected) bgColor = "#fee2e2";
                      } else if (isSelected) bgColor = "#dbeafe";

                      return (
                        <div
                          key={i}
                          onClick={() => !showResults && handleAnswerSelect(index, optionLetter)}
                          style={{
                            padding: "16px 18px",
                            margin: "10px 0",
                            borderRadius: "10px",
                            backgroundColor: bgColor,
                            cursor: showResults ? "default" : "pointer",
                            border: isSelected ? "2px solid #1e40af" : "1px solid #cbd5e1",
                            transition: "all 0.2s ease"
                          }}
                        >
                          {option}
                          {showResults && isRightAnswer && <span style={{ float: "right", color: "#16a34a", fontWeight: "bold" }}>✓ Correct</span>}
                          {showResults && isSelected && !isRightAnswer && <span style={{ float: "right", color: "#ef4444", fontWeight: "bold" }}>✕</span>}
                        </div>
                      );
                    })}
                  </div>

                  {showResults && !isCorrect && (
                    <p style={{ color: "#ef4444", marginTop: "12px", fontWeight: "500" }}>
                      Correct answer: <strong>{correctAnswer}</strong>
                    </p>
                  )}
                </div>
              );
            })}

            {!showResults && Object.keys(selectedAnswers).length > 0 && (
              <button onClick={checkAnswers} style={{
                width: "100%",
                padding: "16px",
                fontSize: "17px",
                fontWeight: "600",
                background: "#16a34a",
                color: "white",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                marginTop: "10px"
              }}>
                Check My Answers
              </button>
            )}

            {showResults && (
              <button
                onClick={() => {
                  setShowResults(false);
                  setSelectedAnswers({});
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: "17px",
                  fontWeight: "600",
                  background: "#64748b",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer"
                }}
              >
                Try Quiz Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;