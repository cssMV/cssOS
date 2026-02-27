import React, { useEffect, useMemo, useState } from "react";

type Tier = "guest" | "free" | "creator" | "pro" | "prime";
type WorkStatus = "draft" | "rendering" | "ready" | "published";
type WorkType = "mv" | "opera";

type WorkCard = {
  id: string;
  title: string;
  type: WorkType;
  status: WorkStatus;
  progress: number;
  updatedAt: string;
  price: number;
  views: number;
};

type Goal = {
  id: string;
  title: string;
  done: number;
  total: number;
};

type Props = {
  tier: Tier;
  workId?: string;
};

const TIER_META: Record<Tier, { label: string; quota: number; quality: string }> = {
  guest: { label: "GUEST", quota: 2, quality: "480P" },
  free: { label: "FREE", quota: 5, quality: "720P" },
  creator: { label: "CREATOR", quota: 30, quality: "1080P" },
  pro: { label: "PRO", quota: 100, quality: "2K" },
  prime: { label: "PRIME", quota: 300, quality: "4K" },
};

function pct(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function statusColor(status: WorkStatus) {
  if (status === "published") return "#45f3b0";
  if (status === "ready") return "#70e6ff";
  if (status === "rendering") return "#ffd166";
  return "#a4adbf";
}

async function apiGetGoals(): Promise<Goal[]> {
  return [
    { id: "g1", title: "本周发布作品", done: 2, total: 4 },
    { id: "g2", title: "本月播放目标", done: 12600, total: 20000 },
    { id: "g3", title: "商用授权成交", done: 5, total: 8 },
  ];
}

async function apiGetWorks(): Promise<WorkCard[]> {
  return [
    {
      id: "w-1024",
      title: "Neon Aria",
      type: "opera",
      status: "published",
      progress: 100,
      updatedAt: "2h ago",
      price: 12.9,
      views: 3891,
    },
    {
      id: "w-2052",
      title: "Pulse Runner",
      type: "mv",
      status: "ready",
      progress: 100,
      updatedAt: "5h ago",
      price: 3.8,
      views: 1277,
    },
    {
      id: "w-3341",
      title: "Echo District",
      type: "mv",
      status: "rendering",
      progress: 68,
      updatedAt: "12m ago",
      price: 2.99,
      views: 0,
    },
    {
      id: "w-3399",
      title: "Glass Orbit",
      type: "opera",
      status: "draft",
      progress: 24,
      updatedAt: "1d ago",
      price: 9.99,
      views: 0,
    },
  ];
}

async function apiPublishWork(id: string): Promise<void> {
  console.log("publish", id);
}

async function apiArchiveWork(id: string): Promise<void> {
  console.log("archive", id);
}

function StatTile(props: { label: string; value: string; hint: string }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 14,
      padding: 14,
      background: "rgba(7, 12, 21, 0.72)",
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ fontSize: 11, letterSpacing: 1.2, opacity: 0.72 }}>{props.label}</div>
      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700 }}>{props.value}</div>
      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.66 }}>{props.hint}</div>
    </div>
  );
}

function ActionBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "soft" | "solid" }) {
  const { tone = "soft", style, ...rest } = props;
  const solid = tone === "solid";
  return (
    <button
      {...rest}
      style={{
        border: solid ? "none" : "1px solid rgba(140, 208, 255, 0.34)",
        background: solid ? "linear-gradient(120deg,#4ed0ff,#45f3b0)" : "rgba(17, 27, 44, 0.76)",
        color: solid ? "#061018" : "#eaf4ff",
        borderRadius: 12,
        padding: "8px 12px",
        fontWeight: 600,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.45 : 1,
        transition: "transform .16s ease, opacity .16s ease",
        ...style,
      }}
    />
  );
}

