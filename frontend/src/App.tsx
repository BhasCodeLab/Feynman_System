import React, { useState, useEffect, useRef, useCallback } from "react";
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

const LOADING_STEPS = [
  { icon: "🧠", label: "Applying Feynman Technique...", sub: "Breaking down complex concepts into simple language" },
  { icon: "🔍", label: "Extracting key claims...",      sub: "Identifying factual statements from the explanation" },
  { icon: "⚖️",  label: "Verifying with NLI model...", sub: "Checking accuracy using DeBERTa v3 AI model" },
  { icon: "📝",  label: "Generating quiz questions...", sub: "Creating 4 comprehension questions for you" },
];

function LoadingOverlay({ step }: { step: number }) {
  const current = LOADING_STEPS[Math.min(step, LOADING_STEPS.length - 1)];
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "48px 40px",
      textAlign: "center",
      animation: "fadeUp 0.4s ease",
      boxShadow: "var(--shadow)",
    }}>
      {/* Spinner */}
      <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 32px" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          animation: "spin 0.9s linear infinite",
          position: "absolute",
        }} />
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 28,
        }}>
          {current.icon}
        </div>
      </div>

      {/* Step label */}
      <h3 style={{
        fontSize: "1.3rem", fontWeight: 700,
        color: "var(--text)", marginBottom: 10,
        fontFamily: "'Outfit', sans-serif",
      }}>
        {current.label}
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: 36 }}>
        {current.sub}
      </p>

      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 32 }}>
        {LOADING_STEPS.map((s, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: i < step ? "var(--green)" : i === step ? "var(--accent)" : "var(--surface2)",
              border: `2px solid ${i === step ? "var(--accent)" : "transparent"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
              boxShadow: i === step ? "0 0 0 4px var(--accent-glow)" : "none",
              transition: "all 0.3s ease",
            }}>
              {i < step ? "✓" : s.icon}
            </div>
            {i < LOADING_STEPS.length - 1 && (
              <div style={{
                width: 2, height: 20,
                background: i < step ? "var(--green)" : "var(--border)",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Bouncing dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--accent)",
            display: "inline-block",
            animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "var(--green)" : score >= 60 ? "var(--yellow)" : "var(--red)";
  const bg    = score >= 80 ? "var(--green-soft)" : score >= 60 ? "var(--yellow-soft)" : "var(--red-soft)";
  const label = score >= 80 ? "High Accuracy" : score >= 60 ? "Moderate" : "Low Accuracy";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 16,
      background: bg, border: `1px solid ${color}`,
      borderRadius: 99, padding: "10px 24px",
    }}>
      <span style={{ fontSize: "2rem", fontWeight: 800, color, fontFamily: "'Outfit', sans-serif" }}>
        {score}%
      </span>
      <span style={{ color, fontWeight: 600, fontSize: "0.9rem" }}>{label}</span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; icon: string }> = {
    SUPPORTED:    { color: "var(--green)",  bg: "var(--green-soft)",  icon: "✓" },
    CONTRADICTED: { color: "var(--red)",    bg: "var(--red-soft)",    icon: "✕" },
    NEUTRAL:      { color: "var(--yellow)", bg: "var(--yellow-soft)", icon: "~" },
  };
  const s = map[status] ?? map["NEUTRAL"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}`,
      borderRadius: 99, padding: "3px 12px",
      fontSize: "0.8rem", fontWeight: 600,
    }}>
      {s.icon} {status}
    </span>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "32px",
      boxShadow: "var(--shadow)",
      animation: "fadeUp 0.5s ease",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{
          fontSize: 22, background: "var(--surface2)",
          width: 44, height: 44, borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <h2 style={{
          fontSize: "1.4rem", fontWeight: 700,
          fontFamily: "'Outfit', sans-serif", color: "var(--text)",
        }}>
          {title}
        </h2>
      </div>
      {subtitle && <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", paddingLeft: 56 }}>{subtitle}</p>}
    </div>
  );
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      id="theme-toggle-btn"
      onClick={onToggle}
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--toggle-bg)",
        border: "1px solid var(--toggle-border)",
        borderRadius: 99, padding: "7px 14px 7px 10px",
        cursor: "pointer", transition: "all 0.25s ease",
        color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600,
      }}
    >
      {/* Pill track */}
      <div style={{
        width: 44, height: 24, borderRadius: 99,
        background: dark ? "var(--accent)" : "var(--surface2)",
        border: `1px solid ${dark ? "transparent" : "var(--border)"}`,
        position: "relative",
        transition: "background 0.3s ease",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute",
          top: 3, left: dark ? 22 : 3,
          width: 16, height: 16, borderRadius: "50%",
          background: dark ? "white" : "var(--toggle-icon-bg)",
          transition: "left 0.25s ease, background 0.25s ease",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9,
        }}>
          {dark ? "🌙" : "☀️"}
        </div>
      </div>
      <span>{dark ? "Dark" : "Light"}</span>
    </button>
  );
}

