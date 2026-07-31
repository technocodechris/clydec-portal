// ------------------------------------------------------------------
// Orbit Workspace — ClickUp/Asana-style project management, embedded
// inside the Clydec Studio Portal (Workspace nav folder, one Orbit
// Workspace instance per Firestore doc in the `orbit-workspaces`
// collection). Originally a standalone in-memory Claude.ai artifact
// (see the project's own RECAP.md history) — merged in as its own
// module rather than folded into the single-file App.jsx, since the
// two files are large enough on their own (App.jsx is already 5,000+
// lines) that inlining would make both harder to work in. This is a
// deliberate, acknowledged exception to App.jsx's "everything lives
// here" convention, not an oversight.
//
// What changed to make this embeddable (was: a fully standalone,
// unpersisted, single-member artifact) — see clydec-portal-history.md
// for the full writeup:
//   - `members` is now an injected prop (real Clydec users), not local
//     state seeded with fake people. Team member CRUD (add/rename/
//     remove) is disabled here — that happens in People Management.
//   - All workspace content (spaces/goals/dashboards/whiteboards/docs/
//     forms/chat/activity) is now initialized from and persisted back
//     to a Firestore doc via `initialData`/`onDataChange` props,
//     instead of living only in memory and resetting on refresh.
//   - The "AI assist" buttons' direct `fetch` to api.anthropic.com is
//     disabled with an explanatory error — that call only works inside
//     the Claude.ai artifact sandbox, which auto-injects the
//     connection; a real deployed app needs its own serverless proxy
//     with a server-side API key, which isn't wired up yet (see
//     "Explicitly out of scope" in the history doc for this sync).
// ------------------------------------------------------------------
import { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import {
  ChevronRight, ChevronDown, Plus, Search, X, Calendar,
  Flag, MessageSquare, CheckSquare, Home, Folder, List as ListIcon,
  LayoutGrid, Trash2, User, Rows, Settings2, Send, Circle,
  CheckCircle2, Inbox, Link2, Bell, AlertTriangle, CalendarRange,
  ListChecks, SlidersHorizontal, Clock, Sparkles, Hash, CalendarDays,
  Target, Gauge, PenTool, FileText, ClipboardList, Zap, Play, Pause,
  LayoutDashboard, Loader2, ChevronLeft, Building2, StickyNote,
  Square as SquareIcon, Type as TypeIcon, Users, ArrowLeft,
} from "lucide-react";
import "./orbit-tailwind.css";

// ---------- constants ----------
const COLOR_DOT = {
  gray: "bg-slate-400", blue: "bg-blue-500", amber: "bg-amber-500",
  green: "bg-emerald-500", red: "bg-rose-500", purple: "bg-violet-500",
  pink: "bg-pink-500", teal: "bg-teal-500",
};
const COLOR_BADGE = {
  gray: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  purple: "bg-violet-50 text-violet-700 border-violet-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
};
const PRIORITIES = {
  urgent: { label: "Urgent", color: "text-rose-600" },
  high: { label: "High", color: "text-amber-600" },
  normal: { label: "Normal", color: "text-blue-600" },
  low: { label: "Low", color: "text-slate-400" },
  none: { label: "No priority", color: "text-slate-300" },
};
const DEFAULT_MEMBERS = [
  { id: "m1", name: "You", color: "bg-violet-500" },
];
const MEMBER_COLORS = ["bg-violet-500", "bg-teal-500", "bg-amber-500", "bg-blue-500", "bg-rose-500", "bg-emerald-500", "bg-pink-500", "bg-indigo-500"];
const MembersContext = createContext(DEFAULT_MEMBERS);
const SPACE_COLORS = ["indigo", "teal", "rose", "amber"];
const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 };

function applyFilterSort(tasks, filters) {
  let out = tasks.filter((t) => {
    if (filters.assignee === "unassigned" && t.assigneeIds.length > 0) return false;
    if (filters.assignee !== "all" && filters.assignee !== "unassigned" && !t.assigneeIds.includes(filters.assignee)) return false;
    if (filters.priority !== "all" && t.priority !== filters.priority) return false;
    if (filters.tag !== "all" && !t.tags.includes(filters.tag)) return false;
    if (filters.due === "overdue" && !isOverdue(t.dueDate, false)) return false;
    if (filters.due === "soon" && !isDueSoon(t.dueDate, false)) return false;
    if (filters.due === "none" && t.dueDate) return false;
    return true;
  });
  if (filters.sort === "dueDate") out = [...out].sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity));
  if (filters.sort === "priority") out = [...out].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  if (filters.sort === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
const DEFAULT_FILTERS = { assignee: "all", priority: "all", tag: "all", due: "all", sort: "manual" };

let idCounter = 1;
const uid = (p = "id") => `${p}_${idCounter++}_${Math.random().toString(36).slice(2, 7)}`;

const defaultStatuses = () => ([
  { id: uid("st"), name: "To Do", color: "gray", isFinal: false },
  { id: uid("st"), name: "In Progress", color: "blue", isFinal: false },
  { id: uid("st"), name: "Review", color: "amber", isFinal: false },
  { id: uid("st"), name: "Done", color: "green", isFinal: true },
]);

function makeSubtask(name) {
  return { id: uid("sub"), name, done: false, startDate: null, dueDate: null, assigneeIds: [], description: "" };
}

function makeTask(name, statusId, opts = {}) {
  return {
    id: uid("task"),
    name,
    description: "",
    statusId,
    priority: opts.priority || "none",
    assigneeIds: opts.assigneeIds || (opts.assigneeId ? [opts.assigneeId] : []),
    startDate: opts.startDate || null,
    dueDate: opts.dueDate || null,
    tags: opts.tags || [],
    subtasks: [],
    checklist: [], // lightweight { id, text, done } items — distinct from full `subtasks` objects
    attachments: [], // { id, name, type, size, dataUrl, uploadedAt }
    recurrence: null, // { freq: "daily" | "weekly" | "monthly", interval } | null — see setTaskStatus()
    comments: [],
    blockedBy: [],
    customFieldValues: {},
    timeEntries: [],
    createdAt: Date.now(),
  };
}

function makeList(name, opts = {}) {
  const statuses = defaultStatuses();
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return {
    id: uid("list"),
    name,
    statuses,
    customFields: [],
    automations: [],
    isSprint: opts.isSprint || false,
    sprintStart: opts.isSprint ? now : null,
    sprintEnd: opts.isSprint ? now + 14 * day : null,
    savedViews: [], // { id, name, filters } — a named, reusable filter+sort combo (see saveView())
    tasks: [],
  };
}

// ---------- inline add control (avoids window.prompt, which browser sandboxes block) ----------
function InlineAdd({ onSubmit, placeholder, label }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 text-slate-400 hover:text-slate-700"
        title={placeholder}
      >
        <Plus className="w-3.5 h-3.5" />{label}
      </button>
    );
  }
  const submit = () => {
    if (text.trim()) onSubmit(text.trim());
    setText(""); setOpen(false);
  };
  return (
    <input
      autoFocus
      value={text}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") submit();
        if (e.key === "Escape") { setText(""); setOpen(false); }
      }}
      onBlur={submit}
      placeholder={placeholder}
      className="text-xs border border-slate-300 rounded px-1.5 py-0.5 w-28 outline-none focus:border-indigo-400"
    />
  );
}

// ---------- small UI atoms ----------
function Avatar({ id, size = "w-6 h-6" }) {
  const members = useContext(MembersContext);
  const m = members.find((x) => x.id === id);
  if (!m) return (
    <div className={`${size} rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-300 shrink-0`}>
      <User className="w-3 h-3" />
    </div>
  );
  const initials = m.name.split(" ").map((w) => w[0]).join("");
  return (
    <div title={m.name} className={`${size} ${m.color} rounded-full text-white flex items-center justify-center text-[10px] font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

function AvatarGroup({ ids, size = "w-6 h-6", max = 3 }) {
  const list = (ids || []).filter(Boolean);
  if (list.length === 0) return <Avatar id={null} size={size} />;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5 shrink-0">
      {shown.map((id) => <Avatar key={id} id={id} size={size} />)}
      {extra > 0 && (
        <div className={`${size} rounded-full bg-slate-300 text-white flex items-center justify-center text-[9px] font-semibold border-2 border-white`}>+{extra}</div>
      )}
    </div>
  );
}

function PriorityFlag({ p }) {
  const cfg = PRIORITIES[p] || PRIORITIES.none;
  return <Flag className={`w-3.5 h-3.5 ${cfg.color}`} fill={p === "none" ? "none" : "currentColor"} />;
}

function StatusPill({ status, onClick }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${COLOR_BADGE[status.color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${COLOR_DOT[status.color]}`} />
      {status.name}
    </button>
  );
}

function fmtDate(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isOverdue(ts, done) {
  if (!ts || done) return false;
  return ts < new Date().setHours(0, 0, 0, 0);
}
// "Due soon" = due within the next 24h and not already overdue/done — used by the
// due_soon automation trigger, the ListView/BoardView badge, and My Tasks.
function isDueSoon(ts, done) {
  if (!ts || done) return false;
  const now = Date.now();
  return ts >= now && ts <= now + 24 * 60 * 60 * 1000;
}

// ---------- automation engine (Zapier/Make/n8n-style rules) ----------
const AUTOMATION_TRIGGERS = {
  task_created: "When a task is created",
  status_changed: "When a task's status changes",
  priority_changed: "When a task's priority changes",
  assignee_changed: "When a task's assignee changes",
  custom_field_changed: "When a custom field changes",
  comment_added: "When a comment is added",
  due_soon: "When a task is due soon (runs on manual check)",
  due_passed: "When a task is overdue (runs on manual check)",
};
const CONDITION_FIELDS = {
  priority: "Priority",
  assignee: "Assignee",
  statusId: "Status",
  tag: "Tag",
};
// Pre-built, one-click automation templates — a small starting gallery
// rather than an exhaustive library, in the spirit of Zapier's template
// gallery. `actions` reference a status by *name* (resolved against the
// target list's actual statuses when applied — see "Use template" below)
// since a template has to work on any list, whose statuses aren't known
// ahead of time.
const AUTOMATION_TEMPLATES = [
  {
    name: "Notify chat when a task is completed",
    description: "Posts a message to this Space's chat whenever a task's status becomes its final one.",
    build: (list) => ({ trigger: { type: "status_changed", statusId: list.statuses.find((s) => s.isFinal)?.id || "" }, logic: "AND", conditions: [], actions: [{ type: "post_chat", value: "A task was just completed 🎉" }] }),
  },
  {
    name: "Tag overdue tasks",
    description: "Adds an 'Overdue' tag whenever the due-date check finds a task past its due date.",
    build: () => ({ trigger: { type: "due_passed" }, logic: "AND", conditions: [], actions: [{ type: "add_tag", value: "Overdue" }] }),
  },
  {
    name: "Escalate urgent tasks",
    description: "When priority changes to Urgent, posts a chat alert.",
    build: () => ({ trigger: { type: "priority_changed" }, logic: "AND", conditions: [{ field: "priority", op: "equals", value: "urgent" }], actions: [{ type: "post_chat", value: "🚨 An urgent task needs attention" }] }),
  },
  {
    name: "Remind before due",
    description: "When a task is due within 24 hours (due-date check), adds a comment as a reminder.",
    build: () => ({ trigger: { type: "due_soon" }, logic: "AND", conditions: [], actions: [{ type: "add_comment", value: "⏰ This task is due within 24 hours." }] }),
  },
  {
    name: "New task created → notify",
    description: "Posts to chat every time a new task lands in this list.",
    build: () => ({ trigger: { type: "task_created" }, logic: "AND", conditions: [], actions: [{ type: "post_chat", value: "A new task was added." }] }),
  },
];
function taskFieldValue(task, field) {
  if (field === "tag") return task.tags || [];
  if (field === "assignee") return task.assigneeIds || [];
  return task[field];
}
function checkCondition(task, cond) {
  const v = taskFieldValue(task, cond.field);
  if (cond.field === "tag" || cond.field === "assignee") {
    const includes = (v || []).includes(cond.value);
    return cond.op === "not_equals" ? !includes : includes;
  }
  if (cond.op === "not_equals") return String(v ?? "") !== String(cond.value ?? "");
  if (cond.op === "contains") return String(v ?? "").toLowerCase().includes(String(cond.value ?? "").toLowerCase());
  return String(v ?? "") === String(cond.value ?? ""); // "equals" default
}
function ruleMatches(rule, task, eventType, opts = {}) {
  if (!rule.enabled) return false;
  if (rule.trigger.type !== eventType) return false;
  if (eventType === "status_changed" && rule.trigger.statusId && rule.trigger.statusId !== opts.toStatusId) return false;
  const results = (rule.conditions || []).map((c) => checkCondition(task, c));
  if (results.length === 0) return true;
  return rule.logic === "OR" ? results.some(Boolean) : results.every(Boolean);
}

function NavButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100 text-slate-600"}`}
    >
      {icon} {label}
      {!!badge && <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-1.5">{badge}</span>}
    </button>
  );
}

function FilterSortBar({ tasks, filters, setFilters, savedViews, onSaveView, onDeleteView }) {
  const members = useContext(MembersContext);
  const allTags = [...new Set(tasks.flatMap((t) => t.tags))];
  const active = filters.assignee !== "all" || filters.priority !== "all" || filters.tag !== "all" || filters.due !== "all";
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  return (
    <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
      <select value={filters.assignee} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))} className="border border-slate-200 rounded px-2 py-1 bg-white">
        <option value="all">Everyone</option>
        <option value="unassigned">Unassigned</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} className="border border-slate-200 rounded px-2 py-1 bg-white">
        <option value="all">Any priority</option>
        {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))} className="border border-slate-200 rounded px-2 py-1 bg-white">
        <option value="all">Any tag</option>
        {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={filters.due || "all"} onChange={(e) => setFilters((f) => ({ ...f, due: e.target.value }))} className="border border-slate-200 rounded px-2 py-1 bg-white">
        <option value="all">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="soon">Due soon (24h)</option>
        <option value="none">No due date</option>
      </select>
      <div className="w-px h-4 bg-slate-200" />
      <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))} className="border border-slate-200 rounded px-2 py-1 bg-white">
        <option value="manual">Sort: manual</option>
        <option value="dueDate">Sort: due date</option>
        <option value="priority">Sort: priority</option>
        <option value="name">Sort: name</option>
      </select>
      {active && (
        <button onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }))} className="text-slate-400 hover:text-rose-500 flex items-center gap-0.5">
          <X className="w-3 h-3" /> Clear filters
        </button>
      )}
      <div className="w-px h-4 bg-slate-200" />
      {(savedViews || []).map((v) => (
        <div key={v.id} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-1">
          <button onClick={() => setFilters(v.filters)} className="font-medium">{v.name}</button>
          <button onClick={() => onDeleteView(v.id)} className="text-indigo-300 hover:text-rose-500"><X className="w-2.5 h-2.5" /></button>
        </div>
      ))}
      {savingView ? (
        <input
          autoFocus value={viewName} onChange={(e) => setViewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && viewName.trim()) { onSaveView(viewName, filters); setViewName(""); setSavingView(false); } if (e.key === "Escape") setSavingView(false); }}
          onBlur={() => setSavingView(false)}
          placeholder="View name" className="border border-slate-200 rounded px-1.5 py-1 w-24"
        />
      ) : (
        active && <button onClick={() => setSavingView(true)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"><Plus className="w-3 h-3" /> Save view</button>
      )}
    </div>
  );
}