export default function WorksCenterPanel({ tier }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [works, setWorks] = useState<WorkCard[]>([]);
  const [busyId, setBusyId] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [g, w] = await Promise.all([apiGetGoals(), apiGetWorks()]);
      setGoals(g);
      setWorks(w);
    })();
  }, []);

  const summary = useMemo(() => {
    const published = works.filter((w) => w.status === "published").length;
    const rendering = works.filter((w) => w.status === "rendering").length;
    const totalViews = works.reduce((n, w) => n + w.views, 0);
    const avgPrice = works.length ? works.reduce((n, w) => n + w.price, 0) / works.length : 0;
    return { published, rendering, totalViews, avgPrice };
  }, [works]);

  async function publish(id: string) {
    setBusyId(id);
    try {
      await apiPublishWork(id);
      setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, status: "published", progress: 100 } : w)));
      setToast("作品已上架");
    } finally {
      setBusyId("");
      setTimeout(() => setToast(""), 1400);
    }
  }

  async function archive(id: string) {
    setBusyId(id);
    try {
      await apiArchiveWork(id);
      setWorks((prev) => prev.filter((w) => w.id !== id));
      setToast("作品已归档");
    } finally {
      setBusyId("");
      setTimeout(() => setToast(""), 1400);
    }
  }

  const tierMeta = TIER_META[tier];

  return (
    <div style={{
      minHeight: "100%",
      color: "#eaf4ff",
      background:
        "radial-gradient(1000px 500px at 0% -10%, rgba(67,170,255,.24), transparent 55%), radial-gradient(900px 500px at 100% 10%, rgba(69,243,176,.18), transparent 50%), linear-gradient(180deg,#03060d,#070d17 40%,#080e1a)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: 20,
      boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
      fontFamily: "'IBM Plex Sans', 'Avenir Next', sans-serif",
    }}>
      <style>{`
        .ws-grid { display:grid; grid-template-columns: 1.4fr 1fr; gap:14px; }
        .ws-card { border:1px solid rgba(255,255,255,.12); border-radius:14px; background:rgba(8,13,23,.76); backdrop-filter: blur(8px); }
        .ws-card-inner { padding:14px; }
        .ws-goalbar { height:7px; border-radius:999px; background:rgba(255,255,255,.14); overflow:hidden; }
        .ws-goalfill { height:100%; background:linear-gradient(90deg,#4ed0ff,#45f3b0); }
        .ws-work-item { border:1px solid rgba(255,255,255,.09); border-radius:12px; padding:12px; background:rgba(9,16,30,.62); }
        .ws-chip { border:1px solid rgba(140,208,255,.4); color:#9de7ff; border-radius:999px; padding:2px 8px; font-size:11px; letter-spacing:.6px; }
        .ws-glow { animation: wsPulse 3s ease-in-out infinite; }
        @keyframes wsPulse { 0%{box-shadow:0 0 0 rgba(78,208,255,0);} 50%{box-shadow:0 0 24px rgba(78,208,255,.24);} 100%{box-shadow:0 0 0 rgba(78,208,255,0);} }
        @media (max-width: 920px) { .ws-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.7 }}>WORKS CENTER</div>
          <h2 style={{ margin: "6px 0 0", fontSize: 28, letterSpacing: 0.5 }}>作品中心</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="ws-chip">{tierMeta.label}</span>
          <span className="ws-chip">质量上限 {tierMeta.quality}</span>
          <span className="ws-chip">额度 {tierMeta.quota}/月</span>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,minmax(120px,1fr))", gap: 10 }}>
        <StatTile label="PUBLISHED" value={`${summary.published}`} hint="已发布作品" />
        <StatTile label="RENDERING" value={`${summary.rendering}`} hint="处理中作品" />
        <StatTile label="TOTAL VIEWS" value={`${summary.totalViews}`} hint="全量播放" />
        <StatTile label="AVG PRICE" value={`$${summary.avgPrice.toFixed(2)}`} hint="平均定价" />
      </div>

      <div className="ws-grid" style={{ marginTop: 14 }}>
        <div className="ws-card ws-glow">
          <div className="ws-card-inner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>创作目标</h3>
              <ActionBtn tone="solid">新建作品</ActionBtn>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {goals.map((g) => (
                <div key={g.id} className="ws-work-item">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span>{g.title}</span>
                    <span style={{ opacity: 0.72 }}>{g.done}/{g.total}</span>
                  </div>
                  <div className="ws-goalbar" style={{ marginTop: 8 }}>
                    <div className="ws-goalfill" style={{ width: `${pct(g.done, g.total)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ws-card">
          <div className="ws-card-inner">
            <h3 style={{ margin: 0, fontSize: 16 }}>调度面板</h3>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="ws-work-item">
                <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.76 }}>RENDER QUEUE</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{summary.rendering}</div>
              </div>
              <div className="ws-work-item">
                <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.76 }}>NEXT RELEASE</div>
                <div style={{ marginTop: 6, fontSize: 15 }}>Pulse Runner</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.66 }}>预计 4 小时后上架</div>
              </div>
              <div className="ws-work-item">
                <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.76 }}>TARGET FOCUS</div>
                <div style={{ marginTop: 6, fontSize: 14, opacity: 0.92 }}>优先完成歌剧中长内容，提升商用授权转化。</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ws-card" style={{ marginTop: 14 }}>
        <div className="ws-card-inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>作品矩阵</h3>
            <div style={{ fontSize: 12, opacity: 0.7 }}>实时状态 / 一键发布 / 归档管理</div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {works.map((w) => (
              <div key={w.id} className="ws-work-item">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{w.title}</span>
                      <span style={{ fontSize: 11, border: `1px solid ${statusColor(w.status)}`, color: statusColor(w.status), borderRadius: 999, padding: "2px 8px" }}>
                        {w.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{w.type.toUpperCase()}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
                      ${w.price.toFixed(2)} · {w.views} views · {w.updatedAt}
                    </div>
                    <div className="ws-goalbar" style={{ marginTop: 8, width: 180 }}>
                      <div className="ws-goalfill" style={{ width: `${w.progress}%` }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <ActionBtn
                      tone="solid"
                      disabled={busyId === w.id || w.status === "published" || w.status === "draft"}
                      onClick={() => publish(w.id)}
                    >
                      {busyId === w.id ? "处理中" : "发布"}
                    </ActionBtn>
                    <ActionBtn disabled={busyId === w.id} onClick={() => archive(w.id)}>归档</ActionBtn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          border: "1px solid rgba(140,208,255,.38)",
          background: "rgba(11,18,33,.92)",
          borderRadius: 10,
          padding: "10px 12px",
          fontSize: 13,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
