// AI Hunter prototype — Detail (job + insights + CV), Saved board, Industry Top 100
const { useState: useStateD } = React;

function JobDetail({ job, onBack, savedIds, toggleSave }) {
  const ins = D.insightsByJob[job.id];
  const cv = D.cvByJob[job.id];
  const [tab, setTab] = useStateD("strategy");
  const saved = savedIds.has(job.id);

  return (
    <div className="app-content">
      <button className="btn" onClick={onBack} style={{ marginBottom: 14 }}>← 回職缺流</button>
      <div className="detail">
        <div>
          <div className="job-head">
            <h2 style={{ border: "none", padding: 0, margin: 0, fontSize: 22 }}>{job.title}</h2>
          </div>
          <div style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 4 }}>{job.company} · {job.city}, {job.country} · {job.remote}</div>
          <div className="job-meta" style={{ marginTop: 8 }}>
            <span>💼 {job.type}</span>
            <span>💰 {fmtSalary(job)}</span>
            <span>👤 {job.yearsMin}–{job.yearsMax} yr</span>
            <span>🕐 {job.postedAt}</span>
            <span>🎯 匹配 {Math.round(job.score*100)}</span>
          </div>
          <div className="source-line" style={{ marginTop: 10 }}>
            <span>來源: {sourceUrlHost(job.sourceUrl)}</span>
            <span>· 抓取於 8 小時前</span>
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">查看原文 ↗</a>
            <span className="tag good">內容與來源一致</span>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`btn star ${saved ? "on" : ""}`} onClick={() => toggleSave(job.id)}>
              {saved ? "★ 已收藏 — 面試策略已生成" : "☆ 收藏並生成面試策略"}
            </button>
            <a className="btn primary" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">前往原始職缺 ↗</a>
          </div>
        </div>

        {!saved && (
          <div className="callout">點擊「收藏」即觸發 agent: SWOT 分析、風險清單、面經彙整、CV 客製版,通常 ≤ 30 秒完成。</div>
        )}

        {saved && ins && (
          <>
            <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line)", marginTop: 8 }}>
              {[["strategy","面試策略 / SWOT"],["risks","風險"],["qa","面經 / 題庫"],["cv","CV 客製版"]].map(([k,l]) => (
                <button key={k} onClick={() => setTab(k)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 12px",
                                 fontFamily: "inherit", fontSize: 13, color: tab===k?"var(--ink)":"var(--ink-3)",
                                 borderBottom: tab===k?"2px solid var(--ink)":"2px solid transparent", fontWeight: tab===k?600:500 }}>
                  {l}
                </button>
              ))}
            </div>

            {tab === "strategy" && (
              <div>
                <div className="swot">
                  <div className="quad S"><h4>Strengths</h4><ul>{ins.swot.S.map((s,i)=><li key={i}>{s}</li>)}</ul></div>
                  <div className="quad W"><h4>Weaknesses</h4><ul>{ins.swot.W.map((s,i)=><li key={i}>{s}</li>)}</ul></div>
                  <div className="quad O"><h4>Opportunities</h4><ul>{ins.swot.O.map((s,i)=><li key={i}>{s}</li>)}</ul></div>
                  <div className="quad T"><h4>Threats</h4><ul>{ins.swot.T.map((s,i)=><li key={i}>{s}</li>)}</ul></div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="eyebrow">建議策略</div>
                  <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{ins.strategy}</p>
                </div>
              </div>
            )}

            {tab === "risks" && (
              <div className="risks">
                {ins.risks.map((r,i) => (
                  <div className="risk" key={i}>
                    <div><div className="lbl">{r.label}</div><span className={`sev ${r.severity}`}>{r.severity}</span></div>
                    <div style={{ color: "var(--ink-2)" }}>{r.note}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "qa" && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>常見題目 / 回答骨架</div>
                <div className="qa-list">
                  {ins.questions.map((qa,i) => (
                    <div className="qa" key={i}><div className="q">Q{i+1}. {qa.q}</div><div className="a">骨架: {qa.outline}</div></div>
                  ))}
                </div>
                <div className="eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>外部面經 / 評價 (僅連結)</div>
                <div className="refs-list">
                  {ins.refs.map((r,i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer">
                      <span>[{r.source}]</span><span style={{ color: "var(--ink)" }}>{r.title}</span><span style={{ marginLeft: "auto" }}>↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {tab === "cv" && cv && (
              <div>
                <div className="callout">{cv.diffNote} 你可以採用整版、單段套用,或駁回。</div>
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow">Summary</div>
                  <div className="diff-block">
                    <div className="diff-side before"><div className="lbl">Before</div>{cv.summary.before}</div>
                    <div className="diff-side after"><div className="lbl">After</div>{cv.summary.after}</div>
                  </div>
                </div>
                {cv.bullets.map((b,i) => (
                  <div key={i}>
                    <div className="eyebrow">Bullet {i+1}</div>
                    <div className="diff-block">
                      <div className="diff-side before"><div className="lbl">Before</div>{b.before}</div>
                      <div className="diff-side after"><div className="lbl">After</div>{b.after}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn primary">採用整版並下載 PDF</button>
                  <button className="btn">編輯</button>
                  <button className="btn">駁回</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SavedView({ savedIds, openJob }) {
  const stages = [
    { id: "saved", label: "Saved" },
    { id: "preparing", label: "Preparing" },
    { id: "applied", label: "Applied" },
    { id: "interview", label: "Interview" },
    { id: "closed", label: "Closed" },
  ];
  const buckets = {
    saved: ["j_003","j_007"],
    preparing: ["j_001"],
    applied: ["j_002"],
    interview: [],
    closed: ["j_005"],
  };
  const all = new Map(D.jobs.map(j => [j.id, j]));

  return (
    <div className="app-content">
      <div className="section-h"><h3>我的收藏</h3><span className="sub">點擊卡片可看面試策略 · 拖動可換 stage (示意)</span></div>
      <div className="kanban">
        {stages.map(s => {
          const ids = buckets[s.id].filter(id => savedIds.has(id) || ["preparing","applied","interview","closed"].includes(s.id));
          return (
            <div className="kcol" key={s.id}>
              <header><span>{s.label}</span><span className="count">{ids.length}</span></header>
              {ids.map(id => {
                const j = all.get(id);
                if (!j) return null;
                return (
                  <div className="kjob" key={id} onClick={() => openJob(j)}>
                    <h4>{j.title}</h4>
                    <div className="meta">{j.company} · {j.city}</div>
                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="score-pill" style={{ fontSize: 11 }}>{Math.round(j.score*100)}</span>
                      <a href={j.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>原文 ↗</a>
                    </div>
                  </div>
                );
              })}
              {ids.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>(空)</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IndustryView() {
  const [ind, setInd] = useStateD("tech.saas");
  const rows = D.top100Sample[ind] || [];
  const fmtPct = (n) => n == null ? "—" : (n>=0?"+":"") + (n*100).toFixed(1) + "%";
  return (
    <div className="app-content">
      <div className="section-h">
        <h3>產業 Top 100 公司</h3>
        <span className="sub">每日 03:00 UTC 更新 · 股價 ≤ 15 分鐘延遲</span>
      </div>
      <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {D.industries.map(i => (
          <span key={i.id} className={`chip ${ind===i.id?"active":""}`} onClick={() => setInd(i.id)}>{i.name}</span>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="industry-table">
          <thead>
            <tr>
              <th className="rank">#</th><th>公司</th><th>樣態</th><th>股價</th><th>1M / 1Y</th>
              <th>優點</th><th>缺點</th><th>趨勢</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.rank}>
                <td className="rank">{r.rank}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.ticker || "—"}</div>
                </td>
                <td style={{ color: "var(--ink-2)" }}>{r.profile}</td>
                <td>
                  {r.price != null ? <>
                    <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{r.price}</div>
                    <div className={`change ${r.d1 >= 0 ? "up" : "down"}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{fmtPct(r.d1)} 1d</div>
                  </> : <span style={{ color: "var(--ink-3)" }}>未上市</span>}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <div className={`change ${(r.m1||0) >= 0 ? "up" : "down"}`}>{fmtPct(r.m1)}</div>
                  <div className={`change ${(r.y1||0) >= 0 ? "up" : "down"}`}>{fmtPct(r.y1)}</div>
                </td>
                <td><ul>{r.pros.map((p,i)=><li key={i}>{p}</li>)}</ul></td>
                <td><ul>{r.cons.map((p,i)=><li key={i}>{p}</li>)}</ul></td>
                <td style={{ color: "var(--ink-2)" }}>{r.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-3)" }}>
        資料來源:Glassdoor、公司官網、財報、新聞 (近 30 天)。優缺點為來源摘要,非系統評斷。
      </div>
    </div>
  );
}

function Settings({ onLogout }) {
  return (
    <div className="app-content">
      <div className="section-h"><h3>設定</h3><span className="sub">帳號、通知、語言、隱私</span></div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="eyebrow">帳號</div>
        <div className="kv"><dt>已登入</dt><dd>{D.user.email}</dd></div>
        <div className="kv"><dt>登出</dt><dd><button className="btn" onClick={onLogout}>登出此裝置</button></dd></div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="eyebrow">通知</div>
        <div className="kv"><dt>新匹配職缺</dt><dd>每日摘要 (Email)</dd></div>
        <div className="kv"><dt>最低分數門檻</dt><dd>0.70</dd></div>
        <div className="kv"><dt>安靜時段</dt><dd>22:00 – 08:00 (Asia/Taipei)</dd></div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="eyebrow">語言</div>
        <div className="kv"><dt>介面</dt><dd>zh-TW</dd></div>
        <div className="kv"><dt>履歷與職缺對照</dt><dd>多語 (auto)</dd></div>
      </div>
      <div className="card">
        <div className="eyebrow">隱私</div>
        <div className="kv"><dt>履歷加密</dt><dd>AES-256 at-rest · KMS envelope</dd></div>
        <div className="kv"><dt>LLM 呼叫</dt><dd>Zero-retention 模式</dd></div>
        <div className="kv"><dt>刪除帳號</dt><dd><a href="#">永久刪除帳號與資料</a></dd></div>
      </div>
    </div>
  );
}

Object.assign(window, { JobDetail, SavedView, IndustryView, Settings });