// ---------- App ----------
// `initialData` — the persisted shape saved in a Firestore
// `orbit-workspaces/{id}.data` field: { spaces, activity, goals,
// dashboards, whiteboards, docs, forms, chatMessages }. Any field
// missing (e.g. a brand-new workspace) falls back to an empty value.
// `members` — real Clydec people, injected live (see
// OrbitWorkspaceView in App.jsx). The logged-in viewer is always
// mapped to id "m1" by the caller, preserving the "m1 = current user"
// convention this file was already built around (see history doc) —
// so nothing below needed to change to know who "you" are.
// `onDataChange(data)` — called (debounced) whenever anything
// persist-worthy changes, so the caller can write it to Firestore.
// `onExit()` — returns to the Workspace list in Clydec.
// `workspaceName` — shown in the sidebar header in place of the old
// static "Orbit Workspace" label.
export default function OrbitApp({ members = DEFAULT_MEMBERS, initialData = null, onDataChange, onExit, workspaceName = "Orbit Workspace" }) {
  const [spaces, setSpaces] = useState(() => initialData?.spaces || []);
  const [expanded, setExpanded] = useState({});
  const [currentListId, setCurrentListId] = useState(null);
  const [route, setRoute] = useState("home"); // home | list
  const [view, setView] = useState("list"); // list | board
  const [query, setQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusEditorList, setStatusEditorList] = useState(null);
  const [fieldsEditorList, setFieldsEditorList] = useState(null);
  const [automationsEditorList, setAutomationsEditorList] = useState(null);
  const [activity, setActivity] = useState(() => initialData?.activity || []);
  const [goals, setGoals] = useState(() => initialData?.goals || []);
  const [dashboards, setDashboards] = useState(() => initialData?.dashboards || []);
  const [whiteboards, setWhiteboards] = useState(() => initialData?.whiteboards || []);
  const [docs, setDocs] = useState(() => initialData?.docs || []);
  const [docFolders, setDocFolders] = useState(() => initialData?.docFolders || []);
  const [forms, setForms] = useState(() => initialData?.forms || []);
  const [chatMessages, setChatMessages] = useState(() => initialData?.chatMessages || {});
  const [runningTimer, setRunningTimer] = useState(null); // { listId, taskId, startedAt }
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!runningTimer) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  // ---- Autosave: debounce persist-worthy state back up to Firestore ----
  // (via the caller's onDataChange). 1.2s of quiet before writing, so
  // typing in a doc/whiteboard drag doesn't fire a write per keystroke —
  // matches the debounce pattern used elsewhere for anything free-typed.
  // `members` is deliberately NOT included here — it's owned by Clydec
  // (People Management / Admin Users), not by this workspace's doc.
  const saveTimerRef = useRef(null);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (!onDataChange) return;
    if (firstRenderRef.current) { firstRenderRef.current = false; return; } // don't re-write what we just loaded
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onDataChange({ spaces, activity, goals, dashboards, whiteboards, docs, docFolders, forms, chatMessages });
    }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [spaces, activity, goals, dashboards, whiteboards, docs, docFolders, forms, chatMessages, onDataChange]);

  function logActivity(entry) {
    setActivity((prev) => [{ id: uid("act"), ts: Date.now(), ...entry }, ...prev].slice(0, 100));
  }

  // ---- helpers to locate / update tree ----
  const allLists = useMemo(() => {
    const out = [];
    spaces.forEach((sp) => {
      sp.lists.forEach((l) => out.push({ ...l, spaceId: sp.id, spaceName: sp.name, spaceColor: sp.color }));
      sp.folders.forEach((f) => f.lists.forEach((l) => out.push({ ...l, spaceId: sp.id, spaceName: sp.name, spaceColor: sp.color, folderName: f.name })));
    });
    return out;
  }, [spaces]);

  const currentList = allLists.find((l) => l.id === currentListId) || null;

  function updateList(listId, updater) {
    setSpaces((prev) => prev.map((sp) => ({
      ...sp,
      lists: sp.lists.map((l) => (l.id === listId ? updater(l) : l)),
      folders: sp.folders.map((f) => ({
        ...f,
        lists: f.lists.map((l) => (l.id === listId ? updater(l) : l)),
      })),
    })));
  }

  function updateTask(listId, taskId, patch) {
    updateList(listId, (l) => ({
      ...l,
      tasks: l.tasks.map((t) => (t.id === taskId ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
    }));
  }

  // ---- Bulk actions (multi-select in ListView) ----
  function bulkSetStatus(listId, taskIds, statusId) {
    taskIds.forEach((taskId) => setTaskStatus(listId, taskId, statusId));
  }
  function bulkSetPriority(listId, taskIds, priority) {
    updateList(listId, (l) => ({ ...l, tasks: l.tasks.map((t) => (taskIds.includes(t.id) ? { ...t, priority } : t)) }));
  }
  function bulkSetAssignee(listId, taskIds, assigneeId) {
    updateList(listId, (l) => ({ ...l, tasks: l.tasks.map((t) => (taskIds.includes(t.id) ? { ...t, assigneeIds: assigneeId ? [assigneeId] : [] } : t)) }));
  }
  function bulkAddTag(listId, taskIds, tag) {
    if (!tag.trim()) return;
    updateList(listId, (l) => ({ ...l, tasks: l.tasks.map((t) => (taskIds.includes(t.id) && !t.tags.includes(tag) ? { ...t, tags: [...t.tags, tag.trim()] } : t)) }));
  }
  function bulkDeleteTasks(listId, taskIds) {
    updateList(listId, (l) => ({ ...l, tasks: l.tasks.filter((t) => !taskIds.includes(t.id)) }));
    logActivity({ type: "info", text: `Deleted ${taskIds.length} task${taskIds.length === 1 ? "" : "s"} in bulk`, listId });
  }

  // ---- Saved views (named filter+sort combos, per list) ----
  function saveView(listId, name, filters) {
    if (!name.trim()) return;
    updateList(listId, (l) => ({ ...l, savedViews: [...(l.savedViews || []), { id: uid("view"), name: name.trim(), filters }] }));
  }
  function deleteView(listId, viewId) {
    updateList(listId, (l) => ({ ...l, savedViews: (l.savedViews || []).filter((v) => v.id !== viewId) }));
  }

  function addTask(listId, statusId, name) {
    if (!name.trim()) return;
    const task = makeTask(name.trim(), statusId);
    updateList(listId, (l) => ({ ...l, tasks: [...l.tasks, task] }));
    logActivity({ type: "created", text: `Created "${task.name}"`, listId, taskId: task.id });
    fireAutomations(listId, task, "task_created");
  }

  function setTaskStatus(listId, taskId, statusId) {
    const list = allLists.find((l) => l.id === listId);
    const task = list?.tasks.find((t) => t.id === taskId);
    const newStatus = list?.statuses.find((s) => s.id === statusId);
    updateTask(listId, taskId, { statusId });
    if (task && newStatus && newStatus.isFinal) {
      logActivity({ type: "completed", text: `Completed "${task.name}"`, listId, taskId });
      if (task.recurrence) createNextRecurrence(listId, list, task);
    }
    if (task) fireAutomations(listId, { ...task, statusId }, "status_changed", { toStatusId: statusId });
  }

  // Called when a task with a `recurrence` is marked done — spins up a fresh
  // copy in the same list, first non-final status, due date advanced by one
  // interval (from the *original* due date if it had one, otherwise from
  // today) — same core idea ClickUp/Asana's "repeat" does.
  function createNextRecurrence(listId, list, completedTask) {
    const day = 24 * 60 * 60 * 1000;
    const advance = { daily: day, weekly: 7 * day, monthly: 30 * day }[completedTask.recurrence.freq] || day;
    const base = completedTask.dueDate || Date.now();
    const startStatus = list.statuses.find((s) => !s.isFinal)?.id || list.statuses[0]?.id;
    const next = {
      ...makeTask(completedTask.name, startStatus, {
        priority: completedTask.priority, assigneeIds: completedTask.assigneeIds, tags: completedTask.tags,
        dueDate: base + advance,
      }),
      description: completedTask.description,
      recurrence: completedTask.recurrence,
      checklist: (completedTask.checklist || []).map((c) => ({ ...c, id: uid("chk"), done: false })),
    };
    updateList(listId, (l) => ({ ...l, tasks: [...l.tasks, next] }));
    logActivity({ type: "created", text: `Created "${next.name}" (repeats ${completedTask.recurrence.freq})`, listId, taskId: next.id });
    fireAutomations(listId, next, "task_created");
  }

  function addComment(listId, taskId, text) {
    if (!text.trim()) return;
    const task = allLists.find((l) => l.id === listId)?.tasks.find((t) => t.id === taskId);
    updateTask(listId, taskId, (t) => ({ comments: [...t.comments, { id: uid("cm"), authorId: "m1", text: text.trim() }] }));
    logActivity({ type: "comment", text: `Commented on "${task?.name || "a task"}"`, listId, taskId });
    if (task) fireAutomations(listId, task, "comment_added");
  }

  function toggleBlocker(listId, taskId, blockerId) {
    updateTask(listId, taskId, (t) => ({
      blockedBy: t.blockedBy.includes(blockerId) ? t.blockedBy.filter((id) => id !== blockerId) : [...t.blockedBy, blockerId],
    }));
  }

  function deleteTask(listId, taskId) {
    updateList(listId, (l) => ({ ...l, tasks: l.tasks.filter((t) => t.id !== taskId) }));
    setSelectedTaskId(null);
  }

  // Member add/rename/remove are intentionally NOT implemented here
  // anymore — `members` comes from Clydec's real `users`/`people`
  // collections (see OrbitWorkspaceView in App.jsx), so managing who's
  // on the team happens in People Management, not inside a specific
  // Orbit Workspace. TeamView is passed `null` for all three handlers
  // below and hides its add/rename/remove controls when they're null.

  function addSpace(name) {
    setSpaces((prev) => [...prev, { id: uid("space"), name, color: SPACE_COLORS[prev.length % SPACE_COLORS.length], folders: [], lists: [] }]);
  }
  function addFolder(spaceId, name) {
    setSpaces((prev) => prev.map((sp) => sp.id === spaceId ? { ...sp, folders: [...sp.folders, { id: uid("folder"), name, lists: [] }] } : sp));
  }
  function addListTo(spaceId, folderId, name, template) {
    const list = makeList(name, { isSprint: template === "sprint" });
    list.tasks = []; // fresh custom lists start empty
    if (template === "crm") {
      list.customFields = [
        { id: uid("cf"), name: "Company", type: "text", options: [] },
        { id: uid("cf"), name: "Deal value", type: "number", options: [] },
        { id: uid("cf"), name: "Stage", type: "dropdown", options: ["New", "Contacted", "Proposal", "Won", "Lost"] },
      ];
      list.statuses = [
        { id: uid("st"), name: "New Lead", color: "gray", isFinal: false },
        { id: uid("st"), name: "Contacted", color: "blue", isFinal: false },
        { id: uid("st"), name: "Proposal Sent", color: "amber", isFinal: false },
        { id: uid("st"), name: "Closed Won", color: "green", isFinal: true },
        { id: uid("st"), name: "Closed Lost", color: "red", isFinal: true },
      ];
    }
    setSpaces((prev) => prev.map((sp) => {
      if (sp.id !== spaceId) return sp;
      if (!folderId) return { ...sp, lists: [...sp.lists, list] };
      return { ...sp, folders: sp.folders.map((f) => f.id === folderId ? { ...f, lists: [...f.lists, list] } : f) };
    }));
    setCurrentListId(list.id);
    setRoute("list");
  }
  function deleteNode(type, spaceId, folderId, listId) {
    setSpaces((prev) => {
      if (type === "space") return prev.filter((s) => s.id !== spaceId);
      return prev.map((sp) => {
        if (sp.id !== spaceId) return sp;
        if (type === "folder") return { ...sp, folders: sp.folders.filter((f) => f.id !== folderId) };
        if (type === "list") {
          return {
            ...sp,
            lists: sp.lists.filter((l) => l.id !== listId),
            folders: sp.folders.map((f) => folderId && f.id === folderId ? { ...f, lists: f.lists.filter((l) => l.id !== listId) } : f),
          };
        }
        return sp;
      });
    });
    if (listId === currentListId) { setCurrentListId(null); setRoute("home"); }
  }

  function addStatus(listId, name, color, isFinal) {
    updateList(listId, (l) => ({ ...l, statuses: [...l.statuses, { id: uid("st"), name, color, isFinal: !!isFinal }] }));
  }
  function renameStatus(listId, statusId, name, color, isFinal) {
    updateList(listId, (l) => ({ ...l, statuses: l.statuses.map((s) => s.id === statusId ? { ...s, name, color, isFinal: isFinal !== undefined ? isFinal : s.isFinal } : s) }));
  }
  function deleteStatus(listId, statusId) {
    updateList(listId, (l) => {
      const fallback = l.statuses.find((s) => s.id !== statusId)?.id;
      return {
        ...l,
        statuses: l.statuses.filter((s) => s.id !== statusId),
        tasks: l.tasks.map((t) => t.statusId === statusId ? { ...t, statusId: fallback } : t),
      };
    });
  }

  function addCustomField(listId, name, type, options) {
    updateList(listId, (l) => ({ ...l, customFields: [...l.customFields, { id: uid("cf"), name, type, options: options || [] }] }));
  }
  function deleteCustomField(listId, fieldId) {
    updateList(listId, (l) => ({ ...l, customFields: l.customFields.filter((f) => f.id !== fieldId) }));
  }
  function setCustomFieldValue(listId, taskId, fieldId, value) {
    updateTask(listId, taskId, (t) => ({ customFieldValues: { ...t.customFieldValues, [fieldId]: value } }));
  }

  function addAutomation(listId, rule) {
    updateList(listId, (l) => ({
      ...l,
      automations: [...l.automations, { id: uid("auto"), enabled: true, conditions: [], logic: "AND", actions: [], ...rule }],
    }));
  }
  function updateAutomation(listId, autoId, patch) {
    updateList(listId, (l) => ({ ...l, automations: l.automations.map((a) => (a.id === autoId ? { ...a, ...patch } : a)) }));
  }
  function toggleAutomation(listId, autoId) {
    updateList(listId, (l) => ({ ...l, automations: l.automations.map((a) => (a.id === autoId ? { ...a, enabled: !a.enabled } : a)) }));
  }
  function deleteAutomation(listId, autoId) {
    updateList(listId, (l) => ({ ...l, automations: l.automations.filter((a) => a.id !== autoId) }));
  }

  // Executes every action in a rule, in order, against one task.
  // `a.value` for create_linked_task/move_task is a listId (from
  // allLists); for the others it's the plain value described alongside
  // each action's config in AutomationsEditorModal.
  function runRuleActions(listId, taskId, list, rule) {
    rule.actions.forEach((a) => {
      if (a.type === "set_status" && a.value) updateTask(listId, taskId, { statusId: a.value });
      else if (a.type === "set_priority") updateTask(listId, taskId, { priority: a.value });
      else if (a.type === "set_assignee") updateTask(listId, taskId, { assigneeIds: a.value ? [a.value] : [] });
      else if (a.type === "add_tag" && a.value) updateTask(listId, taskId, (t) => (t.tags.includes(a.value) ? {} : { tags: [...t.tags, a.value] }));
      else if (a.type === "add_comment" && a.value) updateTask(listId, taskId, (t) => ({ comments: [...t.comments, { id: uid("cm"), authorId: "m1", text: a.value }] }));
      else if (a.type === "create_subtask" && a.value) updateTask(listId, taskId, (t) => ({ subtasks: [...t.subtasks, makeSubtask(a.value)] }));
      else if (a.type === "post_chat" && a.value) sendChatMessage(list.spaceId, `\u26a1 ${a.value}`);
      else if (a.type === "create_linked_task" && a.value) {
        const targetList = allLists.find((l) => l.id === a.value);
        const source = list.tasks.find((t) => t.id === taskId);
        if (targetList && source) {
          const linked = makeTask(`Follow-up: ${source.name}`, targetList.statuses[0]?.id, { priority: source.priority });
          updateList(targetList.id, (l) => ({ ...l, tasks: [...l.tasks, linked] }));
          logActivity({ type: "created", text: `Automation created "${linked.name}" in "${targetList.name}"`, listId: targetList.id, taskId: linked.id });
        }
      }
      else if (a.type === "move_task" && a.value) {
        const targetList = allLists.find((l) => l.id === a.value);
        const source = list.tasks.find((t) => t.id === taskId);
        if (targetList && source && targetList.id !== listId) {
          updateList(listId, (l) => ({ ...l, tasks: l.tasks.filter((t) => t.id !== taskId) }));
          updateList(targetList.id, (l) => ({ ...l, tasks: [...l.tasks, { ...source, statusId: targetList.statuses[0]?.id }] }));
          logActivity({ type: "info", text: `Automation moved "${source.name}" to "${targetList.name}"`, listId: targetList.id, taskId });
        }
      }
      else if (a.type === "send_mock_email" && a.value) {
        // No real email infrastructure is wired up (no SMTP/transactional-
        // email provider configured for this app) — logged to Activity as a
        // clearly-labeled mock, same honest-stub approach as the disabled
        // AI assist, rather than silently pretending to send something.
        logActivity({ type: "info", text: `[Mock email] To: ${a.value} — "${rule.name || "Untitled rule"}" would have emailed here`, listId, taskId });
      }
      else if (a.type === "webhook" && a.value) {
        fetch(a.value, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rule: rule.name, listId, taskId, at: Date.now() }) })
          .then(() => logActivity({ type: "info", text: `Webhook sent to ${a.value}`, listId, taskId }))
          .catch(() => logActivity({ type: "info", text: `Webhook failed: ${a.value}`, listId, taskId }));
      }
    });
    logActivity({ type: "info", text: `Automation "${rule.name || "Untitled rule"}" ran`, listId, taskId });
  }

  // Dispatches an event to every enabled rule on a list; runs the ones whose trigger + conditions match.
  function fireAutomations(listId, task, eventType, opts = {}) {
    const list = allLists.find((l) => l.id === listId);
    if (!list) return;
    (list.automations || []).forEach((rule) => {
      if (ruleMatches(rule, task, eventType, opts)) runRuleActions(listId, task.id, list, rule);
    });
  }

  // Manual "polling" trigger: scans every task workspace-wide for overdue /
  // due-soon items. (Named runDueDateCheck for backwards compatibility with
  // its one call site below; it now covers both due_passed and due_soon.)
  function runDueDateCheck() {
    let hits = 0;
    everyTask.forEach((t) => {
      const list = allLists.find((l) => l.id === t.listId);
      const st = list?.statuses.find((s) => s.id === t.statusId);
      const done = !!st?.isFinal;
      if (isOverdue(t.dueDate, done)) { fireAutomations(t.listId, t, "due_passed"); hits += 1; }
      else if (isDueSoon(t.dueDate, done)) { fireAutomations(t.listId, t, "due_soon"); hits += 1; }
    });
    logActivity({ type: "info", text: `Due-date check ran (${hits} overdue/due-soon task${hits === 1 ? "" : "s"})` });
  }

  function startTimer(listId, taskId) {
    setRunningTimer({ listId, taskId, startedAt: Date.now() });
  }
  function stopTimer(note) {
    if (!runningTimer) return;
    const minutes = Math.max(1, Math.round((Date.now() - runningTimer.startedAt) / 60000));
    updateTask(runningTimer.listId, runningTimer.taskId, (t) => ({
      timeEntries: [...t.timeEntries, { id: uid("tt"), minutes, note: note || "", ts: Date.now() }],
    }));
    setRunningTimer(null);
  }
  function addManualTimeEntry(listId, taskId, minutes, note) {
    if (!minutes || minutes <= 0) return;
    updateTask(listId, taskId, (t) => ({ timeEntries: [...t.timeEntries, { id: uid("tt"), minutes, note: note || "", ts: Date.now() }] }));
  }

  // ---- Goals ----
  // `spaceId` connects a goal to a Space (shown as a chip in GoalsView, and
  // that Space's own page can show its goals — see SpaceHomeView usage
  // below). `sourceListId`, if set, makes the goal's progress auto-compute
  // from that list's task-completion percentage instead of being tracked
  // manually — the concrete "Spaces and Goals should be connected" link.
  function addGoal(name, targetValue, unit, spaceId, sourceListId) {
    setGoals((prev) => [...prev, {
      id: uid("goal"), name, targetValue: Number(targetValue) || 100, currentValue: 0, unit,
      color: SPACE_COLORS[prev.length % SPACE_COLORS.length], dueDate: Date.now() + 30 * 86400000,
      spaceId: spaceId || null, sourceListId: sourceListId || null,
    }]);
  }
  // Reads live off `allLists` — never stored, so it can't drift out of sync
  // with the list it's tracking.
  function goalProgress(goal) {
    if (!goal.sourceListId) return { value: goal.currentValue, auto: false };
    const list = allLists.find((l) => l.id === goal.sourceListId);
    if (!list || list.tasks.length === 0) return { value: 0, auto: true };
    const done = list.tasks.filter((t) => list.statuses.find((s) => s.id === t.statusId)?.isFinal).length;
    return { value: Math.round((done / list.tasks.length) * (goal.targetValue || 100)), auto: true };
  }
  function updateGoalProgress(goalId, value) {
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, currentValue: Math.max(0, Math.min(g.targetValue, Number(value))) } : g));
  }
  function deleteGoal(goalId) {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }

  // ---- Dashboards ----
  function addDashboard(name) {
    setDashboards((prev) => [...prev, { id: uid("dash"), name, widgets: [] }]);
  }
  function addWidget(dashId, type) {
    setDashboards((prev) => prev.map((d) => d.id === dashId ? { ...d, widgets: [...d.widgets, { id: uid("wid"), type }] } : d));
  }
  function removeWidget(dashId, widgetId) {
    setDashboards((prev) => prev.map((d) => d.id === dashId ? { ...d, widgets: d.widgets.filter((w) => w.id !== widgetId) } : d));
  }
  function deleteDashboard(dashId) {
    setDashboards((prev) => prev.filter((d) => d.id !== dashId));
  }

  // ---- Whiteboards ----
  function addWhiteboard(name) {
    setWhiteboards((prev) => [...prev, { id: uid("wb"), name, elements: [] }]);
  }
  function addWhiteboardElement(wbId, type) {
    const colors = ["amber", "teal", "pink", "blue"];
    setWhiteboards((prev) => prev.map((wb) => wb.id === wbId ? {
      ...wb,
      elements: [...wb.elements, { id: uid("el"), type, x: 60 + Math.random() * 200, y: 60 + Math.random() * 120, w: type === "text" ? 180 : 160, h: type === "text" ? 40 : 110, text: type === "text" ? "Label" : "New note", color: colors[wb.elements.length % colors.length] }],
    } : wb));
  }
  function updateWhiteboardElement(wbId, elId, patch) {
    setWhiteboards((prev) => prev.map((wb) => wb.id === wbId ? { ...wb, elements: wb.elements.map((e) => e.id === elId ? { ...e, ...patch } : e) } : wb));
  }
  function deleteWhiteboardElement(wbId, elId) {
    setWhiteboards((prev) => prev.map((wb) => wb.id === wbId ? { ...wb, elements: wb.elements.filter((e) => e.id !== elId) } : wb));
  }
  function deleteWhiteboard(wbId) {
    setWhiteboards((prev) => prev.filter((wb) => wb.id !== wbId));
  }

  // ---- Docs ----
  // Content is a `blocks` array — { id, type: "paragraph"|"bullet"|"image"|"video"|"file", text?, dataUrl?, name?, size? } —
  // instead of one plain-text field, so a doc can mix paragraphs, bullet
  // points, and embedded images/files/video links. Deliberately a flat
  // append/edit/delete/reorder block list rather than a full rich-text
  // editor (contentEditable + selection/formatting state) — that's a much
  // larger, separate piece of work than this pass covers.
  function addDoc(name, folderId = null) {
    const doc = { id: uid("doc"), name, folderId, blocks: [], linkedSpaceId: null, linkedGoalId: null, updatedAt: Date.now() };
    setDocs((prev) => [...prev, doc]);
    return doc.id;
  }
  function updateDoc(docId, patch) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, ...patch, updatedAt: Date.now() } : d));
  }
  function deleteDoc(docId) {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
  }
  function addDocFolder(name) {
    if (!name.trim()) return;
    setDocFolders((prev) => [...prev, { id: uid("dfold"), name: name.trim() }]);
  }
  function deleteDocFolder(folderId) {
    setDocFolders((prev) => prev.filter((f) => f.id !== folderId));
    setDocs((prev) => prev.map((d) => (d.folderId === folderId ? { ...d, folderId: null } : d)));
  }
  function addDocBlock(docId, type, value = "") {
    setDocs((prev) => prev.map((d) => {
      if (d.id !== docId) return d;
      const block = type === "paragraph" || type === "bullet" ? { id: uid("blk"), type, text: value } : { id: uid("blk"), type, ...value };
      return { ...d, blocks: [...d.blocks, block], updatedAt: Date.now() };
    }));
  }
  function updateDocBlock(docId, blockId, patch) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, blocks: d.blocks.map((b) => b.id === blockId ? { ...b, ...patch } : b), updatedAt: Date.now() } : d));
  }
  function deleteDocBlock(docId, blockId) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, blocks: d.blocks.filter((b) => b.id !== blockId) } : d));
  }

  // ---- Forms ----
  // `slug` is a short, stable reference id shown as a "shareable link" in
  // FormsView. Scoped deliberately: it's a copyable reference for a
  // teammate who already has portal access (e.g. paste into Slack, "here's
  // the intake form"), not a public/unauthenticated URL — building real
  // anonymous external submission would mean opening Firestore writes to
  // logged-out visitors, a meaningfully bigger security surface than this
  // pass covers. Flagged in clydec-portal-history.md rather than silently
  // assumed to be full public form hosting.
  function addForm(name, listId) {
    const form = { id: uid("form"), name, listId, slug: uid("frm").slice(0, 10), linkedGoalId: null, fields: [{ id: uid("ff"), label: "Task name", type: "text" }, { id: uid("ff"), label: "Details", type: "textarea" }] };
    setForms((prev) => [...prev, form]);
    return form.id;
  }
  function addFormField(formId, label, type) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, fields: [...f.fields, { id: uid("ff"), label, type }] } : f));
  }
  function deleteFormField(formId, fieldId) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, fields: f.fields.filter((fl) => fl.id !== fieldId) } : f));
  }
  function deleteForm(formId) {
    setForms((prev) => prev.filter((f) => f.id !== formId));
  }
  function setFormGoal(formId, goalId) {
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, linkedGoalId: goalId || null } : f));
  }
  function submitForm(form, values) {
    const nameField = form.fields.find((f) => /name/i.test(f.label));
    const title = (nameField && values[nameField.id]) || "New form submission";
    const detailParts = form.fields.filter((f) => f !== nameField).map((f) => `${f.label}: ${values[f.id] || "—"}`);
    const list = allLists.find((l) => l.id === form.listId);
    if (!list) return;
    const task = makeTask(title, list.statuses[0].id, {});
    task.description = detailParts.join("\n");
    updateList(list.id, (l) => ({ ...l, tasks: [...l.tasks, task] }));
    logActivity({ type: "created", text: `Form "${form.name}" created "${title}"`, listId: list.id, taskId: task.id });
    // If this form is linked to a manually-tracked Goal (one without its own
    // auto-tracking list), each submission nudges that Goal's progress —
    // the concrete "Forms connected to Goals" link. A Goal that's already
    // auto-tracked from a list doesn't need this (it moves from task
    // completion instead, see goalProgress()).
    if (form.linkedGoalId) {
      setGoals((prev) => prev.map((g) => (g.id === form.linkedGoalId && !g.sourceListId ? { ...g, currentValue: g.currentValue + 1 } : g)));
    }
  }

  // ---- Chat ----
  function sendChatMessage(channelId, text) {
    if (!text.trim()) return;
    setChatMessages((prev) => ({ ...prev, [channelId]: [...(prev[channelId] || []), { id: uid("msg"), authorId: "m1", text: text.trim(), ts: Date.now() }] }));
  }

  const selectedTask = currentList?.tasks.find((t) => t.id === selectedTaskId) || null;

  // all tasks across workspace, for home dashboard + search
  const everyTask = useMemo(() => allLists.flatMap((l) => l.tasks.map((t) => ({ ...t, listId: l.id, listName: l.name }))), [allLists]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return everyTask.filter((t) => t.name.toLowerCase().includes(q));
  }, [query, everyTask]);

  return (
    <MembersContext.Provider value={members}>
    <div className="h-full w-full flex bg-slate-50 text-slate-800 font-sans text-sm" style={{ minHeight: 640 }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-3 py-3 border-b border-slate-100 flex items-center gap-2">
            {onExit && (
              <button onClick={onExit} className="p-1 rounded hover:bg-slate-100 text-slate-500 shrink-0" title="Back to Workspaces">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">O</div>
            <span className="font-semibold text-slate-900 truncate" title={workspaceName}>{workspaceName}</span>
          </div>
          <div className="px-2 py-2 space-y-0.5">
            <NavButton active={route === "home"} onClick={() => { setRoute("home"); setSelectedTaskId(null); }} icon={<Home className="w-4 h-4" />} label="Home" />
            <NavButton active={route === "team"} onClick={() => { setRoute("team"); setSelectedTaskId(null); }} icon={<Users className="w-4 h-4" />} label="Team" />
            <NavButton active={route === "mytasks"} onClick={() => { setRoute("mytasks"); setSelectedTaskId(null); }} icon={<ListChecks className="w-4 h-4" />} label="My Tasks" />
            <NavButton active={route === "inbox"} onClick={() => { setRoute("inbox"); setSelectedTaskId(null); }} icon={<Bell className="w-4 h-4" />} label="Inbox" badge={activity.length} />
            <NavButton active={route === "calendar"} onClick={() => { setRoute("calendar"); setSelectedTaskId(null); }} icon={<CalendarDays className="w-4 h-4" />} label="Calendar" />
            <NavButton active={route === "dashboards"} onClick={() => { setRoute("dashboards"); setSelectedTaskId(null); }} icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboards" />
            <NavButton active={route === "goals"} onClick={() => { setRoute("goals"); setSelectedTaskId(null); }} icon={<Target className="w-4 h-4" />} label="Goals" />
            <NavButton active={route === "workload"} onClick={() => { setRoute("workload"); setSelectedTaskId(null); }} icon={<Gauge className="w-4 h-4" />} label="Workload" />
            <NavButton active={route === "whiteboards"} onClick={() => { setRoute("whiteboards"); setSelectedTaskId(null); }} icon={<PenTool className="w-4 h-4" />} label="Whiteboards" />
            <NavButton active={route === "docs"} onClick={() => { setRoute("docs"); setSelectedTaskId(null); }} icon={<FileText className="w-4 h-4" />} label="Docs" />
            <NavButton active={route === "forms"} onClick={() => { setRoute("forms"); setSelectedTaskId(null); }} icon={<ClipboardList className="w-4 h-4" />} label="Forms" />
            <NavButton active={route === "chat"} onClick={() => { setRoute("chat"); setSelectedTaskId(null); }} icon={<Hash className="w-4 h-4" />} label="Chat" />
            <NavButton active={route === "automations"} onClick={() => { setRoute("automations"); setSelectedTaskId(null); }} icon={<Zap className="w-4 h-4" />} label="Automations" />
          </div>
          <div className="px-3 pt-1 pb-1">
            <div className="h-px bg-slate-100" />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
              <span>Spaces</span>
              <InlineAdd onSubmit={addSpace} placeholder="Space name" />
            </div>
            {spaces.map((sp) => (
              <SpaceNode
                key={sp.id}
                space={sp}
                expanded={expanded}
                setExpanded={setExpanded}
                currentListId={currentListId}
                onSelectList={(id) => { setCurrentListId(id); setRoute("list"); setSelectedTaskId(null); setView("list"); }}
                onAddFolder={(name) => addFolder(sp.id, name)}
                onAddList={(folderId, name) => addListTo(sp.id, folderId, name)}
                onDelete={deleteNode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center gap-3 px-4 shrink-0">
          <button onClick={() => setSidebarOpen((s) => !s)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
            <Rows className="w-4 h-4" />
          </button>
          <div className="font-semibold text-slate-900 truncate">
            {({
              home: "Home", team: "Team", mytasks: "My Tasks", inbox: "Inbox", calendar: "Calendar",
              dashboards: "Dashboards", goals: "Goals & OKRs", workload: "Workload",
              whiteboards: "Whiteboards", docs: "Docs & Wikis", forms: "Forms", chat: "Chat", automations: "Automations",
            })[route] || (currentList ? currentList.name : "Select a list")}
          </div>
          {route === "list" && currentList && (
            <div className="flex items-center bg-slate-100 rounded-md p-0.5 ml-2">
              <button onClick={() => setView("list")} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${view === "list" ? "bg-white shadow-sm" : "text-slate-500"}`}>
                <ListIcon className="w-3.5 h-3.5" /> List
              </button>
              <button onClick={() => setView("board")} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${view === "board" ? "bg-white shadow-sm" : "text-slate-500"}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> Board
              </button>
              <button onClick={() => setView("timeline")} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${view === "timeline" ? "bg-white shadow-sm" : "text-slate-500"}`}>
                <CalendarRange className="w-3.5 h-3.5" /> Timeline
              </button>
            </div>
          )}
          <div className="flex-1" />
          {runningTimer && (
            <button
              onClick={() => stopTimer()}
              className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded-md font-medium"
              title="Click to stop timer"
            >
              <Pause className="w-3.5 h-3.5" />
              {Math.floor((Date.now() - runningTimer.startedAt) / 60000)}:{String(Math.floor(((Date.now() - runningTimer.startedAt) / 1000) % 60)).padStart(2, "0")}
              {" — "}{allLists.find((l) => l.id === runningTimer.listId)?.tasks.find((t) => t.id === runningTimer.taskId)?.name}
            </button>
          )}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all tasks..."
              className="w-full pl-8 pr-2 py-1.5 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {query.trim() ? (
            <SearchResultsView
              results={searchResults}
              allLists={allLists}
              onOpen={(listId, taskId) => { setQuery(""); setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }}
            />
          ) : route === "home" ? (
            <HomeDashboard everyTask={everyTask} allLists={allLists} onOpen={(listId, taskId) => { setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }} onNavigate={(r) => { setRoute(r); setSelectedTaskId(null); }} spaces={spaces} onAddListTemplate={(spaceId, name, template) => addListTo(spaceId, null, name, template)} onAddDoc={addDoc} onAddWhiteboard={addWhiteboard} onAddDashboard={addDashboard} />
          ) : route === "team" ? (
            <TeamView
              members={members}
              everyTask={everyTask}
              allLists={allLists}
              spaces={spaces}
              docs={docs}
              whiteboards={whiteboards}
              dashboards={dashboards}
              forms={forms}
              goals={goals}
              onAddMember={null}
              onRenameMember={null}
              onDeleteMember={null}
              onOpen={(listId, taskId) => { setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }}
            />
          ) : route === "mytasks" ? (
            <MyTasksView everyTask={everyTask} allLists={allLists} onOpen={(listId, taskId) => { setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }} onSetStatus={setTaskStatus} />
          ) : route === "inbox" ? (
            <InboxView activity={activity} allLists={allLists} onOpen={(listId, taskId) => { setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }} />
          ) : route === "calendar" ? (
            <CalendarView everyTask={everyTask} onOpen={(listId, taskId) => { setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }} />
          ) : route === "dashboards" ? (
            <DashboardsView
              dashboards={dashboards}
              everyTask={everyTask}
              allLists={allLists}
              onAddDashboard={addDashboard}
              onAddWidget={addWidget}
              onRemoveWidget={removeWidget}
              onDeleteDashboard={deleteDashboard}
              onOpen={(listId, taskId) => { setCurrentListId(listId); setRoute("list"); setSelectedTaskId(taskId); }}
            />
          ) : route === "goals" ? (
            <GoalsView goals={goals} spaces={spaces} allLists={allLists} goalProgress={goalProgress} onAdd={addGoal} onUpdateProgress={updateGoalProgress} onDelete={deleteGoal} onOpenList={(listId) => { setCurrentListId(listId); setRoute("list"); }} />
          ) : route === "workload" ? (
            <WorkloadView everyTask={everyTask} allLists={allLists} />
          ) : route === "whiteboards" ? (
            <WhiteboardsView
              whiteboards={whiteboards}
              onAddBoard={addWhiteboard}
              onAddElement={addWhiteboardElement}
              onUpdateElement={updateWhiteboardElement}
              onDeleteElement={deleteWhiteboardElement}
              onDeleteBoard={deleteWhiteboard}
            />
          ) : route === "docs" ? (
            <DocsView
              docs={docs} docFolders={docFolders} spaces={spaces} goals={goals}
              onAdd={addDoc} onUpdate={updateDoc} onDelete={deleteDoc}
              onAddFolder={addDocFolder} onDeleteFolder={deleteDocFolder}
              onAddBlock={addDocBlock} onUpdateBlock={updateDocBlock} onDeleteBlock={deleteDocBlock}
            />
          ) : route === "forms" ? (
            <FormsView forms={forms} allLists={allLists} goals={goals} onAdd={addForm} onAddField={addFormField} onDeleteField={deleteFormField} onDelete={deleteForm} onSubmitForm={submitForm} onSetGoal={setFormGoal} />
          ) : route === "chat" ? (
            <ChatView spaces={spaces} messages={chatMessages} onSend={sendChatMessage} />
          ) : route === "automations" ? (
            <AutomationsHubView
              allLists={allLists}
              onToggle={(listId, autoId) => toggleAutomation(listId, autoId)}
              onDelete={(listId, autoId) => deleteAutomation(listId, autoId)}
              onEdit={(listId) => setAutomationsEditorList(allLists.find((l) => l.id === listId))}
              onRunDueCheck={runDueDateCheck}
              onPickList={(listId) => setAutomationsEditorList(allLists.find((l) => l.id === listId))}
            />
          ) : currentList ? (
            view === "list" ? (
              <ListView
                list={currentList}
                onAddTask={(statusId, name) => addTask(currentList.id, statusId, name)}
                onOpenTask={(id) => setSelectedTaskId(id)}
                onSetStatus={(taskId, statusId) => setTaskStatus(currentList.id, taskId, statusId)}
                onEditStatuses={() => setStatusEditorList(currentList)}
                onEditFields={() => setFieldsEditorList(currentList)}
                onEditAutomations={() => setAutomationsEditorList(currentList)}
                onBulkSetStatus={(taskIds, statusId) => bulkSetStatus(currentList.id, taskIds, statusId)}
                onBulkSetPriority={(taskIds, priority) => bulkSetPriority(currentList.id, taskIds, priority)}
                onBulkSetAssignee={(taskIds, assigneeId) => bulkSetAssignee(currentList.id, taskIds, assigneeId)}
                onBulkAddTag={(taskIds, tag) => bulkAddTag(currentList.id, taskIds, tag)}
                onBulkDelete={(taskIds) => bulkDeleteTasks(currentList.id, taskIds)}
                onSaveView={(name, filters) => saveView(currentList.id, name, filters)}
                onDeleteView={(viewId) => deleteView(currentList.id, viewId)}
              />
            ) : view === "board" ? (
              <BoardView
                list={currentList}
                onAddTask={(statusId, name) => addTask(currentList.id, statusId, name)}
                onOpenTask={(id) => setSelectedTaskId(id)}
                onMove={(taskId, statusId) => setTaskStatus(currentList.id, taskId, statusId)}
                onEditStatuses={() => setStatusEditorList(currentList)}
              />
            ) : (
              <TimelineView list={currentList} onOpenTask={(id) => setSelectedTaskId(id)} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <Inbox className="w-10 h-10" />
              <p>Pick a list from the sidebar, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Task drawer */}
      {selectedTask && currentList && (
        <TaskDrawer
          task={selectedTask}
          statuses={currentList.statuses}
          customFields={currentList.customFields}
          siblingTasks={currentList.tasks.filter((t) => t.id !== selectedTask.id)}
          onClose={() => setSelectedTaskId(null)}
          onPatch={(patch) => {
            updateTask(currentList.id, selectedTask.id, patch);
            if (patch && Object.prototype.hasOwnProperty.call(patch, "priority")) {
              fireAutomations(currentList.id, { ...selectedTask, ...patch }, "priority_changed");
            }
            if (patch && Object.prototype.hasOwnProperty.call(patch, "assigneeIds")) {
              fireAutomations(currentList.id, { ...selectedTask, ...patch }, "assignee_changed");
            }
          }}
          onStatusChange={(statusId) => setTaskStatus(currentList.id, selectedTask.id, statusId)}
          onComment={(text) => addComment(currentList.id, selectedTask.id, text)}
          onToggleBlocker={(blockerId) => toggleBlocker(currentList.id, selectedTask.id, blockerId)}
          onSetFieldValue={(fieldId, value) => { setCustomFieldValue(currentList.id, selectedTask.id, fieldId, value); fireAutomations(currentList.id, selectedTask, "custom_field_changed"); }}
          onDelete={() => deleteTask(currentList.id, selectedTask.id)}
          runningTimer={runningTimer}
          onStartTimer={() => startTimer(currentList.id, selectedTask.id)}
          onStopTimer={(note) => stopTimer(note)}
          onAddManualTime={(minutes, note) => addManualTimeEntry(currentList.id, selectedTask.id, minutes, note)}
        />
      )}

      {/* Status editor modal */}
      {statusEditorList && (
        <StatusEditorModal
          list={allLists.find((l) => l.id === statusEditorList.id) || statusEditorList}
          onClose={() => setStatusEditorList(null)}
          onAdd={(name, color) => addStatus(statusEditorList.id, name, color)}
          onRename={(sid, name, color) => renameStatus(statusEditorList.id, sid, name, color)}
          onDelete={(sid) => deleteStatus(statusEditorList.id, sid)}
        />
      )}

      {/* Custom fields editor modal */}
      {fieldsEditorList && (
        <CustomFieldsEditorModal
          list={allLists.find((l) => l.id === fieldsEditorList.id) || fieldsEditorList}
          onClose={() => setFieldsEditorList(null)}
          onAdd={(name, type, options) => addCustomField(fieldsEditorList.id, name, type, options)}
          onDelete={(fid) => deleteCustomField(fieldsEditorList.id, fid)}
        />
      )}

      {/* Automations editor modal */}
      {automationsEditorList && (
        <AutomationsEditorModal
          list={allLists.find((l) => l.id === automationsEditorList.id) || automationsEditorList}
          allLists={allLists}
          onClose={() => setAutomationsEditorList(null)}
          onAdd={(rule) => addAutomation(automationsEditorList.id, rule)}
          onUpdate={(autoId, patch) => updateAutomation(automationsEditorList.id, autoId, patch)}
          onDelete={(autoId) => deleteAutomation(automationsEditorList.id, autoId)}
          onToggle={(autoId) => toggleAutomation(automationsEditorList.id, autoId)}
        />
      )}
    </div>
    </MembersContext.Provider>
  );
}

// ---------- Sidebar tree ----------
function SpaceNode({ space, expanded, setExpanded, currentListId, onSelectList, onAddFolder, onAddList, onDelete }) {
  const open = expanded[space.id] ?? true;
  return (
    <div className="mt-1">
      <div className="group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100">
        <button onClick={() => setExpanded((e) => ({ ...e, [space.id]: !open }))}>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        <span className={`w-2 h-2 rounded-full ${COLOR_DOT[space.color] || "bg-slate-400"}`} />
        <span className="font-medium truncate flex-1">{space.name}</span>
        <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <InlineAdd onSubmit={(n) => onAddList(null, n)} placeholder="List name" />
          <button
            onClick={() => onDelete("space", space.id)}
            className="text-slate-300 hover:text-rose-500"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </span>
      </div>
      {open && (
        <div className="ml-4 border-l border-slate-100 pl-2">
          {space.folders.map((f) => (
            <FolderNode key={f.id} space={space} folder={f} expanded={expanded} setExpanded={setExpanded} currentListId={currentListId} onSelectList={onSelectList} onAddList={onAddList} onDelete={onDelete} />
          ))}
          {space.lists.map((l) => (
            <ListNode key={l.id} list={l} active={currentListId === l.id} onSelect={() => onSelectList(l.id)} onDelete={() => onDelete("list", space.id, null, l.id)} />
          ))}
          <div className="px-2 py-1">
            <InlineAdd onSubmit={onAddFolder} placeholder="Folder name" label=" Folder" />
          </div>
        </div>
      )}
    </div>
  );
}

function FolderNode({ space, folder, expanded, setExpanded, currentListId, onSelectList, onAddList, onDelete }) {
  const key = `f_${folder.id}`;
  const open = expanded[key] ?? true;
  return (
    <div className="mt-0.5">
      <div className="group flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100">
        <button onClick={() => setExpanded((e) => ({ ...e, [key]: !open }))}>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        <Folder className="w-3.5 h-3.5 text-slate-400" />
        <span className="truncate flex-1">{folder.name}</span>
        <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <InlineAdd onSubmit={(n) => onAddList(folder.id, n)} placeholder="List name" />
          <button onClick={() => onDelete("folder", space.id, folder.id)} className="text-slate-300 hover:text-rose-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
      {open && (
        <div className="ml-4 border-l border-slate-100 pl-2">
          {folder.lists.map((l) => (
            <ListNode key={l.id} list={l} active={currentListId === l.id} onSelect={() => onSelectList(l.id)} onDelete={() => onDelete("list", space.id, folder.id, l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ListNode({ list, active, onSelect, onDelete }) {
  return (
    <div className={`group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer ${active ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100"}`} onClick={onSelect}>
      <ListIcon className="w-3.5 h-3.5 opacity-70" />
      <span className="truncate flex-1">{list.name}</span>
      <span className="text-[10px] text-slate-400">{list.tasks.length}</span>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------- List (table) view ----------
function ListView({ list, onAddTask, onOpenTask, onSetStatus, onEditStatuses, onEditFields, onEditAutomations, onBulkSetStatus, onBulkSetPriority, onBulkSetAssignee, onBulkAddTag, onBulkDelete, onSaveView, onDeleteView }) {
  const members = useContext(MembersContext);
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState([]); // task ids
  const [bulkTag, setBulkTag] = useState("");
  const doneCount = list.tasks.filter((t) => list.statuses.find((s) => s.id === t.statusId)?.isFinal).length;
  const filteredTasks = applyFilterSort(list.tasks, filters);
  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="p-4">
      {list.isSprint && (
        <div className="mb-3 flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-violet-700">
          <Play className="w-3.5 h-3.5" />
          <span className="font-medium">Sprint</span>
          <span>{fmtDate(list.sprintStart)} → {fmtDate(list.sprintEnd)}</span>
          <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden max-w-xs">
            <div className="h-full bg-violet-500" style={{ width: `${list.tasks.length ? (doneCount / list.tasks.length) * 100 : 0}%` }} />
          </div>
          <span>{doneCount}/{list.tasks.length} done</span>
        </div>
      )}
      <div className="flex justify-between items-center gap-3 mb-2 flex-wrap">
        <FilterSortBar tasks={list.tasks} filters={filters} setFilters={setFilters} savedViews={list.savedViews} onSaveView={onSaveView} onDeleteView={onDeleteView} />
        <div className="flex gap-3">
          <button onClick={onEditAutomations} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
            <Zap className="w-3.5 h-3.5" /> Automations
          </button>
          <button onClick={onEditFields} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Custom fields
          </button>
          <button onClick={onEditStatuses} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
            <Settings2 className="w-3.5 h-3.5" /> Edit statuses
          </button>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex items-center gap-2 mb-3 bg-indigo-600 text-white rounded-lg px-3 py-2 text-xs flex-wrap">
          <span className="font-medium">{selected.length} selected</span>
          <select onChange={(e) => { if (e.target.value) { onBulkSetStatus(selected, e.target.value); e.target.value = ""; } }} className="bg-indigo-500 border border-indigo-400 rounded px-1.5 py-1 text-white">
            <option value="">Set status…</option>
            {list.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) { onBulkSetPriority(selected, e.target.value); e.target.value = ""; } }} className="bg-indigo-500 border border-indigo-400 rounded px-1.5 py-1 text-white">
            <option value="">Set priority…</option>
            {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) { onBulkSetAssignee(selected, e.target.value === "unassign" ? null : e.target.value); e.target.value = ""; } }} className="bg-indigo-500 border border-indigo-400 rounded px-1.5 py-1 text-white">
            <option value="">Set assignee…</option>
            <option value="unassign">Unassign</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input
            value={bulkTag} onChange={(e) => setBulkTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && bulkTag.trim()) { onBulkAddTag(selected, bulkTag); setBulkTag(""); } }}
            placeholder="+ tag, Enter" className="bg-indigo-500 border border-indigo-400 rounded px-1.5 py-1 w-24 placeholder:text-indigo-200"
          />
          <button onClick={() => { onBulkDelete(selected); setSelected([]); }} className="flex items-center gap-1 bg-rose-500 hover:bg-rose-400 rounded px-2 py-1"><Trash2 className="w-3 h-3" /> Delete</button>
          <button onClick={() => setSelected([])} className="ml-auto text-indigo-200 hover:text-white">Clear selection</button>
        </div>
      )}
      {list.statuses.map((status) => {
        const tasks = filteredTasks.filter((t) => t.statusId === status.id);
        return (
          <div key={status.id} className="mb-4 bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className={`w-2 h-2 rounded-full ${COLOR_DOT[status.color]}`} />
              <span className="font-semibold text-xs uppercase tracking-wide text-slate-600">{status.name}</span>
              <span className="text-xs text-slate-400">{tasks.length}</span>
            </div>
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} statuses={list.statuses} allTasks={list.tasks} onOpen={() => onOpenTask(t.id)} onSetStatus={(sid) => onSetStatus(t.id, sid)} selected={selected.includes(t.id)} onToggleSelect={() => toggleSelect(t.id)} />
            ))}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
              <Plus className="w-3.5 h-3.5 text-slate-300" />
              <input
                value={draft[status.id] || ""}
                onChange={(e) => setDraft((d) => ({ ...d, [status.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onAddTask(status.id, draft[status.id] || ""); setDraft((d) => ({ ...d, [status.id]: "" })); }
                }}
                placeholder="Add task"
                className="flex-1 text-xs outline-none placeholder:text-slate-300"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskRow({ task, statuses, allTasks, onOpen, onSetStatus, selected, onToggleSelect }) {
  const [menu, setMenu] = useState(false);
  const status = statuses.find((s) => s.id === task.statusId);
  const overdue = isOverdue(task.dueDate, !!status?.isFinal);
  const dueSoon = !overdue && isDueSoon(task.dueDate, !!status?.isFinal);
  const doneCount = task.subtasks.filter((s) => s.done).length;
  const activeBlockers = (task.blockedBy || []).filter((bid) => {
    const b = allTasks?.find((x) => x.id === bid);
    const bs = b && statuses.find((s) => s.id === b.statusId);
    return b && !bs?.isFinal;
  });
  return (
    <div className={`flex items-center gap-3 px-3 py-2 border-t border-slate-100 hover:bg-slate-50 group ${selected ? "bg-indigo-50/60" : ""}`}>
      <button onClick={onToggleSelect} className="shrink-0">
        {selected ? <CheckCircle2 className="w-4 h-4 text-indigo-600" /> : <Circle className="w-4 h-4 text-slate-200 group-hover:text-slate-300" />}
      </button>
      <PriorityFlag p={task.priority} />
      <button onClick={onOpen} className="flex-1 min-w-0 text-left truncate hover:text-indigo-700">
        {task.name}
      </button>
      {task.recurrence && <span title={`Repeats ${task.recurrence.freq}`}><Zap className="w-3 h-3 text-violet-400" /></span>}
      {activeBlockers.length > 0 && (
        <span title={`Blocked by ${activeBlockers.length} task(s)`} className="flex items-center gap-1 text-[11px] text-amber-600">
          <AlertTriangle className="w-3 h-3" />{activeBlockers.length}
        </span>
      )}
      {task.tags.map((tag) => (
        <span key={tag} className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100">{tag}</span>
      ))}
      {task.checklist?.length > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-slate-400"><SquareIcon className="w-3 h-3" />{task.checklist.filter((c) => c.done).length}/{task.checklist.length}</span>
      )}
      {task.subtasks.length > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-slate-400"><CheckSquare className="w-3 h-3" />{doneCount}/{task.subtasks.length}</span>
      )}
      {task.attachments?.length > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-slate-400"><FileText className="w-3 h-3" />{task.attachments.length}</span>
      )}
      {task.comments.length > 0 && (
        <span className="flex items-center gap-1 text-[11px] text-slate-400"><MessageSquare className="w-3 h-3" />{task.comments.length}</span>
      )}
      {task.dueDate && (
        <span className={`flex items-center gap-1 text-[11px] ${overdue ? "text-rose-600 font-medium" : dueSoon ? "text-amber-600 font-medium" : "text-slate-400"}`} title={dueSoon ? "Due within 24 hours" : undefined}>
          <Calendar className="w-3 h-3" />{fmtDate(task.dueDate)}
        </span>
      )}
      <AvatarGroup ids={task.assigneeIds} />
      <div className="relative">
        <button onClick={() => setMenu((m) => !m)}><StatusPill status={status} /></button>
        {menu && (
          <div className="absolute right-0 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-1 w-40">
            {statuses.map((s) => (
              <button key={s.id} onClick={() => { onSetStatus(s.id); setMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 text-left">
                <span className={`w-1.5 h-1.5 rounded-full ${COLOR_DOT[s.color]}`} />{s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Board view ----------
function BoardView({ list, onAddTask, onOpenTask, onMove, onEditStatuses }) {
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({ assignee: "all", priority: "all", tag: "all", sort: "manual" });
  const dragTaskId = useRef(null);
  const filteredTasks = applyFilterSort(list.tasks, filters);

  return (
    <div className="p-4 h-full">
      <div className="flex justify-between items-center gap-3 mb-2 flex-wrap">
        <FilterSortBar tasks={list.tasks} filters={filters} setFilters={setFilters} />
        <button onClick={onEditStatuses} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
          <Settings2 className="w-3.5 h-3.5" /> Edit statuses
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto h-full pb-4">
        {list.statuses.map((status) => {
          const tasks = filteredTasks.filter((t) => t.statusId === status.id);
          return (
            <div
              key={status.id}
              className="w-72 shrink-0 bg-slate-100/70 rounded-lg flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragTaskId.current) onMove(dragTaskId.current, status.id); }}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span className={`w-2 h-2 rounded-full ${COLOR_DOT[status.color]}`} />
                <span className="font-semibold text-xs uppercase tracking-wide text-slate-600">{status.name}</span>
                <span className="text-xs text-slate-400">{tasks.length}</span>
              </div>
              <div className="flex-1 px-2 space-y-2 overflow-y-auto">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => { dragTaskId.current = t.id; }}
                    onClick={() => onOpenTask(t.id)}
                    className="bg-white rounded-md border border-slate-200 p-2.5 shadow-sm cursor-pointer hover:border-indigo-300"
                  >
                    <div className="flex items-start gap-1.5">
                      <PriorityFlag p={t.priority} />
                      <span className="text-xs font-medium flex-1">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {t.dueDate && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(t.dueDate)}</span>}
                      {t.subtasks.length > 0 && <span className="text-[10px] text-slate-400 flex items-center gap-1"><CheckSquare className="w-3 h-3" />{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>}
                      <div className="flex-1" />
                      <AvatarGroup ids={t.assigneeIds} size="w-5 h-5" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2">
                <input
                  value={draft[status.id] || ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [status.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { onAddTask(status.id, draft[status.id] || ""); setDraft((d) => ({ ...d, [status.id]: "" })); }
                  }}
                  placeholder="+ Add task"
                  className="w-full text-xs px-2 py-1.5 rounded bg-white border border-dashed border-slate-300 outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Task Drawer ----------
// Renders comment text with "@Name" tokens (matched against real member
// names, longest-name-first so "@Jan" doesn't shadow "@Jane") highlighted as
// mention chips. Plain-text-in, JSX-out — no stored rich structure, so a
// mention that's typed before that person is a workspace member just renders
// as plain text (harmless, matches how most lightweight chat/comment mention
// implementations degrade).
// Shared across TaskDrawer's "AI draft"/"AI suggest subtasks" and the
// Automations editor's "AI: describe it" builder. Disabled in the Clydec
// Studio build. The original artifact called api.anthropic.com directly
// from the browser, which only works inside the Claude.ai artifact sandbox
// (Anthropic auto-injects that connection there, with no exposed key). A
// real deployed app needs its own serverless route holding a server-side
// ANTHROPIC_API_KEY — same pattern as api/drive-*.js for Google Drive —
// which hasn't been built yet. Flagged here rather than silently left
// broken; see clydec-portal-history.md for the full note and next-step.
async function callClaude(prompt) {
  throw new Error("AI assist isn't wired up yet in this deployment — it needs a server-side API route (see clydec-portal-history.md).");
}

function renderMentionText(text, members) {
  if (!text) return text;
  const names = [...members].map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
  const parts = [];
  let last = 0, m, key = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<span key={`mention-${key++}`} className="text-indigo-600 font-medium bg-indigo-50 rounded px-1">@{m[1]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function TaskDrawer({ task, statuses, customFields, siblingTasks, onClose, onPatch, onStatusChange, onComment, onToggleBlocker, onSetFieldValue, onDelete, runningTimer, onStartTimer, onStopTimer, onAddManualTime }) {
  const members = useContext(MembersContext);
  const [newSub, setNewSub] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [attachError, setAttachError] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newComment, setNewComment] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null); // string | null — non-null while a "@..." token is being typed in the comment box
  const [depPicker, setDepPicker] = useState(false);
  const [assigneePicker, setAssigneePicker] = useState(false);
  const [openSubtaskId, setOpenSubtaskId] = useState(null);
  const [manualMin, setManualMin] = useState("");
  const [aiLoading, setAiLoading] = useState(null); // 'description' | 'subtasks' | null
  const [aiError, setAiError] = useState("");
  const status = statuses.find((s) => s.id === task.statusId);
  const isTrackingThis = runningTimer && runningTimer.taskId === task.id;
  const totalMinutes = task.timeEntries.reduce((sum, e) => sum + e.minutes, 0);

  async function aiDraftDescription() {
    setAiLoading("description"); setAiError("");
    try {
      const text = await callClaude(`Write a short, practical 2-3 sentence task description for a project management tool. The task is titled "${task.name}". Respond with only the description text, no preamble.`);
      onPatch({ description: text });
    } catch (e) {
      setAiError("Couldn't reach AI assist — try again.");
    } finally {
      setAiLoading(null);
    }
  }

  async function aiSuggestSubtasks() {
    setAiLoading("subtasks"); setAiError("");
    try {
      const text = await callClaude(`Suggest 3-5 short subtask checklist items for the task "${task.name}"${task.description ? ` (context: ${task.description})` : ""}. Respond with ONLY a plain list, one item per line, no numbering, no extra text.`);
      const items = text.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 6);
      if (items.length) onPatch({ subtasks: [...task.subtasks, ...items.map((name) => makeSubtask(name))] });
    } catch (e) {
      setAiError("Couldn't reach AI assist — try again.");
    } finally {
      setAiLoading(null);
    }
  }

  return (
    <div className="w-96 shrink-0 bg-white border-l border-slate-200 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <input
          value={task.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="flex-1 font-semibold text-slate-900 outline-none focus:bg-slate-50 rounded px-1"
        />
        <button onClick={onDelete} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Properties */}
        <div className="grid grid-cols-3 gap-y-2 text-xs items-center">
          <span className="text-slate-400">Status</span>
          <div className="col-span-2 relative">
            <select value={task.statusId} onChange={(e) => onStatusChange(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <span className="text-slate-400">Priority</span>
          <select value={task.priority} onChange={(e) => onPatch({ priority: e.target.value })} className="col-span-2 border border-slate-200 rounded px-2 py-1 text-xs">
            {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <span className="text-slate-400">Assignees</span>
          <div className="col-span-2 relative">
            <button onClick={() => setAssigneePicker((p) => !p)} className="w-full flex items-center gap-1.5 border border-slate-200 rounded px-2 py-1 text-xs text-left">
              <AvatarGroup ids={task.assigneeIds} size="w-5 h-5" />
              <span className="text-slate-500">{task.assigneeIds.length ? `${task.assigneeIds.length} assigned` : "Unassigned"}</span>
            </button>
            {assigneePicker && (
              <div className="absolute left-0 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-1 w-48">
                {members.map((m) => {
                  const checked = task.assigneeIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => onPatch({ assigneeIds: checked ? task.assigneeIds.filter((id) => id !== m.id) : [...task.assigneeIds, m.id] })}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 text-left"
                    >
                      {checked ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> : <Circle className="w-3.5 h-3.5 text-slate-300" />}
                      <Avatar id={m.id} size="w-5 h-5" /> {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="text-slate-400">Start date</span>
          <input
            type="date"
            value={task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : ""}
            onChange={(e) => onPatch({ startDate: e.target.value ? new Date(e.target.value).getTime() : null })}
            className="col-span-2 border border-slate-200 rounded px-2 py-1 text-xs"
          />

          <span className="text-slate-400">Due date</span>
          <input
            type="date"
            value={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
            onChange={(e) => onPatch({ dueDate: e.target.value ? new Date(e.target.value).getTime() : null })}
            className="col-span-2 border border-slate-200 rounded px-2 py-1 text-xs"
          />

          <span className="text-slate-400">Repeats</span>
          <select
            value={task.recurrence?.freq || "none"}
            onChange={(e) => onPatch({ recurrence: e.target.value === "none" ? null : { freq: e.target.value, interval: 1 } })}
            title="When this task is marked done, a new copy is created automatically with the due date moved forward"
            className="col-span-2 border border-slate-200 rounded px-2 py-1 text-xs"
          >
            <option value="none">Doesn't repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          <span className="text-slate-400">Tags</span>
          <div className="col-span-2 flex flex-wrap gap-1 items-center">
            {task.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100 flex items-center gap-1">
                {tag}
                <button onClick={() => onPatch({ tags: task.tags.filter((t) => t !== tag) })}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { onPatch({ tags: [...task.tags, newTag.trim()] }); setNewTag(""); } }}
              placeholder="+ tag"
              className="text-[10px] w-14 outline-none"
            />
          </div>
        </div>

        {/* Custom fields */}
        {customFields && customFields.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">Custom fields</div>
            <div className="grid grid-cols-3 gap-y-2 text-xs items-center">
              {customFields.map((f) => (
                <div key={f.id} className="contents">
                  <span className="text-slate-400 truncate">{f.name}</span>
                  {f.type === "dropdown" ? (
                    <select
                      value={task.customFieldValues?.[f.id] || ""}
                      onChange={(e) => onSetFieldValue(f.id, e.target.value)}
                      className="col-span-2 border border-slate-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      value={task.customFieldValues?.[f.id] || ""}
                      onChange={(e) => onSetFieldValue(f.id, e.target.value)}
                      className="col-span-2 border border-slate-200 rounded px-2 py-1 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Blocked by</div>
          <div className="flex flex-wrap gap-1 mb-1">
            {(task.blockedBy || []).map((bid) => {
              const b = siblingTasks?.find((t) => t.id === bid);
              if (!b) return null;
              return (
                <span key={bid} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1">
                  {b.name}
                  <button onClick={() => onToggleBlocker(bid)}><X className="w-2.5 h-2.5" /></button>
                </span>
              );
            })}
            {(!task.blockedBy || task.blockedBy.length === 0) && <span className="text-[11px] text-slate-400">Nothing blocking this task</span>}
          </div>
          <div className="relative">
            <button onClick={() => setDepPicker((d) => !d)} className="text-[11px] text-indigo-600 hover:text-indigo-800">+ Add dependency</button>
            {depPicker && (
              <div className="absolute left-0 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-1 w-56 max-h-48 overflow-y-auto">
                {siblingTasks?.map((t) => (
                  <button key={t.id} onClick={() => onToggleBlocker(t.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 text-left">
                    {(task.blockedBy || []).includes(t.id) ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> : <Circle className="w-3.5 h-3.5 text-slate-300" />}
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
                {(!siblingTasks || siblingTasks.length === 0) && <div className="px-3 py-1.5 text-xs text-slate-400">No other tasks in this list</div>}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-slate-500">Description</div>
            <button onClick={aiDraftDescription} disabled={aiLoading !== null} className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 disabled:opacity-50">
              {aiLoading === "description" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI draft
            </button>
          </div>
          <textarea
            value={task.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Add a description..."
            rows={4}
            className="w-full text-xs border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none"
          />
          {aiError && <p className="text-[10px] text-rose-500 mt-1">{aiError}</p>}
        </div>

        {/* Time tracking */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time tracked</div>
            <span className="text-[11px] text-slate-400">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {isTrackingThis ? (
              <button onClick={() => onStopTimer()} className="flex items-center gap-1 text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-1 rounded">
                <Pause className="w-3.5 h-3.5" /> Stop timer
              </button>
            ) : (
              <button onClick={onStartTimer} disabled={!!runningTimer} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded disabled:opacity-40">
                <Play className="w-3.5 h-3.5" /> Start timer
              </button>
            )}
            <input
              type="number"
              value={manualMin}
              onChange={(e) => setManualMin(e.target.value)}
              placeholder="+ min"
              className="w-16 text-xs border border-slate-200 rounded px-2 py-1"
            />
            <button
              onClick={() => { if (manualMin) { onAddManualTime(Number(manualMin), "manual entry"); setManualMin(""); } }}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >Log</button>
          </div>
          {task.timeEntries.length > 0 && (
            <div className="space-y-0.5">
              {task.timeEntries.slice().reverse().map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>{Math.floor(e.minutes / 60)}h {e.minutes % 60}m</span>
                  <span className="text-slate-300">·</span>
                  <span>{new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  {e.note && <span className="text-slate-400 truncate">— {e.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist — lighter-weight than Subtasks: just text + a checkbox, no
            assignee/due-date/description of its own. For quick to-do lists
            inside a task, distinct from full Subtask objects below. */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">
            Checklist {task.checklist?.length > 0 && `(${task.checklist.filter((c) => c.done).length}/${task.checklist.length})`}
          </div>
          <div className="space-y-1">
            {(task.checklist || []).map((c) => (
              <div key={c.id} className="flex items-center gap-2 group">
                <button onClick={() => onPatch({ checklist: task.checklist.map((x) => x.id === c.id ? { ...x, done: !x.done } : x) })}>
                  {c.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <SquareIcon className="w-3.5 h-3.5 text-slate-300" />}
                </button>
                <span className={`text-xs flex-1 ${c.done ? "line-through text-slate-400" : ""}`}>{c.text}</span>
                <button onClick={() => onPatch({ checklist: task.checklist.filter((x) => x.id !== c.id) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Plus className="w-3.5 h-3.5 text-slate-300" />
            <input
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newChecklistItem.trim()) { onPatch({ checklist: [...(task.checklist || []), { id: uid("chk"), text: newChecklistItem.trim(), done: false }] }); setNewChecklistItem(""); } }}
              placeholder="Add checklist item"
              className="flex-1 text-xs outline-none placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Attachments — small files only (browser data-URL storage, same
            500KB cap Communication uses for chat attachments, for the same
            reason: comfortably under Firestore's 1MiB document limit once
            other task fields are added). */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">Attachments {task.attachments?.length > 0 && `(${task.attachments.length})`}</div>
          <div className="space-y-1 mb-1">
            {(task.attachments || []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 bg-slate-50/60 rounded px-1.5 py-1 group">
                {a.type?.startsWith("image/") ? (
                  <img src={a.dataUrl} alt={a.name} className="w-6 h-6 rounded object-cover shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <a href={a.dataUrl} download={a.name} className="text-xs flex-1 truncate text-indigo-600 hover:underline">{a.name}</a>
                <span className="text-[10px] text-slate-400">{Math.round((a.size || 0) / 1024)}KB</span>
                <button onClick={() => onPatch({ attachments: task.attachments.filter((x) => x.id !== a.id) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 cursor-pointer w-fit">
            <Plus className="w-3 h-3" /> Attach a file
            <input type="file" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 500 * 1024) { setAttachError("Files over 500KB aren't supported here — link to a file in Storage instead for anything larger."); return; }
              setAttachError("");
              const reader = new FileReader();
              reader.onload = () => {
                onPatch({ attachments: [...(task.attachments || []), { id: uid("att"), name: file.name, type: file.type, size: file.size, dataUrl: reader.result, uploadedAt: Date.now() }] });
              };
              reader.readAsDataURL(file);
            }} />
          </label>
          {attachError && <p className="text-[10px] text-rose-500 mt-1">{attachError}</p>}
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-slate-500">
              Subtasks {task.subtasks.length > 0 && `(${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length})`}
            </div>
            <button onClick={aiSuggestSubtasks} disabled={aiLoading !== null} className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 disabled:opacity-50">
              {aiLoading === "subtasks" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI suggest
            </button>
          </div>
          <div className="space-y-1">
            {task.subtasks.map((s) => {
              const subOverdue = isOverdue(s.dueDate, s.done);
              return (
                <div key={s.id} className="flex items-center gap-2 group bg-slate-50/60 hover:bg-slate-50 rounded px-1.5 py-1">
                  <button onClick={() => onPatch({ subtasks: task.subtasks.map((x) => x.id === s.id ? { ...x, done: !x.done } : x) })}>
                    {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                  </button>
                  <button onClick={() => setOpenSubtaskId(s.id)} className={`text-xs flex-1 text-left truncate ${s.done ? "line-through text-slate-400" : ""}`}>{s.name}</button>
                  {s.assigneeIds?.length > 0 && <AvatarGroup ids={s.assigneeIds} size="w-4 h-4" max={2} />}
                  {s.dueDate && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${subOverdue ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                      <Calendar className="w-2.5 h-2.5" />{fmtDate(s.dueDate)}
                    </span>
                  )}
                  <button onClick={() => setOpenSubtaskId(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-500" title="Open details">
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>
                  <button onClick={() => onPatch({ subtasks: task.subtasks.filter((x) => x.id !== s.id) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Plus className="w-3.5 h-3.5 text-slate-300" />
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newSub.trim()) { onPatch({ subtasks: [...task.subtasks, makeSubtask(newSub.trim())] }); setNewSub(""); } }}
              placeholder="Add subtask"
              className="flex-1 text-xs outline-none placeholder:text-slate-300"
            />
          </div>
        </div>

        {/* Comments */}
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">Comments</div>
          <div className="space-y-2">
            {task.comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar id={c.authorId} size="w-5 h-5" />
                <div className="bg-slate-50 rounded-md px-2 py-1 flex-1">
                  <div className="text-[11px] font-medium text-slate-600">{members.find((m) => m.id === c.authorId)?.name || "You"}</div>
                  <div className="text-xs text-slate-700">{renderMentionText(c.text, members)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="relative flex items-center gap-2 mt-2">
            <input
              value={newComment}
              onChange={(e) => {
                const v = e.target.value;
                setNewComment(v);
                const m = v.slice(0, e.target.selectionStart ?? v.length).match(/@([^\s@]*)$/);
                setMentionQuery(m ? m[1] : null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !mentionQuery && newComment.trim()) { onComment(newComment); setNewComment(""); } if (e.key === "Escape") setMentionQuery(null); }}
              placeholder="Write a comment... (@ to mention someone)"
              className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <button
              onClick={() => { if (newComment.trim()) { onComment(newComment); setNewComment(""); setMentionQuery(null); } }}
              className="text-indigo-600 hover:text-indigo-800"
            ><Send className="w-4 h-4" /></button>
            {mentionQuery !== null && (
              <div className="absolute left-0 bottom-full mb-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-1 w-48 max-h-40 overflow-y-auto">
                {members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setNewComment((v) => v.replace(/@([^\s@]*)$/, `@${m.name} `)); setMentionQuery(null); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 text-left"
                  >
                    <Avatar id={m.id} size="w-5 h-5" /> {m.name}
                  </button>
                ))}
                {members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                  <div className="px-3 py-1.5 text-xs text-slate-400">No matching member</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {openSubtaskId && task.subtasks.find((s) => s.id === openSubtaskId) && (
        <SubtaskModal
          subtask={task.subtasks.find((s) => s.id === openSubtaskId)}
          onClose={() => setOpenSubtaskId(null)}
          onPatch={(patch) => onPatch({ subtasks: task.subtasks.map((x) => x.id === openSubtaskId ? { ...x, ...patch } : x) })}
          onDelete={() => { onPatch({ subtasks: task.subtasks.filter((x) => x.id !== openSubtaskId) }); setOpenSubtaskId(null); }}
        />
      )}
    </div>
  );
}

// ---------- Subtask detail modal ----------
function SubtaskModal({ subtask, onClose, onPatch, onDelete }) {
  const members = useContext(MembersContext);
  const [assigneePicker, setAssigneePicker] = useState(false);
  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[26rem] max-h-[85vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => onPatch({ done: !subtask.done })}>
            {subtask.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-slate-300" />}
          </button>
          <input
            value={subtask.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className={`flex-1 font-semibold text-slate-900 outline-none focus:bg-slate-50 rounded px-1 ${subtask.done ? "line-through text-slate-400" : ""}`}
          />
          <button onClick={onDelete} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-y-2 text-xs items-center mb-3">
          <span className="text-slate-400">Assignees</span>
          <div className="col-span-2 relative">
            <button onClick={() => setAssigneePicker((p) => !p)} className="w-full flex items-center gap-1.5 border border-slate-200 rounded px-2 py-1 text-left">
              <AvatarGroup ids={subtask.assigneeIds} size="w-5 h-5" />
              <span className="text-slate-500">{subtask.assigneeIds?.length ? `${subtask.assigneeIds.length} assigned` : "Unassigned"}</span>
            </button>
            {assigneePicker && (
              <div className="absolute left-0 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-1 w-48">
                {members.map((m) => {
                  const checked = (subtask.assigneeIds || []).includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => onPatch({ assigneeIds: checked ? subtask.assigneeIds.filter((id) => id !== m.id) : [...(subtask.assigneeIds || []), m.id] })}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 text-left"
                    >
                      {checked ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> : <Circle className="w-3.5 h-3.5 text-slate-300" />}
                      <Avatar id={m.id} size="w-5 h-5" /> {m.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="text-slate-400">Start date</span>
          <input
            type="date"
            value={subtask.startDate ? new Date(subtask.startDate).toISOString().slice(0, 10) : ""}
            onChange={(e) => onPatch({ startDate: e.target.value ? new Date(e.target.value).getTime() : null })}
            className="col-span-2 border border-slate-200 rounded px-2 py-1"
          />

          <span className="text-slate-400">Due date</span>
          <input
            type="date"
            value={subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : ""}
            onChange={(e) => onPatch({ dueDate: e.target.value ? new Date(e.target.value).getTime() : null })}
            className="col-span-2 border border-slate-200 rounded px-2 py-1"
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">Description</div>
          <textarea
            value={subtask.description || ""}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Add more detail about this subtask..."
            rows={4}
            className="w-full text-xs border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Status editor ----------
function StatusEditorModal({ list, onClose, onAdd, onRename, onDelete }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("gray");
  const [isFinal, setIsFinal] = useState(false);
  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[26rem] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Statuses — {list.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">Check the box to mark a status as a "complete" state — this drives progress bars, overdue checks, and My Tasks.</p>
        <div className="space-y-2 mb-3">
          {list.statuses.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${COLOR_DOT[s.color]}`} />
              <input
                value={s.name}
                onChange={(e) => onRename(s.id, e.target.value, s.color, s.isFinal)}
                className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 outline-none"
              />
              <select value={s.color} onChange={(e) => onRename(s.id, s.name, e.target.value, s.isFinal)} className="text-xs border border-slate-200 rounded px-1 py-1">
                {Object.keys(COLOR_DOT).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap" title="Marks tasks in this status as complete">
                <input type="checkbox" checked={!!s.isFinal} onChange={(e) => onRename(s.id, s.name, s.color, e.target.checked)} /> Done
              </label>
              <button onClick={() => onDelete(s.id)} disabled={list.statuses.length <= 1} className="text-slate-300 hover:text-rose-500 disabled:opacity-30">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New status name" className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 outline-none" />
          <select value={color} onChange={(e) => setColor(e.target.value)} className="text-xs border border-slate-200 rounded px-1 py-1">
            {Object.keys(COLOR_DOT).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[10px] text-slate-500 whitespace-nowrap">
            <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} /> Done
          </label>
          <button
            onClick={() => { if (name.trim()) { onAdd(name.trim(), color, isFinal); setName(""); setIsFinal(false); } }}
            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
          >Add</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Custom fields editor ----------
function CustomFieldsEditorModal({ list, onClose, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [optionsText, setOptionsText] = useState("");
  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-96 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Custom fields — {list.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-2 mb-3">
          {list.customFields.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <span className="flex-1 text-xs font-medium">{f.name}</span>
              <span className="text-[10px] text-slate-400 uppercase">{f.type}</span>
              <button onClick={() => onDelete(f.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {list.customFields.length === 0 && <p className="text-xs text-slate-400">No custom fields yet.</p>}
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Field name" className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 outline-none" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="text-xs border border-slate-200 rounded px-1 py-1">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </div>
          {type === "dropdown" && (
            <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Options, comma separated" className="w-full text-xs border border-slate-200 rounded px-2 py-1 outline-none" />
          )}
          <button
            onClick={() => {
              if (!name.trim()) return;
              const options = type === "dropdown" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : [];
              onAdd(name.trim(), type, options);
              setName(""); setOptionsText("");
            }}
            className="w-full text-xs bg-indigo-600 text-white px-2 py-1.5 rounded hover:bg-indigo-700"
          >Add field</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Automations editor ----------
function AutomationsEditorModal({ list, allLists, onClose, onAdd, onUpdate, onDelete, onToggle }) {
  const members = useContext(MembersContext);
  const blankForm = { name: "", trigger: { type: "status_changed", statusId: "" }, logic: "AND", conditions: [], actions: [] };
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [showTemplates, setShowTemplates] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  function loadRule(rule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name || "",
      trigger: { ...rule.trigger },
      logic: rule.logic || "AND",
      conditions: (rule.conditions || []).map((c) => ({ ...c })),
      actions: (rule.actions || []).map((a) => ({ ...a })),
    });
  }
  function resetForm() { setEditingId(null); setForm(blankForm); }

  function addCondition() { setForm((f) => ({ ...f, conditions: [...f.conditions, { field: "priority", op: "equals", value: "high" }] })); }
  function updateCondition(i, patch) { setForm((f) => ({ ...f, conditions: f.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })); }
  function removeCondition(i) { setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) })); }

  function addAction() { setForm((f) => ({ ...f, actions: [...f.actions, { type: "set_priority", value: "high" }] })); }
  function updateAction(i, patch) { setForm((f) => ({ ...f, actions: f.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) })); }
  function removeAction(i) { setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) })); }

  function save() {
    if (form.actions.length === 0) return;
    const rule = { name: form.name.trim() || "Untitled rule", trigger: form.trigger, logic: form.logic, conditions: form.conditions, actions: form.actions };
    if (editingId) onUpdate(editingId, rule);
    else onAdd(rule);
    resetForm();
  }

  function useTemplate(tpl) {
    const built = tpl.build(list);
    setForm({ name: tpl.name, trigger: built.trigger, logic: built.logic, conditions: built.conditions, actions: built.actions });
    setEditingId(null);
    setShowTemplates(false);
  }

  // "AI: describe it" — sends the plain-English description to Claude and
  // asks for trigger/conditions/actions back as JSON, matching this rule's
  // own shape, then pre-fills the form below for review (never auto-saved
  // without a look — same "review before it takes effect" spirit as every
  // other automation here). Uses the same (currently disabled) callClaude
  // as TaskDrawer's AI features — see the comment on callClaude above.
  async function aiGenerateRule() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiError("");
    try {
      const triggerKeys = Object.keys(AUTOMATION_TRIGGERS).join(" | ");
      const statusNames = list.statuses.map((s) => `"${s.name}"`).join(", ");
      const text = await callClaude(
        `You configure automation rules for a project-management tool. Given this request: "${aiPrompt.trim()}", ` +
        `respond with ONLY minified JSON, no prose, in exactly this shape: ` +
        `{"name": string, "trigger": {"type": one of [${triggerKeys}]}, "conditions": [{"field": "priority"|"assignee"|"statusId"|"tag", "op": "equals"|"not_equals"|"contains", "value": string}], ` +
        `"actions": [{"type": "set_status"|"set_priority"|"set_assignee"|"add_tag"|"add_comment"|"create_subtask"|"post_chat", "value": string}]}. ` +
        `Available statuses on this list: ${statusNames}. Use a status *name* as the value for a "statusId" condition/action field — it will be matched to the real status.`
      );
      const parsed = JSON.parse(text.trim());
      const resolveStatus = (name) => list.statuses.find((s) => s.name.toLowerCase() === String(name).toLowerCase())?.id || "";
      setForm({
        name: parsed.name || aiPrompt.trim(),
        trigger: { type: parsed.trigger?.type || "task_created", statusId: parsed.trigger?.type === "status_changed" ? resolveStatus(parsed.trigger?.statusId) : "" },
        logic: "AND",
        conditions: (parsed.conditions || []).map((c) => ({ field: c.field, op: c.op || "equals", value: c.field === "statusId" ? resolveStatus(c.value) : c.value })),
        actions: (parsed.actions || []).map((a) => ({ type: a.type, value: a.type === "set_status" ? resolveStatus(a.value) : a.value })),
      });
      setEditingId(null);
      setAiPrompt("");
    } catch (e) {
      setAiError("Couldn't reach AI assist — it needs a server-side API route that isn't wired up in this deployment yet (see clydec-portal-history.md). Build the rule manually below instead.");
    } finally {
      setAiLoading(false);
    }
  }

  const conditionValueInput = (c, i) => {
    if (c.field === "priority") {
      return (
        <select value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      );
    }
    if (c.field === "assignee") {
      return (
        <select value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      );
    }
    if (c.field === "statusId") {
      return (
        <select value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          <option value="">Any</option>
          {list.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    return <input value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="Tag name" className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs" />;
  };

  const actionValueInput = (a, i) => {
    if (a.type === "set_status") {
      return (
        <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          {list.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    if (a.type === "set_priority") {
      return (
        <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      );
    }
    if (a.type === "set_assignee") {
      return (
        <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      );
    }
    if (a.type === "create_linked_task" || a.type === "move_task") {
      return (
        <select value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs">
          <option value="">Choose a list…</option>
          {allLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      );
    }
    const placeholder =
      a.type === "webhook" ? "https://your-endpoint.example.com" :
      a.type === "add_tag" ? "Tag name" :
      a.type === "add_comment" ? "Comment text" :
      a.type === "create_subtask" ? "Subtask name" :
      a.type === "send_mock_email" ? "recipient@example.com" :
      "Message to post";
    return <input value={a.value || ""} onChange={(e) => updateAction(i, { value: e.target.value })} placeholder={placeholder} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs" />;
  };

  // A small non-interactive flow summary (Trigger → Conditions → Actions),
  // shown above the form fields. Explicitly *not* the drag/connect visual
  // node-canvas a full n8n/Make-style builder would have — that's a much
  // larger, separate piece of work (an interactive canvas with draggable,
  // connectable nodes) that wasn't attempted here; this is just a clearer
  // at-a-glance readout of the same rule using the fields below it.
  const flowSummary = (
    <div className="flex items-center gap-1.5 text-[11px] flex-wrap bg-slate-50 border border-slate-100 rounded-md px-2 py-1.5">
      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">{AUTOMATION_TRIGGERS[form.trigger.type]}</span>
      {form.conditions.length > 0 && <><ChevronRight className="w-3 h-3 text-slate-300" /><span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{form.conditions.length} condition{form.conditions.length === 1 ? "" : "s"} ({form.logic})</span></>}
      <ChevronRight className="w-3 h-3 text-slate-300" />
      {form.actions.length === 0 ? <span className="text-slate-400">no actions yet</span> : form.actions.map((a, i) => (
        <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{a.type.replace(/_/g, " ")}</span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[38rem] max-h-[90vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500" /> Automations — {list.name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="space-y-1.5 mb-4">
          {list.automations.length === 0 && <p className="text-xs text-slate-400">No automations yet for this list.</p>}
          {list.automations.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5">
              <button onClick={() => onToggle(rule.id)} className={`w-8 h-[18px] rounded-full relative shrink-0 ${rule.enabled ? "bg-emerald-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${rule.enabled ? "left-4" : "left-0.5"}`} />
              </button>
              <span className="flex-1 text-xs truncate">{rule.name || "Untitled rule"}</span>
              <button onClick={() => loadRule(rule)} className="text-slate-400 hover:text-indigo-600" title="Edit"><Settings2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => onDelete(rule.id)} className="text-slate-300 hover:text-rose-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {/* AI automation builder */}
        <div className="mb-3 bg-violet-50 border border-violet-100 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 mb-1"><Sparkles className="w-3.5 h-3.5" /> AI: describe what you want automated</div>
          <div className="flex items-center gap-2">
            <input
              value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") aiGenerateRule(); }}
              placeholder='e.g. "When priority becomes Urgent, post a chat alert"'
              className="flex-1 border border-violet-200 rounded px-2 py-1 text-xs bg-white"
            />
            <button onClick={aiGenerateRule} disabled={aiLoading || !aiPrompt.trim()} className="flex items-center gap-1 text-xs bg-violet-600 text-white px-2 py-1 rounded disabled:opacity-40">
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate
            </button>
          </div>
          {aiError && <p className="text-[10px] text-rose-600 mt-1">{aiError}</p>}
        </div>

        {/* Templates gallery */}
        <div className="mb-3">
          <button onClick={() => setShowTemplates((s) => !s)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <LayoutGrid className="w-3.5 h-3.5" /> {showTemplates ? "Hide" : "Browse"} automation templates
          </button>
          {showTemplates && (
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {AUTOMATION_TEMPLATES.map((tpl) => (
                <button key={tpl.name} onClick={() => useTemplate(tpl)} className="text-left bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:border-indigo-300 hover:bg-indigo-50/40">
                  <div className="text-xs font-medium text-slate-800">{tpl.name}</div>
                  <div className="text-[11px] text-slate-400">{tpl.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{editingId ? "Edit rule" : "New rule"}</span>
            {editingId && <button onClick={resetForm} className="text-[11px] text-indigo-600 hover:underline">Start a new rule instead</button>}
          </div>
          {flowSummary}
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rule name (e.g. Auto-assign urgent bugs)" className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 w-14 shrink-0">Trigger</span>
            <select value={form.trigger.type} onChange={(e) => setForm((f) => ({ ...f, trigger: { type: e.target.value, statusId: f.trigger.statusId } }))} className="flex-1 border border-slate-200 rounded px-2 py-1">
              {Object.entries(AUTOMATION_TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {form.trigger.type === "status_changed" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 w-14 shrink-0">To status</span>
              <select value={form.trigger.statusId || ""} onChange={(e) => setForm((f) => ({ ...f, trigger: { ...f.trigger, statusId: e.target.value } }))} className="flex-1 border border-slate-200 rounded px-2 py-1">
                <option value="">Any status</option>
                {list.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Conditions</span>
              <select value={form.logic} onChange={(e) => setForm((f) => ({ ...f, logic: e.target.value }))} className="text-[11px] border border-slate-200 rounded px-1 py-0.5">
                <option value="AND">Match ALL</option>
                <option value="OR">Match ANY</option>
              </select>
            </div>
            <div className="space-y-1.5">
              {form.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value, value: "" })} className="border border-slate-200 rounded px-1.5 py-1 text-xs">
                    {Object.entries(CONDITION_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={c.op} onChange={(e) => updateCondition(i, { op: e.target.value })} className="border border-slate-200 rounded px-1.5 py-1 text-xs">
                    <option value="equals">is</option>
                    <option value="not_equals">is not</option>
                    <option value="contains">contains</option>
                  </select>
                  {conditionValueInput(c, i)}
                  <button onClick={() => removeCondition(i)} className="text-slate-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <button onClick={addCondition} className="mt-1.5 text-[11px] text-indigo-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add condition</button>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Actions</span>
            <div className="space-y-1.5 mt-1">
              {form.actions.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select value={a.type} onChange={(e) => updateAction(i, { type: e.target.value, value: "" })} className="border border-slate-200 rounded px-1.5 py-1 text-xs">
                    <option value="set_status">Set status</option>
                    <option value="set_priority">Set priority</option>
                    <option value="set_assignee">Set assignee</option>
                    <option value="add_tag">Add tag</option>
                    <option value="add_comment">Add comment</option>
                    <option value="create_subtask">Create subtask</option>
                    <option value="post_chat">Post chat message</option>
                    <option value="create_linked_task">Create linked task in…</option>
                    <option value="move_task">Move task to…</option>
                    <option value="send_mock_email">Send email (mock)</option>
                    <option value="webhook">Send webhook (POST)</option>
                  </select>
                  {actionValueInput(a, i)}
                  <button onClick={() => removeAction(i)} className="text-slate-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {form.actions.length === 0 && <p className="text-[11px] text-slate-400">No actions yet — add at least one.</p>}
            </div>
            <button onClick={addAction} className="mt-1.5 text-[11px] text-indigo-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add action</button>
          </div>

          <button onClick={save} disabled={form.actions.length === 0} className="w-full bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded hover:bg-indigo-700 text-xs font-medium">
            {editingId ? "Save changes" : "Add automation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Automations hub (workspace-wide view of every rule) ----------
function AutomationsHubView({ allLists, onToggle, onDelete, onEdit, onRunDueCheck, onPickList }) {
  const [pickListId, setPickListId] = useState(allLists[0]?.id || "");
  const allRules = allLists.flatMap((l) => (l.automations || []).map((r) => ({ ...r, listId: l.id, listName: l.name, spaceName: l.spaceName })));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Automations</h1>
        <button onClick={onRunDueCheck} className="flex items-center gap-1.5 text-xs bg-slate-800 text-white px-3 py-1.5 rounded-md hover:bg-slate-900">
          <Clock className="w-3.5 h-3.5" /> Run due-date check
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Rules run automatically when their trigger fires anywhere in the workspace. Due-date rules run when you click "Run due-date check" — think of it as a scheduled poll.</p>

      {allLists.length > 0 && (
        <div className="flex items-center gap-2 mb-4 bg-white border border-slate-200 rounded-md p-2">
          <select value={pickListId} onChange={(e) => setPickListId(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5">
            {allLists.map((l) => <option key={l.id} value={l.id}>{l.spaceName ? `${l.spaceName} / ` : ""}{l.name}</option>)}
          </select>
          <button onClick={() => onPickList(pickListId)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 flex items-center gap-1 shrink-0">
            <Plus className="w-3.5 h-3.5" /> New rule
          </button>
        </div>
      )}

      {allRules.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No automations yet. Pick a list above and create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allRules.map((rule) => (
            <div key={rule.id} className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-slate-800 truncate">{rule.name || "Untitled rule"}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">{rule.spaceName ? `${rule.spaceName} / ` : ""}{rule.listName}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {AUTOMATION_TRIGGERS[rule.trigger.type] || rule.trigger.type} · {(rule.conditions || []).length} condition{(rule.conditions || []).length === 1 ? "" : "s"} · {(rule.actions || []).length} action{(rule.actions || []).length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onToggle(rule.listId, rule.id)} className={`w-9 h-5 rounded-full relative transition-colors ${rule.enabled ? "bg-emerald-500" : "bg-slate-200"}`} title={rule.enabled ? "Enabled" : "Disabled"}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${rule.enabled ? "left-4" : "left-0.5"}`} />
                </button>
                <button onClick={() => onEdit(rule.listId)} className="text-slate-400 hover:text-indigo-600" title="Edit"><Settings2 className="w-4 h-4" /></button>
                <button onClick={() => onDelete(rule.listId, rule.id)} className="text-slate-300 hover:text-rose-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Team hub ----------
function TeamView({ members, everyTask, allLists, spaces, docs, whiteboards, dashboards, forms, goals, onAddMember, onRenameMember, onDeleteMember, onOpen }) {
  const [expandedId, setExpandedId] = useState(null);
  const findStatus = (t) => allLists.find((l) => l.id === t.listId)?.statuses.find((s) => s.id === t.statusId);
  const isDone = (t) => !!findStatus(t)?.isFinal;

  const totalLists = allLists.length;
  const totalAutomations = allLists.reduce((n, l) => n + (l.automations || []).length, 0);

  const stats = [
    { label: "Spaces", value: spaces.length, icon: <Folder className="w-4 h-4 text-indigo-500" /> },
    { label: "Lists", value: totalLists, icon: <ListIcon className="w-4 h-4 text-teal-500" /> },
    { label: "Tasks", value: everyTask.length, icon: <CheckSquare className="w-4 h-4 text-blue-500" /> },
    { label: "Goals", value: goals.length, icon: <Target className="w-4 h-4 text-emerald-500" /> },
    { label: "Docs", value: docs.length, icon: <FileText className="w-4 h-4 text-amber-500" /> },
    { label: "Whiteboards", value: whiteboards.length, icon: <PenTool className="w-4 h-4 text-rose-500" /> },
    { label: "Dashboards", value: dashboards.length, icon: <LayoutDashboard className="w-4 h-4 text-violet-500" /> },
    { label: "Automations", value: totalAutomations, icon: <Zap className="w-4 h-4 text-amber-500" /> },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Team</h1>
        <p className="text-slate-500 text-sm">Align your team and see what everyone's working on, across every part of the workspace.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Workspace at a glance</h2>
        <div className="grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 px-2 py-1.5">
              {s.icon}
              <div>
                <div className="text-base font-semibold text-slate-900 leading-none">{s.value}</div>
                <div className="text-[10px] text-slate-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Members ({members.length})</h2>
          {onAddMember ? (
            <InlineAdd onSubmit={(name) => onAddMember(name)} placeholder="Member name" label=" Add member" />
          ) : (
            <span className="text-[11px] text-slate-400">Managed in People Management</span>
          )}
        </div>
        <div className="space-y-2">
          {members.map((m) => {
            const mine = everyTask.filter((t) => t.assigneeIds.includes(m.id));
            const active = mine.filter((t) => !isDone(t));
            const overdue = active.filter((t) => isOverdue(t.dueDate, false));
            const done = mine.filter(isDone);
            const open = expandedId === m.id;
            return (
              <div key={m.id} className="border border-slate-200 rounded-md overflow-hidden">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Avatar id={m.id} />
                  {onRenameMember ? (
                    <input
                      value={m.name}
                      onChange={(e) => onRenameMember(m.id, e.target.value, m.color)}
                      className="font-medium text-sm text-slate-800 outline-none focus:bg-slate-50 rounded px-1 flex-1 min-w-0"
                    />
                  ) : (
                    <span className="font-medium text-sm text-slate-800 flex-1 min-w-0 truncate">{m.name}</span>
                  )}
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">{active.length} active</span>
                  {overdue.length > 0 && <span className="text-[11px] text-rose-600 whitespace-nowrap">{overdue.length} overdue</span>}
                  <span className="text-[11px] text-emerald-600 whitespace-nowrap">{done.length} done</span>
                  <button onClick={() => setExpandedId(open ? null : m.id)} className="text-slate-400 hover:text-slate-700">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {onDeleteMember && (
                    <button onClick={() => onDeleteMember(m.id)} disabled={members.length <= 1} className="text-slate-300 hover:text-rose-500 disabled:opacity-30" title={members.length <= 1 ? "At least one member is required" : "Remove"}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {open && (
                  <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50">
                    {active.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No active tasks assigned.</p>
                    ) : (
                      <div className="space-y-1">
                        {active.map((t) => {
                          const overdueTask = isOverdue(t.dueDate, false);
                          const s = findStatus(t);
                          return (
                            <button key={t.id} onClick={() => onOpen(t.listId, t.id)} className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white text-left">
                              <PriorityFlag p={t.priority} />
                              <span className="flex-1 truncate text-xs">{t.name}</span>
                              <span className="text-[10px] text-slate-400">{t.listName}</span>
                              {s && <StatusPill status={s} onClick={() => {}} />}
                              {t.dueDate && <span className={`text-[10px] flex items-center gap-1 ${overdueTask ? "text-rose-600 font-medium" : "text-slate-400"}`}><Calendar className="w-3 h-3" />{fmtDate(t.dueDate)}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Home dashboard ----------
function HomeDashboard({ everyTask, allLists, onOpen, onNavigate, spaces, onAddListTemplate, onAddDoc, onAddWhiteboard, onAddDashboard }) {
  const members = useContext(MembersContext);
  const me = members.find((m) => m.id === "m1");
  const findStatus = (t) => allLists.find((l) => l.id === t.listId)?.statuses.find((s) => s.id === t.statusId);
  const isDone = (t) => !!findStatus(t)?.isFinal;

  const total = everyTask.length;
  const done = everyTask.filter(isDone).length;
  const overdue = everyTask.filter((t) => isOverdue(t.dueDate, isDone(t))).length;
  const myTasks = everyTask.filter((t) => t.assigneeIds.includes("m1") && !isDone(t)).sort((a, b) => (a.dueDate || Infinity) - (b.dueDate || Infinity));

  const byColor = {};
  everyTask.forEach((t) => {
    const s = findStatus(t);
    const key = s ? s.name : "Unknown";
    byColor[key] = byColor[key] || { count: 0, color: s?.color || "gray" };
    byColor[key].count += 1;
  });
  const maxCount = Math.max(1, ...Object.values(byColor).map((v) => v.count));

  const templates = [
    { icon: <Play className="w-4 h-4 text-violet-600" />, label: "New Sprint", act: () => spaces[0] && onAddListTemplate(spaces[0].id, "New Sprint", "sprint") },
    { icon: <Building2 className="w-4 h-4 text-teal-600" />, label: "New CRM Pipeline", act: () => spaces[0] && onAddListTemplate(spaces[0].id, "Sales Pipeline", "crm") },
    { icon: <FileText className="w-4 h-4 text-blue-600" />, label: "New Doc", act: () => onAddDoc("Untitled doc") && onNavigate("docs") },
    { icon: <PenTool className="w-4 h-4 text-amber-600" />, label: "New Whiteboard", act: () => { onAddWhiteboard("New whiteboard"); onNavigate("whiteboards"); } },
    { icon: <LayoutDashboard className="w-4 h-4 text-indigo-600" />, label: "New Dashboard", act: () => { onAddDashboard("New dashboard"); onNavigate("dashboards"); } },
    { icon: <ClipboardList className="w-4 h-4 text-rose-600" />, label: "New Form", act: () => onNavigate("forms") },
    { icon: <Target className="w-4 h-4 text-emerald-600" />, label: "New Goal", act: () => onNavigate("goals") },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Good to see you{me ? `, ${me.name}` : ""} 👋</h1>
        <p className="text-slate-500 text-sm">Here's what's happening across your workspace.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Create something new</h2>
        <div className="grid grid-cols-4 gap-2">
          {templates.map((t) => (
            <button key={t.label} onClick={t.act} className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-left text-xs font-medium text-slate-700">
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">{total}</div>
          <div className="text-xs text-slate-500">Total tasks</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-emerald-600">{done}</div>
          <div className="text-xs text-slate-500">Completed</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-rose-600">{overdue}</div>
          <div className="text-xs text-slate-500">Overdue</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Tasks by status</h2>
        <div className="space-y-2">
          {Object.entries(byColor).map(([name, v]) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-24 text-xs text-slate-500 truncate">{name}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${COLOR_DOT[v.color]}`} style={{ width: `${(v.count / maxCount) * 100}%` }} />
              </div>
              <span className="w-6 text-xs text-slate-500 text-right">{v.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">My tasks{me ? ` (${me.name})` : ""}</h2>
        {myTasks.length === 0 && <p className="text-xs text-slate-400">Nothing assigned — nice and clear!</p>}
        <div className="space-y-1">
          {myTasks.slice(0, 8).map((t) => {
            const s = findStatus(t);
            const overdueTask = isOverdue(t.dueDate, isDone(t));
            return (
              <button key={t.id} onClick={() => onOpen(t.listId, t.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-left">
                <PriorityFlag p={t.priority} />
                <span className="flex-1 truncate text-xs">{t.name}</span>
                <span className="text-[10px] text-slate-400">{t.listName}</span>
                {s && <StatusPill status={s} onClick={() => {}} />}
                {t.dueDate && <span className={`text-[10px] flex items-center gap-1 ${overdueTask ? "text-rose-600 font-medium" : "text-slate-400"}`}><Calendar className="w-3 h-3" />{fmtDate(t.dueDate)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Timeline (Gantt-style) view ----------
function TimelineView({ list, onOpenTask }) {
  const day = 24 * 60 * 60 * 1000;
  const tasks = list.tasks;
  const starts = tasks.map((t) => t.startDate || t.createdAt);
  const ends = tasks.map((t) => t.dueDate || (t.startDate || t.createdAt) + day);
  const rangeStart = tasks.length ? Math.min(...starts, Date.now() - 2 * day) : Date.now() - 2 * day;
  const rangeEndRaw = tasks.length ? Math.max(...ends, Date.now() + 7 * day) : Date.now() + 14 * day;
  const rangeEnd = rangeEndRaw + 2 * day;
  const totalSpan = Math.max(rangeEnd - rangeStart, day);
  const totalDays = Math.ceil(totalSpan / day);
  const todayOffset = ((Date.now() - rangeStart) / totalSpan) * 100;

  const monthMarks = [];
  for (let i = 0; i <= totalDays; i += 7) {
    monthMarks.push(new Date(rangeStart + i * day));
  }

  return (
    <div className="p-4">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
          <CalendarRange className="w-8 h-8" />
          <p>No tasks yet — add some in List view to see them on the timeline.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <div className="min-w-[700px]">
            {/* header */}
            <div className="flex border-b border-slate-200 text-[10px] text-slate-400 h-6 relative">
              {monthMarks.map((d, i) => (
                <div key={i} className="absolute top-0 border-l border-slate-100 pl-1" style={{ left: `${((d.getTime() - rangeStart) / totalSpan) * 100}%` }}>
                  {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              ))}
            </div>
            <div className="relative">
              <div className="absolute top-0 bottom-0 border-l-2 border-rose-400 z-10" style={{ left: `${todayOffset}%` }} title="Today" />
              {tasks.map((t) => {
                const s = t.startDate || t.createdAt;
                const e = t.dueDate || s + day;
                const left = ((s - rangeStart) / totalSpan) * 100;
                const width = Math.max(((e - s) / totalSpan) * 100, 1.5);
                const status = list.statuses.find((st) => st.id === t.statusId);
                return (
                  <div key={t.id} className="flex items-center h-9 border-b border-slate-50 px-2 gap-2">
                    <span className="w-32 shrink-0 text-xs truncate">{t.name}</span>
                    <div className="flex-1 relative h-5">
                      <button
                        onClick={() => onOpenTask(t.id)}
                        title={`${t.name}: ${fmtDate(s)} → ${fmtDate(e)}`}
                        className={`absolute h-5 rounded ${COLOR_DOT[status?.color || "gray"]} opacity-80 hover:opacity-100 flex items-center px-1 overflow-hidden`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <span className="text-[9px] text-white truncate">{status?.name}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- My Tasks (Asana-style personal task list) ----------
function MyTasksView({ everyTask, allLists, onOpen, onSetStatus }) {
  const members = useContext(MembersContext);
  const me = members.find((m) => m.id === "m1");
  const [view, setView] = useState("list"); // list | calendar
  const findStatus = (t) => allLists.find((l) => l.id === t.listId)?.statuses.find((s) => s.id === t.statusId);
  const isDone = (t) => !!findStatus(t)?.isFinal;
  const mine = everyTask.filter((t) => t.assigneeIds.includes("m1"));
  const today = new Date().setHours(0, 0, 0, 0);
  const week = today + 7 * 24 * 60 * 60 * 1000;

  const buckets = {
    Overdue: mine.filter((t) => !isDone(t) && t.dueDate && t.dueDate < today),
    Today: mine.filter((t) => !isDone(t) && t.dueDate && t.dueDate >= today && t.dueDate < today + 86400000),
    Upcoming: mine.filter((t) => !isDone(t) && t.dueDate && t.dueDate >= today + 86400000 && t.dueDate < week),
    Later: mine.filter((t) => !isDone(t) && (!t.dueDate || t.dueDate >= week)),
    Completed: mine.filter(isDone),
  };

  return (
    <div className={view === "list" ? "p-6 max-w-3xl mx-auto space-y-6" : ""}>
      <div className={`flex items-center justify-between ${view === "list" ? "" : "px-4 pt-4"}`}>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><ListChecks className="w-5 h-5 text-indigo-600" /> My Tasks</h1>
          <p className="text-slate-500 text-sm">Everything assigned to{me ? ` ${me.name}` : " you"}, across every list.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
          <button onClick={() => setView("list")} className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${view === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
            <Rows className="w-3.5 h-3.5" /> List
          </button>
          <button onClick={() => setView("calendar")} className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 ${view === "calendar" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
        </div>
      </div>
      {view === "calendar" ? (
        <CalendarView everyTask={mine} onOpen={onOpen} />
      ) : (
        <>
          {Object.entries(buckets).map(([label, items]) => (
            items.length === 0 ? null : (
              <div key={label}>
                <h2 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${label === "Overdue" ? "text-rose-600" : "text-slate-500"}`}>{label} ({items.length})</h2>
                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-50">
                  {items.map((t) => {
                    const s = findStatus(t);
                    const doneStatus = allLists.find((l) => l.id === t.listId)?.statuses.find((st) => st.isFinal);
                    const todoStatus = allLists.find((l) => l.id === t.listId)?.statuses[0];
                    return (
                      <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => onSetStatus(t.listId, t.id, isDone(t) ? (todoStatus?.id || t.statusId) : (doneStatus?.id || t.statusId))}
                          title={isDone(t) ? "Mark incomplete" : "Mark complete"}
                        >
                          {isDone(t) ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                        </button>
                        <PriorityFlag p={t.priority} />
                        <button onClick={() => onOpen(t.listId, t.id)} className={`flex-1 text-left text-xs truncate ${isDone(t) ? "line-through text-slate-400" : ""}`}>{t.name}</button>
                        <span className="text-[10px] text-slate-400">{t.listName}</span>
                        {s && <StatusPill status={s} onClick={() => {}} />}
                        {t.dueDate && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(t.dueDate)}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ))}
          {mine.length === 0 && <p className="text-sm text-slate-400">No tasks assigned to you yet.</p>}
        </>
      )}
    </div>
  );
}

// ---------- Inbox / activity feed ----------
function InboxView({ activity, allLists, onOpen }) {
  const iconFor = (type) => {
    if (type === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (type === "comment") return <MessageSquare className="w-4 h-4 text-blue-500" />;
    if (type === "created") return <Plus className="w-4 h-4 text-indigo-500" />;
    return <Bell className="w-4 h-4 text-slate-400" />;
  };
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mb-1"><Bell className="w-5 h-5 text-indigo-600" /> Inbox</h1>
      <p className="text-slate-500 text-sm mb-4">Recent activity across your workspace.</p>
      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-50">
        {activity.map((a) => (
          <button
            key={a.id}
            onClick={() => a.listId && a.taskId && onOpen(a.listId, a.taskId)}
            disabled={!a.taskId}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:hover:bg-transparent"
          >
            {iconFor(a.type)}
            <span className="flex-1 text-xs text-slate-700 truncate">{a.text}</span>
            <span className="text-[10px] text-slate-400 shrink-0">{new Date(a.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Search results ----------
function SearchResultsView({ results, allLists, onOpen }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-sm font-semibold text-slate-500 mb-3">{results.length} result{results.length !== 1 ? "s" : ""}</h2>
      <div className="space-y-1">
        {results.map((t) => {
          const list = allLists.find((l) => l.id === t.listId);
          const status = list?.statuses.find((s) => s.id === t.statusId);
          return (
            <button key={t.id} onClick={() => onOpen(t.listId, t.id)} className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-md hover:border-indigo-300 text-left">
              <PriorityFlag p={t.priority} />
              <span className="flex-1 truncate text-xs">{t.name}</span>
              <span className="text-[10px] text-slate-400">{list?.name}</span>
              {status && <StatusPill status={status} onClick={() => {}} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Calendar ----------
function CalendarView({ everyTask, onOpen }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const tasksOnDay = (d) => everyTask.filter((t) => {
    if (!t.dueDate) return false;
    const dt = new Date(t.dueDate);
    return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === d;
  });
  const todayStr = new Date().toDateString();

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1.5 rounded hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
        <div className="font-semibold text-slate-900 w-40 text-center">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1.5 rounded hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="text-xs text-indigo-600 hover:text-indigo-800 ml-2">Today</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="h-24 bg-transparent" />;
          const isToday = new Date(year, month, d).toDateString() === todayStr;
          const items = tasksOnDay(d);
          return (
            <div key={i} className={`h-24 rounded-md border p-1 overflow-hidden ${isToday ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200 bg-white"}`}>
              <div className={`text-[10px] mb-0.5 ${isToday ? "text-indigo-600 font-semibold" : "text-slate-400"}`}>{d}</div>
              <div className="space-y-0.5 overflow-y-auto max-h-16">
                {items.slice(0, 3).map((t) => (
                  <button key={t.id} onClick={() => onOpen(t.listId, t.id)} className="w-full text-left text-[9px] px-1 py-0.5 rounded bg-violet-50 text-violet-700 truncate block">
                    {t.name}
                  </button>
                ))}
                {items.length > 3 && <div className="text-[9px] text-slate-400">+{items.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Dashboards ----------
const WIDGET_TYPES = [
  { type: "stat-total", label: "Total tasks" },
  { type: "stat-done", label: "Completed tasks" },
  { type: "stat-overdue", label: "Overdue tasks" },
  { type: "status-chart", label: "Tasks by status" },
  { type: "priority-chart", label: "Tasks by priority" },
  { type: "assignee-chart", label: "Tasks by assignee" },
];

function DashboardsView({ dashboards, everyTask, allLists, onAddDashboard, onAddWidget, onRemoveWidget, onDeleteDashboard, onOpen }) {
  const members = useContext(MembersContext);
  const [activeId, setActiveId] = useState(dashboards[0]?.id || null);
  const [adding, setAdding] = useState(false);
  const active = dashboards.find((d) => d.id === activeId) || dashboards[0];
  const findStatus = (t) => allLists.find((l) => l.id === t.listId)?.statuses.find((s) => s.id === t.statusId);
  const isDone = (t) => !!findStatus(t)?.isFinal;

  function renderWidget(w) {
    if (w.type === "stat-total") return <StatCard label="Total tasks" value={everyTask.length} color="text-slate-900" />;
    if (w.type === "stat-done") return <StatCard label="Completed" value={everyTask.filter(isDone).length} color="text-emerald-600" />;
    if (w.type === "stat-overdue") return <StatCard label="Overdue" value={everyTask.filter((t) => isOverdue(t.dueDate, isDone(t))).length} color="text-rose-600" />;
    if (w.type === "status-chart") {
      const counts = {};
      everyTask.forEach((t) => { const s = findStatus(t); const k = s?.name || "Unknown"; counts[k] = counts[k] || { count: 0, color: s?.color || "gray" }; counts[k].count++; });
      return <BarBreakdown title="Tasks by status" data={counts} />;
    }
    if (w.type === "priority-chart") {
      const counts = {};
      everyTask.forEach((t) => { const p = PRIORITIES[t.priority]; const k = p?.label || "None"; counts[k] = counts[k] || { count: 0, color: "gray" }; counts[k].count++; });
      return <BarBreakdown title="Tasks by priority" data={counts} />;
    }
    if (w.type === "assignee-chart") {
      const counts = {};
      everyTask.forEach((t) => {
        const ids = t.assigneeIds.length ? t.assigneeIds : [null];
        ids.forEach((aid) => {
          const m = members.find((mm) => mm.id === aid);
          const k = m?.name || "Unassigned";
          counts[k] = counts[k] || { count: 0, color: "gray" };
          counts[k].count++;
        });
      });
      return <BarBreakdown title="Tasks by assignee" data={counts} />;
    }
    return null;
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        {dashboards.map((d) => (
          <button key={d.id} onClick={() => setActiveId(d.id)} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${active?.id === d.id ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}>
            <LayoutDashboard className="w-3.5 h-3.5" /> {d.name}
          </button>
        ))}
        <InlineAdd onSubmit={(n) => { onAddDashboard(n); }} placeholder="Dashboard name" label=" New" />
      </div>
      {active && (
        <div className="max-w-5xl">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-slate-800">{active.name}</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"><Plus className="w-3.5 h-3.5" /> Add widget</button>
                {adding && (
                  <div className="absolute right-0 mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-1 w-48">
                    {WIDGET_TYPES.map((w) => (
                      <button key={w.type} onClick={() => { onAddWidget(active.id, w.type); setAdding(false); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50">{w.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => onDeleteDashboard(active.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {active.widgets.map((w) => (
              <div key={w.id} className="bg-white rounded-lg border border-slate-200 p-3 relative group">
                <button onClick={() => onRemoveWidget(active.id, w.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
                {renderWidget(w)}
              </div>
            ))}
            {active.widgets.length === 0 && <p className="text-xs text-slate-400 col-span-2">No widgets yet — add one above.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function BarBreakdown({ title, data }) {
  const max = Math.max(1, ...Object.values(data).map((v) => v.count));
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600 mb-2">{title}</div>
      <div className="space-y-1.5">
        {Object.entries(data).map(([name, v]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-20 text-[10px] text-slate-500 truncate">{name}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${COLOR_DOT[v.color] || "bg-slate-400"}`} style={{ width: `${(v.count / max) * 100}%` }} />
            </div>
            <span className="w-5 text-[10px] text-slate-500 text-right">{v.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Goals & OKRs ----------
function GoalsView({ goals, spaces, allLists, goalProgress, onAdd, onUpdateProgress, onDelete, onOpenList }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState(100);
  const [unit, setUnit] = useState("%");
  const [spaceId, setSpaceId] = useState("");
  const [sourceListId, setSourceListId] = useState("");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><Target className="w-5 h-5 text-indigo-600" /> Goals & OKRs</h1>
        <p className="text-slate-500 text-sm">Create goals, break them into measurable targets, and track progress — optionally auto-tracked from a Space's list.</p>
      </div>
      <div className="space-y-3">
        {goals.map((g) => {
          const progress = goalProgress ? goalProgress(g) : { value: g.currentValue, auto: false };
          const pct = Math.min(100, Math.round((progress.value / g.targetValue) * 100));
          const space = spaces?.find((s) => s.id === g.spaceId);
          const sourceList = allLists?.find((l) => l.id === g.sourceListId);
          return (
            <div key={g.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-800">{g.name}</span>
                  {space && <span className={`text-[10px] px-1.5 py-0.5 rounded ${COLOR_BADGE[space.color] || "bg-slate-100 text-slate-600"}`}>{space.name}</span>}
                </div>
                <button onClick={() => onDelete(g.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className={`h-full ${COLOR_DOT[g.color] || "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span>{pct}% complete</span>
                <span>·</span>
                <span>Due {fmtDate(g.dueDate)}</span>
                {progress.auto ? (
                  <button onClick={() => sourceList && onOpenList(sourceList.id)} className="flex items-center gap-1 text-indigo-600 hover:underline">
                    <Link2 className="w-3 h-3" /> Auto-tracked from "{sourceList?.name || "a deleted list"}"
                  </button>
                ) : (
                  <>
                    <div className="flex-1" />
                    <input
                      type="number"
                      value={g.currentValue}
                      onChange={(e) => onUpdateProgress(g.id, e.target.value)}
                      className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs"
                    />
                    <span>/ {g.targetValue}{g.unit}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {goals.length === 0 && <p className="text-xs text-slate-400">No goals yet — set one below.</p>}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500">Set a new goal</div>
        <div className="flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5" />
          <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="w-20 text-xs border border-slate-200 rounded px-2 py-1.5" />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="text-xs border border-slate-200 rounded px-2 py-1.5">
            <option value="%">%</option>
            <option value="tasks">tasks</option>
            <option value="$">$</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5">
            <option value="">No Space</option>
            {(spaces || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={sourceListId} onChange={(e) => setSourceListId(e.target.value)} className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5" title="Optional — track progress automatically from a list's completion %">
            <option value="">Track manually</option>
            {(allLists || []).map((l) => <option key={l.id} value={l.id}>Auto-track: {l.name}</option>)}
          </select>
          <button
            onClick={() => { if (name.trim()) { onAdd(name.trim(), target, unit, spaceId || null, sourceListId || null); setName(""); setSpaceId(""); setSourceListId(""); } }}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 whitespace-nowrap"
          >Set Goal</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Workload ----------
function WorkloadView({ everyTask, allLists }) {
  const members = useContext(MembersContext);
  const CAPACITY = 6;
  const findStatus = (t) => allLists.find((l) => l.id === t.listId)?.statuses.find((s) => s.id === t.statusId);
  const isDone = (t) => !!findStatus(t)?.isFinal;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><Gauge className="w-5 h-5 text-indigo-600" /> Workload</h1>
        <p className="text-slate-500 text-sm">Active (incomplete) tasks per person, against a capacity of {CAPACITY}.</p>
      </div>
      <div className="space-y-3">
        {members.map((m) => {
          const active = everyTask.filter((t) => t.assigneeIds.includes(m.id) && !isDone(t));
          const over = active.length > CAPACITY;
          return (
            <div key={m.id} className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Avatar id={m.id} />
                <span className="text-sm font-medium">{m.name}</span>
                <span className={`ml-auto text-xs font-medium ${over ? "text-rose-600" : "text-slate-500"}`}>{active.length} / {CAPACITY}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${over ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (active.length / CAPACITY) * 100)}%` }} />
              </div>
              {active.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {active.slice(0, 6).map((t) => <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[9rem]">{t.name}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Whiteboards ----------
function WhiteboardsView({ whiteboards, onAddBoard, onAddElement, onUpdateElement, onDeleteElement, onDeleteBoard }) {
  const [activeId, setActiveId] = useState(whiteboards[0]?.id || null);
  const active = whiteboards.find((w) => w.id === activeId) || whiteboards[0];
  const dragRef = useRef(null);

  function onMouseDownEl(e, el) {
    const startX = e.clientX, startY = e.clientY;
    const origX = el.x, origY = el.y;
    dragRef.current = { id: el.id, startX, startY, origX, origY };
    function onMove(ev) {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onUpdateElement(active.id, dragRef.current.id, { x: Math.max(0, dragRef.current.origX + dx), y: Math.max(0, dragRef.current.origY + dy) });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
        {whiteboards.map((w) => (
          <button key={w.id} onClick={() => setActiveId(w.id)} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${active?.id === w.id ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}>
            <PenTool className="w-3.5 h-3.5" /> {w.name}
          </button>
        ))}
        <InlineAdd onSubmit={onAddBoard} placeholder="Board name" label=" New" />
      </div>
      {active && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => onAddElement(active.id, "sticky")} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100"><StickyNote className="w-3.5 h-3.5" /> Sticky</button>
            <button onClick={() => onAddElement(active.id, "rect")} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"><SquareIcon className="w-3.5 h-3.5" /> Shape</button>
            <button onClick={() => onAddElement(active.id, "text")} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"><TypeIcon className="w-3.5 h-3.5" /> Text</button>
            <button onClick={() => onDeleteBoard(active.id)} className="ml-auto text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1 relative bg-slate-50 border border-dashed border-slate-300 rounded-lg overflow-hidden" style={{ minHeight: 420 }}>
            {active.elements.map((el) => (
              <div
                key={el.id}
                onMouseDown={(e) => onMouseDownEl(e, el)}
                style={{ left: el.x, top: el.y, width: el.w, height: el.h, position: "absolute", cursor: "grab" }}
                className={`group ${el.type === "rect" ? `border-2 ${COLOR_BADGE[el.color]?.split(" ")[2] || "border-slate-300"} bg-white/60 rounded` : el.type === "text" ? "" : `${COLOR_BADGE[el.color]} border rounded-md shadow-sm p-2`}`}
              >
                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDeleteElement(active.id, el.id)} className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-white border border-slate-200 rounded-full p-0.5 text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
                <textarea
                  value={el.text}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdateElement(active.id, el.id, { text: e.target.value })}
                  className={`w-full h-full bg-transparent resize-none outline-none text-xs ${el.type === "text" ? "font-semibold text-slate-700" : ""}`}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Docs & Wikis ----------
function DocBlock({ block, onUpdate, onDelete }) {
  if (block.type === "paragraph" || block.type === "bullet") {
    return (
      <div className="flex items-start gap-2 group">
        {block.type === "bullet" && <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />}
        <textarea
          value={block.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={Math.max(1, block.text.split("\n").length)}
          placeholder={block.type === "bullet" ? "List item" : "Write something..."}
          className="flex-1 text-sm outline-none resize-none leading-relaxed bg-transparent"
        />
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 mt-1.5"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="relative group w-fit">
        <img src={block.dataUrl} alt={block.name || "image"} className="max-w-full max-h-96 rounded-lg border border-slate-200" />
        <button onClick={onDelete} className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }
  if (block.type === "video") {
    // Reference-only: an embedded player for a video *link* (YouTube/Vimeo/
    // Loom/a direct .mp4 URL) — not an uploaded video file. Uploaded video
    // files would routinely blow past Firestore's 1MiB document limit even
    // at low resolution/short length, unlike the small image/file
    // attachments above, so linking out is the sound choice here rather
    // than a corner silently cut.
    const isDirectFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(block.url || "");
    return (
      <div className="relative group">
        {isDirectFile ? (
          <video src={block.url} controls className="max-w-full max-h-96 rounded-lg border border-slate-200" />
        ) : (
          <a href={block.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-indigo-600 hover:underline w-fit">
            <Play className="w-3.5 h-3.5" /> {block.url}
          </a>
        )}
        <button onClick={onDelete} className="absolute -top-2 -right-2 bg-white rounded-full p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 border border-slate-200"><X className="w-3 h-3" /></button>
      </div>
    );
  }
  if (block.type === "file") {
    return (
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-fit group">
        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <a href={block.dataUrl} download={block.name} className="text-xs text-indigo-600 hover:underline">{block.name}</a>
        <span className="text-[10px] text-slate-400">{Math.round((block.size || 0) / 1024)}KB</span>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><X className="w-3 h-3" /></button>
      </div>
    );
  }
  return null;
}

function DocsView({ docs, docFolders, spaces, goals, onAdd, onUpdate, onDelete, onAddFolder, onDeleteFolder, onAddBlock, onUpdateBlock, onDeleteBlock }) {
  const [activeId, setActiveId] = useState(docs[0]?.id || null);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const active = docs.find((d) => d.id === activeId) || docs[0];
  const unfiled = docs.filter((d) => !d.folderId);

  function handleFileBlock(file, type) {
    if (file.size > 500 * 1024) { setUploadError("Files over 500KB aren't supported here — link to a file in Storage instead for anything larger."); return; }
    setUploadError("");
    const reader = new FileReader();
    reader.onload = () => onAddBlock(active.id, type, { name: file.name, size: file.size, dataUrl: reader.result });
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-slate-200 p-2 overflow-y-auto">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Docs</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setAddingFolder((s) => !s)} title="New folder" className="text-slate-400 hover:text-slate-700"><Folder className="w-3.5 h-3.5" /></button>
            <button onClick={() => { const id = onAdd("Untitled doc"); setActiveId(id); }} title="New doc" className="text-slate-400 hover:text-slate-700"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        {addingFolder && (
          <div className="flex items-center gap-1 px-1 mb-2">
            <input
              autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) { onAddFolder(newFolderName); setNewFolderName(""); setAddingFolder(false); } if (e.key === "Escape") setAddingFolder(false); }}
              placeholder="Folder name" className="flex-1 text-xs border border-slate-200 rounded px-1.5 py-1"
            />
          </div>
        )}
        {docFolders.map((folder) => (
          <div key={folder.id} className="mb-1">
            <div className="flex items-center gap-1 px-2 py-1 group">
              <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 text-[11px] font-medium text-slate-500 truncate">{folder.name}</span>
              <button onClick={() => onDeleteFolder(folder.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>
            </div>
            {docs.filter((d) => d.folderId === folder.id).map((d) => (
              <button key={d.id} onClick={() => setActiveId(d.id)} className={`w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md text-left text-xs ${active?.id === d.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100"}`}>
                <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{d.name}</span>
              </button>
            ))}
          </div>
        ))}
        {unfiled.map((d) => (
          <button key={d.id} onClick={() => setActiveId(d.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs ${active?.id === d.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100"}`}>
            <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{d.name}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 p-6 max-w-3xl overflow-y-auto">
        {active ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <input value={active.name} onChange={(e) => onUpdate(active.id, { name: e.target.value })} className="text-xl font-semibold text-slate-900 outline-none flex-1" />
              <button onClick={() => onDelete(active.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <select value={active.folderId || ""} onChange={(e) => onUpdate(active.id, { folderId: e.target.value || null })} className="text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-500">
                <option value="">No folder</option>
                {docFolders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select value={active.linkedSpaceId || ""} onChange={(e) => onUpdate(active.id, { linkedSpaceId: e.target.value || null })} className="text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-500">
                <option value="">Not linked to a Space</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>Space: {s.name}</option>)}
              </select>
              <select value={active.linkedGoalId || ""} onChange={(e) => onUpdate(active.id, { linkedGoalId: e.target.value || null })} className="text-[11px] border border-slate-200 rounded px-1.5 py-1 text-slate-500">
                <option value="">Not linked to a Goal</option>
                {goals.map((g) => <option key={g.id} value={g.id}>Goal: {g.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              {active.blocks.length === 0 && <p className="text-sm text-slate-300">Start writing...</p>}
              {active.blocks.map((b) => (
                <DocBlock key={b.id} block={b} onUpdate={(patch) => onUpdateBlock(active.id, b.id, patch)} onDelete={() => onDeleteBlock(active.id, b.id)} />
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex-wrap">
              <button onClick={() => onAddBlock(active.id, "paragraph", "")} className="flex items-center gap-1 hover:text-indigo-600"><TypeIcon className="w-3.5 h-3.5" /> Text</button>
              <button onClick={() => onAddBlock(active.id, "bullet", "")} className="flex items-center gap-1 hover:text-indigo-600"><ListIcon className="w-3.5 h-3.5" /> Bullet</button>
              <label className="flex items-center gap-1 hover:text-indigo-600 cursor-pointer">
                <StickyNote className="w-3.5 h-3.5" /> Image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleFileBlock(f, "image"); }} />
              </label>
              <label className="flex items-center gap-1 hover:text-indigo-600 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> File
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleFileBlock(f, "file"); }} />
              </label>
              {addingVideo ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && videoUrl.trim()) { onAddBlock(active.id, "video", { url: videoUrl.trim() }); setVideoUrl(""); setAddingVideo(false); } if (e.key === "Escape") setAddingVideo(false); }}
                    placeholder="Video URL (YouTube, Loom, .mp4...)" className="border border-slate-200 rounded px-1.5 py-1 text-xs w-56"
                  />
                </div>
              ) : (
                <button onClick={() => setAddingVideo(true)} className="flex items-center gap-1 hover:text-indigo-600"><Play className="w-3.5 h-3.5" /> Video link</button>
              )}
            </div>
            {uploadError && <p className="text-[10px] text-rose-500 mt-1">{uploadError}</p>}
            <div className="text-[10px] text-slate-400 mt-3">Last edited {new Date(active.updatedAt).toLocaleString()}</div>
          </>
        ) : <p className="text-sm text-slate-400">No docs yet.</p>}
      </div>
    </div>
  );
}

// ---------- Forms ----------
function FormsView({ forms, allLists, goals, onAdd, onAddField, onDeleteField, onDelete, onSubmitForm, onSetGoal }) {
  const [activeId, setActiveId] = useState(forms[0]?.id || null);
  const [newName, setNewName] = useState("");
  const [targetList, setTargetList] = useState(allLists[0]?.id || "");
  const [fieldLabel, setFieldLabel] = useState("");
  const [preview, setPreview] = useState(false);
  const [values, setValues] = useState({});
  const [copied, setCopied] = useState(false);
  const active = forms.find((f) => f.id === activeId);

  return (
    <div className="p-4 flex gap-4">
      <div className="w-56 shrink-0 border-r border-slate-200 pr-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Forms</div>
        <div className="space-y-1 mb-3">
          {forms.map((f) => (
            <button key={f.id} onClick={() => { setActiveId(f.id); setPreview(false); setValues({}); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs ${active?.id === f.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100"}`}>
              <ClipboardList className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{f.name}</span>
            </button>
          ))}
          {forms.length === 0 && <p className="text-xs text-slate-400">No forms yet.</p>}
        </div>
        <div className="space-y-1.5 border-t border-slate-100 pt-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Form name" className="w-full text-xs border border-slate-200 rounded px-2 py-1" />
          <select value={targetList} onChange={(e) => setTargetList(e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1">
            {allLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button
            onClick={() => { if (newName.trim() && targetList) { const id = onAdd(newName.trim(), targetList); setActiveId(id); setNewName(""); } }}
            className="w-full text-xs bg-indigo-600 text-white px-2 py-1.5 rounded hover:bg-indigo-700"
          >Create form</button>
        </div>
      </div>
      <div className="flex-1 max-w-lg">
        {!active ? (
          <p className="text-sm text-slate-400">Select or create a form.</p>
        ) : preview ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">{active.name}</h2>
              <button onClick={() => setPreview(false)} className="text-xs text-slate-500 hover:text-indigo-600">Back to builder</button>
            </div>
            <div className="space-y-3">
              {active.fields.map((f) => (
                <div key={f.id}>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea value={values[f.id] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} rows={3} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
                  ) : (
                    <input value={values[f.id] || ""} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5" />
                  )}
                </div>
              ))}
              <button
                onClick={() => { onSubmitForm(active, values); setValues({}); }}
                className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded hover:bg-indigo-700"
              >Submit</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">{active.name}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => setPreview(true)} className="text-xs text-indigo-600 hover:text-indigo-800">Preview / Fill out</button>
                <button onClick={() => onDelete(active.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              {active.fields.map((f) => (
                <div key={f.id} className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5">
                  <span className="flex-1 text-xs">{f.label}</span>
                  <span className="text-[10px] text-slate-400 uppercase">{f.type}</span>
                  <button onClick={() => onDeleteField(active.id, f.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="New field label" className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5" />
              <button onClick={() => { if (fieldLabel.trim()) { onAddField(active.id, fieldLabel.trim(), "text"); setFieldLabel(""); } }} className="text-xs bg-slate-800 text-white px-2 py-1.5 rounded hover:bg-slate-900">Add field</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Submitting this form creates a new task in "{allLists.find((l) => l.id === active.listId)?.name}".</p>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1"><Link2 className="w-3 h-3" /> Shareable link</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={`orbit-workspace/forms/${active.slug}`} className="flex-1 text-[11px] border border-slate-200 rounded px-2 py-1.5 bg-slate-50 text-slate-500 font-mono" />
                  <button
                    onClick={() => { navigator.clipboard?.writeText(`orbit-workspace/forms/${active.slug}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded whitespace-nowrap"
                  >{copied ? "Copied!" : "Copy"}</button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">A stable reference for teammates who already have portal access — not a public, logged-out URL (that would need a separate, unauthenticated submission endpoint).</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1"><Target className="w-3 h-3" /> Contributes to Goal</label>
                <select value={active.linkedGoalId || ""} onChange={(e) => onSetGoal(active.id, e.target.value || null)} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5">
                  <option value="">Not linked</option>
                  {goals.filter((g) => !g.sourceListId).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {active.linkedGoalId && <p className="text-[10px] text-slate-400 mt-1">Each submission adds +1 to that Goal's progress.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Chat ----------
function ChatView({ spaces, messages, onSend }) {
  const members = useContext(MembersContext);
  const [channelId, setChannelId] = useState(spaces[0]?.id || null);
  const [text, setText] = useState("");
  const channel = spaces.find((s) => s.id === channelId);
  const msgs = messages[channelId] || [];

  return (
    <div className="flex h-full">
      <div className="w-52 shrink-0 border-r border-slate-200 p-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2 px-1">Channels</div>
        {spaces.map((s) => (
          <button key={s.id} onClick={() => setChannelId(s.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs ${channelId === s.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-100"}`}>
            <Hash className="w-3.5 h-3.5" /> {s.name}
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.length === 0 && <p className="text-xs text-slate-400">No messages yet in #{channel?.name}. Say hi!</p>}
          {msgs.map((m) => (
            <div key={m.id} className="flex items-start gap-2">
              <Avatar id={m.authorId} />
              <div>
                <div className="text-xs font-medium text-slate-700">{members.find((x) => x.id === m.authorId)?.name || "You"} <span className="text-[10px] text-slate-400 font-normal ml-1">{new Date(m.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div>
                <div className="text-xs text-slate-700 mt-0.5">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-100 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onSend(channelId, text); setText(""); } }}
            placeholder={`Message #${channel?.name || ""}`}
            className="flex-1 text-xs border border-slate-200 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button onClick={() => { if (text.trim()) { onSend(channelId, text); setText(""); } }} className="text-indigo-600 hover:text-indigo-800"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
