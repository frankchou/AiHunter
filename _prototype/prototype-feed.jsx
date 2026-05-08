// AI Hunter prototype — Feed (collapsible filters + pagination + AI default sort)
const { useState: useStateF, useMemo: useMemoF } = React;

function FilterBar({ filters, setFilters }) {
  const toggle = (key, val) => {
    setFilters(f => {
      const cur = new Set(f[key] || []);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...f, [key]: Array.from(cur) };
    });
  };
  const has = (key, val) => (filters[key] || []).includes(val);
  const lbl = (s) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s}</span>;

  return (
    <div className="filters">
      <div className="grp">
        <label>儲存的篩選</label>
        <select className="sort-select">
          <option>矽谷 Senior PM (alert on)</option>
          <option>東京 / 遠端 PM</option>
          <option>+ 新增篩選組合</option>
        </select>
      </div>
      <div>
        <div className="row">
          <div className="col"><label className="grp">{lbl("地區")}</label>
            <div className="chips">
              {["TW","US","JP","GB","AU","SG","DE"].map(c => (
                <span key={c} className={`chip ${has("countries", c) ? "active": ""}`} onClick={() => toggle("countries", c)}>{c}</span>
              ))}
            </div>
          </div>
          <div className="col"><label className="grp">{lbl("工作型態")}</label>
            <div className="chips">
              {["onsite","hybrid","remote"].map(r => (
                <span key={r} className={`chip ${has("remote", r) ? "active": ""}`} onClick={() => toggle("remote", r)}>{r}</span>
              ))}
            </div>
          </div>
          <div className="col"><label className="grp">{lbl("產業")}</label>
            <div className="chips">
              {D.industries.map(i => (
                <span key={i.id} className={`chip ${has("industries", i.id) ? "active": ""}`} onClick={() => toggle("industries", i.id)}>{i.name}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div className="col" style={{ maxWidth: 220 }}><label className="grp">{lbl("經驗 (年)")}</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" placeholder="min" value={filters.yearsMin || ""} onChange={e => setFilters(f => ({...f, yearsMin: +e.target.value||0}))} />
              <span style={{ color: "var(--ink-3)" }}>–</span>
              <input type="number" placeholder="max" value={filters.yearsMax || ""} onChange={e => setFilters(f => ({...f, yearsMax: +e.target.value||0}))} />
            </div>
          </div>
          <div className="col"><label className="grp">{lbl("職稱關鍵字")}</label>
            <input type="text" placeholder="ex: Senior PM, Growth" value={filters.titles || ""} onChange={e => setFilters(f => ({...f, titles: e.target.value}))}/>
          </div>
          <div className="col"><label className="grp">{lbl("來源")}</label>
            <div className="chips">
              {D.sources.map(s => (
                <span key={s.id} className={`chip ${has("sources", s.id) ? "active": ""}`} onClick={() => toggle("sources", s.id)}>{s.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, saved, onSave, onOpen }) {
  return (
    <div className="job-card">
      <div>
        <div className="job-head">
          <h3>{job.title}</h3>
          <span className="co">· {job.company}</span>
          {job.ticker !== "—" && <span className="tag">{job.ticker}</span>}
        </div>
        <div className="job-meta">
          <span>📍 {job.city}, {job.country} · {job.remote}</span>
          <span>💼 {job.type}</span>
          <span>💰 {fmtSalary(job)}</span>
          <span>👤 {job.yearsMin}–{job.yearsMax} yr</span>
          <span>🕐 {job.postedAt}</span>
        </div>
        <div className="match-reasons">AI 推薦理由: {job.matchReasons.join(" · ")}</div>
        <div className="job-tags">
          {job.skills.map(s => <span key={s} className="tag">{s}</span>)}
          <span className="tag accent">來源: {sourceUrlHost(job.sourceUrl)}</span>
        </div>
      </div>
      <div className="job-side">
        <span className="score-pill">{Math.round(job.score * 100)}</span>
        <button className={`btn star ${saved ? "on" : ""}`} onClick={onSave} title="收藏">
          {saved ? "★ 已收藏" : "☆ 收藏"}
        </button>
        <button className="btn" onClick={() => onOpen(job)}>檢視</button>
        <a className="btn primary" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">原始職缺 ↗</a>
      </div>
    </div>
  );
}

function FeedView({ savedIds, toggleSave, openJob, prefs }) {
  const [filters, setFilters] = useStateF({ countries: [], remote: [], industries: [], sources: [] });
  const [showFilters, setShowFilters] = useStateF(false);
  const [q, setQ] = useStateF("");
  const [sort, setSort] = useStateF("score");
  const [streaming, setStreaming] = useStateF(true);
  const [page, setPage] = useStateF(1);
  const [pageSize, setPageSize] = useStateF(10);

  const visible = useMemoF(() => {
    let arr = D.jobs.slice();
    // 偏好已預先套用 (以 reasons 中已體現),這裡是進一步使用者篩選
    if (filters.countries?.length) arr = arr.filter(j => filters.countries.includes(j.country));
    if (filters.remote?.length) arr = arr.filter(j => filters.remote.includes(j.remote));
    if (filters.industries?.length) arr = arr.filter(j => filters.industries.includes(j.industry));
    if (filters.sources?.length) arr = arr.filter(j => filters.sources.includes(j.source));
    if (filters.yearsMin) arr = arr.filter(j => j.yearsMax >= filters.yearsMin);
    if (filters.yearsMax) arr = arr.filter(j => j.yearsMin <= filters.yearsMax);
    if (filters.titles) arr = arr.filter(j => j.title.toLowerCase().includes(filters.titles.toLowerCase()));
    if (q) arr = arr.filter(j => (j.title + j.company + j.skills.join(" ")).toLowerCase().includes(q.toLowerCase()));
    if (sort === "score") arr.sort((a,b) => b.score - a.score);
    if (sort === "date") arr.sort((a,b) => a.postedAt.localeCompare(b.postedAt));
    if (sort === "salary") arr.sort((a,b) => (b.salaryMax||0) - (a.salaryMax||0));
    return arr;
  }, [filters, q, sort]);

  const total = visible.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const curPage = Math.min(page, totalPages);
  const sliceStart = (curPage - 1) * pageSize;
  const pageItems = visible.slice(sliceStart, sliceStart + pageSize);

  // 條件變更時重置頁碼
  React.useEffect(() => { setPage(1); }, [filters, q, sort, pageSize]);

  const activeFilterCount =
    (filters.countries?.length || 0) + (filters.remote?.length || 0) +
    (filters.industries?.length || 0) + (filters.sources?.length || 0) +
    (filters.titles ? 1 : 0) + (filters.yearsMin ? 1 : 0) + (filters.yearsMax ? 1 : 0);

  return (
    <div className="app-content">
      {streaming && (
        <div className="banner">
          <div className="pulse"></div>
          <div>Agent 已根據你的履歷 + 偏好 (地區: {(prefs?.locations||[]).slice(0,3).join("/")} · 產業: {(prefs?.industries||[]).length} 個) 從 7 個來源抓取 · 已聚合 {D.jobs.length} 筆,持續更新中</div>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setStreaming(false)}>隱藏</button>
        </div>
      )}

      <div className="section-h">
        <h3>職缺流 — {total} 筆</h3>
        <span className="sub">基於 {D.user.resumeName} + 偏好 · AI 推薦適合度 高 → 低</span>
      </div>

      <div className="search-row">
        <input className="q" placeholder="搜尋職稱、公司、技能…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="score">AI 推薦適合度</option>
          <option value="date">最新</option>
          <option value="salary">薪資高至低</option>
        </select>
        <button className="btn" onClick={() => setShowFilters(s => !s)}>
          {showFilters ? "收起篩選" : "顯示篩選"}{activeFilterCount > 0 && <span className="tag accent" style={{ marginLeft: 4 }}>{activeFilterCount}</span>}
        </button>
      </div>

      {showFilters && <FilterBar filters={filters} setFilters={setFilters} />}

      <div className="job-list">
        {pageItems.map(j => (
          <JobCard key={j.id} job={j}
                   saved={savedIds.has(j.id)}
                   onSave={() => toggleSave(j.id)}
                   onOpen={openJob} />
        ))}
        {pageItems.length === 0 && (
          <div className="card" style={{ textAlign: "center", color: "var(--ink-3)" }}>沒有符合條件的職缺,試試移除幾個篩選。</div>
        )}
      </div>

      {total > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "12px 14px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            顯示 {sliceStart + 1}–{Math.min(sliceStart + pageSize, total)} / {total}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>每頁</span>
            <select className="sort-select" value={pageSize} onChange={e => setPageSize(+e.target.value)}>
              {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn" disabled={curPage <= 1} onClick={() => setPage(1)}>« 首頁</button>
            <button className="btn" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹ 上一頁</button>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "0 6px" }}>{curPage} / {totalPages}</span>
            <button className="btn" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一頁 ›</button>
            <button className="btn" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)}>末頁 »</button>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { FeedView, JobCard, FilterBar });
