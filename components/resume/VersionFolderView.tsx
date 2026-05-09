"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(async (r) => {
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error ?? "error"), { status: r.status, data });
  return data;
});

interface VersionItem {
  id: string;
  kind: "general" | "tailored";
  docType: "resume" | "cv";
  fileName: string;
  jobId?: string;
  jobTitle?: string;
  company?: string;
  updatedAt: string;
  downloadable: boolean;
  hasContent: boolean;
}

interface VersionsResponse {
  resumes: VersionItem[];
  coverLetters: VersionItem[];
}

interface DetailResponse {
  id: string;
  kind: "general" | "tailored";
  docType: "resume" | "cv";
  fileName?: string;
  rawText?: string;
  parsed?: unknown;
  content?: string;
  summary?: { before: string; after: string };
  bullets?: { before: string; after: string }[];
  diffNote?: string;
  job?: { title: string; company: string };
}

function typeKey(item: VersionItem): "resume-a" | "resume-b" | "cv-a" | "cv-b" {
  if (item.docType === "resume") return item.kind === "general" ? "resume-a" : "resume-b";
  return item.kind === "general" ? "cv-a" : "cv-b";
}

export function VersionFolderView() {
  const { data, error, isLoading } = useSWR<VersionsResponse>("/api/resume/versions", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const [openItem, setOpenItem] = useState<VersionItem | null>(null);

  if (isLoading) {
    return (
      <div className="app-content">
        <div style={{ textAlign: "center", padding: 60 }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <div className="eyebrow">載入版本夾…</div>
        </div>
      </div>
    );
  }

  if (error && (error as { status?: number }).status === 403) {
    return (
      <div className="app-content">
        <div className="section-h"><h3>履歷版本</h3></div>
        <UpsellCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-content">
        <div className="section-h"><h3>履歷版本</h3></div>
        <div className="card" style={{ padding: 24, color: "var(--ink-3)" }}>無法載入，請稍後再試。</div>
      </div>
    );
  }

  const resumes = data?.resumes ?? [];
  const coverLetters = data?.coverLetters ?? [];

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>📁 履歷版本</h3>
        <span className="sub">集中保存所有履歷與 CV 版本 · 唯讀</span>
      </div>

      <Section
        title="履歷"
        subtitle="A 一般履歷（不可刪）+ B 針對性履歷（每職缺一份，從職缺 Prepare 頁刪除）"
        items={resumes}
        onOpen={setOpenItem}
        emptyHint="尚未上傳一般履歷，請先到「履歷」頁上傳。"
      />

      <div style={{ height: 28 }} />

      <Section
        title="CV (Cover Letter)"
        subtitle="A 一般 CV（不可刪）+ B 針對性 CV（每職缺一份）"
        items={coverLetters}
        onOpen={setOpenItem}
        emptyHint="尚未撰寫一般 CV，請先到「履歷」頁編寫。"
      />

      {openItem && <PreviewModal item={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

function UpsellCard() {
  return (
    <div className="card" style={{ padding: 24, textAlign: "center", maxWidth: 520 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>履歷版本夾為 Max 旗艦專屬</div>
      <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 16 }}>
        集中管理你的所有履歷與 CV 版本，包含每個職缺的針對性產出。<br />
        升級 Max 後可開啟版本夾並使用針對性履歷 / CV 撰寫功能。
      </div>
      <Link href="/pricing" className="btn primary" style={{ fontSize: 14 }}>🚀 查看升級方案</Link>
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
  onOpen,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  items: VersionItem[];
  onOpen: (it: VersionItem) => void;
  emptyHint: string;
}) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{subtitle}</div>
      </div>
      {items.length === 0 ? (
        <div className="card" style={{ padding: 18, color: "var(--ink-3)", fontSize: 13 }}>{emptyHint}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => <Row key={`${typeKey(it)}_${it.id}`} item={it} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function Row({ item, onOpen }: { item: VersionItem; onOpen: (it: VersionItem) => void }) {
  const tk = typeKey(item);
  const onDownload = () => {
    if (!item.downloadable) return;
    window.location.href = `/api/resume/versions/${item.id}/download?type=${tk}`;
  };

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.fileName}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, fontSize: 11, color: "var(--ink-3)", flexWrap: "wrap" }}>
          <span className={`tag${item.kind === "tailored" ? " good" : ""}`} style={{ fontSize: 10 }}>
            {item.kind === "general" ? "一般版" : "針對性"}
          </span>
          {item.kind === "tailored" && item.company && <span>{item.company} · {item.jobTitle}</span>}
          <span>· {new Date(item.updatedAt).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          className="btn"
          onClick={() => onOpen(item)}
          disabled={!item.hasContent}
          style={{ fontSize: 12 }}
        >
          預覽
        </button>
        <button
          className="btn"
          onClick={onDownload}
          disabled={!item.downloadable}
          title={item.downloadable ? "下載原始檔" : "AI 生成內容暫不提供下載"}
          style={{ fontSize: 12 }}
        >
          下載
        </button>
        {item.kind === "tailored" && item.jobId && (
          <Link href={`/job/${item.jobId}`} className="btn" style={{ fontSize: 12 }}>
            原職缺 ↗
          </Link>
        )}
      </div>
    </div>
  );
}

function PreviewModal({ item, onClose }: { item: VersionItem; onClose: () => void }) {
  const tk = typeKey(item);
  const { data, isLoading } = useSWR<DetailResponse>(
    `/api/resume/versions/${item.id}?type=${tk}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-elev)", borderRadius: 10, maxWidth: 820, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.fileName}
          </div>
          <button className="btn" onClick={onClose} style={{ fontSize: 12 }}>關閉</button>
        </div>
        <div style={{ padding: 18, overflow: "auto", flex: 1 }}>
          {isLoading && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>載入中…</div>}
          {data && <PreviewBody data={data} />}
        </div>
      </div>
    </div>
  );
}

function PreviewBody({ data }: { data: DetailResponse }) {
  if (data.docType === "cv" && typeof data.content === "string") {
    return (
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--ink-1)" }}>
        {data.content}
      </pre>
    );
  }
  if (data.docType === "resume" && data.kind === "general" && typeof data.rawText === "string") {
    return (
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--ink-1)" }}>
        {data.rawText}
      </pre>
    );
  }
  if (data.docType === "resume" && data.kind === "tailored") {
    return (
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {data.diffNote && <div className="callout" style={{ marginBottom: 14 }}>{data.diffNote}</div>}
        {data.summary && (
          <div style={{ marginBottom: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Summary</div>
            <div className="diff-block">
              <div className="diff-side before"><div className="lbl">Before</div>{data.summary.before}</div>
              <div className="diff-side after"><div className="lbl">After</div>{data.summary.after}</div>
            </div>
          </div>
        )}
        {data.bullets?.map((b, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Bullet {i + 1}</div>
            <div className="diff-block">
              <div className="diff-side before"><div className="lbl">Before</div>{b.before}</div>
              <div className="diff-side after"><div className="lbl">After</div>{b.after}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <div style={{ fontSize: 13, color: "var(--ink-3)" }}>無內容可預覽</div>;
}
