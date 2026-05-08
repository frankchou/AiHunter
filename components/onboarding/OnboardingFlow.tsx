"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { INDUSTRIES, WORLD_LOCATIONS } from "@/lib/mock-data";
import type { ParsedResume, ResumeAnalysis } from "@/lib/types";
import { ResumeEditor } from "./ResumeEditor";

const STEPS = ["上傳履歷", "確認分析", "求職偏好", "完成"];

export function OnboardingFlow({ initialStep = 0, initialParsed = null }: { initialStep?: number; initialParsed?: ParsedResume | null }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(initialStep);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedResume | null>(initialParsed);
  const [rawText, setRawText] = useState("");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runAnalysis = (parsedData: ParsedResume) => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setRetryCountdown(0);
    setAnalyzing(true);
    setAnalysisError(null);
    fetch("/api/resume/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parsed: parsedData }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        return data;
      })
      .then((data) => setAnalysis(data))
      .catch((e) => {
        setAnalysisError(String(e));
        // auto-retry after 30 seconds
        let secs = 30;
        setRetryCountdown(secs);
        countdownRef.current = setInterval(() => {
          secs -= 1;
          setRetryCountdown(secs);
          if (secs <= 0 && countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }, 1000);
        retryTimerRef.current = setTimeout(() => runAnalysis(parsedData), 30000);
      })
      .finally(() => setAnalyzing(false));
  };

  useEffect(() => {
    if (step === 1 && parsed && !analysis && !analysisError) {
      runAnalysis(parsed);
    }
  }, [step, parsed]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [prefs, setPrefs] = useState({
    locations: [] as string[],
    remote: [] as string[],
    industries: [] as string[],
    languages: [] as string[],
    salaryMin: 0,
    salaryMax: null as number | null,
    salaryCcy: "TWD",
    titles: "",
  });

  const [locationInput, setLocationInput] = useState("");

  const togglePref = (key: keyof typeof prefs, val: string) => {
    const cur = (prefs[key] as string[]) ?? [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    setPrefs({ ...prefs, [key]: next });
  };
  const hasPref = (key: keyof typeof prefs, val: string) =>
    ((prefs[key] as string[]) ?? []).includes(val);

  const addLocation = (loc: string) => {
    const trimmed = loc.trim();
    if (!trimmed || prefs.locations.includes(trimmed)) return;
    setPrefs({ ...prefs, locations: [...prefs.locations, trimmed] });
    setLocationInput("");
  };

  const removeLocation = (loc: string) =>
    setPrefs({ ...prefs, locations: prefs.locations.filter((l) => l !== loc) });

  const saveStep = async (completedStep: number, data?: object) => {
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: completedStep, data }),
    });
  };

  const parseFile = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setParsing(true);
    try {
      const r = await fetch("/api/resume/parse", { method: "POST", body: fd });
      if (!r.ok) throw new Error(`Parse failed: ${r.status}`);
      const { rawText: rt, parsed: p, fileName, fileData, fileMime } = await r.json();
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rt, parsed: p, fileName, fileData, fileMime }),
      });
      setRawText(rt);
      setParsed(p);
      // Step 0 完成：履歷已上傳解析完畢
      await saveStep(1);
      setStep(1);
    } catch (e) {
      console.error(e);
      alert("解析失敗，請確認檔案格式或稍後再試。");
    } finally {
      setParsing(false);
    }
  };

  const parseText = async () => {
    setParsing(true);
    try {
      const r = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(`Parse failed: ${r.status}`);
      const { rawText: rt, parsed: p } = await r.json();
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rt, parsed: p }),
      });
      setRawText(rt);
      setParsed(p);
      // Step 0 完成：履歷已上傳解析完畢
      await saveStep(1);
      setStep(1);
    } catch (e) {
      console.error(e);
      alert("解析失敗，請稍後再試。");
    } finally {
      setParsing(false);
    }
  };

  const confirmAndNext = async () => {
    await saveStep(2);
    setStep(2);
  };

  const handleResumeEdit = async (updated: ParsedResume) => {
    // Save updated parsed data to DB
    await fetch("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, parsed: updated }),
    });
    setParsed(updated);
    setEditMode(false);
    setAnalysis(null);
    setAnalysisError(null);
    runAnalysis(updated);
  };

  const savePrefsAndFinish = async () => {
    // Step 2 完成：儲存偏好，整個 onboarding 完成
    await saveStep(3, { prefs });
    setStep(3);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: step === 1 ? 720 : 560 }}>
        {/* Logo + logout */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, letterSpacing: "-.02em" }}>AI Hunter</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>AI 驅動求職助手</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ fontSize: 12, color: "var(--ink-3)", background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}
          >
            登出
          </button>
        </div>

        {/* Step indicators */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                background: i < step ? "var(--accent)" : i === step ? "var(--accent)" : "var(--bg-elev)",
                color: i <= step ? "#fff" : "var(--ink-3)",
                opacity: i > step ? 0.4 : 1,
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div style={{ width: 20, height: 1, background: "var(--line)" }} />}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 24 }}>

          {/* Step 0: Upload */}
          {step === 0 && (
            <>
              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>上傳你的履歷</h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-3)" }}>AI 自動抽取技能、年資、職稱，用於職缺匹配。</p>

              {parsing ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <div className="spinner" style={{ margin: "0 auto 12px" }} />
                  <div className="eyebrow">Agent 解析中… 抽取技能 / 年資 / 職稱 / 經歷</div>
                </div>
              ) : (
                <>
                  <div className="dropzone" onClick={() => fileRef.current?.click()} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 14 }}>拖放 PDF / DOCX / TXT<br />或<a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click(); }}> 點擊選擇檔案</a></div>
                    <div style={{ fontSize: 11, marginTop: 8 }}>解析後可確認結果再繼續</div>
                  </div>
                  {/* stopPropagation fixes double-trigger */}
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />

                  <div style={{ textAlign: "center", margin: "10px 0", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>— 或貼上文字 —</div>
                  <textarea placeholder="貼上你的履歷文字…"
                    style={{ width: "100%", minHeight: 100, padding: 10, fontFamily: "inherit", fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)", resize: "vertical" }}
                    value={text} onChange={(e) => setText(e.target.value)} />
                  {text && <button className="btn primary" style={{ marginTop: 10, width: "100%" }} onClick={parseText}>解析文字</button>}
                </>
              )}
            </>
          )}

          {/* Step 1: Full resume + AI analysis */}
          {step === 1 && parsed && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>確認 AI 分析結果</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>確認 AI 抽取的履歷資訊是否正確，並查看 AI 評析。</p>
                </div>
                {!editMode && (
                  <button className="btn" style={{ fontSize: 12, whiteSpace: "nowrap" }} onClick={() => setEditMode(true)}>
                    ✏ 編輯履歷
                  </button>
                )}
              </div>

              {/* ── Edit Mode ── */}
              {editMode && (
                <ResumeEditor
                  initial={parsed}
                  onSave={handleResumeEdit}
                  onCancel={() => setEditMode(false)}
                />
              )}

              {/* ── 履歷內容 (display mode) ── */}
              {!editMode && <>
              <div className="eyebrow" style={{ marginBottom: 8 }}>履歷內容</div>
              <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: "20px 24px", marginBottom: 16, fontSize: 13.5, lineHeight: 1.7 }}>

                {/* 姓名 + 聯絡 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 22 }}>{parsed.name || session?.user?.name || ""}</div>
                  <div style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 2, display: "flex", flexWrap: "wrap", gap: "0 12px" }}>
                    {parsed.email && <span>{parsed.email}</span>}
                    {parsed.phone && <span>| {parsed.phone}</span>}
                    {parsed.location && <span>| {parsed.location}</span>}
                  </div>
                </div>
                <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "0 0 14px" }} />

                {/* 履歷摘要 */}
                {parsed.summary && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>履歷摘要</div>
                    <div style={{ whiteSpace: "pre-line", color: "var(--ink-2)" }}>{parsed.summary}</div>
                  </div>
                )}

                {/* 證照及獎項 */}
                {((parsed.certifications?.length ?? 0) > 0 || (parsed.awards?.length ?? 0) > 0) && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>證照及獎項</div>
                    <ul style={{ margin: "0 0 0 20px", padding: 0, color: "var(--ink-2)" }}>
                      {parsed.certifications?.map((c, i) => <li key={`c${i}`}>{c}</li>)}
                      {parsed.awards?.map((a, i) => <li key={`a${i}`}>{a}</li>)}
                    </ul>
                  </div>
                )}

                {/* 技能 */}
                {parsed.skills.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>專業技能</div>
                    <div className="skill-row">
                      {parsed.skills.map((s) => (
                        <span key={s.name} className="skill-pill">{s.name}{s.years > 0 && <span className="yrs">{s.years}yr</span>}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 工作經歷 */}
                {parsed.experience.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>工作經歷</div>
                    {parsed.experience.map((e, i) => (
                      <div key={i} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {e.title} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>| {e.company}</span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                            {e.years || `${e.startDate} - ${e.endDate}`}
                          </div>
                        </div>
                        {e.bullets && e.bullets.length > 0 && (
                          <ul style={{ margin: "6px 0 0 20px", padding: 0, color: "var(--ink-2)", listStyle: "none" }}>
                            {e.bullets.map((b, j) => {
                              const isSub = b.startsWith("→ ") || b.startsWith("- ") || b.startsWith("– ") || b.startsWith("‐ ");
                              const text = isSub ? b.replace(/^(→ |- |– |‐ )/, "") : b;
                              return (
                                <li key={j} style={{ marginBottom: 3, paddingLeft: isSub ? 20 : 0, display: "flex", gap: 6 }}>
                                  <span style={{ flexShrink: 0, color: isSub ? "var(--ink-3)" : "var(--ink-2)" }}>{isSub ? "–" : "•"}</span>
                                  <span>{text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 教育程度 */}
                {parsed.education && parsed.education.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>教育程度</div>
                    {parsed.education.map((ed, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{ed.degree}</span>
                        {ed.major && <span> | {ed.major}</span>}
                        <span style={{ color: "var(--ink-3)" }}> | {ed.school}</span>
                        {ed.year && <span style={{ color: "var(--ink-3)" }}> · {ed.startYear ? `${ed.startYear} – ` : ""}{ed.year}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── AI 分析 ── */}
              <div className="eyebrow" style={{ marginBottom: 8 }}>AI 分析</div>
              {analyzing ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--ink-3)", fontSize: 13 }}>
                  <div className="spinner" style={{ margin: "0 auto 8px" }} />
                  AI 正在分析你的履歷…（約 10–30 秒）
                </div>
              ) : analysisError ? (
                <div style={{ padding: 16, background: "var(--bg-soft)", borderRadius: 8, marginBottom: 16, textAlign: "center" }}>
                  <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10 }}>
                    AI 服務目前過載，{retryCountdown > 0 ? `${retryCountdown} 秒後自動重試…` : "重試中…"}
                  </div>
                  <button className="btn primary" onClick={() => parsed && runAnalysis(parsed)}>
                    立即重試
                  </button>
                </div>
              ) : analysis ? (
                <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13 }}>

                  {/* 分數 + 關鍵字 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ textAlign: "center", minWidth: 56 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: analysis.score >= 80 ? "var(--accent)" : analysis.score >= 60 ? "#f59e0b" : "#ef4444", fontFamily: "var(--font-mono)" }}>{analysis.score}</div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)" }}>/ 100</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="eyebrow" style={{ marginBottom: 4 }}>關鍵字優勢</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {analysis.keywords.map((k) => (
                          <span key={k} style={{ background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SWOT */}
                  <div className="eyebrow" style={{ marginBottom: 8 }}>SWOT 分析</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {(["S", "W", "O", "T"] as const).map((k) => (
                      <div key={k} style={{ background: "var(--bg)", borderRadius: 6, padding: 10, border: "1px solid var(--line)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, color: k === "S" ? "#22c55e" : k === "W" ? "#ef4444" : k === "O" ? "var(--accent)" : "#f59e0b", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                          {k === "S" ? "Strengths 優勢" : k === "W" ? "Weaknesses 劣勢" : k === "O" ? "Opportunities 機會" : "Threats 威脅"}
                        </div>
                        <ul style={{ margin: "0 0 0 14px", padding: 0, lineHeight: 1.7, fontSize: 12, color: "var(--ink-2)" }}>
                          {analysis.swot[k].map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* 建議 */}
                  {analysis.suggestions.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div className="eyebrow" style={{ marginBottom: 6 }}>改善建議</div>
                      {analysis.suggestions.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, padding: "8px 10px", background: "var(--bg)", borderRadius: 6, border: "1px solid var(--line)" }}>
                          <span style={{ color: "#f59e0b", flexShrink: 0 }}>▲</span>
                          <div><span style={{ fontWeight: 600, color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase" }}>{s.field}</span><br />{s.suggestion}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 總評 */}
                  <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 6, borderLeft: "3px solid var(--accent)", fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)" }}>
                    {analysis.comment}
                  </div>

                  <div style={{ marginTop: 10, textAlign: "right" }}>
                    <button className="btn" style={{ fontSize: 11 }} onClick={() => { setAnalysis(null); setAnalysisError(null); parsed && runAnalysis(parsed); }}>
                      重新分析
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 14 }}>
                如果分析結果有誤，可回上一步重新上傳，或點「編輯履歷」直接修正。
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setStep(0)}>← 重新上傳</button>
                <button className="btn primary" style={{ flex: 2 }} onClick={confirmAndNext}>確認，繼續設定偏好 →</button>
              </div>
              </>}
            </>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <>
              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>設定求職偏好</h3>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-3)" }}>用於 AI 職缺匹配，之後可隨時修改。</p>

              {/* Locations */}
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>工作地區</h4>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(locationInput); } }}
                    placeholder="輸入城市或國家，Enter 加入"
                    list="loc-suggestions"
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }}
                  />
                  <button className="btn" onClick={() => addLocation(locationInput)}>+</button>
                </div>
                <datalist id="loc-suggestions">
                  {WORLD_LOCATIONS.filter(l => l.toLowerCase().includes(locationInput.toLowerCase())).map(l => <option key={l} value={l} />)}
                </datalist>
                {prefs.locations.length > 0 && (
                  <div className="chips">
                    {prefs.locations.map(l => (
                      <span key={l} className="chip active" onClick={() => removeLocation(l)}>{l} ✕</span>
                    ))}
                  </div>
                )}
                <div className="chips" style={{ marginTop: 6 }}>
                  {WORLD_LOCATIONS.filter(l => !prefs.locations.includes(l)).slice(0, 12).map(l => (
                    <span key={l} className="chip" onClick={() => addLocation(l)}>{l}</span>
                  ))}
                </div>
              </div>

              {/* Remote */}
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>遠端型態</h4>
                <div className="chips">
                  {["onsite", "hybrid", "remote"].map(v => (
                    <span key={v} className={`chip${hasPref("remote", v) ? " active" : ""}`} onClick={() => togglePref("remote", v)}>{v}</span>
                  ))}
                </div>
              </div>

              {/* Industries */}
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>期望產業</h4>
                <div className="chips" style={{ maxHeight: 120, overflowY: "auto" }}>
                  {INDUSTRIES.map(ind => (
                    <span key={ind.id} className={`chip${hasPref("industries", ind.id) ? " active" : ""}`} onClick={() => togglePref("industries", ind.id)}>{ind.name}</span>
                  ))}
                </div>
              </div>

              {/* Salary range */}
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>期望薪資範圍（年薪）</h4>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="number" placeholder="最低" value={prefs.salaryMin || ""}
                    onChange={(e) => setPrefs({ ...prefs, salaryMin: +e.target.value })}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
                  <span style={{ color: "var(--ink-3)", fontSize: 13 }}>—</span>
                  <input type="number" placeholder="最高" value={prefs.salaryMax ?? ""}
                    onChange={(e) => setPrefs({ ...prefs, salaryMax: e.target.value ? +e.target.value : null })}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
                  <select value={prefs.salaryCcy} onChange={(e) => setPrefs({ ...prefs, salaryCcy: e.target.value })} className="sort-select">
                    {["TWD", "USD", "JPY", "EUR", "GBP", "SGD", "AUD", "HKD", "KRW"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button className="btn primary" style={{ width: "100%", marginTop: 6 }} onClick={savePrefsAndFinish}>儲存偏好，開始找工作 →</button>
            </>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>設定完成！</h3>
              <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 24px" }}>AI Hunter 已準備好為你尋找最適合的職缺</p>
              <button className="btn primary" style={{ width: "100%", fontSize: 15, padding: "12px" }} onClick={() => router.push("/feed")}>查看職缺流 →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
