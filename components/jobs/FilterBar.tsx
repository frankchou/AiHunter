"use client";
import { INDUSTRIES, JOB_SOURCES } from "@/lib/mock-data";
import { CULTURE_TAGS } from "@/lib/culture-keywords";
import type { JobFilters } from "@/lib/types";

interface Props {
  filters: JobFilters;
  onChange: (f: JobFilters) => void;
}

export function FilterBar({ filters, onChange }: Props) {
  const toggle = (key: keyof JobFilters, val: string) => {
    const cur = (filters[key] as string[] | undefined) ?? [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    onChange({ ...filters, [key]: next });
  };
  const has = (key: keyof JobFilters, val: string) =>
    ((filters[key] as string[] | undefined) ?? []).includes(val);

  return (
    <div className="filters">
      {/* Saved filter preset (UI only) */}
      <div>
        <span className="filter-label">儲存的篩選</span>
        <select className="sort-select" style={{ width: "100%" }}>
          <option>— 選擇預設 —</option>
          <option>台北 Senior PM</option>
          <option>遠端 AI 職缺</option>
        </select>
      </div>

      <div>
        <div className="row">
          <div className="col">
            <span className="filter-label">地區</span>
            <div className="chips">
              {["TW","US","JP","GB","AU","SG","DE"].map((c) => (
                <span key={c} className={`chip${has("countries", c) ? " active" : ""}`}
                      onClick={() => toggle("countries", c)}>{c}</span>
              ))}
            </div>
          </div>
          <div className="col">
            <span className="filter-label">工作型態</span>
            <div className="chips">
              {["onsite","hybrid","remote"].map((r) => (
                <span key={r} className={`chip${has("remote", r) ? " active" : ""}`}
                      onClick={() => toggle("remote", r)}>{r}</span>
              ))}
            </div>
          </div>
          <div className="col">
            <span className="filter-label">產業</span>
            <div className="chips">
              {INDUSTRIES.map((i) => (
                <span key={i.id} className={`chip${has("industries", i.id) ? " active" : ""}`}
                      onClick={() => toggle("industries", i.id)}>{i.name}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="col" style={{ maxWidth: 220 }}>
            <span className="filter-label">年資 (年)</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="number" placeholder="min" style={{ width: "50%" }}
                     value={filters.yearsMin ?? ""} onChange={(e) => onChange({ ...filters, yearsMin: e.target.value ? +e.target.value : undefined })} />
              <span style={{ color: "var(--ink-3)" }}>–</span>
              <input type="number" placeholder="max" style={{ width: "50%" }}
                     value={filters.yearsMax ?? ""} onChange={(e) => onChange({ ...filters, yearsMax: e.target.value ? +e.target.value : undefined })} />
            </div>
          </div>
          <div className="col">
            <span className="filter-label">職稱關鍵字</span>
            <input type="text" placeholder="Senior PM, Growth" value={filters.titles ?? ""}
                   onChange={(e) => onChange({ ...filters, titles: e.target.value })} />
          </div>
          <div className="col">
            <span className="filter-label">來源</span>
            <div className="chips">
              {JOB_SOURCES.map((s) => (
                <span key={s.id} className={`chip${has("sources", s.id) ? " active" : ""}`}
                      onClick={() => toggle("sources", s.id)}>{s.name}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="col" style={{ flex: "1 1 100%" }}>
            <span className="filter-label">企業文化</span>
            <div className="chips">
              {CULTURE_TAGS.map((t) => (
                <span key={t.key} className={`chip${has("culture", t.key) ? " active" : ""}`}
                      onClick={() => toggle("culture", t.key)}>{t.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
