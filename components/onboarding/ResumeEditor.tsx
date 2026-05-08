"use client";
import { useState } from "react";
import type { ParsedResume } from "@/lib/types";

interface Props {
  initial: ParsedResume;
  onSave: (updated: ParsedResume) => void;
  onCancel: () => void;
}

export function ResumeEditor({ initial, onSave, onCancel }: Props) {
  const [d, setD] = useState<ParsedResume>(JSON.parse(JSON.stringify(initial)));

  const setField = <K extends keyof ParsedResume>(k: K, v: ParsedResume[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  // Skills
  const setSkill = (i: number, field: "name" | "years", v: string | number) =>
    setD((prev) => {
      const skills = [...prev.skills];
      skills[i] = { ...skills[i], [field]: field === "years" ? Number(v) : v };
      return { ...prev, skills };
    });
  const addSkill = () => setD((prev) => ({ ...prev, skills: [...prev.skills, { name: "", years: 0 }] }));
  const removeSkill = (i: number) => setD((prev) => ({ ...prev, skills: prev.skills.filter((_, idx) => idx !== i) }));

  // Experience
  const setExp = (i: number, field: keyof ParsedResume["experience"][0], v: string) =>
    setD((prev) => {
      const experience = [...prev.experience];
      experience[i] = { ...experience[i], [field]: v };
      return { ...prev, experience };
    });
  const setBullet = (ei: number, bi: number, v: string) =>
    setD((prev) => {
      const experience = [...prev.experience];
      const bullets = [...(experience[ei].bullets ?? [])];
      bullets[bi] = v;
      experience[ei] = { ...experience[ei], bullets };
      return { ...prev, experience };
    });
  const addBullet = (ei: number) =>
    setD((prev) => {
      const experience = [...prev.experience];
      experience[ei] = { ...experience[ei], bullets: [...(experience[ei].bullets ?? []), ""] };
      return { ...prev, experience };
    });
  const removeBullet = (ei: number, bi: number) =>
    setD((prev) => {
      const experience = [...prev.experience];
      experience[ei] = { ...experience[ei], bullets: (experience[ei].bullets ?? []).filter((_, idx) => idx !== bi) };
      return { ...prev, experience };
    });
  const addExp = () =>
    setD((prev) => ({
      ...prev,
      experience: [...prev.experience, { title: "", company: "", startDate: "", endDate: "present", years: "", location: "", bullets: [""] }],
    }));
  const removeExp = (i: number) => setD((prev) => ({ ...prev, experience: prev.experience.filter((_, idx) => idx !== i) }));

  // Education
  const setEdu = (i: number, field: string, v: string) =>
    setD((prev) => {
      const education = [...(prev.education ?? [])];
      education[i] = { ...education[i], [field]: v };
      return { ...prev, education };
    });
  const addEdu = () =>
    setD((prev) => ({ ...prev, education: [...(prev.education ?? []), { degree: "", major: "", school: "", year: "" }] }));
  const removeEdu = (i: number) =>
    setD((prev) => ({ ...prev, education: (prev.education ?? []).filter((_, idx) => idx !== i) }));

  // List fields (certifications, awards)
  const setListItem = (key: "certifications" | "awards", i: number, v: string) =>
    setD((prev) => {
      const arr = [...(prev[key] ?? [])];
      arr[i] = v;
      return { ...prev, [key]: arr };
    });
  const addListItem = (key: "certifications" | "awards") =>
    setD((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ""] }));
  const removeListItem = (key: "certifications" | "awards", i: number) =>
    setD((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((_, idx) => idx !== i) }));

  const input = (style?: object) => ({
    padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)",
    background: "var(--bg)", fontFamily: "inherit", fontSize: 13,
    width: "100%", ...style,
  });
  const label = { fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase" as const, color: "var(--ink-3)", letterSpacing: ".06em", marginBottom: 4, display: "block" };
  const section = { marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--line)" };

  return (
    <div style={{ fontSize: 13 }}>

      {/* 基本資訊 */}
      <div style={section}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>基本資訊</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><span style={label}>姓名</span><input value={d.name} onChange={e => setField("name", e.target.value)} style={input()} /></div>
          <div><span style={label}>Email</span><input value={d.email ?? ""} onChange={e => setField("email", e.target.value)} style={input()} /></div>
          <div><span style={label}>電話</span><input value={d.phone ?? ""} onChange={e => setField("phone", e.target.value)} style={input()} /></div>
          <div><span style={label}>地點</span><input value={d.location ?? ""} onChange={e => setField("location", e.target.value)} style={input()} /></div>
        </div>
        <div style={{ marginTop: 10 }}><span style={label}>標題 / Headline</span><input value={d.headline} onChange={e => setField("headline", e.target.value)} style={input()} /></div>
        <div style={{ marginTop: 10 }}><span style={label}>摘要</span>
          <textarea value={d.summary ?? ""} onChange={e => setField("summary", e.target.value)}
            style={{ ...input({ minHeight: 80, resize: "vertical" as const }) }} />
        </div>
      </div>

      {/* 技能 */}
      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>技能</div>
          <button className="btn" style={{ fontSize: 11 }} onClick={addSkill}>+ 新增</button>
        </div>
        {d.skills.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input value={s.name} onChange={e => setSkill(i, "name", e.target.value)} placeholder="技能名稱" style={input({ flex: 3 })} />
            <input type="number" value={s.years} onChange={e => setSkill(i, "years", e.target.value)} placeholder="年" min={0} style={input({ width: 64 })} />
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>年</span>
            <button onClick={() => removeSkill(i)} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
          </div>
        ))}
      </div>

      {/* 工作經歷 */}
      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>工作經歷</div>
          <button className="btn" style={{ fontSize: 11 }} onClick={addExp}>+ 新增</button>
        </div>
        {d.experience.map((e, ei) => (
          <div key={ei} style={{ marginBottom: 16, padding: 12, background: "var(--bg)", borderRadius: 6, border: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div><span style={label}>職稱</span><input value={e.title} onChange={v => setExp(ei, "title", v.target.value)} style={input()} /></div>
              <div><span style={label}>公司</span><input value={e.company} onChange={v => setExp(ei, "company", v.target.value)} style={input()} /></div>
              <div><span style={label}>開始日期</span><input value={e.startDate} placeholder="YYYY-MM" onChange={v => setExp(ei, "startDate", v.target.value)} style={input()} /></div>
              <div><span style={label}>結束日期</span><input value={e.endDate} placeholder="YYYY-MM 或 present" onChange={v => setExp(ei, "endDate", v.target.value)} style={input()} /></div>
              <div><span style={label}>地點</span><input value={e.location} onChange={v => setExp(ei, "location", v.target.value)} style={input()} /></div>
            </div>
            <span style={label}>工作內容</span>
            {(e.bullets ?? []).map((b, bi) => (
              <div key={bi} style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                <textarea value={b} onChange={v => setBullet(ei, bi, v.target.value)}
                  style={{ ...input({ flex: 1, minHeight: 40, resize: "vertical" as const }) }} />
                <button onClick={() => removeBullet(ei, bi)} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 16, alignSelf: "flex-start", padding: "4px" }}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <button className="btn" style={{ fontSize: 11 }} onClick={() => addBullet(ei)}>+ 新增條目</button>
              <button onClick={() => removeExp(ei)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>刪除此段經歷</button>
            </div>
          </div>
        ))}
      </div>

      {/* 學歷 */}
      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>學歷</div>
          <button className="btn" style={{ fontSize: 11 }} onClick={addEdu}>+ 新增</button>
        </div>
        {(d.education ?? []).map((ed, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10, padding: 10, background: "var(--bg)", borderRadius: 6, border: "1px solid var(--line)" }}>
            <div><span style={label}>學位</span><input value={ed.degree} onChange={v => setEdu(i, "degree", v.target.value)} style={input()} /></div>
            <div><span style={label}>科系</span><input value={ed.major ?? ""} onChange={v => setEdu(i, "major", v.target.value)} style={input()} /></div>
            <div><span style={label}>學校</span><input value={ed.school} onChange={v => setEdu(i, "school", v.target.value)} style={input()} /></div>
            <div><span style={label}>畢業年份</span><input value={ed.year} onChange={v => setEdu(i, "year", v.target.value)} style={input()} /></div>
            <div style={{ gridColumn: "span 2", textAlign: "right" }}>
              <button onClick={() => removeEdu(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>刪除</button>
            </div>
          </div>
        ))}
      </div>

      {/* 證照 */}
      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>證照</div>
          <button className="btn" style={{ fontSize: 11 }} onClick={() => addListItem("certifications")}>+ 新增</button>
        </div>
        {(d.certifications ?? []).map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={c} onChange={v => setListItem("certifications", i, v.target.value)} style={input({ flex: 1 })} />
            <button onClick={() => removeListItem("certifications", i)} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ))}
      </div>

      {/* 獎項 */}
      <div style={{ ...section, borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>獎項 / 成就</div>
          <button className="btn" style={{ fontSize: 11 }} onClick={() => addListItem("awards")}>+ 新增</button>
        </div>
        {(d.awards ?? []).map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={a} onChange={v => setListItem("awards", i, v.target.value)} style={input({ flex: 1 })} />
            <button onClick={() => removeListItem("awards", i)} style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ))}
      </div>

      {/* 操作按鈕 */}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onCancel}>取消</button>
        <button className="btn primary" style={{ flex: 2 }} onClick={() => onSave(d)}>儲存修正，重新分析 →</button>
      </div>
    </div>
  );
}
