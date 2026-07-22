import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Lock, Mail, Eye, EyeOff, LayoutDashboard, FolderOpen, Users, Shield,
  Bell, LogOut, Upload, Download, Trash2, Plus, X, Check, Clock,
  ChevronDown, Search, FileText, Settings, UserPlus, AlertCircle,
  Loader2, Building2, KeyRound, Image as ImageIcon, File as FileIcon,
  ShieldCheck, Inbox, ChevronRight, CircleAlert, CheckCircle2, XCircle, RefreshCw,
  Database, Smile, CalendarCheck, Timer, Network, LayoutGrid, Pencil,
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
  sget, sset, listCollection, listCollectionWhere, setDocIn, addDocIn, updateDocIn, deleteDocIn, deleteDocFieldIn, setUserAttendanceOverridesBulk,
  uploadFile, deleteFileFromStorage, db,
} from "./firebase";
import { doc as fsDoc, getDoc } from "firebase/firestore";

import { driveUpload, driveDownload, driveDelete, driveSyncFolder, getPendingUpload, clearPendingUpload, driveListFolders, driveCreateFolder, driveRenameFolder, driveDeleteFolder, driveGetStorageQuota, driveVerifyFiles } from "./driveStorage";

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
const SEED_PEOPLE_CONFIG = {
  departments: ["Engineering", "Design", "Creatives", "Data", "Product", "Marketing", "Sales", "Operations", "Finance", "HR"],
  employmentStatuses: ["Full-time", "Part-time", "Project-Based"],
};
const SEED_TIME_SETTINGS = {
  workStartTime: "09:00",   // expected clock-in time (24h "HH:MM")
  workEndTime: "18:00",     // expected clock-out time (24h "HH:MM")
  lateThresholdMinutes: 15, // grace period after workStartTime before "Late"
  fullDayHours: 8,          // hours worked to count as a full "Present" day
  halfDayHours: 4,          // hours worked to count as a "Half day"
};
// index 0 = Sunday ... 6 = Saturday. Weekdays are working days by default,
// weekends are days off — the owner can edit this per team member.
const DEFAULT_WEEKLY_WORK_DAYS = [false, true, true, true, true, true, false];

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
    <div className="cly" style={{ display: "flex", minHeight: "100vh" }}>
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
  const storageItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { key: "files", label: "Files", icon: FolderOpen, show: true },
  ];
  const portalItems = [
    { key: "requests", label: "Access requests", icon: Inbox, show: user.role === "OWNER" || user.role === "ADMIN", badge: user.role === "OWNER" ? pendingCount : 0 },
    { key: "admin", label: "Admin settings", icon: Settings, show: user.role === "OWNER" || user.role === "ADMIN" },
  ];
  const peopleItems = [
    { key: "people-info", label: "People Information", icon: Smile, show: user.role !== "CLIENT" },
    { key: "org-chart", label: "Organizational Chart", icon: Network, show: user.role !== "CLIENT" },
  ];
  const timeAttendanceItems = [
    { key: "time-tracking", label: "Time Tracking", icon: Timer, show: user.role !== "CLIENT" },
    { key: "time-inout", label: "Time in/Time out information", icon: Clock, show: user.role !== "CLIENT" },
    { key: "attendance", label: "Attendance", icon: CalendarCheck, show: user.role !== "CLIENT" },
  ];
  const [storageOpen, setStorageOpen] = useState(true);
  const [portalOpen, setPortalOpen] = useState(true);
  const [peopleOpen, setPeopleOpen] = useState(true);
  const [timeAttendanceOpen, setTimeAttendanceOpen] = useState(true);
  const showPortalGroup = portalItems.some(i => i.show);
  const showPeopleGroup = peopleItems.some(i => i.show);
  const showTimeAttendanceGroup = timeAttendanceItems.some(i => i.show);
  return (
    <div className="cly-scan" style={{ width: 216, flexShrink: 0, background: COLORS.ink, color: "#fff", display: "flex", flexDirection: "column", padding: "20px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 22px" }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: `linear-gradient(135deg, ${COLORS.creative}, ${COLORS.data})` }} />
        <span className="cly-serif" style={{ fontSize: 13.5, letterSpacing: 0.5 }}><b>CLYDEC</b> STUDIO</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={() => setStorageOpen(o => !o)} className="cly-navitem cly-btn" style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: "transparent",
          color: "#fff", fontSize: 13.5, fontWeight: 600, textAlign: "left",
        }}>
          <Database size={16} style={{ opacity: 0.85 }} />
          <span style={{ flex: 1 }}>Storage Settings</span>
          <ChevronDown size={14} style={{ opacity: 0.7, transform: storageOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
        </button>
        {storageOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 12, marginLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
            {storageItems.filter(i => i.show).map(i => (
              <button key={i.key} onClick={() => setPage(i.key)} className="cly-navitem cly-btn" style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: page === i.key ? "rgba(255,255,255,0.1)" : "transparent",
                color: "#fff", fontSize: 13.5, fontWeight: 500, textAlign: "left",
              }}>
                <i.icon size={16} style={{ opacity: 0.85 }} />
                <span style={{ flex: 1 }}>{i.label}</span>
              </button>
            ))}
          </div>
        )}
        {showPortalGroup && (
          <>
            <button onClick={() => setPortalOpen(o => !o)} className="cly-navitem cly-btn" style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: "transparent",
              color: "#fff", fontSize: 13.5, fontWeight: 600, textAlign: "left", marginTop: 6,
            }}>
              <Shield size={16} style={{ opacity: 0.85 }} />
              <span style={{ flex: 1 }}>Portal Settings</span>
              <ChevronDown size={14} style={{ opacity: 0.7, transform: portalOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
            </button>
            {portalOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 12, marginLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
                {portalItems.filter(i => i.show).map(i => (
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
            )}
          </>
        )}
        {showPeopleGroup && (
          <>
            <button onClick={() => setPeopleOpen(o => !o)} className="cly-navitem cly-btn" style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: "transparent",
              color: "#fff", fontSize: 13.5, fontWeight: 600, textAlign: "left", marginTop: 6,
            }}>
              <Users size={16} style={{ opacity: 0.85 }} />
              <span style={{ flex: 1 }}>People Management</span>
              <ChevronDown size={14} style={{ opacity: 0.7, transform: peopleOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
            </button>
            {peopleOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 12, marginLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
                {peopleItems.filter(i => i.show).map(i => (
                  <button key={i.key} onClick={() => setPage(i.key)} className="cly-navitem cly-btn" style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: page === i.key ? "rgba(255,255,255,0.1)" : "transparent",
                    color: "#fff", fontSize: 13.5, fontWeight: 500, textAlign: "left",
                  }}>
                    <i.icon size={16} style={{ opacity: 0.85 }} />
                    <span style={{ flex: 1 }}>{i.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {showTimeAttendanceGroup && (
          <>
            <button onClick={() => setTimeAttendanceOpen(o => !o)} className="cly-navitem cly-btn" style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: "transparent",
              color: "#fff", fontSize: 13.5, fontWeight: 600, textAlign: "left", marginTop: 6,
            }}>
              <Clock size={16} style={{ opacity: 0.85 }} />
              <span style={{ flex: 1 }}>Time and Attendance</span>
              <ChevronDown size={14} style={{ opacity: 0.7, transform: timeAttendanceOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
            </button>
            {timeAttendanceOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 12, marginLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.12)" }}>
                {timeAttendanceItems.filter(i => i.show).map(i => (
                  <button key={i.key} onClick={() => setPage(i.key)} className="cly-navitem cly-btn" style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, background: page === i.key ? "rgba(255,255,255,0.1)" : "transparent",
                    color: "#fff", fontSize: 13.5, fontWeight: 500, textAlign: "left",
                  }}>
                    <i.icon size={16} style={{ opacity: 0.85 }} />
                    <span style={{ flex: 1 }}>{i.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
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
function DashboardPage({ user, users, files, requests, folders, syncAllVisibleFolders, verifyAllFiles }) {
  const [quota, setQuota] = useState(null);
  const [quotaError, setQuotaError] = useState(null);

  useEffect(() => {
    const visible = folders.filter(f => f.access.includes(user.role));
    syncAllVisibleFolders(visible);
    verifyAllFiles();
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
  function goIntoFolder(sf) {
    setPath(prev => {
      if (prev.length && prev[prev.length - 1].id === sf.id) return prev; // a double-click fires two click events — don't push the same folder twice
      return [...prev, { id: sf.id, name: sf.name }];
    });
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
                <button onClick={() => goIntoFolder(sf)} className="cly-btn" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 13, color: COLORS.text }}>
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
/* People Management pages                                           */
/* ---------------------------------------------------------------- */
function peopleColorFor(name) {
  const palette = [COLORS.creative, COLORS.data, COLORS.warning, COLORS.success, "#6B4A6D", "#3B5C7A"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
function peopleInitials(name) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}
function formatPeopleDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function peopleStatusMeta(status) {
  if (status === "Active") return { soft: COLORS.successSoft, text: COLORS.success };
  if (status === "On leave") return { soft: COLORS.warningSoft, text: COLORS.warning };
  return { soft: COLORS.line, text: COLORS.mute };
}
// People Information (HR records) and Users (portal logins) are separate
// collections — this is the link between them. A Person can optionally be
// linked to a portal account, which is how Time Tracking/Attendance (which
// only know about logged-in Users) can show that person's department/title.
function personForUser(people, userId) {
  return people.find(p => p.linkedUserId === userId) || null;
}
function userForPerson(users, person) {
  return person?.linkedUserId ? users.find(u => u.id === person.linkedUserId) || null : null;
}
const errorTextStyle = { color: COLORS.danger, fontSize: 11.5, marginTop: 4 };
const manageLinkStyle = { background: "none", border: "none", color: COLORS.data, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 };

const PEOPLE_EMPTY_FORM = { name: "", role: "", department: "", employmentStatus: "", email: "", phone: "", startDate: "", status: "Active", linkedUserId: "" };
const PEOPLE_STATUSES = ["Active", "On leave", "Inactive"];

function PeopleInfoPage({ user, users, people, peopleConfig, addPerson, updatePerson, removePerson, savePeopleConfig }) {
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const canManageLists = user.role === "OWNER"; // list config lives in "settings", which is owner-only elsewhere too
  const departments = peopleConfig.departments || [];
  const employmentStatuses = peopleConfig.employmentStatuses || [];

  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(PEOPLE_EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [manageList, setManageList] = useState(null); // "department" | "employmentStatus" | null

  const filtered = people.filter(p => {
    const q = query.toLowerCase();
    const matchesQuery = p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    const matchesDept = deptFilter === "All" || p.department === deptFilter;
    return matchesQuery && matchesDept;
  });

  function openAddModal() {
    setForm({ ...PEOPLE_EMPTY_FORM, department: departments[0] || "", employmentStatus: employmentStatuses[0] || "" });
    setErrors({}); setEditingId(null); setModalOpen(true);
  }
  function openEditModal(person) {
    setForm({ ...person }); setErrors({}); setEditingId(person.id); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setErrors({}); }

  function validate(f) {
    const e = {};
    if (!f.name.trim()) e.name = "Enter a full name.";
    if (!f.role.trim()) e.role = "Enter a job title.";
    if (!f.department) e.department = "Select a department.";
    if (!f.employmentStatus) e.employmentStatus = "Select an employment status.";
    if (!f.email.trim()) e.email = "Enter an email address.";
    else if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email address.";
    if (!f.startDate) e.startDate = "Select a start date.";
    return e;
  }
  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    try {
      if (editingId) await updatePerson(editingId, form);
      else await addPerson(form);
      setModalOpen(false);
    } catch (e) {
      // addPerson/updatePerson already surfaced an error toast; keep the
      // modal open so the user doesn't lose what they typed.
    }
  }
  function updateField(key, value) { setForm(f => ({ ...f, [key]: value })); }

  function addOption(kind, value) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = kind === "department" ? "departments" : "employmentStatuses";
    const list = peopleConfig[key] || [];
    if (list.some(x => x.toLowerCase() === trimmed.toLowerCase())) return;
    savePeopleConfig({ ...peopleConfig, [key]: [...list, trimmed] });
  }
  function removeOption(kind, value) {
    const key = kind === "department" ? "departments" : "employmentStatuses";
    const list = peopleConfig[key] || [];
    savePeopleConfig({ ...peopleConfig, [key]: list.filter(x => x !== value) });
    if (kind === "department" && deptFilter === value) setDeptFilter("All");
    if (kind === "department" && form.department === value) setForm(f => ({ ...f, department: "" }));
    if (kind === "employmentStatus" && form.employmentStatus === value) setForm(f => ({ ...f, employmentStatus: "" }));
  }

  const deptCounts = departments.reduce((acc, d) => { acc[d] = people.filter(p => p.department === d).length; return acc; }, {});
  const linkableUsers = users.filter(u => u.role !== "CLIENT" && (!personForUser(people, u.id) || personForUser(people, u.id).id === editingId));

  return (
    <div className="cly-fade-in" style={{ padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 280 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: COLORS.mute }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, role, or email"
              style={{ ...inputStyle, padding: "8px 10px 8px 30px" }} />
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px" }}>
            <option value="All">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d} ({deptCounts[d] || 0})</option>)}
          </select>
        </div>
        {canManage && (
          <button onClick={openAddModal} className="cly-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.ink, color: "#fff", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            <Plus size={14} /> Add person
          </button>
        )}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Smile}
            title={people.length === 0 ? "No people records yet" : "No matches found"}
            body={people.length === 0
              ? (canManage ? "Add your first team member to start building your people directory." : "Team member profiles and details will appear here once added.")
              : "Try adjusting your search or department filter."} />
        ) : (
          <>
            <div style={{ display: "flex", padding: "9px 16px", fontSize: 11, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.line}` }}>
              <span style={{ flex: 2, minWidth: 160 }}>Name</span>
              <span style={{ width: 120 }}>Department</span>
              <span style={{ width: 120 }}>Employment</span>
              <span style={{ flex: 1.5, minWidth: 160 }}>Email</span>
              <span style={{ width: 130 }}>Phone</span>
              <span style={{ width: 100 }}>Start date</span>
              <span style={{ width: 90 }}>Status</span>
              {canManage && <span style={{ width: 90 }}></span>}
            </div>
            {filtered.map(p => {
              const sm = peopleStatusMeta(p.status);
              return (
                <div key={p.id} className="cly-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                  <span style={{ flex: 2, minWidth: 160, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: peopleColorFor(p.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {peopleInitials(p.name)}
                    </div>
                    <span style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.mute }}>{p.role}</div>
                    </span>
                  </span>
                  <span style={{ width: 120 }}>
                    {p.department}
                    <div style={{ fontSize: 10.5, color: COLORS.mute, marginTop: 2 }}>
                      {p.linkedUserId ? "🔗 Portal access" : "No portal account"}
                    </div>
                  </span>
                  <span style={{ width: 120 }}>{p.employmentStatus || "—"}</span>
                  <span style={{ flex: 1.5, minWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</span>
                  <span style={{ width: 130 }}>{p.phone || "—"}</span>
                  <span style={{ width: 100 }}>{formatPeopleDate(p.startDate)}</span>
                  <span style={{ width: 90 }}><Badge soft={sm.soft} text={sm.text}>{p.status}</Badge></span>
                  {canManage && (
                    <span style={{ width: 90, display: "flex", gap: 8, alignItems: "center" }}>
                      <button title="Edit" onClick={() => openEditModal(p)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><Settings size={14} /></button>
                      {confirmDeleteId === p.id ? (
                        <>
                          <button title="Confirm" onClick={() => { removePerson(p.id); setConfirmDeleteId(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, fontSize: 11, fontWeight: 700 }}>Confirm</button>
                          <button title="Cancel" onClick={() => setConfirmDeleteId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><X size={14} /></button>
                        </>
                      ) : (
                        <button title="Remove" onClick={() => setConfirmDeleteId(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger }}><Trash2 size={15} /></button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {modalOpen && (
        <Modal title={editingId ? "Edit person" : "Add person"} onClose={closeModal} width={560}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Full name"><input value={form.name} onChange={e => updateField("name", e.target.value)} placeholder="Juan Dela Cruz" style={inputStyle} /></Field>
              {errors.name && <div style={errorTextStyle}>{errors.name}</div>}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Job title"><input value={form.role} onChange={e => updateField("role", e.target.value)} placeholder="Senior Product Designer" style={inputStyle} /></Field>
              {errors.role && <div style={errorTextStyle}>{errors.role}</div>}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Department</div>
                {canManageLists && <button type="button" onClick={() => setManageList("department")} style={manageLinkStyle}>Manage</button>}
              </div>
              <select value={form.department} onChange={e => updateField("department", e.target.value)} style={inputStyle}>
                <option value="" disabled>Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {errors.department && <div style={errorTextStyle}>{errors.department}</div>}
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Employment status</div>
                {canManageLists && <button type="button" onClick={() => setManageList("employmentStatus")} style={manageLinkStyle}>Manage</button>}
              </div>
              <select value={form.employmentStatus} onChange={e => updateField("employmentStatus", e.target.value)} style={inputStyle}>
                <option value="" disabled>Select employment status</option>
                {employmentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.employmentStatus && <div style={errorTextStyle}>{errors.employmentStatus}</div>}
            </div>
            <Field label="Status">
              <select value={form.status} onChange={e => updateField("status", e.target.value)} style={inputStyle}>
                {PEOPLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Linked portal account (optional)">
                <select value={form.linkedUserId} onChange={e => updateField("linkedUserId", e.target.value)} style={inputStyle}>
                  <option value="">— No linked account —</option>
                  {linkableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE_META[u.role].label}) — {u.email}</option>)}
                </select>
              </Field>
              <div style={{ fontSize: 11, color: COLORS.mute, marginTop: 4 }}>Connects this person to their portal login, so Time Tracking and Attendance can show their department and job title.</div>
            </div>
            <div>
              <Field label="Email"><input value={form.email} onChange={e => updateField("email", e.target.value)} placeholder="name@clydecstudio.com" style={inputStyle} /></Field>
              {errors.email && <div style={errorTextStyle}>{errors.email}</div>}
            </div>
            <Field label="Phone"><input value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="+63 917 000 0000" style={inputStyle} /></Field>
            <div>
              <Field label="Start date"><input type="date" value={form.startDate} onChange={e => updateField("startDate", e.target.value)} style={inputStyle} /></Field>
              {errors.startDate && <div style={errorTextStyle}>{errors.startDate}</div>}
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, borderTop: `1px solid ${COLORS.line}`, paddingTop: 16 }}>
              <button type="button" onClick={closeModal} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button type="submit" className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                {editingId ? "Save changes" : "Add person"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {manageList && (
        <ManagePeopleListModal
          title={manageList === "department" ? "Manage departments" : "Manage employment statuses"}
          items={manageList === "department" ? departments : employmentStatuses}
          placeholder={manageList === "department" ? "e.g. Legal" : "e.g. Contractual"}
          onAdd={value => addOption(manageList, value)}
          onRemove={value => removeOption(manageList, value)}
          onClose={() => setManageList(null)}
        />
      )}
    </div>
  );
}

function ManagePeopleListModal({ title, items, placeholder, onAdd, onRemove, onClose }) {
  const [value, setValue] = useState("");
  const [pendingRemove, setPendingRemove] = useState(null);

  function submit(e) {
    e.preventDefault();
    onAdd(value);
    setValue("");
  }

  return (
    <Modal title={title} onClose={onClose} width={420}>
      <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder={placeholder} value={value} onChange={e => setValue(e.target.value)} />
        <button type="submit" className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Add</button>
      </form>
      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, maxHeight: 240, overflowY: "auto" }}>
        {items.length === 0 && <p style={{ fontSize: 12.5, color: COLORS.mute, padding: "12px 14px", margin: 0 }}>No options yet. Add one above.</p>}
        {items.map(item => (
          <div key={item} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${COLORS.line}`, fontSize: 13 }}>
            <span>{item}</span>
            {pendingRemove === item ? (
              <span style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { onRemove(item); setPendingRemove(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, fontSize: 12, fontWeight: 700 }}>Confirm</button>
                <button type="button" onClick={() => setPendingRemove(null)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute, fontSize: 12 }}>Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => setPendingRemove(item)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, fontSize: 12, fontWeight: 600 }}>Remove</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onClose} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Done</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Organizational Chart — built from People Information, hierarchy   */
/* comes from each person's `reportsTo`, layout comes from each        */
/* person's `chartX`/`chartY` (falls back to an auto tree layout       */
/* until someone drags a card, at which point that person's spot is  */
/* pinned). All of it lives on the existing `people` docs — no new    */
/* collection, no rules changes.                                     */
/* ---------------------------------------------------------------- */
const ORG_NODE_W = 208;
const ORG_NODE_H = 84;
const ORG_GAP_X = 32;
const ORG_GAP_Y = 64;
const ORG_PADDING = 40;
const ORG_DEPT_PALETTE = [
  { soft: COLORS.creativeSoft, text: COLORS.creativeText },
  { soft: COLORS.dataSoft, text: COLORS.dataText },
  { soft: COLORS.goldSoft, text: "#6B4A1A" },
  { soft: COLORS.successSoft, text: COLORS.success },
  { soft: COLORS.warningSoft, text: COLORS.warning },
];
function orgDeptColor(dept) {
  if (!dept) return { soft: COLORS.line, text: COLORS.mute };
  let hash = 0;
  for (let i = 0; i < dept.length; i++) hash = (hash * 31 + dept.charCodeAt(i)) >>> 0;
  return ORG_DEPT_PALETTE[hash % ORG_DEPT_PALETTE.length];
}
function orgInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
// Splits people into a manager -> direct-reports map and a list of roots
// (no manager, or a manager who no longer exists). Ignores self-references.
function buildOrgHierarchy(people) {
  const byId = {};
  people.forEach(p => { byId[p.id] = p; });
  const childrenOf = {};
  const roots = [];
  people.forEach(p => {
    const mgrId = p.reportsTo && p.reportsTo !== p.id && byId[p.reportsTo] ? p.reportsTo : null;
    if (mgrId) (childrenOf[mgrId] = childrenOf[mgrId] || []).push(p);
    else roots.push(p);
  });
  Object.values(childrenOf).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
  roots.sort((a, b) => a.name.localeCompare(b.name));
  return { byId, childrenOf, roots };
}
// All of a person's reports, and their reports, recursively — used to stop
// someone from being set as their own (grand)manager, which would create a loop.
function orgDescendantIds(personId, childrenOf) {
  const result = new Set();
  (function walk(id) {
    (childrenOf[id] || []).forEach(child => {
      if (!result.has(child.id)) { result.add(child.id); walk(child.id); }
    });
  })(personId);
  return result;
}
// Default tree layout (grid column/depth per person) for anyone who hasn't
// been manually dragged yet. Guards against cycles with a visited set so a
// bad reportsTo chain can never recurse forever.
function orgAutoLayout(roots, childrenOf) {
  const positions = {};
  let nextCol = 0;
  function place(person, depth, visited) {
    if (visited.has(person.id)) return nextCol++;
    const seen = new Set(visited); seen.add(person.id);
    const kids = childrenOf[person.id] || [];
    let col;
    if (kids.length === 0) {
      col = nextCol++;
    } else {
      const childCols = kids.map(k => place(k, depth + 1, seen));
      col = (Math.min(...childCols) + Math.max(...childCols)) / 2;
    }
    positions[person.id] = { col, depth };
    return col;
  }
  roots.forEach(r => place(r, 0, new Set()));
  return positions;
}
function orgElbowPath(x1, y1, x2, y2) {
  const midY = y1 + (y2 - y1) / 2;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

function OrgChartPage({ user, people, updatePerson }) {
  const canEdit = user.role === "OWNER" || user.role === "ADMIN";
  const { childrenOf, roots } = buildOrgHierarchy(people);
  const autoPositions = orgAutoLayout(roots, childrenOf);
  const [dragState, setDragState] = useState(null); // { id, startClientX, startClientY, origX, origY, curX, curY }
  const [editingId, setEditingId] = useState(null);
  const [reportsToDraft, setReportsToDraft] = useState("");

  function basePos(p) {
    if (typeof p.chartX === "number" && typeof p.chartY === "number") return { x: p.chartX, y: p.chartY };
    const auto = autoPositions[p.id] || { col: 0, depth: 0 };
    return { x: auto.col * (ORG_NODE_W + ORG_GAP_X) + ORG_PADDING, y: auto.depth * (ORG_NODE_H + ORG_GAP_Y) + ORG_PADDING };
  }
  function livePos(p) {
    if (dragState && dragState.id === p.id) return { x: dragState.curX, y: dragState.curY };
    return basePos(p);
  }

  function onCardPointerDown(e, p) {
    if (!canEdit) return;
    e.stopPropagation();
    const pos = basePos(p);
    setDragState({ id: p.id, startClientX: e.clientX, startClientY: e.clientY, origX: pos.x, origY: pos.y, curX: pos.x, curY: pos.y });
    e.target.setPointerCapture(e.pointerId);
  }
  function onCanvasPointerMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startClientX;
    const dy = e.clientY - dragState.startClientY;
    setDragState(d => d && { ...d, curX: Math.max(0, d.origX + dx), curY: Math.max(0, d.origY + dy) });
  }
  function onCanvasPointerUp() {
    if (!dragState) return;
    const { id, curX, curY } = dragState;
    setDragState(null);
    updatePerson(id, { chartX: Math.round(curX), chartY: Math.round(curY) });
  }
  function openEdit(p) {
    setEditingId(p.id);
    setReportsToDraft(p.reportsTo || "");
  }
  async function saveReportsTo() {
    await updatePerson(editingId, { reportsTo: reportsToDraft });
    setEditingId(null);
  }
  async function resetLayout() {
    await Promise.all(people.filter(p => typeof p.chartX === "number").map(p => updatePerson(p.id, { chartX: null, chartY: null })));
  }

  let canvasW = 400, canvasH = 300;
  people.forEach(p => {
    const pos = livePos(p);
    canvasW = Math.max(canvasW, pos.x + ORG_NODE_W + ORG_PADDING);
    canvasH = Math.max(canvasH, pos.y + ORG_NODE_H + ORG_PADDING);
  });

  const edges = people
    .map(p => {
      const mgrId = p.reportsTo && p.reportsTo !== p.id && people.some(x => x.id === p.reportsTo) ? p.reportsTo : null;
      if (!mgrId) return null;
      const mgr = people.find(x => x.id === mgrId);
      const from = livePos(mgr), to = livePos(p);
      return { id: p.id, x1: from.x + ORG_NODE_W / 2, y1: from.y + ORG_NODE_H, x2: to.x + ORG_NODE_W / 2, y2: to.y };
    })
    .filter(Boolean);

  const editingPerson = editingId ? people.find(p => p.id === editingId) : null;
  const editOptions = editingId
    ? (() => {
        const excluded = new Set([editingId, ...orgDescendantIds(editingId, childrenOf)]);
        return people.filter(p => !excluded.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
      })()
    : [];

  return (
    <div className="cly-fade-in" style={{ padding: 28 }}>
      {people.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.mute }}>
          <Network size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div style={{ fontSize: 13.5 }}>Add people in People Information first — the chart builds itself from that list.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
            <div style={{ fontSize: 12.5, color: COLORS.mute }}>
              {canEdit
                ? "Drag any card to arrange the chart. Use \u201CSet manager\u201D to change who someone reports to."
                : "View only — ask an Owner or Admin to update the hierarchy."}
            </div>
            {canEdit && (
              <button type="button" onClick={resetLayout} className="cly-btn" style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${COLORS.line}`, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
                <LayoutGrid size={14} /> Reset layout
              </button>
            )}
          </div>
          <div
            style={{ position: "relative", overflow: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 12, background: COLORS.cream, maxHeight: "calc(100vh - 230px)" }}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerUp}
          >
            <div style={{ position: "relative", width: canvasW, height: canvasH }}>
              <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {edges.map(e => (
                  <path key={e.id} d={orgElbowPath(e.x1, e.y1, e.x2, e.y2)} stroke={COLORS.line} strokeWidth={2} fill="none" />
                ))}
              </svg>
              {people.map(p => {
                const pos = livePos(p);
                const dc = orgDeptColor(p.department);
                const dragging = dragState?.id === p.id;
                const sm = p.status && p.status !== "Active" ? peopleStatusMeta(p.status) : null;
                return (
                  <div
                    key={p.id}
                    onPointerDown={e => onCardPointerDown(e, p)}
                    className="cly-fade-in"
                    style={{
                      position: "absolute", left: pos.x, top: pos.y, width: ORG_NODE_W, minHeight: ORG_NODE_H,
                      background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 12px",
                      boxShadow: dragging ? "0 10px 24px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
                      cursor: canEdit ? (dragging ? "grabbing" : "grab") : "default",
                      userSelect: "none", touchAction: "none", zIndex: dragging ? 5 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: dc.soft, color: dc.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                        {orgInitials(p.name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.mute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.role || "—"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 6 }}>
                      <span style={{ fontSize: 10.5, color: COLORS.mute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.department || "—"}</span>
                      {sm && <Badge soft={sm.soft} text={sm.text}>{p.status}</Badge>}
                    </div>
                    {canEdit && (
                      <button type="button" onPointerDown={e => e.stopPropagation()} onClick={() => openEdit(p)} style={{ ...manageLinkStyle, marginTop: 8, fontSize: 11 }}>
                        Set manager
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {editingPerson && (
        <Modal title={`Set manager for ${editingPerson.name}`} onClose={() => setEditingId(null)} width={420}>
          <Field label="Reports to">
            <select value={reportsToDraft} onChange={e => setReportsToDraft(e.target.value)} style={inputStyle}>
              <option value="">— No manager (top-level) —</option>
              {editOptions.map(p => <option key={p.id} value={p.id}>{p.name}{p.role ? ` — ${p.role}` : ""}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button type="button" onClick={() => setEditingId(null)} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Cancel</button>
            <button type="button" onClick={saveReportsTo} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Time Tracking / Time in-out / Attendance — shared helpers          */
/* ---------------------------------------------------------------- */
function formatClockTime(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
// datetime-local inputs work in the browser's local time, so we shift by the
// timezone offset before/after going to/from an epoch-ms timestamp.
function tsToLocalInputValue(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(ts - off).toISOString().slice(0, 16);
}
function localInputValueToTs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}
function formatWorkedDuration(ms) {
  if (ms == null || ms < 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
function attendanceStatusMeta(status) {
  if (status === "Present") return { soft: COLORS.successSoft, text: COLORS.success };
  if (status === "Late") return { soft: COLORS.warningSoft, text: COLORS.warning };
  if (status === "Left early") return { soft: COLORS.warningSoft, text: COLORS.warning };
  if (status === "Half day") return { soft: COLORS.dataSoft, text: COLORS.dataText };
  if (status === "In progress") return { soft: COLORS.goldSoft, text: "#6B4A1A" };
  if (status === "Absent") return { soft: COLORS.dangerSoft, text: COLORS.danger };
  return { soft: COLORS.line, text: COLORS.mute }; // "Incomplete"
}
// Merge a user's saved attendance rules with sensible defaults, so users
// created before this feature (or with partial data) still work.
function getAttendanceRules(u) {
  const r = (u && u.attendanceRules) || {};
  return {
    workStartTime: r.workStartTime || SEED_TIME_SETTINGS.workStartTime,
    workEndTime: r.workEndTime || SEED_TIME_SETTINGS.workEndTime,
    lateThresholdMinutes: r.lateThresholdMinutes ?? SEED_TIME_SETTINGS.lateThresholdMinutes,
    fullDayHours: r.fullDayHours ?? SEED_TIME_SETTINGS.fullDayHours,
    halfDayHours: r.halfDayHours ?? SEED_TIME_SETTINGS.halfDayHours,
    weeklyWorkDays: r.weeklyWorkDays || DEFAULT_WEEKLY_WORK_DAYS,
    dateOverrides: r.dateOverrides || {}, // "YYYY-MM-DD" -> "work" | "off"
  };
}
// Whether a given date is a working day for someone, honoring their weekly
// pattern (weekdays on / weekends off by default) plus any specific-date
// overrides (holidays marked off, or an off-day flipped to a working day).
function isWorkingDay(dateStr, rules) {
  const override = rules.dateOverrides?.[dateStr];
  if (override === "off") return false;
  if (override === "work") return true;
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return !!rules.weeklyWorkDays[dow];
}
function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// Weeks (arrays of 7 cells, null = padding outside the month) for a
// month-grid calendar view.
function getMonthMatrix(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];


// Same math as above, but produces a dateStr -> day-info map for one person
// across one month, for the Attendance calendar view. The Owner has no
// personal calendar (no absence/day-off concept for them); everyone else's
// working days come from their own attendanceRules calendar.
function computeMonthCalendarForUser(entries, u, year, month, todayStr) {
  const isOwner = u.role === "OWNER";
  const rules = getAttendanceRules(u);
  const [wsH, wsM] = rules.workStartTime.split(":").map(Number);
  const [weH, weM] = rules.workEndTime.split(":").map(Number);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDate = {};
  entries.filter(e => e.userId === u.id).forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
  const result = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year, month, d);
    if (dateStr > todayStr) { result[dateStr] = { future: true }; continue; }
    if (!isOwner && !isWorkingDay(dateStr, rules)) { result[dateStr] = { dayOff: true }; continue; }
    const dayEntries = byDate[dateStr];
    if (!dayEntries || dayEntries.length === 0) {
      if (dateStr === todayStr) { result[dateStr] = { pending: true }; continue; }
      if (isOwner) { result[dateStr] = { empty: true }; continue; }
      result[dateStr] = { status: "Absent", hours: 0 };
      continue;
    }
    const sorted = [...dayEntries].sort((a, b) => a.clockIn - b.clockIn);
    const earliest = sorted[0].clockIn;
    const stillOpen = sorted.some(e => !e.clockOut);
    const latestOut = stillOpen ? null : Math.max(...sorted.map(e => e.clockOut));
    const totalMs = sorted.reduce((sum, e) => sum + ((e.clockOut || Date.now()) - e.clockIn), 0);
    const hours = totalMs / 3_600_000;
    const expectedIn = new Date(earliest);
    expectedIn.setHours(wsH || 0, (wsM || 0) + (rules.lateThresholdMinutes || 0), 0, 0);
    const isLate = new Date(earliest) > expectedIn;
    const expectedOut = new Date(earliest);
    expectedOut.setHours(weH || 0, (weM || 0) - (rules.lateThresholdMinutes || 0), 0, 0);
    const leftEarly = !stillOpen && new Date(latestOut) < expectedOut;
    let status;
    if (stillOpen) status = "In progress";
    else if (hours < rules.halfDayHours) status = "Incomplete";
    else if (hours < rules.fullDayHours) status = "Half day";
    else status = isLate ? "Late" : leftEarly ? "Left early" : "Present";
    result[dateStr] = { status, hours, clockIn: earliest, clockOut: latestOut, isLate };
  }
  // Owner-set manual overrides (from the Attendance calendar's "Day type"
  // picker) win over whatever the raw entries computed above. "Present" is
  // never stored as an override — picking it just clears any override so
  // the day goes back to following its recorded sessions, which keeps this
  // calendar and the Time in/out table always in sync.
  const overrides = u.attendanceOverrides || {};
  Object.entries(overrides).forEach(([dateStr, label]) => {
    const [oy, om] = dateStr.split("-").map(Number);
    if (oy !== year || (om - 1) !== month) return;
    if (label === "Half Day") {
      result[dateStr] = { ...(result[dateStr] || {}), status: "Half day", manual: true, future: false };
    } else {
      // "Off", "Restday", "Holiday Off"
      result[dateStr] = { dayOff: true, manual: true, manualLabel: label === "Holiday Off" ? "Holiday" : label };
    }
  });
  return result;
}
// Early-in / undertime / overtime for a single Time in/out row, measured
// against that person's own scheduled work start/end time. Early arrival
// isn't credited as extra work time — it's purely informational — so this
// never touches the Duration column, it just adds context alongside it.
//
// Undertime is the shortfall against the *full scheduled shift* (schedEnd -
// schedStart), not just "clocked out before schedEnd" — a late arrival
// eats into that shift the same way an early departure does, so both ends
// of the actual session are weighed against both ends of the schedule.
// Overtime is purely extra time worked past the scheduled end, and can
// occur alongside undertime (e.g. arrived late, then also stayed late).
function computeEntryTimingFlags(entry, ruleUser) {
  if (!ruleUser) return { earlyMs: 0, undertimeMs: 0, overtimeMs: 0 };
  const rules = getAttendanceRules(ruleUser);
  const [sh, sm] = rules.workStartTime.split(":").map(Number);
  const [eh, em] = rules.workEndTime.split(":").map(Number);
  const schedStart = new Date(entry.clockIn); schedStart.setHours(sh || 0, sm || 0, 0, 0);
  const schedEnd = new Date(entry.clockIn); schedEnd.setHours(eh || 0, em || 0, 0, 0);
  const schedStartMs = schedStart.getTime(), schedEndMs = schedEnd.getTime();
  const earlyMs = entry.clockIn < schedStartMs ? schedStartMs - entry.clockIn : 0;
  let undertimeMs = 0, overtimeMs = 0;
  if (entry.clockOut) {
    const scheduledShiftMs = Math.max(0, schedEndMs - schedStartMs);
    const effStart = Math.max(entry.clockIn, schedStartMs);   // early arrival doesn't count
    const effEnd = Math.min(entry.clockOut, schedEndMs);       // time past schedEnd is overtime, not "shift" time
    const effectiveWorkedMs = Math.max(0, effEnd - effStart);
    undertimeMs = Math.max(0, scheduledShiftMs - effectiveWorkedMs);
    if (entry.clockOut > schedEndMs) overtimeMs = entry.clockOut - schedEndMs;
  }
  return { earlyMs, undertimeMs, overtimeMs };
}


function TimeTrackingPage({ user, users, people, timeEntries, clockIn, clockOut, setUserTimeTrackingEnabled, saveUserAttendanceRules }) {
  const isOwner = user.role === "OWNER";
  const enabled = isOwner || !!user.timeTrackingEnabled;
  const myOpenEntry = timeEntries.find(e => e.userId === user.id && !e.clockOut);
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!myOpenEntry) return;
    const t = setInterval(() => forceTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [myOpenEntry?.id]);

  async function handleClockIn() {
    setBusy(true);
    try { await clockIn(); } catch (e) { /* toast already shown */ } finally { setBusy(false); }
  }
  async function handleClockOut() {
    setBusy(true);
    try { await clockOut(myOpenEntry.id); } catch (e) { /* toast already shown */ } finally { setBusy(false); }
  }

  const elapsedMs = myOpenEntry ? Date.now() - myOpenEntry.clockIn : 0;
  // Team members whose schedule the owner can configure — everyone except
  // the owner (always on, no personal calendar needed) and clients (who
  // never get this feature at all).
  const teamMembers = users.filter(u => u.role !== "CLIENT" && u.role !== "OWNER");
  const activeNow = isOwner ? timeEntries.filter(e => !e.clockOut).sort((a, b) => a.clockIn - b.clockIn) : [];

  return (
    <div className="cly-fade-in" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 24 }}>
        {!enabled ? (
          <EmptyState icon={Timer} title="Time tracking isn't enabled for your account" body="Ask your workspace owner to turn this on for you from this page." />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12.5, color: COLORS.mute, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {myOpenEntry ? "Clocked in since" : "Status"}
              </div>
              <div className="cly-serif" style={{ fontSize: 24, marginTop: 4 }}>
                {myOpenEntry ? formatClockTime(myOpenEntry.clockIn) : "Not clocked in"}
              </div>
              {myOpenEntry && (
                <div className="cly-mono" style={{ fontSize: 13, color: COLORS.mute, marginTop: 4 }}>{formatWorkedDuration(elapsedMs)} elapsed</div>
              )}
            </div>
            <button
              disabled={busy}
              onClick={myOpenEntry ? handleClockOut : handleClockIn}
              className="cly-btn"
              style={{ padding: "12px 26px", borderRadius: 10, fontWeight: 700, fontSize: 14, background: myOpenEntry ? COLORS.dangerSoft : COLORS.ink, color: myOpenEntry ? COLORS.danger : "#fff", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "…" : myOpenEntry ? "Clock out" : "Clock in"}
            </button>
          </div>
        )}
      </div>

      {isOwner && (
        <>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Currently clocked in</div>
            {activeNow.length === 0 ? (
              <div style={{ color: COLORS.mute, fontSize: 13 }}>No one is clocked in right now.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeNow.map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13.5 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: peopleColorFor(e.userName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                        {peopleInitials(e.userName)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{e.userName}</span>
                    </span>
                    <span style={{ color: COLORS.mute }}>since {formatClockTime(e.clockIn)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Who can use time tracking</div>
            <div style={{ color: COLORS.mute, fontSize: 12.5, marginBottom: 14 }}>Clients never get this feature. Turn it on for anyone else who needs to clock in/out, and set their hours and work calendar.</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${COLORS.line}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{user.name}</span>
                  <Badge color={ROLE_META.OWNER.color} soft={ROLE_META.OWNER.soft} text={ROLE_META.OWNER.text}>Owner</Badge>
                </div>
                <span style={{ fontSize: 12, color: COLORS.mute }}>Always on</span>
              </div>
              {teamMembers.map(u => {
                const meta = ROLE_META[u.role];
                const person = personForUser(people, u.id);
                const isExpanded = expandedId === u.id;
                return (
                  <div key={u.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</span>
                        <Badge color={meta.color} soft={meta.soft} text={meta.text}>{meta.label}</Badge>
                        {person && <span style={{ fontSize: 11.5, color: COLORS.mute }}>{person.department} · {person.role}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <button onClick={() => setExpandedId(isExpanded ? null : u.id)} className="cly-btn" style={{ background: "none", color: COLORS.data, fontSize: 12, fontWeight: 700 }}>
                          {isExpanded ? "Close" : "Edit hours & calendar"}
                        </button>
                        <Toggle checked={!!u.timeTrackingEnabled} onChange={(v) => setUserTimeTrackingEnabled(u.id, v)} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ paddingBottom: 18 }}>
                        <AttendanceRulesEditor user={u} onSave={(rules) => saveUserAttendanceRules(u.id, rules)} />
                      </div>
                    )}
                  </div>
                );
              })}
              {teamMembers.length === 0 && (
                <div style={{ color: COLORS.mute, fontSize: 13, padding: "10px 0" }}>No other team members yet — add people from Admin settings → Users.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Per-person hours (start/end time, grace period, full/half-day thresholds)
// plus a work calendar (weekly pattern + specific-date overrides for
// holidays/leave). Used inside each team member's expanded row above.
function AttendanceRulesEditor({ user, onSave }) {
  const initial = getAttendanceRules(user);
  const [rules, setRules] = useState(initial);
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const dirty = JSON.stringify(rules) !== JSON.stringify(initial);

  function patch(k, v) { setRules(r => ({ ...r, [k]: v })); }
  function toggleWeekday(i) {
    const next = [...rules.weeklyWorkDays];
    next[i] = !next[i];
    patch("weeklyWorkDays", next);
  }
  function cycleDate(dateStr) {
    const current = rules.dateOverrides[dateStr];
    const defaultsToWork = rules.weeklyWorkDays[new Date(dateStr + "T00:00:00").getDay()];
    const next = { ...rules.dateOverrides };
    // Cycle: default -> forced opposite -> back to default.
    if (current === undefined) next[dateStr] = defaultsToWork ? "off" : "work";
    else delete next[dateStr];
    patch("dateOverrides", next);
  }

  const weeks = getMonthMatrix(viewYear, viewMonth);
  const overrideCount = Object.keys(rules.dateOverrides).length;

  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Hours</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 460 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Work start time
            <input type="time" className="cly-input" value={rules.workStartTime} onChange={e => patch("workStartTime", e.target.value)} style={{ ...inputStyle, marginTop: 5, background: "#fff" }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Work end time
            <input type="time" className="cly-input" value={rules.workEndTime} onChange={e => patch("workEndTime", e.target.value)} style={{ ...inputStyle, marginTop: 5, background: "#fff" }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Grace period (minutes)
            <input type="number" min={0} className="cly-input" value={rules.lateThresholdMinutes} onChange={e => patch("lateThresholdMinutes", Number(e.target.value))} style={{ ...inputStyle, marginTop: 5, background: "#fff" }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Full day hours
            <input type="number" min={0} step={0.5} className="cly-input" value={rules.fullDayHours} onChange={e => patch("fullDayHours", Number(e.target.value))} style={{ ...inputStyle, marginTop: 5, background: "#fff" }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Half day hours
            <input type="number" min={0} step={0.5} className="cly-input" value={rules.halfDayHours} onChange={e => patch("halfDayHours", Number(e.target.value))} style={{ ...inputStyle, marginTop: 5, background: "#fff" }} />
          </label>
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Weekly pattern</div>
        <div style={{ color: COLORS.mute, fontSize: 11.5, marginBottom: 8 }}>Default working days for this person. Specific dates can still be overridden below.</div>
        <div style={{ display: "flex", gap: 6 }}>
          {WEEKDAY_LETTERS.map((letter, i) => (
            <button key={i} onClick={() => toggleWeekday(i)} className="cly-btn" style={{
              width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: rules.weeklyWorkDays[i] ? COLORS.ink : "#fff",
              color: rules.weeklyWorkDays[i] ? "#fff" : COLORS.mute,
              border: `1px solid ${rules.weeklyWorkDays[i] ? COLORS.ink : COLORS.line}`,
            }}>{letter}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Work calendar</div>
            <div style={{ color: COLORS.mute, fontSize: 11.5 }}>Click a date to mark it a day off (e.g. a holiday) or a working day. {overrideCount > 0 && `${overrideCount} custom date${overrideCount === 1 ? "" : "s"} set.`}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; })} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, width: 26, height: 26 }}>‹</button>
            <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 110, textAlign: "center" }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={() => setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; })} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, width: 26, height: 26 }}>›</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, maxWidth: 380 }}>
          {WEEKDAY_LETTERS.map((l, i) => <div key={i} style={{ textAlign: "center", fontSize: 10.5, color: COLORS.mute, fontWeight: 700 }}>{l}</div>)}
          {weeks.flat().map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateStr = toDateStr(viewYear, viewMonth, d);
            const working = isWorkingDay(dateStr, rules);
            const isOverride = rules.dateOverrides[dateStr] !== undefined;
            const isToday = dateStr === today.toISOString().slice(0, 10);
            return (
              <button key={i} onClick={() => cycleDate(dateStr)} className="cly-btn" title={working ? "Working day — click to mark as day off" : "Day off — click to mark as working day"} style={{
                aspectRatio: "1", borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                background: working ? COLORS.successSoft : "#fff",
                color: working ? COLORS.success : COLORS.mute,
                border: isToday ? `1.5px solid ${COLORS.ink}` : isOverride ? `1.5px dashed ${COLORS.gold}` : `1px solid ${COLORS.line}`,
              }}>{d}</button>
            );
          })}
        </div>
      </div>

      <button disabled={!dirty} onClick={() => onSave(rules)} className="cly-btn"
        style={{ alignSelf: "flex-start", padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, background: dirty ? COLORS.ink : COLORS.line, color: dirty ? "#fff" : COLORS.mute }}>
        Save
      </button>
    </div>
  );
}

// Shared modal for correcting a clock-in/out session (Owner only). Used both
// to edit an existing time-entries doc from the Time in/out table, and to
// add/edit a session for a specific day+person from the Attendance calendar
// (e.g. filling in a day that's showing "Absent" because of a missed punch).
function TimeEntryEditModal({ entry, userId, userName, defaultDate, onSave, onCreate, onDelete, onClose }) {
  const [clockInVal, setClockInVal] = useState(entry ? tsToLocalInputValue(entry.clockIn) : (defaultDate ? `${defaultDate}T09:00` : ""));
  const [clockOutVal, setClockOutVal] = useState(entry ? tsToLocalInputValue(entry.clockOut) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError("");
    const clockIn = localInputValueToTs(clockInVal);
    if (!clockIn) { setError("Clock-in time is required."); return; }
    const clockOut = clockOutVal ? localInputValueToTs(clockOutVal) : null;
    if (clockOut && clockOut <= clockIn) { setError("Clock-out must be after clock-in."); return; }
    const date = new Date(clockIn).toISOString().slice(0, 10);
    setSaving(true);
    try {
      if (entry) await onSave(entry.id, { clockIn, clockOut, date });
      else await onCreate({ userId, userName, clockIn, clockOut, date });
      onClose();
    } catch (e) {
      setSaving(false); // parent already showed a toast; keep the modal open to retry
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete(entry.id);
      onClose();
    } catch (e) {
      setSaving(false);
    }
  }

  const canDelete = !!(entry && onDelete);

  return (
    <Modal title={entry ? "Edit time entry" : "Add time entry"} onClose={onClose} width={380}>
      <div style={{ display: "grid", gap: 12 }}>
        {userName && <div style={{ fontSize: 12.5, color: COLORS.mute, marginTop: -4 }}>{userName}</div>}
        <Field label="Clock in"><input type="datetime-local" value={clockInVal} onChange={e => setClockInVal(e.target.value)} style={inputStyle} /></Field>
        <Field label="Clock out (leave blank if still in progress)"><input type="datetime-local" value={clockOutVal} onChange={e => setClockOutVal(e.target.value)} style={inputStyle} /></Field>
        {error && <div style={{ fontSize: 12.5, color: COLORS.danger }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: canDelete ? "space-between" : "flex-end", gap: 8, marginTop: 4 }}>
          {canDelete && (
            <button disabled={saving} onClick={handleDelete} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.dangerSoft}`, color: COLORS.danger, padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              Delete entry
            </button>
          )}
          <button disabled={saving} onClick={handleSave} className="cly-btn" style={{ background: COLORS.ink, color: "#fff", padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TimeInOutPage({ user, users, people, timeEntries, groups, updateTimeEntry, deleteTimeEntry }) {
  const isOwner = user.role === "OWNER";
  const [filterUser, setFilterUser] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [editingEntry, setEditingEntry] = useState(null);
  const eligibleUsers = users.filter(u => u.role !== "CLIENT");
  const groupOptions = groups.filter(g => eligibleUsers.some(u => u.role === g.id));

  const visible = timeEntries
    .filter(e => {
      if (!isOwner) return e.userId === user.id;
      if (filterUser !== "all" && e.userId !== filterUser) return false;
      if (filterGroup !== "all") {
        const eu = users.find(u => u.id === e.userId);
        if (!eu || eu.role !== filterGroup) return false;
      }
      return true;
    })
    .sort((a, b) => b.clockIn - a.clockIn);

  return (
    <div className="cly-fade-in" style={{ padding: 28 }}>
      {isOwner && (
        <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setFilterUser("all"); }} style={{ ...inputStyle, width: "auto", minWidth: 160 }}>
            <option value="all">All groups</option>
            {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 220 }}>
            <option value="all">All team members</option>
            {eligibleUsers.filter(u => filterGroup === "all" || u.role === filterGroup).map(u => {
              const person = personForUser(people, u.id);
              return <option key={u.id} value={u.id}>{u.name}{person ? ` — ${person.department}` : ""}</option>;
            })}
          </select>
        </div>
      )}
      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, overflow: "hidden" }}>
        {visible.length === 0 ? (
          <EmptyState icon={Clock} title="No time logs yet" body="Clock-in and clock-out records will appear here once someone uses Time Tracking." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: isOwner ? 1060 : 760 }}>
              <div style={{ display: "flex", padding: "9px 16px", fontSize: 11, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.line}` }}>
                {isOwner && <span style={{ flex: 1.5, minWidth: 140 }}>Team member</span>}
                <span style={{ width: 110 }}>Date</span>
                <span style={{ width: 100 }}>Clock in</span>
                <span style={{ width: 100 }}>Clock out</span>
                <span style={{ width: 90 }}>Duration</span>
                <span style={{ width: 90 }}>Early in</span>
                <span style={{ width: 100 }}>Undertime</span>
                <span style={{ width: 100 }}>Overtime</span>
                {isOwner && <span style={{ width: 32 }}></span>}
              </div>
              {visible.map(e => {
                const person = personForUser(people, e.userId);
                const entryUser = users.find(u => u.id === e.userId);
                const flags = computeEntryTimingFlags(e, entryUser);
                return (
                  <div key={e.id} className="cly-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                    {isOwner && (
                      <span style={{ flex: 1.5, minWidth: 140, display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: peopleColorFor(e.userName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {peopleInitials(e.userName)}
                        </div>
                        <span style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.userName}</div>
                          {person && <div style={{ fontSize: 10.5, color: COLORS.mute }}>{person.department}</div>}
                        </span>
                      </span>
                    )}
                    <span style={{ width: 110 }}>{formatPeopleDate(e.date)}</span>
                    <span style={{ width: 100 }}>{formatClockTime(e.clockIn)}</span>
                    <span style={{ width: 100 }}>{e.clockOut ? formatClockTime(e.clockOut) : <span style={{ color: COLORS.warning, fontWeight: 700 }}>In progress</span>}</span>
                    <span style={{ width: 90 }}>{formatWorkedDuration((e.clockOut || Date.now()) - e.clockIn)}</span>
                    <span style={{ width: 90, color: flags.earlyMs >= 60000 ? COLORS.dataText : COLORS.mute, fontWeight: flags.earlyMs >= 60000 ? 700 : 400 }}>
                      {flags.earlyMs >= 60000 ? formatWorkedDuration(flags.earlyMs) : "—"}
                    </span>
                    <span style={{ width: 100, color: flags.undertimeMs >= 60000 ? COLORS.warning : COLORS.mute, fontWeight: flags.undertimeMs >= 60000 ? 700 : 400 }}>
                      {flags.undertimeMs >= 60000 ? formatWorkedDuration(flags.undertimeMs) : "—"}
                    </span>
                    <span style={{ width: 100, color: flags.overtimeMs >= 60000 ? "#6B4A1A" : COLORS.mute, fontWeight: flags.overtimeMs >= 60000 ? 700 : 400 }}>
                      {flags.overtimeMs >= 60000 ? formatWorkedDuration(flags.overtimeMs) : "—"}
                    </span>
                    {isOwner && (
                      <span style={{ width: 32, textAlign: "right" }}>
                        <button title="Edit for correction" onClick={() => setEditingEntry(e)} className="cly-btn" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}>
                          <Pencil size={14} />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editingEntry && (
        <TimeEntryEditModal
          entry={editingEntry}
          userName={editingEntry.userName}
          onSave={updateTimeEntry}
          onDelete={deleteTimeEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}

function AttendancePage({ user, users, people, timeEntries, groups, updateTimeEntry, createTimeEntry, deleteTimeEntry, setDayStatusOverride, clearDayStatusOverride, applyBulkDayStatus }) {
  const isOwner = user.role === "OWNER";
  const eligibleUsers = users.filter(u => u.role !== "CLIENT");
  const [filterGroup, setFilterGroup] = useState("all");
  const groupOptions = groups.filter(g => eligibleUsers.some(u => u.role === g.id));
  const filteredUsers = filterGroup === "all" ? eligibleUsers : eligibleUsers.filter(u => u.role === filterGroup);
  const [selectedId, setSelectedId] = useState(isOwner ? (eligibleUsers.find(u => u.id !== user.id)?.id || user.id) : user.id);
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const todayStr = today.toISOString().slice(0, 10);
  // Owner-only "correct this day" flow: click a day cell to see its
  // clock-in/out sessions and edit, delete, or add one (e.g. a missed punch
  // that's showing as Absent).
  const [correctingDate, setCorrectingDate] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null); // "new" | an entry object
  // Owner-only bulk mode: select several days at once and apply one Day
  // type to all of them in a single action (e.g. marking a whole week as
  // Holiday Off).
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]); // array of "YYYY-MM-DD"
  const [bulkStatus, setBulkStatus] = useState("Holiday Off");
  const [bulkSaving, setBulkSaving] = useState(false);

  function toggleBulkMode() {
    setBulkMode(m => !m);
    setSelectedDates([]);
  }
  function toggleDateSelected(dateStr) {
    setSelectedDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
  }
  async function applyBulkSelection() {
    if (selectedDates.length === 0) return;
    setBulkSaving(true);
    try {
      await applyBulkDayStatus(selectedUser.id, selectedDates, bulkStatus);
      setSelectedDates([]);
      setBulkMode(false);
    } catch (e) {
      // parent already showed a toast; keep selection so they can retry
    } finally {
      setBulkSaving(false);
    }
  }

  // If narrowing to a group drops the currently-selected person, fall back
  // to the first person in that group.
  useEffect(() => {
    if (isOwner && !filteredUsers.some(u => u.id === selectedId)) {
      setSelectedId(filteredUsers[0]?.id || user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroup]);

  const selectedUser = eligibleUsers.find(u => u.id === selectedId) || user;
  const person = personForUser(people, selectedUser.id);
  const rules = getAttendanceRules(selectedUser);

  const monthEntries = timeEntries.filter(e => {
    if (e.userId !== selectedUser.id) return false;
    const [y, m] = e.date.split("-").map(Number);
    return y === viewYear && (m - 1) === viewMonth;
  });
  const dayMap = computeMonthCalendarForUser(monthEntries, selectedUser, viewYear, viewMonth, todayStr);
  const weeks = getMonthMatrix(viewYear, viewMonth);

  const counts = { Present: 0, Late: 0, "Half day": 0, Absent: 0, "Left early": 0 };
  Object.values(dayMap).forEach(v => { if (v.status && counts[v.status] !== undefined) counts[v.status]++; });

  const dayEntries = correctingDate ? monthEntries.filter(e => e.date === correctingDate).sort((a, b) => a.clockIn - b.clockIn) : [];

  return (
    <div className="cly-fade-in" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        {isOwner ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 150 }}>
              <option value="all">All groups</option>
              {groupOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 220 }}>
              {filteredUsers.map(u => {
                const p = personForUser(people, u.id);
                return <option key={u.id} value={u.id}>{u.name}{u.role === "OWNER" ? " (You)" : ""}{p ? ` — ${p.department}` : ""}</option>;
              })}
            </select>
            <button onClick={toggleBulkMode} className="cly-btn" style={{ background: bulkMode ? COLORS.ink : "#fff", color: bulkMode ? "#fff" : COLORS.text, border: `1px solid ${bulkMode ? COLORS.ink : COLORS.line}`, borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600 }}>
              {bulkMode ? "Cancel selection" : "Select multiple days"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 14, fontWeight: 700 }}>My attendance{person ? ` · ${person.department}, ${person.role}` : ""}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; })} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, width: 28, height: 28 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 130, textAlign: "center" }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={() => setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; })} className="cly-btn" style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 6, width: 28, height: 28 }}>›</button>
        </div>
      </div>

      {isOwner && person && (
        <div style={{ fontSize: 12.5, color: COLORS.mute, marginTop: -8 }}>
          {selectedUser.name} — {person.department}, {person.role} · {bulkMode ? "click days to select them, then apply a day type below" : "click a day to add or correct a session"}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
        {Object.entries(counts).filter(([, n]) => n > 0).map(([status, n]) => {
          const sm = attendanceStatusMeta(status);
          return <span key={status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: sm.soft, border: `1px solid ${sm.text}` }} />
            {status}: <strong>{n}</strong>
          </span>;
        })}
        {Object.values(counts).every(n => n === 0) && <span style={{ color: COLORS.mute }}>No attendance data yet this month.</span>}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 20, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, width: "100%", maxWidth: 380 }}>
          {WEEKDAY_LETTERS.map((l, i) => <div key={i} style={{ textAlign: "center", fontSize: 10.5, color: COLORS.mute, fontWeight: 700 }}>{l}</div>)}
          {weeks.flat().map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateStr = toDateStr(viewYear, viewMonth, d);
            const info = dayMap[dateStr] || {};
            const isToday = dateStr === todayStr;
            const clickable = isOwner && !info.future;
            const isSelected = bulkMode && selectedDates.includes(dateStr);
            let bg = "#fff", fg = COLORS.text, border = COLORS.line, label = "";
            if (info.dayOff) { bg = COLORS.cream; fg = COLORS.mute; label = info.manualLabel || "Off"; }
            else if (info.future) { bg = "#fff"; fg = COLORS.line; }
            else if (info.pending) { bg = "#fff"; fg = COLORS.mute; label = "Today"; }
            else if (info.empty) { bg = "#fff"; fg = COLORS.mute; }
            else if (info.status) {
              const sm = attendanceStatusMeta(info.status);
              bg = sm.soft; fg = sm.text; border = sm.text;
              label = info.status === "In progress" ? "Active" : info.status;
            }
            return (
              <div key={i}
                onClick={clickable ? () => { if (bulkMode) { toggleDateSelected(dateStr); } else { setCorrectingDate(dateStr); setEditingEntry(null); } } : undefined}
                title={info.status ? `${info.status}${info.manual ? " (manually set)" : ""}${info.hours ? ` · ${info.hours.toFixed(1)}h` : ""}${info.clockIn ? ` · in ${formatClockTime(info.clockIn)}` : ""}` : (info.dayOff ? (info.manualLabel || "Day off") : (clickable ? (bulkMode ? "Click to select" : "Click to add or correct a session") : ""))}
                style={{
                  position: "relative", aspectRatio: "1", borderRadius: 6, background: bg, color: fg,
                  border: isSelected ? `2px solid ${COLORS.data}` : isToday ? `1.5px solid ${COLORS.ink}` : info.manual ? `1.5px dashed ${COLORS.gold}` : `1px solid ${border}`,
                  boxShadow: isSelected ? `0 0 0 2px ${COLORS.dataSoft}` : "none",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                  cursor: clickable ? "pointer" : "default",
                }}>
                {isSelected && <CheckCircle2 size={12} style={{ position: "absolute", top: 3, right: 3, color: COLORS.data }} />}
                <span style={{ fontSize: 11.5, fontWeight: 700 }}>{d}</span>
                {label && <span style={{ fontSize: 7.5, fontWeight: 600, textAlign: "center", lineHeight: 1 }}>{label}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {bulkMode && (
        <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {selectedDates.length === 0 ? "No days selected yet" : `${selectedDates.length} day${selectedDates.length !== 1 ? "s" : ""} selected`}
          </span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px" }}>
            <option value="Half Day">Half Day</option>
            <option value="Off">Off</option>
            <option value="Restday">Restday</option>
            <option value="Holiday Off">Holiday Off</option>
            <option value="Present">Present (clear override)</option>
          </select>
          <button
            disabled={selectedDates.length === 0 || bulkSaving}
            onClick={applyBulkSelection}
            className="cly-btn"
            style={{ background: COLORS.ink, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, opacity: (selectedDates.length === 0 || bulkSaving) ? 0.5 : 1 }}
          >
            {bulkSaving ? "Applying…" : `Apply to ${selectedDates.length || ""} day${selectedDates.length !== 1 ? "s" : ""}`}
          </button>
          {selectedDates.length > 0 && (
            <button onClick={() => setSelectedDates([])} className="cly-btn" style={{ background: "none", border: "none", color: COLORS.mute, fontSize: 13, fontWeight: 600 }}>
              Clear selection
            </button>
          )}
        </div>
      )}

      {isOwner && !bulkMode && correctingDate && !editingEntry && (
        <Modal title={`${formatPeopleDate(correctingDate)} — ${selectedUser.name}`} onClose={() => setCorrectingDate(null)} width={380}>
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Day type">
              <select
                value={selectedUser.attendanceOverrides?.[correctingDate] || "Present"}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "Present") clearDayStatusOverride(selectedUser.id, correctingDate);
                  else setDayStatusOverride(selectedUser.id, correctingDate, v);
                }}
                style={{ ...inputStyle, padding: "9px 10px" }}
              >
                <option value="Present">Present (follow recorded sessions)</option>
                <option value="Half Day">Half Day</option>
                <option value="Off">Off</option>
                <option value="Restday">Restday</option>
                <option value="Holiday Off">Holiday Off</option>
              </select>
              <div style={{ fontSize: 11.5, color: COLORS.mute, marginTop: 5 }}>
                Choosing anything but "Present" marks the day directly and overrides whatever the sessions below would otherwise compute. Switch back to "Present" any time to go back to following the recorded sessions.
              </div>
            </Field>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Recorded sessions</div>
              {dayEntries.length === 0 && <div style={{ fontSize: 13, color: COLORS.mute }}>No clock-in/out sessions recorded for this day.</div>}
              <div style={{ display: "grid", gap: 8 }}>
                {dayEntries.map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ fontSize: 13 }}>{formatClockTime(e.clockIn)} – {e.clockOut ? formatClockTime(e.clockOut) : <span style={{ color: COLORS.warning, fontWeight: 700 }}>in progress</span>}</span>
                    <button onClick={() => setEditingEntry(e)} className="cly-btn" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><Pencil size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setEditingEntry("new")} className="cly-btn" style={{ background: COLORS.cream, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600 }}>
              + Add session
            </button>
          </div>
        </Modal>
      )}

      {isOwner && !bulkMode && correctingDate && editingEntry && (
        <TimeEntryEditModal
          entry={editingEntry === "new" ? null : editingEntry}
          userId={selectedUser.id}
          userName={selectedUser.name}
          defaultDate={correctingDate}
          onSave={updateTimeEntry}
          onCreate={createTimeEntry}
          onDelete={editingEntry === "new" ? undefined : deleteTimeEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
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
function UsersTab({ user, users, people, addUserRequest, removeUser, groups, updateUserRole, requestRoleChange }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "EMPLOYEE" });
  const isOwner = user.role === "OWNER";
  // Admins can't change a role directly (only the owner can write to the
  // users collection) — instead they pick a new group here, which opens a
  // small confirm step that files a role_change request for the owner.
  const [roleRequest, setRoleRequest] = useState(null); // { targetUser, newRole } | null
  const assignableGroups = groups.filter(g => g.id !== "OWNER");

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
          <span style={{ flex: 1 }}>Name</span><span style={{ width: 170 }}>Role</span><span style={{ width: 100 }}>Status</span><span style={{ width: 50 }}></span>
        </div>
        {users.map((u, i) => {
          const meta = ROLE_META[u.role];
          const person = personForUser(people, u.id);
          const editable = u.role !== "OWNER"; // the OWNER role is a singleton and never reassigned
          return (
            <div key={u.id} className="cly-row" style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: COLORS.mute }}>{u.email}</div>
                {person && <div style={{ fontSize: 11, color: COLORS.mute }}>{person.department} · {person.role}</div>}
              </span>
              <span style={{ width: 170 }}>
                {!editable ? (
                  <Badge color={meta.color} soft={meta.soft} text={meta.text}>{meta.label}</Badge>
                ) : isOwner ? (
                  <select
                    value={u.role}
                    onChange={e => updateUserRole(u.id, e.target.value)}
                    style={{ ...selStyle, width: 140, fontWeight: 600, borderColor: meta.color }}
                    title="Change this person's group/role"
                  >
                    {assignableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Badge color={meta.color} soft={meta.soft} text={meta.text}>{meta.label}</Badge>
                    <button title="Request a role change" onClick={() => setRoleRequest({ targetUser: u, newRole: u.role })} className="cly-btn" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}>
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </span>
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

      {roleRequest && (
        <Modal onClose={() => setRoleRequest(null)} title={`Request role change — ${roleRequest.targetUser.name}`} width={360}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="New group">
              <select value={roleRequest.newRole} onChange={e => setRoleRequest({ ...roleRequest, newRole: e.target.value })} style={{ ...inputStyle, padding: "9px 10px" }}>
                {assignableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <div style={noteStyle}>This creates a request the owner needs to approve.</div>
            <button
              disabled={roleRequest.newRole === roleRequest.targetUser.role}
              onClick={async () => { await requestRoleChange(roleRequest.targetUser, roleRequest.newRole); setRoleRequest(null); }}
              className="cly-btn"
              style={{ background: COLORS.ink, color: "#fff", padding: "10px 0", borderRadius: 8, fontSize: 13.5, fontWeight: 700, opacity: roleRequest.newRole === roleRequest.targetUser.role ? 0.5 : 1 }}
            >
              Send request
            </button>
          </div>
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
      {tab === "users" && <UsersTab user={user} users={props.users} people={props.people} addUserRequest={props.addUserRequest} removeUser={props.removeUser} groups={props.groups} updateUserRole={props.updateUserRole} requestRoleChange={props.requestRoleChange} />}
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
function Modal({ title, onClose, children, width = 360 }) {
  // Rendered via a portal straight into <body> so it always centers on the
  // real viewport — nesting it inside a page's own scrollable container
  // (as plain JSX would) let that ancestor's scroll position clip/offset
  // the modal, which is what caused it to render cut off at the top.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,28,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="cly-fade-in" style={{ background: "#fff", borderRadius: 14, padding: 22, width, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="cly-serif" style={{ fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.mute }}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
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
  const [people, setPeople] = useState([]);
  const [peopleConfig, setPeopleConfig] = useState(SEED_PEOPLE_CONFIG);
  const [timeEntries, setTimeEntries] = useState([]);
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

  // workspace data load — every collection here requires a signed-in user
  // per firestore.rules, so this must wait for auth to resolve. Running it
  // unconditionally on mount meant logged-out visitors always hit
  // permission-denied errors, which left `ready` stuck false forever (blank
  // spinner, no login screen). It also must never leave the app stuck if a
  // fetch fails for any other reason, so `ready` is set in a finally block.
  useEffect(() => {
    if (!authChecked) return; // wait until we know whether someone's signed in
    if (!user) { setReady(true); return; } // nothing to load pre-login

    (async () => {
      const canReadRequests = user.role === "OWNER" || user.role === "ADMIN";
      const canReadPeople = user.role !== "CLIENT";
      const jobs = [
        { key: "users", run: () => listCollection("users"), fallback: [] },
        { key: "groups", run: () => listCollection("groups").then(g => g.length ? g : SEED_GROUPS), fallback: SEED_GROUPS },
        // requests/{id} is Admin/Owner-only per firestore.rules — querying it
        // as anyone else is a guaranteed permission-denied, so skip the call
        // entirely rather than let it fail and show a "data didn't load" banner.
        { key: "requests", run: () => canReadRequests ? listCollection("requests") : Promise.resolve([]), fallback: [] },
        { key: "auth", run: () => sget("auth-settings", SEED_AUTH), fallback: SEED_AUTH },
        { key: "notif", run: () => sget("notif-settings", SEED_NOTIF), fallback: SEED_NOTIF },
        { key: "restrictions", run: () => sget("restrictions", SEED_RESTRICTIONS), fallback: SEED_RESTRICTIONS },
        { key: "files", run: () => listCollection("files"), fallback: [] },
        // people/{id} is hidden from CLIENT per firestore.rules — same reasoning.
        { key: "people", run: () => canReadPeople ? listCollection("people") : Promise.resolve([]), fallback: [] },
        { key: "peopleConfig", run: () => sget("people-config", SEED_PEOPLE_CONFIG), fallback: SEED_PEOPLE_CONFIG },
        // Only the Owner can read every user's time entries (per firestore.rules);
        // everyone else's query is scoped to their own uid so it isn't denied.
        { key: "timeEntries", run: () => (user.role === "OWNER" ? listCollection("time-entries") : listCollectionWhere("time-entries", "userId", user.id)), fallback: [] },
      ];
      const results = await Promise.allSettled(jobs.map(j => j.run()));
      const values = {};
      const failed = [];
      results.forEach((r, i) => {
        const { key, fallback } = jobs[i];
        if (r.status === "fulfilled") {
          values[key] = r.value;
        } else {
          values[key] = fallback;
          failed.push(key);
          console.error(`Failed to load "${key}":`, r.reason);
        }
      });
      setUsers(values.users); setGroups(values.groups); setRequests(values.requests);
      setAuth(values.auth); setNotif(values.notif); setRestrictions(values.restrictions);
      setFiles([...values.files].sort((x, y) => y.uploadedAt - x.uploadedAt));
      setPeople(values.people); setPeopleConfig(values.peopleConfig);
      setTimeEntries(values.timeEntries);
      if (failed.length) {
        // Most common cause: a Firestore security rule for one of these
        // collections hasn't been deployed yet (committing firestore.rules
        // to GitHub does NOT push it — run `firebase deploy --only
        // firestore:rules` from the terminal). Check the browser console
        // for the exact collection and error code.
        notify(`Some data didn't load (${failed.join(", ")}) — check console for details.`, "error");
      }
      setReady(true);
    })();
  }, [authChecked, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function verifyAllFiles() {
    if (STORAGE_PROVIDER !== "drive") return;
    const driveFiles = files.filter(f => f.provider === "drive");
    if (driveFiles.length === 0) return;
    try {
      const missing = await driveVerifyFiles(driveFiles.map(f => f.driveFileId));
      if (missing.length === 0) return;
      await Promise.all(
        driveFiles.filter(f => missing.includes(f.driveFileId)).map(f => deleteDocIn("files", f.id))
      );
      setFiles(files.filter(f => !missing.includes(f.driveFileId)));
    } catch (e) {
      // Silent — stale entries just persist until the next successful check.
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
  // Owner-only direct role change. The OWNER role itself is a singleton and
  // is never offered as an option or as an editable row (enforced in
  // UsersTab), so this never needs to guard against reassigning it.
  async function updateUserRole(userId, newRole) {
    try {
      await updateDocIn("users", userId, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      notify("Role updated.");
    } catch (e) {
      console.error("Failed to update role:", e);
      notify("Couldn't update role — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  // Admins can't write to the users collection directly, so a role change
  // they propose goes through the same approval queue as adding a user.
  async function requestRoleChange(targetUser, newRole) {
    const req = {
      type: "role_change",
      title: `Change ${targetUser.name}'s group to ${ROLE_META[newRole].label}`,
      detail: targetUser.email,
      requestedBy: user.id, requestedByName: user.name,
      status: "pending", createdAt: Date.now(),
      payload: { userId: targetUser.id, role: newRole },
    };
    const id = await addDocIn("requests", req);
    setRequests([{ id, ...req }, ...requests]);
    notify("Request sent to the owner for approval.");
  }
  async function addGroup(g) {
    await setDocIn("groups", g.id, g);
    setGroups([...groups, g]);
    persistRestrictions({ ...restrictions, [g.id]: [0, 0, 0, 0] });
    notify("Group created.");
  }
  async function addPerson(form) {
    const id = uid();
    const record = { ...form, id, createdAt: Date.now() };
    try {
      await setDocIn("people", id, record);
      setPeople([...people, record]);
      notify(`${form.name} added.`);
    } catch (e) {
      console.error("Failed to add person:", e);
      notify("Couldn't save — check your connection or permissions and try again.", "error");
      throw e; // let the form know it failed so it can keep the modal open
    }
  }
  async function updatePerson(id, form) {
    try {
      await updateDocIn("people", id, form);
      setPeople(people.map(p => p.id === id ? { ...p, ...form } : p));
      notify("Changes saved.");
    } catch (e) {
      console.error("Failed to update person:", e);
      notify("Couldn't save changes — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function removePerson(id) {
    try {
      await deleteDocIn("people", id);
      setPeople(people.filter(p => p.id !== id));
      notify("Person removed.");
    } catch (e) {
      console.error("Failed to remove person:", e);
      notify("Couldn't remove — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function savePeopleConfig(next) {
    setPeopleConfig(next);
    await sset("people-config", next);
  }
  async function clockIn() {
    const now = Date.now();
    const entry = {
      userId: user.id, userName: user.name,
      date: new Date(now).toISOString().slice(0, 10),
      clockIn: now, clockOut: null, createdAt: now,
    };
    try {
      const id = await addDocIn("time-entries", entry);
      setTimeEntries([{ id, ...entry }, ...timeEntries]);
      notify("Clocked in.");
    } catch (e) {
      console.error("Failed to clock in:", e);
      notify("Couldn't clock in — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function clockOut(entryId) {
    const clockOutAt = Date.now();
    try {
      await updateDocIn("time-entries", entryId, { clockOut: clockOutAt });
      setTimeEntries(timeEntries.map(e => e.id === entryId ? { ...e, clockOut: clockOutAt } : e));
      notify("Clocked out.");
    } catch (e) {
      console.error("Failed to clock out:", e);
      notify("Couldn't clock out — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  // Owner-only corrections: fix a mistaken clock-in/out, fill in a missed
  // punch that's showing as Absent, or remove a bad entry entirely.
  async function updateTimeEntry(entryId, patch) {
    try {
      await updateDocIn("time-entries", entryId, patch);
      setTimeEntries(timeEntries.map(e => e.id === entryId ? { ...e, ...patch } : e));
      notify("Time entry updated.");
    } catch (e) {
      console.error("Failed to update time entry:", e);
      notify("Couldn't save — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function createTimeEntry(data) {
    const entry = { userId: data.userId, userName: data.userName, date: data.date, clockIn: data.clockIn, clockOut: data.clockOut ?? null, createdAt: Date.now() };
    try {
      const id = await addDocIn("time-entries", entry);
      setTimeEntries([{ id, ...entry }, ...timeEntries]);
      notify("Time entry added.");
    } catch (e) {
      console.error("Failed to add time entry:", e);
      notify("Couldn't save — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function deleteTimeEntry(entryId) {
    try {
      await deleteDocIn("time-entries", entryId);
      setTimeEntries(timeEntries.filter(e => e.id !== entryId));
      notify("Time entry deleted.");
    } catch (e) {
      console.error("Failed to delete time entry:", e);
      notify("Couldn't delete — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  // Owner-only "Day type" picker on the Attendance calendar. Setting one of
  // Half Day / Off / Restday / Holiday Off stores a manual override that
  // wins over whatever the recorded sessions would otherwise compute.
  // Picking "Present" clears the override instead of storing it, so the day
  // goes back to following its actual clock-in/out entries — which keeps
  // this calendar and the Time in/out table always in agreement.
  async function setDayStatusOverride(userId, dateStr, status) {
    try {
      await updateDocIn("users", userId, { [`attendanceOverrides.${dateStr}`]: status });
      setUsers(users.map(u => u.id === userId ? { ...u, attendanceOverrides: { ...(u.attendanceOverrides || {}), [dateStr]: status } } : u));
      notify(`Day marked as ${status}.`);
    } catch (e) {
      console.error("Failed to set day status override:", e);
      notify("Couldn't save — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function clearDayStatusOverride(userId, dateStr) {
    try {
      await deleteDocFieldIn("users", userId, `attendanceOverrides.${dateStr}`);
      setUsers(users.map(u => {
        if (u.id !== userId || !u.attendanceOverrides || !(dateStr in u.attendanceOverrides)) return u;
        const next = { ...u.attendanceOverrides };
        delete next[dateStr];
        return { ...u, attendanceOverrides: next };
      }));
      notify("Back to following recorded sessions for that day.");
    } catch (e) {
      console.error("Failed to clear day status override:", e);
      notify("Couldn't update — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  // Attendance page's "Select multiple days" bulk action: apply one Day
  // type to every selected date for a person in a single write.
  async function applyBulkDayStatus(userId, dateStrs, status) {
    try {
      const pairs = dateStrs.map(d => [d, status === "Present" ? null : status]);
      await setUserAttendanceOverridesBulk(userId, pairs);
      setUsers(users.map(u => {
        if (u.id !== userId) return u;
        const next = { ...(u.attendanceOverrides || {}) };
        dateStrs.forEach(d => { if (status === "Present") delete next[d]; else next[d] = status; });
        return { ...u, attendanceOverrides: next };
      }));
      notify(`${dateStrs.length} day${dateStrs.length !== 1 ? "s" : ""} set to ${status}.`);
    } catch (e) {
      console.error("Failed to bulk-update day status:", e);
      notify("Couldn't save — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function setUserTimeTrackingEnabled(userId, enabled) {
    try {
      await updateDocIn("users", userId, { timeTrackingEnabled: enabled });
      setUsers(users.map(u => u.id === userId ? { ...u, timeTrackingEnabled: enabled } : u));
      notify(enabled ? "Time tracking enabled for that user." : "Time tracking disabled for that user.");
    } catch (e) {
      console.error("Failed to update time-tracking access:", e);
      notify("Couldn't update — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function saveUserAttendanceRules(userId, rules) {
    try {
      await updateDocIn("users", userId, { attendanceRules: rules });
      setUsers(users.map(u => u.id === userId ? { ...u, attendanceRules: rules } : u));
      notify("Attendance settings saved.");
    } catch (e) {
      console.error("Failed to save attendance settings:", e);
      notify("Couldn't save — check your connection or permissions and try again.", "error");
      throw e;
    }
  }
  async function resolveRequest(id, status) {
    const req = requests.find(r => r.id === id);
    await updateDocIn("requests", id, { status });
    setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
    if (status === "approved" && req?.type === "new_user") {
      await addUserRequest(req.payload, true);
    }
    if (status === "approved" && req?.type === "role_change") {
      await updateUserRole(req.payload.userId, req.payload.role);
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
    <div className="cly" style={{ position: "relative", minHeight: "100vh" }}>
      <style>{CSS}</style>
      <Toast toast={toast} />
      {!user ? (
        <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} onForgot={handleForgot} />
      ) : (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar user={user} page={page} setPage={setPage} pendingCount={requests.filter(r => r.status === "pending").length} />
          <div style={{ flex: 1, background: COLORS.cream, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Topbar user={user} onLogout={() => fbLogout()} title={
              page === "dashboard" ? "Dashboard" : page === "files" ? "Files" : page === "requests" ? "Access requests" :
              page === "people-info" ? "People Information" : page === "org-chart" ? "Organizational Chart" : page === "time-tracking" ? "Time Tracking" :
              page === "time-inout" ? "Time in/Time out information" :
              page === "attendance" ? "Attendance" : "Admin settings"
            } subtitle={
              page === "dashboard" ? "Your workspace at a glance." :
              page === "files" ? "Shared storage for your team and clients." :
              page === "requests" ? "Owner approval queue." :
              page === "people-info" ? "Team member profiles and details." :
              page === "org-chart" ? "Reporting structure, built from People Information." :
              page === "time-tracking" ? "Live time-tracking sessions." :
              page === "time-inout" ? "Clock-in and clock-out records." :
              page === "attendance" ? "Daily attendance summaries." : "Authentication, users, groups, and restrictions."
            } />
            <div style={{ flex: 1, overflow: "auto" }}>
              {page === "dashboard" && <DashboardPage user={user} users={users} files={files} requests={requests} folders={folders} syncAllVisibleFolders={syncAllVisibleFolders} verifyAllFiles={verifyAllFiles} />}
              {page === "files" && <FilesPage user={user} folders={folders} files={files} addFile={addFile} deleteFile={deleteFile} downloadFile={downloadFile} syncDriveFolder={syncDriveFolder} notify={notify} />}
              {page === "requests" && <RequestsPage user={user} requests={requests} resolveRequest={resolveRequest} />}
              {page === "people-info" && <PeopleInfoPage user={user} users={users} people={people} peopleConfig={peopleConfig} addPerson={addPerson} updatePerson={updatePerson} removePerson={removePerson} savePeopleConfig={savePeopleConfig} />}
              {page === "org-chart" && <OrgChartPage user={user} people={people} updatePerson={updatePerson} />}
              {page === "time-tracking" && <TimeTrackingPage user={user} users={users} people={people} timeEntries={timeEntries} clockIn={clockIn} clockOut={clockOut} setUserTimeTrackingEnabled={setUserTimeTrackingEnabled} saveUserAttendanceRules={saveUserAttendanceRules} />}
              {page === "time-inout" && <TimeInOutPage user={user} users={users} people={people} timeEntries={timeEntries} groups={groups} updateTimeEntry={updateTimeEntry} deleteTimeEntry={deleteTimeEntry} />}
              {page === "attendance" && <AttendancePage user={user} users={users} people={people} timeEntries={timeEntries} groups={groups} updateTimeEntry={updateTimeEntry} createTimeEntry={createTimeEntry} deleteTimeEntry={deleteTimeEntry} setDayStatusOverride={setDayStatusOverride} clearDayStatusOverride={clearDayStatusOverride} applyBulkDayStatus={applyBulkDayStatus} />}
              {page === "admin" && (
                <AdminSettings
                  user={user} auth={auth} setAuth={persistAuth} users={users} people={people} addUserRequest={addUserRequest} removeUser={removeUser}
                  updateUserRole={updateUserRole} requestRoleChange={requestRoleChange}
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
