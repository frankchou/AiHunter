// AI Hunter prototype — base: Login, Onboarding, Sidebar, ResumeView
const { useState, useMemo, useEffect } = React;

const D = window.AH_DATA;

const fmtSalary = (j) => {
  if (!j.salaryMin) return "薪資未公開";
  const f = (n) => n >= 1000000 ? (n/10000).toFixed(0) + "萬" : n.toLocaleString();
  if (j.ccy === "TWD") return `${f(j.salaryMin)}–${f(j.salaryMax)} TWD`;
  if (j.ccy === "JPY") return `¥${(j.salaryMin/10000).toFixed(0)}–${(j.salaryMax/10000).toFixed(0)} 萬`;
  return `${j.ccy} ${(j.salaryMin/1000).toFixed(0)}k–${(j.salaryMax/1000).toFixed(0)}k`;
};
const sourceUrlHost = (url) => { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return url; } };

// ---------- Login ----------
function Login({ onLogin }) {
  const [mode, setMode] = useState("returning"); // 'returning' | 'new' — 系統會用 OAuth 後端判別,這裡讓 demo 切換
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="mark">AH</div>
        <h2>登入 AI Hunter</h2>
        <p>用你的履歷,讓 agent 為你掃描全球職缺。</p>

        <div style={{ display: "flex", gap: 6, padding: 4, background: "var(--bg-soft)", borderRadius: 8, marginBottom: 14, border: "1px solid var(--line)" }}>
          <button onClick={() => setMode("returning")}
                  style={{ flex: 1, padding: "8px 10px", background: mode === "returning" ? "var(--bg-elev)" : "transparent", border: "1px solid " + (mode === "returning" ? "var(--line)" : "transparent"), borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--ink)" }}>
            既有使用者
          </button>
          <button onClick={() => setMode("new")}
                  style={{ flex: 1, padding: "8px 10px", background: mode === "new" ? "var(--bg-elev)" : "transparent", border: "1px solid " + (mode === "new" ? "var(--line)" : "transparent"), borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "var(--ink)" }}>
            全新使用者
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 12px" }}>
          {mode === "returning" ? "登入後直接進入職缺流。" : "登入後需先建立履歷與偏好,才能開始使用。"}
        </p>

        <button className="btn-oauth primary" onClick={() => onLogin(mode)}>使用 Google 登入</button>
        <button className="btn-oauth" onClick={() => onLogin(mode)}>使用 LinkedIn 登入</button>
        <button className="btn-oauth" onClick={() => onLogin(mode)}>使用 Email 登入</button>
        <p style={{ marginTop: 18, fontSize: 11.5 }}>
          登入即同意 <a href="#">服務條款</a> 與 <a href="#">隱私政策</a>。
        </p>
      </div>
    </div>
  );
}

