"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES } from "@/lib/mock-data";

const STEPS = ["上傳履歷", "求職偏好", "完成"];

interface ParsedResume {
  name?: string;
  headline?: string;
  skills?: { name: string; years: number }[];
}

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [prefs, setPrefs] = useState({
    locations: [] as string[],
    remote: [] as string[],
    industries: [] as string[],
    languages: [] as string[],
    salaryMin: 0,
    salaryCcy: "TWD",
    titles: "",
  });

  const togglePref = (key: keyof typeof prefs, val: string) => {
    const cur = (prefs[key] as string[]) ?? [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    setPrefs({ ...prefs, [key]: next });
  };
  const hasPref = (key: keyof typeof prefs, val: string) =>
    ((prefs[key] as string[]) ?? []).includes(val);

  const parseAndSave = async (rawText: string, fileName?: string) => {
    setParsing(true);
    try {
      const r = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const { parsed: p } = await r.json();
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, parsed: p, fileName }),
      });
      setParsed(p);
      setStep(1);
    } finally {
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
      const { rawText, parsed: p, fileName, fileData, fileMime } = await r.json();
      await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, parsed: p, fileName, fileData, fileMime }),
      });
      setParsed(p);
      setStep(1);
    } catch (e) {
      console.error(e);
      alert("解析失敗，請確認檔案格式或稍後再試。");
    } finally {
      setParsing(false);
    }
  };

  const savePrefsAndFinish = async () => {
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setStep(2);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 22, letterSpacing: "-.02em" }}>
            AI Hunter
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
            AI 驅動求職助手
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
                background: i < step ? "var(--accent)" : i === step ? "var(--accent)" : "var(--bg-elev)",
                color: i <= step ? "#fff" : "var(--ink-3)",
                border: i === step ? "2px solid var(--accent)" : "2px solid var(--line)",
                opacity: i > step ? 0.5 : 1,
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 12, color: i === step ? "var(--ink)" : "var(--ink-3)" }}>{s}</span>
              {i < STEPS.length - 1 && (
                <div style={{ width: 24, height: 1, background: "var(--line)" }} />
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 24 }}>
          {/* Step 0: Upload resume */}
          {step === 0 && (
            <>
              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>上傳你的履歷</h3>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--ink-3)" }}>
                AI 自動抽取技能、年資、職稱，用於職缺匹配。
              </p>

              {parsing ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <div className="spinner" style={{ margin: "0 auto 12px" }} />
                  <div className="eyebrow">Agent 解析中… 抽取技能 / 年資 / 職稱 / 經歷</div>
                </div>
              ) : (
                <>
                  <div
                    className="dropzone"
                    onClick={() => fileRef.current?.click()}
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ fontSize: 14 }}>
                      拖放 PDF / DOCX / TXT<br />
                      或<a href="#" onClick={(e) => { e.preventDefault(); fileRef.current?.click(); }}> 點擊選擇檔案</a>
                    </div>
                    <div style={{ fontSize: 11, marginTop: 8 }}>解析後自動填入</div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />

                  <div style={{ textAlign: "center", margin: "12px 0", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>— 或貼上文字 —</div>

                  <textarea
                    placeholder="貼上你的履歷文字…"
                    style={{ width: "100%", minHeight: 100, padding: 10, fontFamily: "inherit", fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)", resize: "vertical" }}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  {text && (
                    <button
                      className="btn primary"
                      style={{ marginTop: 10, width: "100%" }}
                      onClick={() => parseAndSave(text)}
                    >
                      解析文字
                    </button>
                  )}

                  <button
                    className="btn"
                    style={{ marginTop: 10, width: "100%", color: "var(--ink-3)", fontSize: 12 }}
                    onClick={() => setStep(1)}
                  >
                    跳過，稍後再上傳
                  </button>
                </>
              )}
            </>
          )}

          {/* Step 1: Preferences */}
          {step === 1 && (
            <>
              {parsed && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--bg-soft)", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{parsed.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{parsed.headline}</div>
                  {(parsed.skills?.length ?? 0) > 0 && (
                    <div className="skill-row" style={{ marginTop: 8 }}>
                      {(parsed.skills ?? []).slice(0, 6).map((s) => (
                        <span key={s.name} className="skill-pill">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <h3 style={{ margin: "0 0 6px", fontSize: 18 }}>設定求職偏好</h3>
              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-3)" }}>
                這些偏好將用於 AI 職缺匹配。
              </p>

              {[
                { label: "工作地區", key: "locations" as const, options: ["Taipei","Tokyo","Singapore","San Francisco","New York","London","Remote"] },
                { label: "遠端型態", key: "remote" as const, options: ["onsite","hybrid","remote"] },
                { label: "期望產業", key: "industries" as const, options: INDUSTRIES.slice(0, 6).map((i) => i.id), labels: Object.fromEntries(INDUSTRIES.map((i) => [i.id, i.name])) },
              ].map(({ label, key, options, labels }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <h4 style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 6px", letterSpacing: ".06em" }}>{label}</h4>
                  <div className="chips">
                    {options.map((v) => (
                      <span
                        key={v}
                        className={`chip${hasPref(key, v) ? " active" : ""}`}
                        onClick={() => togglePref(key, v)}
                      >
                        {(labels as Record<string, string> | undefined)?.[v] ?? v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input
                  type="number"
                  value={prefs.salaryMin || ""}
                  onChange={(e) => setPrefs({ ...prefs, salaryMin: +e.target.value })}
                  placeholder="最低薪資"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }}
                />
                <select
                  value={prefs.salaryCcy}
                  onChange={(e) => setPrefs({ ...prefs, salaryCcy: e.target.value })}
                  className="sort-select"
                >
                  {["TWD","USD","JPY","EUR","GBP","SGD"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn primary"
                style={{ marginTop: 16, width: "100%" }}
                onClick={savePrefsAndFinish}
              >
                儲存偏好，開始找工作 →
              </button>
            </>
          )}

          {/* Step 2: Done */}
          {step === 2 && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
              <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>設定完成！</h3>
              <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 24px" }}>
                AI Hunter 已準備好為你尋找最適合的職缺
              </p>
              <button
                className="btn primary"
                style={{ width: "100%", fontSize: 15, padding: "12px" }}
                onClick={() => router.push("/feed")}
              >
                查看職缺流 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