function App() {
  const [text, setText] = useState<string>("");
  const [result, setResult] = useState<FullResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("feynman-theme");
    return saved ? saved === "dark" : true;
  });
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("feynman-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleTheme = useCallback(() => setDarkMode(d => !d), []);

  const processText = async () => {
    if (!text.trim() || text.trim().length < 50) {
      setError("Please enter at least 50 characters of academic text.");
      return;
    }
    setError("");
    setLoading(true);
    setLoadingStep(0);
    setSelectedAnswers({});
    setShowResults(false);
    setResult(null);

    try {
      setLoadingStep(0);
      await new Promise(r => setTimeout(r, 900));
      setLoadingStep(1);
      const res = await axios.post(`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/process`, { text });
      setLoadingStep(2);
      await new Promise(r => setTimeout(r, 500));
      setLoadingStep(3);
      await new Promise(r => setTimeout(r, 500));
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [result]);

  const charCount = text.length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* Theme Toggle – top right */}
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 100 }}>
        <ThemeToggle dark={darkMode} onToggle={toggleTheme} />
      </div>

      {/* Hero Header */}
      <div style={{
        background: "var(--hero-bg)",
        borderBottom: "1px solid var(--border)",
        padding: "60px 24px 48px",
        textAlign: "center" as const,
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{
          position: "absolute", top: -60, left: "20%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -40, right: "15%",
          width: 250, height: 250, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 99, padding: "6px 18px", marginBottom: 24,
          fontSize: "0.8rem", fontWeight: 600, color: "#a5b4fc",
          letterSpacing: "0.05em",
        }}>
          ✦ FEYNMAN TECHNIQUE AI
        </div>

        <h1 style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
          fontWeight: 800,
          background: "var(--header-title)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 16,
          lineHeight: 1.15,
        }}>
          Make Complex Ideas<br />Crystal Clear
        </h1>

        <p style={{
          color: "var(--text-muted)",
          fontSize: "clamp(1rem, 2vw, 1.15rem)",
          maxWidth: 520,
          margin: "0 auto 32px",
          lineHeight: 1.7,
        }}>
          Paste any academic text — the AI will simplify it like you're 10,
          verify facts with NLI, and generate a comprehension quiz.
        </p>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {["🧠 Feynman Simplification", "⚖️ NLI Fact Check", "📝 Auto Quiz"].map(f => (
            <span key={f} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 99, padding: "6px 16px",
              fontSize: "0.85rem", color: "var(--text-muted)",
            }}>{f}</span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 0" }}>

        {/* Input card */}
        <Card>
          <SectionTitle icon="📄" title="Your Academic Text" subtitle="Paste the text you want to understand deeply" />

          <div style={{ position: "relative" }}>
            <textarea
              rows={8}
              style={{
                width: "100%", display: "block",
                background: "var(--surface2)",
                border: `1px solid ${error ? "var(--red)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)",
                padding: "20px",
                fontSize: "1.05rem",
                lineHeight: 1.75,
                color: "var(--text)",
                resize: "vertical",
                minHeight: 180,
                outline: "none",
                fontFamily: "'Inter', sans-serif",
                transition: "border-color 0.2s",
              }}
              placeholder="e.g. Quantum entanglement is a phenomenon where two particles become correlated in such a way that the quantum state of each particle cannot be described independently of the others..."
              value={text}
              onChange={e => { setText(e.target.value); setError(""); }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = error ? "var(--red)" : "var(--border)")}
            />
            <div style={{
              position: "absolute", bottom: 12, right: 16,
              fontSize: "0.78rem", color: "var(--text-dim)",
            }}>
              {charCount} chars {charCount < 50 && charCount > 0 && <span style={{ color: "var(--yellow)" }}>· need {50 - charCount} more</span>}
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: "12px 16px",
              background: "var(--red-soft)", border: "1px solid var(--red)",
              borderRadius: "var(--radius-sm)", color: "var(--red)",
              fontSize: "0.9rem", display: "flex", gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            id="process-btn"
            onClick={processText}
            disabled={loading}
            style={{
              marginTop: 20,
              width: "100%",
              padding: "18px",
              fontSize: "1.05rem",
              fontWeight: 700,
              fontFamily: "'Outfit', sans-serif",
              background: loading
                ? "var(--surface2)"
                : "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)",
              color: loading ? "var(--text-dim)" : "white",
              border: `1px solid ${loading ? "var(--border)" : "transparent"}`,
              borderRadius: "var(--radius-sm)",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.25s ease",
              letterSpacing: "0.02em",
              animation: !loading ? "glow-pulse 3s ease infinite" : "none",
            }}
          >
            {loading ? "Processing…" : "✦ Simplify, Verify & Quiz →"}
          </button>
        </Card>

        {/* Loading state */}
        {loading && (
          <div style={{ marginTop: 32 }}>
            <LoadingOverlay step={loadingStep} />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div ref={resultRef} style={{ marginTop: 40, display: "grid", gap: 28 }}>

            {/* ── Simplified Explanation ── */}
            <Card>
              <SectionTitle
                icon="💡"
                title="Simplified Explanation"
                subtitle="Explained like you're 10 years old, using the Feynman Technique"
              />

              <div style={{
                background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                padding: "28px 32px",
                borderLeft: "4px solid var(--accent)",
                marginBottom: 32,
              }}>
                <p style={{
                  fontSize: "1.15rem", lineHeight: 1.85,
                  color: "var(--text)", fontWeight: 400,
                }}>
                  {result.simplified.simplified_explanation}
                </p>
              </div>

              {/* Steps */}
              <h3 style={{
                fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)",
                marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                STEP-BY-STEP BREAKDOWN
              </h3>
              <ol style={{ listStyle: "none", display: "grid", gap: 12, marginBottom: 32 }}>
                {result.simplified.steps.map((step, i) => (
                  <li key={i} style={{
                    display: "flex", gap: 16, alignItems: "flex-start",
                    animation: `slide-in 0.4s ease ${i * 0.08}s both`,
                  }}>
                    <span style={{
                      flexShrink: 0, width: 32, height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.85rem", fontWeight: 700, color: "white",
                    }}>
                      {i + 1}
                    </span>
                    <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--text)", paddingTop: 4 }}>
                      {step}
                    </p>
                  </li>
                ))}
              </ol>

              {/* Analogy */}
              <div style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))",
                border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: "var(--radius-sm)", padding: "24px 28px", marginBottom: 24,
              }}>
                <div style={{
                  fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)",
                  letterSpacing: "0.1em", marginBottom: 10,
                }}>
                  🎯 EVERYDAY ANALOGY
                </div>
                <p style={{ fontSize: "1.1rem", lineHeight: 1.75, color: "var(--text)", fontStyle: "italic" }}>
                  "{result.simplified.analogy.text}"
                </p>
              </div>

              {/* Why it works */}
              <div style={{
                background: "var(--green-soft)", border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: "var(--radius-sm)", padding: "24px 28px",
              }}>
                <div style={{
                  fontSize: "0.75rem", fontWeight: 700, color: "var(--green)",
                  letterSpacing: "0.1em", marginBottom: 10,
                }}>
                  ⚡ WHY IT WORKS
                </div>
                <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "var(--text)" }}>
                  {result.simplified.why_explanation}
                </p>
              </div>
            </Card>

            {/* ── Verification ── */}
            <Card>
              <SectionTitle
                icon="⚖️"
                title="NLI Fact Verification"
                subtitle="Each claim from the simplified explanation verified against your original text using DeBERTa v3"
              />

              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
                <ScoreBadge score={result.verification.support_score} />
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {result.verification.support_score >= 80
                    ? "Great! The simplified explanation closely matches the original text."
                    : result.verification.support_score >= 60
                    ? "Moderate accuracy — some claims may need review."
                    : "Low accuracy — the explanation may contain unsupported statements."}
                </p>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {result.verification.results.map((r, i) => (
                  <div key={i} style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", padding: "20px 24px",
                    animation: `slide-in 0.4s ease ${i * 0.06}s both`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                      <p style={{ fontSize: "1rem", color: "var(--text)", fontWeight: 500, lineHeight: 1.6, flex: 1 }}>
                        {r.claim}
                      </p>
                      <StatusChip status={r.status} />
                    </div>
                    {r.evidence && (
                      <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>Evidence: </span>{r.evidence}
                      </p>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <div style={{
                        height: 4, borderRadius: 99,
                        background: "var(--border)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.round(r.confidence * 100)}%`,
                          background: r.status === "SUPPORTED" ? "var(--green)" : r.status === "CONTRADICTED" ? "var(--red)" : "var(--yellow)",
                          borderRadius: 99,
                          transition: "width 1s ease",
                        }} />
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>
                        Confidence: {Math.round(r.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Quiz ── */}
            <Card>
              <SectionTitle icon="📝" title="Comprehension Quiz" subtitle="Test your understanding with 4 questions" />

              <div style={{ display: "grid", gap: 24 }}>
                {result.quiz.questions.map((q, index) => {
                  const LETTERS     = ["A", "B", "C", "D"];
                  const userAnswer  = selectedAnswers[index];
                  // Normalise answer: backend may return "A" or "A. some text"
                  const correctAns  = (q.answer || "").charAt(0).toUpperCase();
                  const isCorrect   = userAnswer === correctAns;

                  return (
                    <div key={`${index}-${q.question.slice(0,20)}`} style={{
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)", padding: "24px 28px",
                      animation: `slide-in 0.4s ease ${index * 0.1}s both`,
                    }}>
                      <p style={{
                        fontWeight: 600, fontSize: "1.1rem",
                        color: "var(--text)", marginBottom: 18, lineHeight: 1.6,
                      }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                          fontSize: "0.8rem", fontWeight: 700, color: "white",
                          marginRight: 12, flexShrink: 0,
                        }}>
                          {index + 1}
                        </span>
                        {q.question}
                      </p>

                      <div style={{ display: "grid", gap: 10 }}>
                        {q.options.map((option, i) => {
                          // Always use positional A/B/C/D — never rely on option text's first char
                          const optionLetter = LETTERS[i];
                          const isSelected   = userAnswer === optionLetter;
                          const isRight      = optionLetter === correctAns;

                          let bg     = "var(--surface)";
                          let border = "1px solid var(--border)";
                          let color  = "var(--text)";

                          if (showResults) {
                            if (isRight)                { bg = "var(--green-soft)";  border = "1px solid var(--green)";  color = "var(--green)"; }
                            else if (isSelected)        { bg = "var(--red-soft)";    border = "1px solid var(--red)";    color = "var(--red)"; }
                          } else if (isSelected) {
                            bg     = "rgba(99,102,241,0.12)";
                            border = "1px solid var(--accent)";
                            color  = "#a5b4fc";
                          }

                          return (
                            <div
                              key={optionLetter}
                              id={`q${index}-opt-${optionLetter}`}
                              onClick={() => !showResults && setSelectedAnswers(prev => ({ ...prev, [index]: optionLetter }))}
                              style={{
                                padding: "14px 20px",
                                borderRadius: "var(--radius-sm)",
                                background: bg, border, color,
                                cursor: showResults ? "default" : "pointer",
                                fontSize: "1rem", lineHeight: 1.6,
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                transition: "all 0.2s ease",
                                fontWeight: isSelected || (showResults && isRight) ? 600 : 400,
                              }}
                            >
                              <span>{option}</span>
                              {showResults && isRight  && <span style={{ fontSize: "1.1rem" }}>✓</span>}
                              {showResults && isSelected && !isRight && <span style={{ fontSize: "1.1rem" }}>✕</span>}
                            </div>
                          );
                        })}
                      </div>

                      {showResults && !isCorrect && userAnswer && (
                        <div style={{
                          marginTop: 14, padding: "10px 16px",
                          background: "var(--red-soft)", border: "1px solid var(--red)",
                          borderRadius: "var(--radius-sm)", color: "var(--red)",
                          fontSize: "0.9rem",
                        }}>
                          Correct answer: <strong>{correctAns}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quiz actions */}
              <div style={{ marginTop: 28 }}>
                {!showResults && Object.keys(selectedAnswers).length > 0 && (
                  <button
                    id="check-answers-btn"
                    onClick={() => setShowResults(true)}
                    style={{
                      width: "100%", padding: "16px",
                      fontSize: "1rem", fontWeight: 700,
                      fontFamily: "'Outfit', sans-serif",
                      background: "linear-gradient(135deg, var(--green) 0%, #059669 100%)",
                      color: "white", border: "none",
                      borderRadius: "var(--radius-sm)", cursor: "pointer",
                    }}
                  >
                    ✓ Check My Answers ({Object.keys(selectedAnswers).length}/4 answered)
                  </button>
                )}

                {showResults && (() => {
                  const correct = result.quiz.questions.filter((q, i) => selectedAnswers[i] === q.answer).length;
                  return (
                    <div>
                      <div style={{
                        padding: "20px 24px", borderRadius: "var(--radius-sm)",
                        background: correct >= 3 ? "var(--green-soft)" : "var(--yellow-soft)",
                        border: `1px solid ${correct >= 3 ? "var(--green)" : "var(--yellow)"}`,
                        marginBottom: 16, textAlign: "center",
                      }}>
                        <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: correct >= 3 ? "var(--green)" : "var(--yellow)" }}>
                          {correct} / 4
                        </div>
                        <div style={{ color: "var(--text-muted)", marginTop: 4, fontSize: "0.95rem" }}>
                          {correct === 4 ? "🎉 Perfect score! You really understood it." : correct >= 3 ? "Great job! Almost perfect." : correct >= 2 ? "Good effort! Review the explanation again." : "Keep learning — re-read the simplification above."}
                        </div>
                      </div>
                      <button
                        id="retry-quiz-btn"
                        onClick={() => { setShowResults(false); setSelectedAnswers({}); }}
                        style={{
                          width: "100%", padding: "14px",
                          fontSize: "0.95rem", fontWeight: 600,
                          background: "var(--surface2)", color: "var(--text-muted)",
                          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                        }}
                      >
                        ↺ Try Quiz Again
                      </button>
                    </div>
                  );
                })()}
              </div>
            </Card>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;