// ---------- Onboarding (forced resume creation) ----------
function Onboarding({ onDone }) {
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [prefs, setPrefs] = useState({
    locations: ["Taipei", "Remote"],
    salaryMin: 2400000,
    salaryCcy: "TWD",
    industries: ["tech.saas", "ai"],
    employment: ["ft"],
    remote: ["hybrid", "remote"],
    languages: ["zh-TW", "en"],
    titles: "Senior PM, Growth PM",
  });

  const togglePref = (key, val) => {
    setPrefs(p => {
      const cur = new Set(p[key]);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...p, [key]: Array.from(cur) };
    });
  };
  const hasPref = (key, val) => prefs[key].includes(val);

  const simulateParse = () => {
    setParsing(true);
    setTimeout(() => {
      setParsed({
        name: D.user.name,
        headline: D.user.headline,
        skills: D.resume.skills,
        experience: D.resume.experience,
      });
      setParsing(false);
    }, 1400);
  };

  return (
    <div className="login-bg" style={{ alignItems: "flex-start", paddingTop: 60 }}>
      <div className="login-card" style={{ maxWidth: 640 }}>
        <div className="mark">AH</div>
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {[1,2,3].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: n <= step ? "var(--ink)" : "var(--line)"
            }}/>
          ))}
        </div>
        <h2 style={{ marginTop: 16 }}>
          {step === 1 ? "建立你的履歷" : step === 2 ? "確認自動抽取的內容" : "設定求職偏好"}
        </h2>
        <p>
          {step === 1 ? "上傳檔案或貼上文字,系統會解析為結構化履歷,做為職缺匹配依據。" :
           step === 2 ? "確認 / 修改 agent 從履歷中抽取的欄位。這些內容直接驅動匹配演算法。" :
           "完成後,職缺流會立即根據你的履歷 + 偏好,從全球來源抓取並排序。"}
        </p>

        {step === 1 && (
          <div>
            {!parsed && !parsing && (
              <>
                <div className="dropzone" onClick={simulateParse}>
                  <div style={{ fontSize: 14 }}>拖放 PDF / DOCX / TXT<br/>或 <a href="#" onClick={e=>e.preventDefault()}>點擊選擇檔案</a></div>
                  <div style={{ fontSize: 11, marginTop: 8 }}>解析後欄位將自動填入系統履歷</div>
                </div>
                <div style={{ textAlign: "center", margin: "10px 0", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>— 或 —</div>
                <textarea placeholder="貼上你的履歷文字..." style={{
                  width: "100%", minHeight: 120, padding: 10, fontFamily: "inherit",
                  fontSize: 12.5, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)"
                }}/>
                <button className="btn-oauth primary" style={{ marginTop: 10 }} onClick={simulateParse}>用文字解析</button>
              </>
            )}
            {parsing && (
              <div className="card" style={{ textAlign: "center", padding: 28, marginTop: 8 }}>
                <div className="banner" style={{ marginBottom: 10, justifyContent: "center" }}>
                  <div className="pulse"></div>
                  <span>Agent 解析中... 抽取技能 / 年資 / 職稱 / 經歷</span>
                </div>
              </div>
            )}
            {parsed && !parsing && (
              <div className="card" style={{ marginTop: 8 }}>
                <div className="eyebrow">解析完成 · 抽取到</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{parsed.name} · {parsed.headline}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
                  {parsed.skills.length} 個技能 · {parsed.experience.length} 段工作經歷
                </div>
                <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setStep(2)}>下一步:確認內容</button>
              </div>
            )}
          </div>
        )}

        {step === 2 && parsed && (
          <div>
            <div className="card">
              <div className="eyebrow">基本資訊</div>
              <div style={{ fontWeight: 600, fontSize: 16, marginTop: 4 }}>{parsed.name}</div>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{parsed.headline}</div>
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>技能 ({parsed.skills.length})</div>
                <div className="skill-row">
                  {parsed.skills.map(s => <span key={s.name} className="skill-pill">{s.name}<span className="yrs">{s.years}y</span></span>)}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>工作經歷</div>
                {parsed.experience.map((e,i) => (
                  <div className="timeline-item" key={i}>
                    <div className="when">{e.years}</div>
                    <div><div style={{ fontWeight: 600 }}>{e.title}</div><div style={{ color: "var(--ink-3)", fontSize: 12 }}>{e.company} · {e.location}</div></div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setStep(1)}>← 重新上傳</button>
              <button className="btn primary" onClick={() => setStep(3)}>下一步:設定偏好</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>工作地區 · 多選</div>
              <div className="chips">
                {["Taipei","Tokyo","Singapore","San Francisco","New York","London","Berlin","Sydney","Remote"].map(c => (
                  <span key={c} className={`chip ${hasPref("locations", c) ? "active" : ""}`} onClick={() => togglePref("locations", c)}>{c}</span>
                ))}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>遠端 / 工作型態</div>
              <div className="chips" style={{ marginBottom: 8 }}>
                {[["onsite","onsite"],["hybrid","hybrid"],["remote","remote"]].map(([id,l]) => (
                  <span key={id} className={`chip ${hasPref("remote", id) ? "active" : ""}`} onClick={() => togglePref("remote", id)}>{l}</span>
                ))}
              </div>
              <div className="chips">
                {[["ft","Full-time"],["pt","Part-time"],["contract","Contract"],["intern","Intern"]].map(([id,l]) => (
                  <span key={id} className={`chip ${hasPref("employment", id) ? "active" : ""}`} onClick={() => togglePref("employment", id)}>{l}</span>
                ))}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>期望薪資 (年)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" value={prefs.salaryMin} onChange={e => setPrefs(p => ({...p, salaryMin: +e.target.value}))}
                       style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
                <select value={prefs.salaryCcy} onChange={e => setPrefs(p => ({...p, salaryCcy: e.target.value}))} className="sort-select">
                  {["TWD","USD","JPY","EUR","GBP","SGD","AUD"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{ color: "var(--ink-3)", fontSize: 12 }}>以上</span>
              </div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>期望產業 · 多選</div>
              <div className="chips">
                {D.industries.map(i => (
                  <span key={i.id} className={`chip ${hasPref("industries", i.id) ? "active" : ""}`} onClick={() => togglePref("industries", i.id)}>{i.name}</span>
                ))}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>語言能力</div>
              <div className="chips">
                {["zh-TW","zh-CN","en","ja","ko","de","es","fr"].map(l => (
                  <span key={l} className={`chip ${hasPref("languages", l) ? "active" : ""}`} onClick={() => togglePref("languages", l)}>{l}</span>
                ))}
              </div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>期望職稱關鍵字</div>
              <input type="text" value={prefs.titles} onChange={e => setPrefs(p => ({...p, titles: e.target.value}))}
                     placeholder="例: Senior PM, Growth, Platform"
                     style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={() => setStep(2)}>← 上一步</button>
              <button className="btn primary" onClick={() => onDone(parsed, prefs)}>完成 · 開始抓職缺 →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Sidebar ----------
function Sidebar({ view, setView, sideOpen, setSideOpen }) {
  const items = [
    { id: "feed", label: "職缺流" },
    { id: "saved", label: "我的收藏" },
    { id: "resume", label: "履歷" },
    { id: "industry", label: "產業 Top 100" },
    { id: "settings", label: "設定" },
  ];
  return (
    <aside className={`app-side ${sideOpen ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">AH</div> AI Hunter
      </div>
      <div className="side-nav">
        {items.map(it => (
          <button key={it.id} className={view === it.id ? "active" : ""}
                  onClick={() => { setView(it.id); setSideOpen(false); }}>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11, color: "var(--ink-3)", padding: 10, borderTop: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="avatar">{D.user.avatar}</div>
          <div>
            <div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 12 }}>{D.user.name}</div>
            <div>{D.user.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------- Resume View ----------
function ResumeView({ prefs, setPrefs }) {
  const togglePref = (key, val) => {
    setPrefs(p => {
      const cur = new Set(p[key]);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...p, [key]: Array.from(cur) };
    });
  };
  const hasPref = (key, val) => prefs[key]?.includes(val);

  return (
    <div className="app-content">
      <div className="section-h"><h3>履歷</h3><span className="sub">{D.user.resumeName} · v3 · 已啟用 · 內容驅動職缺匹配</span></div>
      <div className="resume-grid">
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow">基本資訊 · 自動填入</div>
          <h2 style={{ border: "none", margin: "8px 0 4px", fontSize: 22 }}>{D.user.name}</h2>
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{D.user.headline}</div>
          <div style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>技能 · 自動抽取</div>
            <div className="skill-row">
              {D.resume.skills.map(s => (
                <span key={s.name} className="skill-pill">{s.name}<span className="yrs">{s.years} yr</span></span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>工作經歷 · 自動抽取</div>
            {D.resume.experience.map((e, i) => (
              <div className="timeline-item" key={i}>
                <div className="when">{e.years}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.title} · {e.company}</div>
                  <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{e.location}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>上傳新版本</div>
            <div className="dropzone">
              <div style={{ fontSize: 13 }}>拖放 PDF / DOCX 到此處 · <a href="#" onClick={e=>e.preventDefault()}>選擇檔案</a></div>
              <div style={{ fontSize: 11, marginTop: 6 }}>系統會自動更新內容並重新匹配職缺</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow">求職偏好 · 即時生效</div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "4px 0 12px" }}>偏好變更後,職缺流立即重新計算 AI 推薦適合度。</p>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "10px 0 6px", letterSpacing: "0.06em" }}>工作地區</h4>
          <div className="chips">
            {["Taipei","Tokyo","Singapore","San Francisco","New York","London","Berlin","Sydney","Remote"].map(c => (
              <span key={c} className={`chip ${hasPref("locations", c) ? "active" : ""}`} onClick={() => togglePref("locations", c)}>{c}</span>
            ))}
          </div>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "14px 0 6px", letterSpacing: "0.06em" }}>遠端</h4>
          <div className="chips">
            {["onsite","hybrid","remote"].map(r => (
              <span key={r} className={`chip ${hasPref("remote", r) ? "active" : ""}`} onClick={() => togglePref("remote", r)}>{r}</span>
            ))}
          </div>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "14px 0 6px", letterSpacing: "0.06em" }}>期望薪資 (年)</h4>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="number" value={prefs.salaryMin} onChange={e => setPrefs(p => ({...p, salaryMin: +e.target.value}))}
                   style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
            <select value={prefs.salaryCcy} onChange={e => setPrefs(p => ({...p, salaryCcy: e.target.value}))} className="sort-select">
              {["TWD","USD","JPY","EUR","GBP","SGD","AUD"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ color: "var(--ink-3)", fontSize: 12 }}>以上</span>
          </div>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "14px 0 6px", letterSpacing: "0.06em" }}>期望產業</h4>
          <div className="chips">
            {D.industries.map(i => (
              <span key={i.id} className={`chip ${hasPref("industries", i.id) ? "active" : ""}`} onClick={() => togglePref("industries", i.id)}>{i.name}</span>
            ))}
          </div>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "14px 0 6px", letterSpacing: "0.06em" }}>語言</h4>
          <div className="chips">
            {["zh-TW","zh-CN","en","ja","ko","de","es","fr"].map(l => (
              <span key={l} className={`chip ${hasPref("languages", l) ? "active" : ""}`} onClick={() => togglePref("languages", l)}>{l}</span>
            ))}
          </div>

          <h4 style={{ fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--ink-3)", margin: "14px 0 6px", letterSpacing: "0.06em" }}>期望職稱關鍵字</h4>
          <input type="text" value={prefs.titles} onChange={e => setPrefs(p => ({...p, titles: e.target.value}))}
                 placeholder="例: Senior PM, Growth"
                 style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "inherit", fontSize: 13 }} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Login, Onboarding, Sidebar, ResumeView, fmtSalary, sourceUrlHost });
