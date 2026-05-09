"use client";
import { useState, useRef, useCallback } from "react";
import useSWR from "swr";
import { INDUSTRIES, WORLD_LOCATIONS } from "@/lib/mock-data";
import type { ParsedResume, ResumeAnalysis } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PrefState {
  locations: string[];
  salaryMin: number;
  salaryMax: number | null;
  salaryCcy: string;
  industries: string[];
  remote: string[];
  languages: string[];
  titles: string;
}

export function ResumeView() {
  const { data: resumeData, mutate: mutateResume } = useSWR("/api/resume", fetcher);
  const { data: prefData, mutate: mutatePrefs } = useSWR<PrefState>("/api/preferences", fetcher);
  const [prefs, setPrefs] = useState<PrefState | null>(null);
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [text, setText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadOriginal = useCallback(() => {
    window.open("/api/resume/download", "_blank");
  }, []);

  const [locationInput, setLocationInput] = useState("");

  const activePref = prefs ?? prefData ?? {
    locations: [], salaryMin: 0, salaryMax: null, salaryCcy: "TWD", industries: [],
    remote: [], languages: [], titles: "",
  };

  const addLocation = (loc: string) => {
    const trimmed = loc.trim();
    if (!trimmed || activePref.locations.includes(trimmed)) return;
    setPrefs({ ...activePref, locations: [...activePref.locations, trimmed] });
    setLocationInput("");
  };
  const removeLocation = (loc: string) =>
    setPrefs({ ...activePref, locations: activePref.locations.filter((l) => l !== loc) });

  const togglePref = (key: keyof PrefState, val: string) => {
    const cur = (activePref[key] as string[]) ?? [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    setPrefs({ ...activePref, [key]: next });
  };
  const hasPref = (key: keyof PrefState, val: string) =>
    ((activePref[key] as string[]) ?? []).includes(val);

  const savePref = async () => {
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(activePref),
    });
    mutatePrefs();
  };

  const runAnalysis = async (parsed: ParsedResume) => {
    setAnalyzing(true);
    try {
      await fetch("/api/resume/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsed }),
      });
      await mutateResume();
    } finally {
      setAnalyzing(false);
    }
  };

  const parseAndSave = async (rawText: string, fileName?: string) => {
    setParsing(true);
    try {
      const r = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const { parsed } = await r.json();
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, parsed, fileName }),
      });
      setParsing(false);
      await runAnalysis(parsed);
    } catch {
      setParsing(false);
    }
  };

  const handleFile = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setParsing(true);
    try {
      const r = await fetch("/api/resume/parse", { method: "POST", body: fd });
      if (!r.ok) throw new Error(`Parse failed: ${r.status}`);
      const { rawText, parsed, fileName, fileData, fileMime } = await r.json();
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, parsed, fileName, fileData, fileMime }),
      });
      setParsing(false);
      await runAnalysis(parsed);
    } catch (e) {
      console.error(e);
      setParsing(false);
      alert("解析失敗，請確認檔案格式或稍後再試。");
    }
  };

  const parsed: ParsedResume | null = resumeData?.parsed ?? null;
  const analysis: ResumeAnalysis | null = resumeData?.analysis ?? null;

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>履歷</h3>
        <span className="sub">
          {resumeData ? `${resumeData.fileName ?? "履歷"} · v${resumeData.version} · 已啟用` : "尚未建立履歷"}
        </span>
      </div>

      <div className="resume-grid">
        {/* Left: resume */}
        <div className="card" style={{ padding: 18 }}>
          {!parsed && !parsing && (
            <>
              <div className="eyebrow" style={{ marginBottom: 10 }}>上傳 / 貼上履歷</div>
              <div className="dropzone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: 14 }}>拖放 PDF / DOCX / TXT<br/>或<a href="#" onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}> 點擊選擇檔案</a></div>
                <div style={{ fontSize: 11, marginTop: 8 }}>解析後自動填入，驅動職缺匹配</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
                     onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div style={{ textAlign: "center", margin: "12px 0", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>— 或貼上文字 —</div>
              <textarea placeholder="貼上你的履歷文字…" style={{ width: "100%", minHeight: 120, padding: 10, fontFamily: "inherit", fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)" }}
                        value={text} onChange={(e) => setText(e.target.value)} />
              {text && <button className="btn primary" style={{ marginTop: 10 }} onClick={() => parseAndSave(text)}>解析文字</button>}
            </>
          )}

          {(parsing || analyzing) && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              <div className="eyebrow">
                {parsing ? "Agent 解析中… 抽取技能 / 年資 / 職稱 / 經歷" : "AI 分析履歷中… 生成 SWOT"}
              </div>
            </div>
          )}

          {parsed && !parsing && !analyzing && (
            <>
              <div className="eyebrow">基本資訊 · 自動抽取</div>
              <div style={{ fontWeight: 600, fontSize: 18, marginTop: 6 }}>{parsed.name}</div>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{parsed.headline}</div>

              <div style={{ marginTop: 16 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>技能 ({parsed.skills.length})</div>
                <div className="skill-row">
                  {parsed.skills.map((s) => (
                    <span key={s.name} className="skill-pill">{s.name}<span className="yrs">{s.years} yr</span></span>
                  ))}
                </div>
              </div>

              {/* AI Analysis — SWOT */}
              {!analysis && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg-soft)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-2)" }}>尚無 AI 履歷分析，點擊生成 SWOT 分析與改善建議</div>
                  <button className="btn primary" style={{ whiteSpace: "nowrap" }}
                    onClick={() => parsed && runAnalysis(parsed)}>
                    立即分析
                  </button>
                </div>
              )}
              {analysis && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div className="eyebrow">AI 履歷分析</div>
                    <span className={`score-pill ${analysis.score >= 75 ? "high" : analysis.score >= 50 ? "mid" : "low"}`} style={{ fontSize: 11 }}>
                      {analysis.score} 分
                    </span>
                  </div>

                  {analysis.comment && (
                    <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 12px", lineHeight: 1.6 }}>{analysis.comment}</p>
                  )}

                  <div className="swot">
                    <div className="quad S"><h4>優勢 S</h4><ul>{analysis.swot.S.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    <div className="quad W"><h4>弱點 W</h4><ul>{analysis.swot.W.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    <div className="quad O"><h4>機會 O</h4><ul>{analysis.swot.O.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                    <div className="quad T"><h4>威脅 T</h4><ul>{analysis.swot.T.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  </div>

                  {analysis.suggestions?.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="eyebrow" style={{ marginBottom: 6 }}>改善建議</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {analysis.suggestions.map((s, i) => (
                          <div key={i} style={{ fontSize: 13, color: "var(--ink-2)", padding: "6px 10px", background: "var(--bg-soft)", borderRadius: 6 }}>
                            <span style={{ fontWeight: 600, color: "var(--ink)", marginRight: 6 }}>{s.field}:</span>{s.suggestion}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {parsed.experience.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>工作經歷</div>
                  {parsed.experience.map((e, i) => (
                    <div className="timeline-item" key={i}>
                      <div className="when">{e.years}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{e.title} · {e.company}</div>
                        <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{e.location}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Raw text toggle */}
              <div style={{ marginTop: 18 }}>
                <button
                  className="btn"
                  style={{ fontSize: 12, width: "100%", justifyContent: "space-between", display: "flex" }}
                  onClick={() => setShowRaw((s) => !s)}
                >
                  <span>原始履歷文字（AI 解析來源）</span>
                  <span>{showRaw ? "▲ 收起" : "▼ 展開對照"}</span>
                </button>
                {showRaw && (
                  <pre style={{
                    marginTop: 8, padding: 12, background: "var(--bg-soft)", border: "1px solid var(--line)",
                    borderRadius: 6, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap",
                    maxHeight: 320, overflowY: "auto", color: "var(--ink-2)", fontFamily: "var(--font-mono)",
                  }}>
                    {resumeData?.rawText ?? "（無原始文字）"}
                  </pre>
                )}
              </div>

              {/* Actions */}
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={downloadOriginal} style={{ fontSize: 12 }}>
                  ↓ 下載原始檔案
                </button>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>上傳新版本</div>
                <div className="dropzone" onClick={() => fileRef.current?.click()}>
                  <div style={{ fontSize: 13 }}>拖放或<a href="#" onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}> 選擇檔案</a></div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>系統自動更新並重新匹配</div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
                       onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            </>
          )}
        </div>

        {/* Right: preferences */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow">求職偏好 · 即時生效</div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "4px 0 12px" }}>
            偏好變更後，職缺流立即重新計算 AI 推薦適合度。
          </p>

          {/* Locations */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>工作地區</h4>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(locationInput); } }}
                placeholder="輸入城市或國家，Enter 加入"
                list="pref-loc-suggestions"
                style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }}
              />
              <button className="btn" onClick={() => addLocation(locationInput)}>+</button>
            </div>
            <datalist id="pref-loc-suggestions">
              {WORLD_LOCATIONS.filter(l => l.toLowerCase().includes(locationInput.toLowerCase())).map(l => <option key={l} value={l} />)}
            </datalist>
            {activePref.locations.length > 0 && (
              <div className="chips">
                {activePref.locations.map(l => (
                  <span key={l} className="chip active" onClick={() => removeLocation(l)}>{l} ✕</span>
                ))}
              </div>
            )}
            <div className="chips" style={{ marginTop: 6 }}>
              {WORLD_LOCATIONS.filter(l => !activePref.locations.includes(l)).slice(0, 12).map(l => (
                <span key={l} className="chip" onClick={() => addLocation(l)}>{l}</span>
              ))}
            </div>
          </div>

          {/* Remote */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>遠端型態</h4>
            <div className="chips">
              {["onsite", "hybrid", "remote"].map(v => (
                <span key={v} className={`chip${hasPref("remote", v) ? " active" : ""}`} onClick={() => togglePref("remote", v)}>{v}</span>
              ))}
            </div>
          </div>

          {/* Industries */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>期望產業</h4>
            <div className="chips" style={{ maxHeight: 120, overflowY: "auto" }}>
              {INDUSTRIES.map(ind => (
                <span key={ind.id} className={`chip${hasPref("industries", ind.id) ? " active" : ""}`} onClick={() => togglePref("industries", ind.id)}>{ind.name}</span>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>語言</h4>
            <div className="chips">
              {["zh-TW","zh-CN","en","ja","ko","de","es","fr"].map(v => (
                <span key={v} className={`chip${hasPref("languages", v) ? " active" : ""}`} onClick={() => togglePref("languages", v)}>{v}</span>
              ))}
            </div>
          </div>

          {/* Salary range */}
          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>期望薪資範圍（年薪）</h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <input type="number" placeholder="最低" value={activePref.salaryMin || ""}
                   onChange={(e) => setPrefs({ ...activePref, salaryMin: +e.target.value })}
                   style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
            <span style={{ color: "var(--ink-3)", fontSize: 12 }}>—</span>
            <input type="number" placeholder="最高" value={activePref.salaryMax ?? ""}
                   onChange={(e) => setPrefs({ ...activePref, salaryMax: e.target.value ? +e.target.value : null })}
                   style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
            <select value={activePref.salaryCcy}
                    onChange={(e) => setPrefs({ ...activePref, salaryCcy: e.target.value })}
                    className="sort-select">
              {["TWD","USD","JPY","EUR","GBP","SGD","AUD","HKD","KRW"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>期望職稱關鍵字</h4>
          <input type="text" value={activePref.titles}
                 onChange={(e) => setPrefs({ ...activePref, titles: e.target.value })}
                 placeholder="例: Senior PM, Growth"
                 style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13, marginBottom: 14 }} />

          <button className="btn primary" onClick={savePref}>儲存偏好</button>
        </div>
      </div>
    </div>
  );
}
