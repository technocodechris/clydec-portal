import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Lock, Mail, Eye, EyeOff, LayoutDashboard, FolderOpen, Users, Shield,
  Bell, LogOut, Upload, Download, Trash2, Plus, X, Check, Clock,
  ChevronDown, Search, FileText, Settings, UserPlus, AlertCircle,
  Loader2, Building2, KeyRound, Image as ImageIcon, File as FileIcon,
  ShieldCheck, Inbox, ChevronRight, CircleAlert, CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";

/* ---------------------------------------------------------------- */
/* Design tokens                                                     */
/* ---------------------------------------------------------------- */
const CSS = `
  .cly { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .cly-serif { font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif; }
  .cly-mono { font-family: "SF Mono", Menlo, Consolas, monospace; }
  .cly *, .cly *::before, .cly *::after { box-sizing: border-box; }
  .cly ::-webkit-scrollbar { width: 8px; height: 8px; }
  .cly ::-webkit-scrollbar-thumb { background: #D8D4C8; border-radius: 4px; }
  .cly-scan { background-image: repeating-linear-gradient(115deg, transparent 0 40px, rgba(255,255,255,0.035) 40px 41px); }
  .cly-fade-in { animation: clyFade .35s ease both; }
  @keyframes clyFade { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform:none;} }
  .cly-shake { animation: clyShake .4s ease; }
  @keyframes clyShake { 10%,90%{transform:translateX(-1px);} 20%,80%{transform:translateX(2px);} 30%,50%,70%{transform:translateX(-4px);} 40%,60%{transform:translateX(4px);} }
  .cly-btn { cursor:pointer; border:none; transition: background .15s, opacity .15s, transform .1s; }
  .cly-btn:active { transform: scale(0.98); }
  .cly-input:focus { outline: none; border-color: #14181C !important; box-shadow: 0 0 0 3px rgba(20,24,28,0.08); }
  .cly-row:hover { background: #FAF9F6; }
  .cly-navitem:hover { background: rgba(255,255,255,0.06); }
  .cly-spin { animation: clySpin 0.9s linear infinite; }
  @keyframes clySpin { to { transform: rotate(360deg); } }
  .cly-toggle { position:relative; width:38px; height:22px; border-radius:11px; cursor:pointer; transition: background .15s; border:none; flex-shrink:0; }
  .cly-toggle::after { content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .cly-toggle.on { background:#14181C; }
  .cly-toggle.on::after { transform: translateX(16px); }
  .cly-toggle.off { background:#DCD8CC; }
  .cly-toggle:disabled { cursor:not-allowed; opacity:0.5; }
`;

const COLORS = {
  ink: "#14181C",
  ink2: "#1B2027",
  inkBorder: "#2B323A",
  cream: "#F7F5F0",
  line: "#E7E3D8",
  text: "#1A1A18",
  mute: "#7A7A70",
  creative: "#C2622D",
  creativeSoft: "#F1DECD",
  creativeText: "#8A3E17",
  data: "#3B6EA5",
  dataSoft: "#DCE6F0",
  dataText: "#204A72",
  success: "#3F8F5F",
  successSoft: "#DCEEE1",
  warning: "#B8862F",
  warningSoft: "#F5E9D2",
  danger: "#B4423A",
  dangerSoft: "#F5DEDC",
  gold: "#A67C3D",
  goldSoft: "#EFE1C8",
};

const ROLE_META = {
  OWNER: { label: "Owner", color: COLORS.gold, soft: COLORS.goldSoft, text: "#6B4A1A", desc: "Full control of the workspace" },
  ADMIN: { label: "Admin", color: COLORS.data, soft: COLORS.dataSoft, text: COLORS.dataText, desc: "Manages users, can request access changes" },
  EMPLOYEE: { label: "Employee", color: COLORS.creative, soft: COLORS.creativeSoft, text: COLORS.creativeText, desc: "Works inside assigned folders" },
  CLIENT: { label: "Client", color: "#4F8272", soft: "#DCEBE5", text: "#2E5347", desc: "Views their own project only" },
};

/* ---------------------------------------------------------------- */
/* Storage / auth: real backend, via src/firebase.js                 */
/* ---------------------------------------------------------------- */
import {
  watchAuth, login as fbLogin, logout as fbLogout, createUserAccount,
  requestPasswordReset as requestPasswordResetFor,
  sget, sset, listCollection, setDocIn, addDocIn, updateDocIn, deleteDocIn,
  uploadFile, deleteFileFromStorage, db,
} from "./firebase";
import { doc as fsDoc, getDoc } from "firebase/firestore";

import { driveUpload, driveDownload, driveDelete, driveSyncFolder, getPendingUpload, clearPendingUpload, driveListFolders, driveCreateFolder, driveRenameFolder, driveDeleteFolder, driveGetStorageQuota } from "./driveStorage";

const STORAGE_PROVIDER = import.meta.env.VITE_STORAGE_PROVIDER === "drive" ? "drive" : "firebase";

function uid() { return Math.random().toString(36).slice(2, 10); }
function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function downloadFromUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.target = "_blank";
  document.body.appendChild(a); a.click(); a.remove();
}
function formatDuration(sec) {
  if (sec == null || !isFinite(sec)) return "calculating…";
  const s = Math.round(sec);
  if (s < 60) return `${s}s left`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s left`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left`;
}

/* ---------------------------------------------------------------- */
/* Seed data                                                          */
/* ---------------------------------------------------------------- */
// Fallback shape only — with Firebase connected, real users come from the
// "users" Firestore collection (profile: name/role/status) paired with a
// Firebase Auth account (email/password) that shares the same uid.
// See README.md "First-run setup" for how to create your first owner.
const SEED_USERS = [];

const SEED_GROUPS = [
  { id: "OWNER", name: "Owner", custom: false, description: "Full access to every workspace, file, and setting." },
  { id: "ADMIN", name: "Admin", custom: false, description: "Manages users and day-to-day operations; sensitive changes need owner approval." },
  { id: "EMPLOYEE", name: "Employee", custom: false, description: "Works inside the Creative and Data wings on assigned projects." },
  { id: "CLIENT", name: "Client", custom: false, description: "Views and downloads files from their own project only." },
];

const SEED_FOLDERS = [
  { id: "creative", name: "Creative Wing", wing: "creative", access: ["OWNER", "ADMIN", "EMPLOYEE"] },
  { id: "data", name: "Data Wing", wing: "data", access: ["OWNER", "ADMIN", "EMPLOYEE"] },
  { id: "finance", name: "Admin & Finance", wing: "data", access: ["OWNER", "ADMIN"] },
  { id: "client-aurora", name: "Clients", wing: "creative", access: ["OWNER", "ADMIN", "CLIENT"] },
];

const SEED_AUTH = {
  loginEnabled: true,
  emailPassword: true,
  signup: "disabled", // disabled | open | domain
  logoutDays: 90,
  idleTimeout: "never",
};

const SEED_NOTIF = {
  sender: "PORTAL <notifications@clydecstudio.com>",
  autoInvite: false,
  templates: [
    { id: "invite", name: "Invitation", desc: "Sent when a new user gets invited to the portal." },
    { id: "otc", name: "One-time code", desc: "Sent when a user takes an action requiring email verification." },
    { id: "reset", name: "Reset password", desc: "Sent when a user requests to reset their password." },
    { id: "comment", name: "New comment", desc: "Sent when a comment is added to a thread you're following." },
    { id: "mention", name: "New mention", desc: "Sent when someone mentions you in a thread." },
  ],
};

const DATA_CATEGORIES = ["Files & projects", "Client records", "Financial data", "User management"];
const LEVELS = ["No access", "View only", "Edit", "Full access"];
const SEED_RESTRICTIONS = {
  OWNER: [3, 3, 3, 3],
  ADMIN: [3, 2, 1, 2],
  EMPLOYEE: [2, 0, 0, 0],
  CLIENT: [1, 0, 0, 0],
};

/* ---------------------------------------------------------------- */
/* Small shared UI                                                   */
/* ---------------------------------------------------------------- */
function Badge({ color, soft, text, children }) {
  return (
    <span style={{ background: soft, color: text, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, padding: "3px 9px", borderRadius: 20, textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      className={`cly-toggle ${checked ? "on" : "off"}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: COLORS.mute }}>
      <Icon size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{body}</div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const good = toast.type !== "error";
  return (
    <div className="cly-fade-in" style={{
      position: "absolute", top: 16, right: 16, zIndex: 50, display: "flex", alignItems: "center", gap: 8,
      background: good ? COLORS.ink : COLORS.dangerSoft, color: good ? "#fff" : COLORS.danger,
      padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
    }}>
      {good ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
      {toast.msg}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Login screen                                                       */
/* ---------------------------------------------------------------- */
function LoginScreen({ onLogin, loading, error, onForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="cly" style={{ display: "flex", minHeight: 640, borderRadius: 14, overflow: "hidden", border: `1px solid ${COLORS.line}`, boxShadow: "0 20px 50px rgba(0,0,0,0.12)" }}>
      {/* left */}
      <div className="cly-scan" style={{ flex: "1 1 46%", background: `linear-gradient(160deg, ${COLORS.ink} 0%, #0E2A33 100%)`, color: "#fff", padding: "40px 44px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${COLORS.creative}, ${COLORS.data})` }} />
          <span className="cly-serif" style={{ fontSize: 16, letterSpacing: 1 }}><b>CLYDEC</b> STUDIO</span>
        </div>

        <div>
          <div style={{ display: "flex", gap: 14, marginBottom: 18, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            <span style={{ color: COLORS.creative }}>● CREATIVE WING</span>
            <span style={{ color: "#6FA3D6" }}>● DATA WING</span>
          </div>
          <h1 className="cly-serif" style={{ fontSize: 38, lineHeight: 1.15, margin: "0 0 14px" }}>
            Two disciplines.<br /><span style={{ color: COLORS.creative, fontStyle: "italic" }}>One</span> workspace.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#C7CCD1", maxWidth: 340 }}>
            The secure home for Clydec Studio's projects, files, and client conversations — animation, webtoons, dashboards, and automation, side by side.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8B9198" }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "#3FBF6F", display: "inline-block" }} />
          <span className="cly-mono">portal.clydecstudio.com</span>
        </div>
      </div>

      {/* right */}
      <div style={{ flex: "1 1 54%", background: COLORS.cream, padding: "44px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ maxWidth: 360, width: "100%", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.mute, marginBottom: 22 }}>
            <Lock size={13} /> Encrypted session
          </div>
          <h2 className="cly-serif" style={{ fontSize: 26, margin: "0 0 4px" }}>Welcome back</h2>
          <p style={{ fontSize: 13.5, color: COLORS.mute, margin: "0 0 26px" }}>Log in to your Clydec Studio workspace.</p>

          <form onSubmit={(e) => { e.preventDefault(); onLogin(email.trim().toLowerCase(), password); }} className={error ? "cly-shake" : ""}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Email</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Mail size={15} style={{ position: "absolute", left: 12, top: 12, color: COLORS.mute }} />
              <input className="cly-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clydecstudio.com" required
                style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, background: "#fff" }} />
            </div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <KeyRound size={15} style={{ position: "absolute", left: 12, top: 12, color: COLORS.mute }} />
              <input className="cly-input" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required
                style={{ width: "100%", padding: "10px 34px 10px 34px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 14, background: "#fff" }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: 9, background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10, display: "flex", gap: 5, alignItems: "center" }}><AlertCircle size={13} /> {error}</div>}
            <button type="submit" disabled={loading} className="cly-btn" style={{
              width: "100%", padding: "11px 0", background: COLORS.ink, color: "#fff", borderRadius: 9, fontSize: 14, fontWeight: 700, marginTop: 6,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1,
            }}>
              {loading ? <Loader2 size={15} className="cly-spin" /> : null}
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>

          <div style={{ fontSize: 12, color: COLORS.mute, marginTop: 14, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            Sign-ups are invite-only. Contact your owner or admin for access.
          </div>

          <button onClick={() => onForgot(email)} style={{ background: "none", border: "none", color: COLORS.mute, fontSize: 12, textDecoration: "underline", cursor: "pointer", marginTop: 18, padding: 0 }}>
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* App shell: sidebar + topbar                                        */
/* ---------------------------------------------------------------- */
function Sidebar({ user, page, setPage, pendingCount }) {
  const meta = ROLE_META[user.role];
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { key: "files", label: "Files", icon: FolderOpen, show: true },
    { key: "requests", label: "Access requests", icon: Inbox, show: user.role === "OWNER" || user.role === "ADMIN", badge: user.role === "OWNER" ? pendingCount : 0 },
    { key: "admin", label: "Admin settings", icon: Settings, show: user.role === "OWNER" || user.role === "ADMIN" },
  ];
  return (
    <div className="cly-scan" style={{ width: 216, flexShrink: 0, background: COLORS.ink, color: "#fff", display: "flex", flexDirection: "column", padding: "20px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 22px" }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: `linear-gradient(135deg, ${COLORS.creative}, ${COLORS.data})` }} />
        <span className="cly-serif" style={{ fontSize: 13.5, letterSpacing: 0.5 }}><b>CLYDEC</b> STUDIO</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.filter(i => i.show).map(i => (
          <button key={i.key} onClick={() => setPage(i.key)} className="cly-navitem cly-btn" style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: page === i.key ? "rgba(255,255,255,0.1)" : "transparent",
            color: "#fff", fontSize: 13.5, fontWeight: 500, textAlign: "left",
          }}>
            <i.icon size={16} style={{ opacity: 0.85 }} />
            <span style={{ flex: 1 }}>{i.label}</span>
            {!!i.badge && <span style={{ background: COLORS.creative, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10 }}>{i.badge}</span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12, padding: "12px 8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1A1A18" }}>
            {user.name.split(" ").map(w => w[0]).slice(0, 2).join("")}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
            <div style={{ fontSize: 10.5, color: meta.color, fontWeight: 700 }}>{meta.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ user, onLogout, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: `1px solid ${COLORS.line}` }}>
      <div>
        <h2 className="cly-serif" style={{ fontSize: 21, margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12.5, color: COLORS.mute, margin: "3px 0 0" }}>{subtitle}</p>}
      </div>
      <button onClick={onLogout} className="cly-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${COLORS.line}`, padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: COLORS.text }}>
        <LogOut size={13} /> Log out
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Dashboard page                                                     */
/* ---------------------------------------------------------------- */
function DashboardPage({ user, users, files, requests, folders, syncAllVisibleFolders }) {
  const [quota, setQuota] = useState(null);
  const [quotaError, setQuotaError] = useState(null);

  useEffect(() => {
    const visible = folders.filter(f => f.access.includes(user.role));
    syncAllVisibleFolders(visible);
    if (user.role === "OWNER" && STORAGE_PROVIDER === "drive") {
      driveGetStorageQuota().then(setQuota).catch(e => setQuotaError(e.message));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = ROLE_META[user.role];
  const stats = [
    { label: "Total files", value: files.length },
    { label: "Storage used", value: formatBytes(files.reduce((a, f) => a + f.size, 0)) },
    user.role === "OWNER" ? { label: "Workspace users", value: users.length } : null,
    user.role === "OWNER" ? { label: "Pending requests", value: requests.filter(r => r.status === "pending").length } : null,
  ].filter(Boolean);

  return (
    <div className="cly-fade-in" style={{ padding: 28 }}>
      <div style={{ background: `linear-gradient(120deg, ${COLORS.ink} 0%, #12262C 100%)`, borderRadius: 14, padding: "26px 28px", color: "#fff", marginBottom: 22 }}>
        <Badge color={meta.color} soft="rgba(255,255,255,0.12)" text="#fff">{meta.label}</Badge>
        <h3 className="cly-serif" style={{ fontSize: 22, margin: "10px 0 4px" }}>Welcome back, {user.name.split(" ")[0]}.</h3>
        <p style={{ fontSize: 13, color: "#C7CCD1", margin: 0, maxWidth: 460 }}>{meta.desc}.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 14 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: COLORS.mute, marginBottom: 6 }}>{s.label}</div>
            <div className="cly-serif" style={{ fontSize: 24 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {user.role === "OWNER" && STORAGE_PROVIDER === "drive" && (
        <div style={{ marginTop: 22, background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Google Drive storage</div>
          {quotaError ? (
            <div style={{ fontSize: 12.5, color: COLORS.mute }}>Could not load storage info: {quotaError}</div>
          ) : !quota ? (
            <div style={{ fontSize: 12.5, color: COLORS.mute, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} className="cly-spin" /> Loading…</div>
          ) : quota.limit == null ? (
            <div style={{ fontSize: 13 }}>{formatBytes(quota.usage)} used <span style={{ color: COLORS.mute }}>(unlimited plan)</span></div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}>
                <span>{formatBytes(quota.usage)} used of {formatBytes(quota.limit)}</span>
                <span style={{ color: COLORS.mute }}>{formatBytes(Math.max(0, quota.limit - quota.usage))} left</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: COLORS.cream, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (quota.usage / quota.limit) * 100)}%`, background: (quota.usage / quota.limit) > 0.9 ? COLORS.danger : COLORS.ink }} />
              </div>
            </>
          )}
        </div>
      )}
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Recent files</div>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
          {files.length === 0 ? <EmptyState icon={FolderOpen} title="No files yet" body="Uploaded files will show up here." /> :
            files.slice(0, 5).map((f, i) => (
              <div key={f.id} className="cly-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: i ? `1px solid ${COLORS.line}` : "none" }}>
                <FileIcon size={15} color={COLORS.mute} />
                <span style={{ fontSize: 13, flex: 1 }}>{f.name}</span>
                <span style={{ fontSize: 11.5, color: COLORS.mute }}>{formatBytes(f.size)}</span>
                <span style={{ fontSize: 11.5, color: COLORS.mute, width: 70, textAlign: "right" }}>{timeAgo(f.uploadedAt)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Files page                                                         */
/* ---------------------------------------------------------------- */
function FilesPage({ user, folders, files, addFile, deleteFile, downloadFile, syncDriveFolder, notify }) {
  const visibleFolders = folders.filter(f => f.access.includes(user.role));
  const [activeFolder, setActiveFolder] = useState(visibleFolders[0]?.id);
  const [path, setPath] = useState([]); // [{id, name}] — subfolder trail within the active Wing
  const [subfolders, setSubfolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(null); // { name, uploaded, total, percent, speedBps }
  const [pendingUpload, setPendingUpload] = useState(() => getPendingUpload());
  const fileInput = useRef(null);
  const resumeFileInput = useRef(null);
  const abortControllerRef = useRef(null);
  const canWrite = user.role !== "CLIENT";

  const currentFolderId = path.length ? path[path.length - 1].id : activeFolder;
  const currentWingName = visibleFolders.find(f => f.id === activeFolder)?.name;

  function goToWing(wingId) {
    setActiveFolder(wingId);
    setPath([]);
  }
  function goToPathIndex(i) {
    setPath(path.slice(0, i + 1));
  }

  async function loadFolderContents() {
    if (!currentFolderId) return;
    setLoadingFolders(true);
    try {
      const [subs] = await Promise.all([
        driveListFolders(currentFolderId),
        syncDriveFolder(currentFolderId, files),
      ]);
      setSubfolders(subs);
    } catch (e) {
      notify(`Could not load folder: ${e.message}`, "error");
    }
    setLoadingFolders(false);
  }
  useEffect(() => { loadFolderContents(); }, [currentFolderId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setSyncing(true);
    await loadFolderContents();
    setSyncing(false);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      const created = await driveCreateFolder(currentFolderId, newFolderName.trim());
      setSubfolders([...subfolders, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
      setNewFolderOpen(false);
      notify(`Folder "${created.name}" created.`);
    } catch (e) {
      notify(`Could not create folder: ${e.message}`, "error");
    }
  }

  function startRename(folder) {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  }
  async function submitRename(folder) {
    if (!renameValue.trim() || renameValue.trim() === folder.name) { setRenamingId(null); return; }
    try {
      const updated = await driveRenameFolder(folder.id, renameValue.trim());
      setSubfolders(subfolders.map(f => f.id === folder.id ? updated : f));
      notify(`Renamed to "${updated.name}".`);
    } catch (e) {
      notify(`Could not rename: ${e.message}`, "error");
    }
    setRenamingId(null);
  }
  async function handleDeleteFolder(folder) {
    if (!window.confirm(`Delete "${folder.name}" and everything inside it? This moves it to Drive's Trash (recoverable for 30 days).`)) return;
    try {
      await driveDeleteFolder(folder.id);
      setSubfolders(subfolders.filter(f => f.id !== folder.id));
      notify(`"${folder.name}" deleted.`);
    } catch (e) {
      notify(`Could not delete: ${e.message}`, "error");
    }
  }

  function handleDiscardPending() {
    clearPendingUpload();
    setPendingUpload(null);
  }

  async function handleResumeFileSelect(file) {
    if (!pendingUpload) return;
    if (file.name !== pendingUpload.fileName || file.size !== pendingUpload.fileSize) {
      notify(`That doesn't match "${pendingUpload.fileName}" — select the exact same file to resume.`, "error");
      return;
    }
    setUploading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setProgress({ name: file.name, uploaded: 0, total: file.size, percent: 0, speedBps: 0 });
    try {
      await addFile(
        { id: uid(), folderId: pendingUpload.folder, name: file.name, mime: file.type || pendingUpload.mimeType || "application/octet-stream", size: file.size, file, uploadedBy: user.name, uploadedAt: Date.now() },
        (p) => setProgress({ name: file.name, ...p }),
        controller.signal,
        pendingUpload
      );
      setPendingUpload(null);
      notify("Upload resumed and completed.");
    } catch (e) {
      if (e.name === "AbortError") {
        notify("Resume cancelled.");
        setPendingUpload(null);
      } else {
        notify(`Resume failed: ${e.message}`, "error");
      }
    }
    abortControllerRef.current = null;
    setProgress(null);
    setUploading(false);
  }

  const folderFiles = files.filter(f => f.folderId === currentFolderId && f.name.toLowerCase().includes(query.toLowerCase()));

  async function handleFiles(fileList) {
    setUploading(true);
    let cancelled = false;
    for (const file of Array.from(fileList)) {
      if (cancelled) break;
      if (file.size > 10 * 1024 * 1024 * 1024) {
        notify(`${file.name} is over the 10 GB limit — skipped.`, "error");
        continue;
      }
      const id = uid();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setProgress({ name: file.name, uploaded: 0, total: file.size, percent: 0, speedBps: 0 });
      try {
        await addFile(
          { id, folderId: currentFolderId, name: file.name, mime: file.type || "application/octet-stream", size: file.size, file, uploadedBy: user.name, uploadedAt: Date.now() },
          (p) => setProgress({ name: file.name, ...p }),
          controller.signal
        );
      } catch (e) {
        if (e.name === "AbortError") {
          notify(`${file.name} upload cancelled.`);
          cancelled = true;
        } else {
          notify(`${file.name} failed to upload: ${e.message}`, "error");
        }
      }
    }
    abortControllerRef.current = null;
    setProgress(null);
    setUploading(false);
    if (!cancelled) notify("Files uploaded.");
  }

  function handleCancelUpload() {
    abortControllerRef.current?.abort();
  }

  return (
    <div className="cly-fade-in" style={{ padding: 28, display: "flex", gap: 22 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Folders</div>
        {visibleFolders.map(f => (
          <button key={f.id} onClick={() => goToWing(f.id)} className="cly-btn" style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 8, marginBottom: 3,
            background: activeFolder === f.id ? COLORS.cream : "transparent", fontSize: 13, fontWeight: 500, color: COLORS.text,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: f.wing === "creative" ? COLORS.creative : COLORS.data, flexShrink: 0 }} />
            {f.name}
          </button>
        ))}
        <div style={{ marginTop: 18, fontSize: 11.5, color: COLORS.mute, lineHeight: 1.5, background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 10 }}>
          Files here are stored securely in {STORAGE_PROVIDER === "drive" ? "your connected Google Drive" : "Firebase Cloud Storage"}. Limit: 10 GB per file.
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13, color: COLORS.mute, flexWrap: "wrap" }}>
          <button onClick={() => goToWing(activeFolder)} className="cly-btn" style={{ background: "none", border: "none", padding: 0, fontWeight: path.length === 0 ? 700 : 500, color: path.length === 0 ? COLORS.text : COLORS.mute, cursor: "pointer" }}>
            {currentWingName}
          </button>
          {path.map((p, i) => (
            <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ChevronRight size={13} />
              <button onClick={() => goToPathIndex(i)} className="cly-btn" style={{ background: "none", border: "none", padding: 0, fontWeight: i === path.length - 1 ? 700 : 500, color: i === path.length - 1 ? COLORS.text : COLORS.mute, cursor: "pointer" }}>
                {p.name}
              </button>
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: COLORS.mute }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search files…"
              style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
          </div>
          {canWrite && (
            <>
              <button onClick={() => setNewFolderOpen(!newFolderOpen)} className="cly-btn" style={{
                display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${COLORS.line}`, color: COLORS.text, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              }}>
                <Plus size={14} /> Folder
              </button>
              <input ref={fileInput} type="file" multiple hidden onChange={e => e.target.files.length && handleFiles(e.target.files)} />
              <button onClick={() => fileInput.current.click()} disabled={uploading} className="cly-btn" style={{
                display: "flex", alignItems: "center", gap: 6, background: COLORS.ink, color: "#fff", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              }}>
                {uploading ? <Loader2 size={14} className="cly-spin" /> : <Upload size={14} />} Upload
              </button>
            </>
          )}
          <button onClick={handleRefresh} disabled={syncing} title="Check for changes made directly in Drive" className="cly-btn" style={{
            display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${COLORS.line}`, color: COLORS.text, padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
          }}>
            {syncing ? <Loader2 size={14} className="cly-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {newFolderOpen && (
          <div className="cly-fade-in" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              placeholder="New folder name…"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
            <button onClick={handleCreateFolder} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Create</button>
            <button onClick={() => { setNewFolderOpen(false); setNewFolderName(""); }} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Cancel</button>
          </div>
        )}

        {pendingUpload && !progress && (
          <div className="cly-fade-in" style={{ marginBottom: 14, background: "#FFF8E8", border: `1px solid #E8D9A8`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>Unfinished upload: {pendingUpload.fileName}</span>
              <span style={{ color: COLORS.mute }}> ({formatBytes(pendingUpload.fileSize)}) — reload interrupted it. Select the same file again to pick up where it left off.</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <input ref={resumeFileInput} type="file" hidden onChange={e => e.target.files.length && handleResumeFileSelect(e.target.files[0])} />
              <button onClick={() => resumeFileInput.current.click()} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "7px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600 }}>
                Select file to resume
              </button>
              <button onClick={handleDiscardPending} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, padding: "7px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600 }}>
                Discard
              </button>
            </div>
          </div>
        )}

        {progress && (
          <div className="cly-fade-in" style={{ marginBottom: 14, background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>{progress.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: COLORS.mute }}>
                  {formatBytes(progress.uploaded)} / {formatBytes(progress.total)} • {formatBytes(progress.speedBps)}/s • {formatDuration(progress.etaSec)}
                </span>
                <button onClick={handleCancelUpload} title="Cancel upload" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, display: "flex" }}>
                  <X size={15} />
                </button>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: COLORS.cream, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress.percent}%`, background: COLORS.ink, transition: "width 0.2s" }} />
            </div>
          </div>
        )}

        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "9px 16px", fontSize: 11, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.line}` }}>
            <span style={{ flex: 1 }}>Name</span><span style={{ width: 90 }}>Size</span><span style={{ width: 110 }}>Uploaded</span><span style={{ width: 70 }}></span>
          </div>

          {subfolders.map(sf => (
            <div key={sf.id} className="cly-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
              {renamingId === sf.id ? (
                <span style={{ flex: 1, display: "flex", gap: 6 }}>
                  <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitRename(sf)}
                    style={{ flex: 1, padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.line}`, fontSize: 13 }} />
                  <button onClick={() => submitRename(sf)} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Save</button>
                  <button onClick={() => setRenamingId(null)} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Cancel</button>
                </span>
              ) : (
                <button onClick={() => setPath([...path, { id: sf.id, name: sf.name }])} className="cly-btn" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 13, color: COLORS.text }}>
                  <FolderOpen size={15} color={COLORS.data} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sf.name}</span>
                </button>
              )}
              <span style={{ width: 90 }}></span>
              <span style={{ width: 110 }}></span>
              <span style={{ width: 70, display: "flex", gap: 8 }}>
                {canWrite && renamingId !== sf.id && (
                  <>
                    <button title="Rename" onClick={() => startRename(sf)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><Settings size={14} /></button>
                    <button title="Delete" onClick={() => handleDeleteFolder(sf)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger }}><Trash2 size={15} /></button>
                  </>
                )}
              </span>
            </div>
          ))}

          {subfolders.length === 0 && folderFiles.length === 0 ? <EmptyState icon={FolderOpen} title="Nothing here yet" body={canWrite ? "Upload a file or create a folder to get started." : "Files shared with you will appear here."} /> :
            folderFiles.map(f => (
              <div key={f.id} className="cly-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {f.mime.startsWith("image/") ? <ImageIcon size={15} color={COLORS.data} /> : <FileText size={15} color={COLORS.mute} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </span>
                <span style={{ width: 90, color: COLORS.mute, fontSize: 12 }}>{formatBytes(f.size)}</span>
                <span style={{ width: 110, color: COLORS.mute, fontSize: 12 }}>{timeAgo(f.uploadedAt)}</span>
                <span style={{ width: 70, display: "flex", gap: 8 }}>
                  <button title="Download" onClick={() => downloadFile(f)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><Download size={15} /></button>
                  {canWrite && <button title="Delete" onClick={() => deleteFile(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger }}><Trash2 size={15} /></button>}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Access requests page                                                */
/* ---------------------------------------------------------------- */
function RequestsPage({ user, requests, resolveRequest }) {
  const mine = user.role === "ADMIN" ? requests.filter(r => r.requestedBy === user.id) : requests;
  const statusStyle = {
    pending: { soft: COLORS.warningSoft, text: COLORS.warning, icon: Clock },
    approved: { soft: COLORS.successSoft, text: COLORS.success, icon: CheckCircle2 },
    denied: { soft: COLORS.dangerSoft, text: COLORS.danger, icon: XCircle },
  };
  return (
    <div className="cly-fade-in" style={{ padding: 28 }}>
      <p style={{ fontSize: 13, color: COLORS.mute, maxWidth: 560, marginTop: 0 }}>
        {user.role === "OWNER" ? "New users and access changes requested by admins wait here until you approve them." : "Track the status of the access changes you've requested from the owner."}
      </p>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
        {mine.length === 0 ? <EmptyState icon={Inbox} title="No requests" body="You're all caught up." /> :
          mine.map((r, i) => {
            const s = statusStyle[r.status];
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? `1px solid ${COLORS.line}` : "none" }}>
                <s.icon size={16} color={s.text} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.mute }}>{r.detail} · requested by {r.requestedByName} · {timeAgo(r.createdAt)}</div>
                </div>
                {user.role === "OWNER" && r.status === "pending" ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => resolveRequest(r.id, "denied")} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 7, padding: "6px 11px", fontSize: 12.5, fontWeight: 600 }}>Deny</button>
                    <button onClick={() => resolveRequest(r.id, "approved")} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", borderRadius: 7, padding: "6px 11px", fontSize: 12.5, fontWeight: 600 }}>Approve</button>
                  </div>
                ) : (
                  <Badge color={s.text} soft={s.soft} text={s.text}>{r.status}</Badge>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Admin settings — Authentication tab                                */
/* ---------------------------------------------------------------- */
function AuthTab({ auth, setAuth, canEdit }) {
  const patch = (k, v) => canEdit && setAuth({ ...auth, [k]: v });
  return (
    <div className="cly-fade-in">
      {!canEdit && <div style={{ ...noteStyle }}>Read-only — only the owner can change authentication settings.</div>}
      <Section title="Login" desc="Will your users need to log in?">
        <SegButtons value={auth.loginEnabled ? "on" : "off"} onChange={v => patch("loginEnabled", v === "on")} disabled={!canEdit}
          options={[{ v: "on", l: "Enabled" }, { v: "off", l: "Disabled" }]} />
      </Section>
      <Section title="Authentication method" desc="How will users log in?">
        <Row icon={Mail} label="Email" sub="Password">
          <Toggle checked={auth.emailPassword} onChange={v => patch("emailPassword", v)} disabled={!canEdit} />
        </Row>
        <Row icon={KeyRound} label="Single sign-on" sub="Not connected" disabled><Toggle checked={false} disabled /></Row>
        <Row icon={ShieldCheck} label="Google sign-in" sub="Not connected" disabled><Toggle checked={false} disabled /></Row>
      </Section>
      <Section title="Sign up" desc="Can people sign up on their own?">
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { v: "disabled", l: "Disabled", d: "You control who gets invited" },
            { v: "open", l: "Open", d: "Anyone can sign up" },
            { v: "domain", l: "Domain restricted", d: "Only @clydecstudio.com can sign up" },
          ].map(o => (
            <button key={o.v} disabled={!canEdit} onClick={() => patch("signup", o.v)} className="cly-btn" style={{
              textAlign: "left", padding: "10px 14px", borderRadius: 9, border: `1.5px solid ${auth.signup === o.v ? COLORS.ink : COLORS.line}`,
              background: auth.signup === o.v ? COLORS.cream : "#fff",
            }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{o.l}</div>
              <div style={{ fontSize: 12, color: COLORS.mute }}>{o.d}</div>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Security" desc="Advanced session options">
        <Row label="Log user out">
          <select disabled={!canEdit} value={auth.logoutDays} onChange={e => patch("logoutDays", e.target.value)} style={selStyle}>
            <option value="30">Every 30 days</option><option value="90">Every 90 days</option><option value="365">Every year</option>
          </select>
        </Row>
        <Row label="End session if idle">
          <select disabled={!canEdit} value={auth.idleTimeout} onChange={e => patch("idleTimeout", e.target.value)} style={selStyle}>
            <option value="never">Never</option><option value="30m">After 30 minutes</option><option value="2h">After 2 hours</option>
          </select>
        </Row>
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Admin settings — Users tab                                         */
/* ---------------------------------------------------------------- */
function UsersTab({ user, users, addUserRequest, removeUser, groups }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "EMPLOYEE" });
  const isOwner = user.role === "OWNER";

  function submit(e) {
    e.preventDefault();
    addUserRequest(form, isOwner);
    setModal(false);
    setForm({ email: "", name: "", role: "EMPLOYEE" });
  }

  return (
    <div className="cly-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: COLORS.mute }}>{users.length} user{users.length !== 1 ? "s" : ""}</div>
        <button onClick={() => setModal(true)} className="cly-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.ink, color: "#fff", padding: "8px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          <UserPlus size={14} /> Add user
        </button>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", padding: "9px 16px", fontSize: 11, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.line}` }}>
          <span style={{ flex: 1 }}>Name</span><span style={{ width: 150 }}>Role</span><span style={{ width: 100 }}>Status</span><span style={{ width: 50 }}></span>
        </div>
        {users.map((u, i) => {
          const meta = ROLE_META[u.role];
          return (
            <div key={u.id} className="cly-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: COLORS.mute }}>{u.email}</div>
              </span>
              <span style={{ width: 150 }}><Badge color={meta.color} soft={meta.soft} text={meta.text}>{meta.label}</Badge></span>
              <span style={{ width: 100 }}><Badge color={COLORS.success} soft={COLORS.successSoft} text={COLORS.success}>{u.status}</Badge></span>
              <span style={{ width: 50 }}>
                {isOwner && u.role !== "OWNER" && (
                  <button title="Remove" onClick={() => removeUser(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger }}><Trash2 size={15} /></button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal onClose={() => setModal(false)} title="Add user">
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <Field label="Email"><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@clydecstudio.com" style={inputStyle} /></Field>
            <Field label="Full name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Cruz" style={inputStyle} /></Field>
            <Field label="User group">
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ ...inputStyle, padding: "9px 10px" }}>
                {groups.filter(g => g.id !== "OWNER").map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            {!isOwner && <div style={noteStyle}>As an admin, this creates a request the owner needs to approve.</div>}
            <button type="submit" className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "10px 0", borderRadius: 8, fontSize: 13.5, fontWeight: 700 }}>
              {isOwner ? "Add user" : "Send request"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Admin settings — User groups tab                                   */
/* ---------------------------------------------------------------- */
function GroupsTab({ user, groups, addGroup }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const isOwner = user.role === "OWNER";

  function submit(e) {
    e.preventDefault();
    addGroup({ id: uid(), name: form.name, description: form.description, custom: true });
    setModal(false);
    setForm({ name: "", description: "" });
  }

  return (
    <div className="cly-fade-in">
      <p style={{ fontSize: 13, color: COLORS.mute, maxWidth: 520, marginTop: 0 }}>Manage roles and permissions among your users. Only the owner can create new groups.</p>
      <div style={{ display: "grid", gap: 10 }}>
        {groups.map(g => {
          const meta = ROLE_META[g.id];
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "13px 16px" }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: meta ? meta.color : COLORS.creative, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{g.name} {!g.custom && <span style={{ fontSize: 11, color: COLORS.mute, fontWeight: 500 }}>· default</span>}</div>
                <div style={{ fontSize: 12, color: COLORS.mute }}>{g.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      {isOwner && (
        <button onClick={() => setModal(true)} className="cly-btn" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${COLORS.line}`, padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          <Plus size={14} /> Add group
        </button>
      )}
      {modal && (
        <Modal onClose={() => setModal(false)} title="Add user group">
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <Field label="Group name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contractors" style={inputStyle} /></Field>
            <Field label="Description"><input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What this group can do" style={inputStyle} /></Field>
            <button type="submit" className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "10px 0", borderRadius: 8, fontSize: 13.5, fontWeight: 700 }}>Create group</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Admin settings — Data restrictions tab                              */
/* ---------------------------------------------------------------- */
function RestrictionsTab({ user, groups, restrictions, setRestrictions }) {
  const isOwner = user.role === "OWNER";
  function setCell(groupId, catIdx, level) {
    if (!isOwner) return;
    const next = { ...restrictions, [groupId]: [...(restrictions[groupId] || [0, 0, 0, 0])] };
    next[groupId][catIdx] = level;
    setRestrictions(next);
  }
  return (
    <div className="cly-fade-in">
      {!isOwner && <div style={noteStyle}>Read-only — only the owner can edit data restrictions.</div>}
      <p style={{ fontSize: 13, color: COLORS.mute, maxWidth: 560, marginTop: 0 }}>
        Limit what each user group can interact with. Rules here apply throughout the entire portal, on top of individual folder settings.
      </p>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: COLORS.cream }}>
              <th style={{ textAlign: "left", padding: "9px 16px", fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", fontSize: 11 }}>Group</th>
              {DATA_CATEGORIES.map(c => <th key={c} style={{ textAlign: "left", padding: "9px 10px", fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", fontSize: 11 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => {
              const meta = ROLE_META[g.id];
              const row = restrictions[g.id] || [0, 0, 0, 0];
              return (
                <tr key={g.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: meta ? meta.color : COLORS.creative }} />{g.name}
                  </td>
                  {DATA_CATEGORIES.map((c, ci) => (
                    <td key={c} style={{ padding: "8px 10px" }}>
                      <select disabled={!isOwner} value={row[ci]} onChange={e => setCell(g.id, ci, Number(e.target.value))} style={{ ...selStyle, width: "100%" }}>
                        {LEVELS.map((l, li) => <option key={l} value={li}>{l}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Admin settings — Notifications tab                                 */
/* ---------------------------------------------------------------- */
function NotifTab({ notif, setNotif, canEdit }) {
  return (
    <div className="cly-fade-in">
      {!canEdit && <div style={noteStyle}>Read-only — only the owner can edit notification settings.</div>}
      <Section title="Email sender" desc="Users will receive system emails from this sender">
        <input disabled={!canEdit} value={notif.sender} onChange={e => setNotif({ ...notif, sender: e.target.value })} style={inputStyle} />
      </Section>
      <Section title="Automation" desc="Automatically send an invitation email when a new user is created">
        <Toggle checked={notif.autoInvite} onChange={v => canEdit && setNotif({ ...notif, autoInvite: v })} disabled={!canEdit} />
      </Section>
      <Section title="System notification templates" desc="Customize notification content">
        <div style={{ display: "grid", gap: 8 }}>
          {notif.templates.map(t => (
            <Row key={t.id} icon={Bell} label={t.name} sub={t.desc}><span /></Row>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Admin settings shell                                               */
/* ---------------------------------------------------------------- */
function AdminSettings(props) {
  const { user } = props;
  const isOwner = user.role === "OWNER";
  const tabs = [
    { key: "auth", label: "Authentication" },
    { key: "users", label: "Users" },
    { key: "groups", label: "User groups" },
    { key: "restrictions", label: "Data restrictions" },
    { key: "notif", label: "Notifications" },
  ];
  const [tab, setTab] = useState("auth");
  return (
    <div className="cly-fade-in" style={{ padding: 28 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: `1px solid ${COLORS.line}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="cly-btn" style={{
            background: "none", border: "none", padding: "9px 4px", marginRight: 18, fontSize: 13.5, fontWeight: 600,
            color: tab === t.key ? COLORS.text : COLORS.mute, borderBottom: tab === t.key ? `2px solid ${COLORS.ink}` : "2px solid transparent",
          }}>{t.label}</button>
        ))}
      </div>
      {tab === "auth" && <AuthTab auth={props.auth} setAuth={props.setAuth} canEdit={isOwner} />}
      {tab === "users" && <UsersTab user={user} users={props.users} addUserRequest={props.addUserRequest} removeUser={props.removeUser} groups={props.groups} />}
      {tab === "groups" && <GroupsTab user={user} groups={props.groups} addGroup={props.addGroup} />}
      {tab === "restrictions" && <RestrictionsTab user={user} groups={props.groups} restrictions={props.restrictions} setRestrictions={props.setRestrictions} />}
      {tab === "notif" && <NotifTab notif={props.notif} setNotif={props.setNotif} canEdit={isOwner} />}
    </div>
  );
}

/* small shared building blocks for admin settings */
const noteStyle = { display: "flex", gap: 8, alignItems: "center", background: COLORS.goldSoft, color: "#6B4A1A", fontSize: 12.5, padding: "9px 12px", borderRadius: 8, marginBottom: 16 };
const inputStyle = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5 };
const selStyle = { padding: "6px 8px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 12.5, background: "#fff" };

function Section({ title, desc, children }) {
  return (
    <div style={{ display: "flex", gap: 30, padding: "18px 0", borderBottom: `1px solid ${COLORS.line}` }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: COLORS.mute, marginTop: 3 }}>{desc}</div>
      </div>
      <div style={{ flex: 1, maxWidth: 420 }}>{children}</div>
    </div>
  );
}
function Row({ icon: Icon, label, sub, children, disabled }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", opacity: disabled ? 0.5 : 1 }}>
      {Icon && <div style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={14} /></div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: COLORS.mute }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function SegButtons({ value, onChange, options, disabled }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden" }}>
      {options.map(o => (
        <button key={o.v} disabled={disabled} onClick={() => onChange(o.v)} className="cly-btn" style={{
          padding: "8px 18px", fontSize: 13, fontWeight: 600, background: value === o.v ? COLORS.ink : "#fff", color: value === o.v ? "#fff" : COLORS.text, border: "none",
        }}>{o.l}</button>
      ))}
    </div>
  );
}
function Field({ label, children }) {
  return <label style={{ display: "block" }}><div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>{label}</div>{children}</label>;
}
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,28,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="cly-fade-in" style={{ background: "#fff", borderRadius: 14, padding: 22, width: 360, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="cly-serif" style={{ fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Root App                                                            */
/* ---------------------------------------------------------------- */
export default function App() {
  const [ready, setReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState(SEED_GROUPS);
  const [folders] = useState(SEED_FOLDERS);
  const [files, setFiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [auth, setAuth] = useState(SEED_AUTH);
  const [notif, setNotif] = useState(SEED_NOTIF);
  const [restrictions, setRestrictions] = useState(SEED_RESTRICTIONS);

  const notify = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Firebase Auth session -> matching Firestore profile (name/role/status)
  useEffect(() => {
    const unsub = watchAuth(async (fbUser) => {
      if (!fbUser) { setUser(null); setAuthChecked(true); return; }
      const snap = await getDoc(fsDoc(db, "users", fbUser.uid));
      if (snap.exists()) {
        setUser({ id: fbUser.uid, email: fbUser.email, ...snap.data() });
      } else {
        // Signed in with Firebase Auth but no workspace profile yet —
        // treat as not provisioned rather than guessing a role.
        setLoginError("Your account isn't set up in this workspace yet. Contact your owner.");
        await fbLogout();
        setUser(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  // workspace data load (runs once; re-run per section as needed)
  useEffect(() => {
    (async () => {
      const [u, g, r, a, n, res, fMeta] = await Promise.all([
        listCollection("users"), listCollection("groups").then(g => g.length ? g : SEED_GROUPS),
        listCollection("requests"), sget("auth-settings", SEED_AUTH), sget("notif-settings", SEED_NOTIF),
        sget("restrictions", SEED_RESTRICTIONS), listCollection("files"),
      ]);
      setUsers(u); setGroups(g); setRequests(r); setAuth(a); setNotif(n); setRestrictions(res);
      setFiles(fMeta.sort((x, y) => y.uploadedAt - x.uploadedAt));
      setReady(true);
    })();
  }, []);

  function persistAuth(next) { setAuth(next); sset("auth-settings", next); }
  function persistNotif(next) { setNotif(next); sset("notif-settings", next); }
  function persistRestrictions(next) { setRestrictions(next); sset("restrictions", next); }

  async function addFile(f, onProgress, signal, resumeInfo) {
    const { file, id, ...meta } = f;
    if (STORAGE_PROVIDER === "drive") {
      const result = await driveUpload(file, meta.folderId, onProgress, signal, resumeInfo);
      const record = { ...meta, id: result.fileId, driveFileId: result.fileId, provider: "drive" };
      await setDocIn("files", result.fileId, record);
      setFiles([record, ...files]);
    } else {
      const path = `files/${meta.folderId}/${id}-${meta.name}`;
      const url = await uploadFile(path, file);
      const record = { ...meta, id, url, path, provider: "firebase" };
      await setDocIn("files", id, record);
      setFiles([record, ...files]);
    }
  }
  async function deleteFile(id) {
    const f = files.find(x => x.id === id);
    if (f?.provider === "drive") {
      await driveDelete(f.driveFileId, f.folderId);
    } else if (f) {
      await deleteFileFromStorage(f.path);
    }
    await deleteDocIn("files", id);
    setFiles(files.filter(x => x.id !== id));
    notify("File deleted.");
  }
  async function downloadFile(f) {
    if (f.provider === "drive") {
      await driveDownload(f.driveFileId, f.folderId, f.name);
    } else {
      downloadFromUrl(f.url, f.name);
    }
  }
  async function syncDriveFolder(folderId, currentFiles) {
    if (STORAGE_PROVIDER !== "drive") return currentFiles;
    const folderFiles = currentFiles.filter(f => f.folderId === folderId && f.provider === "drive");
    try {
      const { missing, added } = await driveSyncFolder(folderId, folderFiles.map(f => f.driveFileId));
      if (missing.length === 0 && added.length === 0) return currentFiles;

      await Promise.all(
        folderFiles.filter(f => missing.includes(f.driveFileId)).map(f => deleteDocIn("files", f.id))
      );
      const newRecords = await Promise.all(
        added.map(async (a) => {
          const record = {
            id: a.id, driveFileId: a.id, provider: "drive", folderId,
            name: a.name, mime: a.mimeType, size: Number(a.size || 0),
            uploadedBy: "Google Drive", uploadedAt: a.createdTime ? new Date(a.createdTime).getTime() : Date.now(),
          };
          await setDocIn("files", a.id, record);
          return record;
        })
      );

      const next = [
        ...newRecords,
        ...currentFiles.filter(f => !missing.includes(f.driveFileId)),
      ];
      setFiles(next);
      const parts = [];
      if (added.length) parts.push(`${added.length} new file(s) found in Drive`);
      if (missing.length) parts.push(`${missing.length} file(s) removed`);
      if (parts.length) notify(parts.join(", ") + ".");
      return next;
    } catch (e) {
      return currentFiles;
    }
  }

  async function syncAllVisibleFolders(rootFolders) {
    if (STORAGE_PROVIDER !== "drive") return;
    let current = files;
    for (const f of rootFolders) {
      current = await syncDriveFolder(f.id, current);
    }
  }

  async function addUserRequest(form, isOwner) {
    if (isOwner) {
      const tempPassword = "Cly" + Math.random().toString(36).slice(2, 10) + "!";
      try {
        const newUid = await createUserAccount(form.email, tempPassword);
        const nu = { email: form.email, name: form.name, role: form.role, status: "ACTIVE", createdAt: Date.now() };
        await setDocIn("users", newUid, nu);
        setUsers([...users, { id: newUid, ...nu }]);
        await requestPasswordResetFor(form.email);
        notify(`${form.name} added — a password-setup email has been sent to them.`);
      } catch (e) {
        notify(e.message?.replace("Firebase: ", "") || "Couldn't create that user.", "error");
      }
    } else {
      const req = { type: "new_user", title: `Add ${form.name} as ${ROLE_META[form.role].label}`, detail: form.email, requestedBy: user.id, requestedByName: user.name, status: "pending", createdAt: Date.now(), payload: form };
      const id = await addDocIn("requests", req);
      setRequests([{ id, ...req }, ...requests]);
      notify("Request sent to the owner for approval.");
    }
  }
  async function removeUser(id) {
    // Removes the workspace profile (revokes portal access). Deleting the
    // underlying Firebase Auth account requires the Admin SDK (a Cloud
    // Function), since a client can't delete another user's auth record.
    await deleteDocIn("users", id);
    setUsers(users.filter(u => u.id !== id));
    notify("User removed from the workspace.");
  }
  async function addGroup(g) {
    await setDocIn("groups", g.id, g);
    setGroups([...groups, g]);
    persistRestrictions({ ...restrictions, [g.id]: [0, 0, 0, 0] });
    notify("Group created.");
  }
  async function resolveRequest(id, status) {
    const req = requests.find(r => r.id === id);
    await updateDocIn("requests", id, { status });
    setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
    if (status === "approved" && req?.type === "new_user") {
      await addUserRequest(req.payload, true);
    }
    notify(status === "approved" ? "Request approved." : "Request denied.");
  }

  async function handleLogin(email, password) {
    setLoginError(""); setLoginLoading(true);
    try {
      await fbLogin(email, password);
      setPage("dashboard");
    } catch (e) {
      setLoginError("Incorrect email or password.");
    } finally {
      setLoginLoading(false);
    }
  }
  async function handleForgot(email) {
    if (!email) { notify("Enter your email above first.", "error"); return; }
    try {
      await requestPasswordResetFor(email);
      notify("Password reset email sent.");
    } catch (e) {
      notify("Couldn't send reset email — check the address.", "error");
    }
  }

  if (!ready || !authChecked) return (
    <div className="cly" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, color: COLORS.mute }}>
      <Loader2 size={20} className="cly-spin" />
    </div>
  );

  return (
    <div className="cly" style={{ position: "relative" }}>
      <style>{CSS}</style>
      <Toast toast={toast} />
      {!user ? (
        <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} onForgot={handleForgot} />
      ) : (
        <div style={{ display: "flex", minHeight: 640, borderRadius: 14, overflow: "hidden", border: `1px solid ${COLORS.line}`, boxShadow: "0 20px 50px rgba(0,0,0,0.1)" }}>
          <Sidebar user={user} page={page} setPage={setPage} pendingCount={requests.filter(r => r.status === "pending").length} />
          <div style={{ flex: 1, background: COLORS.cream, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Topbar user={user} onLogout={() => fbLogout()} title={
              page === "dashboard" ? "Dashboard" : page === "files" ? "Files" : page === "requests" ? "Access requests" : "Admin settings"
            } subtitle={
              page === "dashboard" ? "Your workspace at a glance." :
              page === "files" ? "Shared storage for your team and clients." :
              page === "requests" ? "Owner approval queue." : "Authentication, users, groups, and restrictions."
            } />
            <div style={{ flex: 1, overflow: "auto" }}>
              {page === "dashboard" && <DashboardPage user={user} users={users} files={files} requests={requests} folders={folders} syncAllVisibleFolders={syncAllVisibleFolders} />}
              {page === "files" && <FilesPage user={user} folders={folders} files={files} addFile={addFile} deleteFile={deleteFile} downloadFile={downloadFile} syncDriveFolder={syncDriveFolder} notify={notify} />}
              {page === "requests" && <RequestsPage user={user} requests={requests} resolveRequest={resolveRequest} />}
              {page === "admin" && (
                <AdminSettings
                  user={user} auth={auth} setAuth={persistAuth} users={users} addUserRequest={addUserRequest} removeUser={removeUser}
                  groups={groups} addGroup={addGroup} restrictions={restrictions} setRestrictions={persistRestrictions}
                  notif={notif} setNotif={persistNotif}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
