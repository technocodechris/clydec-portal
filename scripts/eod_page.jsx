function EodReportsPage({ user, users, reports, createReport, updateReport, deleteReport }) {
  const [tab, setTab] = useState("submit");
  
  // Submit state
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [targetUserId, setTargetUserId] = useState(user.id);
  const [completedToday, setCompletedToday] = useState("");
  const [movedForward, setMovedForward] = useState("");
  const [nextTomorrow, setNextTomorrow] = useState("");
  const [blockers, setBlockers] = useState("");

  // View state
  const [viewType, setViewType] = useState("daily"); // "daily" | "weekly" | "monthly"
  const [selectedUserId, setSelectedUserId] = useState(user.role === "ADMIN" ? "all" : user.id);

  const isAdmin = user.role === "ADMIN";

  async function handleSubmit(e) {
    e.preventDefault();
    await createReport({
      userId: targetUserId,
      date: reportDate,
      completedToday,
      movedForward,
      nextTomorrow,
      blockers,
      createdAt: Date.now()
    });
    setCompletedToday("");
    setMovedForward("");
    setNextTomorrow("");
    setBlockers("");
    setTab("view");
  }

  function getWeekString(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return `Week of ${monday.toISOString().split("T")[0]}`;
  }

  function getMonthString(dateStr) {
    return dateStr.substring(0, 7);
  }

  const visibleReports = reports.filter(r => {
    if (!isAdmin) return r.userId === user.id;
    if (selectedUserId === "all") return true;
    return r.userId === selectedUserId;
  });

  const groupedReports = visibleReports.reduce((acc, r) => {
    let key = r.date;
    if (viewType === "weekly") key = getWeekString(r.date);
    if (viewType === "monthly") key = getMonthString(r.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const sortedKeys = Object.keys(groupedReports).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24, gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>EOD Reports</h2>
        <div style={{ display: "flex", background: 'var(--color-bgDark)', borderRadius: 8, overflow: "hidden" }}>
          {[{ id: "submit", label: "Submit Report" }, { id: "view", label: "View Reports" }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "8px 16px", border: "none", cursor: "pointer",
                background: tab === t.id ? 'var(--color-primary)' : "transparent",
                color: tab === t.id ? 'var(--color-white)' : 'var(--color-mute)',
                fontWeight: tab === t.id ? 600 : 500,
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "submit" && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, background: 'var(--color-surface)', padding: 24, borderRadius: 12, border: `1px solid ${'var(--color-border)'}` }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-mute)' }}>Date</label>
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} required disabled={!isAdmin} style={{ width: "100%", padding: "10px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: "inherit" }} />
            </div>
            {isAdmin && (
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-mute)' }}>Filing for</label>
                <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: "inherit" }}>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-mute)' }}>Completed Today</label>
            <textarea value={completedToday} onChange={e => setCompletedToday(e.target.value)} required rows={4} placeholder="List of what has been done..." style={{ width: "100%", padding: "10px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-mute)' }}>What Moved Forward</label>
            <textarea value={movedForward} onChange={e => setMovedForward(e.target.value)} required rows={3} placeholder="What has been achieved for the day..." style={{ width: "100%", padding: "10px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-mute)' }}>What's Next Tomorrow</label>
            <textarea value={nextTomorrow} onChange={e => setNextTomorrow(e.target.value)} required rows={3} placeholder="Task for tomorrow or continuations..." style={{ width: "100%", padding: "10px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--color-mute)' }}>Blockers / Questions</label>
            <textarea value={blockers} onChange={e => setBlockers(e.target.value)} rows={2} placeholder="Any blockers or questions..." style={{ width: "100%", padding: "10px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button type="submit" style={{ padding: "10px 24px", background: 'var(--color-primary)', color: 'var(--color-white)', border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Submit EOD Report</button>
          </div>
        </form>
      )}

      {tab === "view" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", background: 'var(--color-bgDark)', borderRadius: 6, overflow: "hidden" }}>
              {["daily", "weekly", "monthly"].map(v => (
                <button
                  key={v}
                  onClick={() => setViewType(v)}
                  style={{
                    padding: "6px 12px", border: "none", cursor: "pointer", fontSize: 13, textTransform: "capitalize",
                    background: viewType === v ? 'var(--color-border)' : "transparent",
                    color: viewType === v ? 'var(--color-text)' : 'var(--color-mute)',
                  }}
                >{v}</button>
              ))}
            </div>
            {isAdmin && (
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={{ padding: "6px 12px", background: 'var(--color-bgDark)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 6, color: 'var(--color-text)', fontSize: 13 }}>
                <option value="all">All Employees</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>

          {sortedKeys.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: 'var(--color-mute)', background: 'var(--color-surface)', borderRadius: 12 }}>No reports found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {sortedKeys.map(key => (
                <div key={key}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 600, color: 'var(--color-text)', borderBottom: `1px solid ${'var(--color-border)'}`, paddingBottom: 8 }}>
                    {key}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {groupedReports[key].map(r => {
                      const u = users.find(x => x.id === r.userId);
                      return (
                        <div key={r.id} style={{ background: 'var(--color-surface)', border: `1px solid ${'var(--color-border)'}`, borderRadius: 12, padding: 20 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              {u?.avatar ? (
                                <img src={u.avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: 'var(--color-primary)', display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: 14 }}>
                                  {u?.name?.[0] || "?"}
                                </div>
                              )}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{u?.name || "Unknown"}</div>
                                <div style={{ fontSize: 12, color: 'var(--color-mute)' }}>{new Date(r.createdAt).toLocaleString()}</div>
                              </div>
                            </div>
                            {isAdmin && (
                              <button onClick={() => { if(confirm("Delete report?")) deleteReport(r.id); }} style={{ background: "transparent", border: "none", color: 'var(--color-danger)', cursor: "pointer", fontSize: 13 }}>Delete</button>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                            <div><strong style={{ color: 'var(--color-mute)', display: "block", fontSize: 12, marginBottom: 4 }}>COMPLETED TODAY</strong> <div style={{ whiteSpace: "pre-wrap" }}>{r.completedToday}</div></div>
                            <div><strong style={{ color: 'var(--color-mute)', display: "block", fontSize: 12, marginBottom: 4 }}>WHAT MOVED FORWARD</strong> <div style={{ whiteSpace: "pre-wrap" }}>{r.movedForward}</div></div>
                            <div><strong style={{ color: 'var(--color-mute)', display: "block", fontSize: 12, marginBottom: 4 }}>WHAT'S NEXT TOMORROW</strong> <div style={{ whiteSpace: "pre-wrap" }}>{r.nextTomorrow}</div></div>
                            {r.blockers && <div><strong style={{ color: 'var(--color-mute)', display: "block", fontSize: 12, marginBottom: 4 }}>BLOCKERS / QUESTIONS</strong> <div style={{ whiteSpace: "pre-wrap" }}>{r.blockers}</div></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Root App                                                            */
/* ---------------------------------------------------------------- */
function CommunicationPage({ user, users, people, conversations, activeConversationId, setActiveConversationId, messages, sendMessage, getOrCreateDirectConversation, createGroupConversation, markConversationRead, startCall, activeCall, callConnecting, setCallConnecting, setToast, editMessage, deleteMessage, sendFileMessage, hideConversationForMe, addGroupMembers, removeGroupMember, leaveGroupConversation, setMyPresenceStatus }) {
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [leftTab, setLeftTab] = useState("chats"); // "chats" | "people"
  const [statusOpen, setStatusOpen] = useState(false);
  const [customStatusText, setCustomStatusText] = useState(user.statusText || "");
  const [replyingTo, setReplyingTo] = useState(null); // the message object being replied to
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSelection, setGroupSelection] = useState([]);
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addMemberSelection, setAddMemberSelection] = useState([]);
  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [hoveredId, setHoveredId] = useState(null);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const myLiveUser = users.find(u => u.id === user.id) || user;
  const myPresence = getPresenceDisplay(myLiveUser);
  const contacts = users
    .filter(u => u.id !== user.id && u.role !== "CLIENT")
    .map(u => ({ u, person: personForUser(people, u.id) }))
    .filter(c => !search.trim() || c.u.name.toLowerCase().includes(search.trim().toLowerCase()) || (c.person?.department || "").toLowerCase().includes(search.trim().toLowerCase()));

  const sortedConversations = [...conversations]
    .filter(c => !c.hiddenFor?.[user.id])
    .filter(c => !search.trim() || conversationLabel(c, user).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

  function conversationLabel(c, viewer) {
    if (c.type === "group") return c.name || "Group";
    const otherId = c.participantIds.find(id => id !== viewer.id);
    return c.participantNames?.[otherId] || "Direct message";
  }
  function conversationUnread(c) {
    const lastRead = c.lastReadAt?.[user.id] || 0;
    return (c.lastMessageAt || 0) > lastRead && c.lastMessageBy && c.lastMessageBy !== user.name;
  }

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const otherParticipant = (() => {
    if (!activeConversation || activeConversation.type !== "direct") return null;
    const otherId = activeConversation.participantIds.find(id => id !== user.id);
    return { u: users.find(u => u.id === otherId), p: personForUser(people, otherId), id: otherId };
  })();
  // Legacy groups (created before `createdBy` existed) fall back to
  // allowing any current member to manage it, rather than locking everyone
  // out of a feature that predates the field.
  const canManageGroup = activeConversation?.type === "group" && (!activeConversation.createdBy || activeConversation.createdBy === user.id || user.role === "ADMIN" || user.role === "ADMIN");
  const groupMembers = activeConversation?.type === "group" ? activeConversation.participantIds.map(id => ({ id, u: users.find(u => u.id === id), name: activeConversation.participantNames?.[id] || "?" })) : [];
  const addableContacts = contacts.filter(c => !activeConversation?.participantIds?.includes(c.u.id));

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  useEffect(() => { if (activeConversationId) markConversationRead(activeConversationId); }, [activeConversationId, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMenuOpen(false); setCallPickerOpen(false); setEditingId(null); }, [activeConversationId]);

  async function handleSend() {
    if (!messageText.trim() || !activeConversationId || sending) return;
    setSending(true);
    const text = messageText.trim();
    const reply = replyingTo;
    setMessageText("");
    setReplyingTo(null);
    try { await sendMessage(activeConversationId, text, reply); } finally { setSending(false); }
  }
  async function handleSelectContact(c) {
    await getOrCreateDirectConversation(c.u.id, c.u.name);
  }
  function toggleGroupMember(userId) {
    setGroupSelection(sel => sel.includes(userId) ? sel.filter(id => id !== userId) : [...sel, userId]);
  }
  async function handleCreateGroup() {
    if (!groupName.trim() || groupSelection.length === 0) return;
    const names = {};
    contacts.forEach(c => { if (groupSelection.includes(c.u.id)) names[c.u.id] = c.u.name; });
    await createGroupConversation(groupName.trim(), groupSelection, names);
    setGroupOpen(false); setGroupName(""); setGroupSelection([]);
  }
  function handleFileClick() { fileInputRef.current?.click(); }
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && activeConversationId) sendFileMessage(activeConversationId, file);
  }
  function startEdit(m) { setEditingId(m.id); setEditText(m.text); }
  async function saveEdit(m) {
    if (!editText.trim()) { setEditingId(null); return; }
    await editMessage(activeConversationId, m.id, editText.trim());
    setEditingId(null);
  }
  async function handleDeleteMessage(m) {
    if (!window.confirm("Delete this message?")) return;
    await deleteMessage(activeConversationId, m.id);
  }
  async function handleDeleteChat() {
    if (!window.confirm("Delete this chat from your list? The other participant(s) will keep their copy â€” it'll come back for you if anyone sends a new message.")) return;
    setMenuOpen(false);
    await hideConversationForMe(activeConversationId);
  }
  async function handleLeaveGroup() {
    if (!window.confirm("Leave this group? You'll need to be added back to rejoin.")) return;
    setMenuOpen(false);
    await leaveGroupConversation(activeConversation);
  }
  async function handleAddMembers() {
    if (addMemberSelection.length === 0) return;
    const names = {};
    contacts.forEach(c => { if (addMemberSelection.includes(c.u.id)) names[c.u.id] = c.u.name; });
    await addGroupMembers(activeConversation, addMemberSelection, names);
    setAddMemberSelection([]);
  }

  const inCallWithThisConvo = activeCall && activeCall.conversationId === activeConversationId;

  return (
    <div className="cly-fade-in" style={{ display: "flex", height: "calc(100vh - 130px)", background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 12, overflow: "hidden", margin: 4 }}>
      <div className={`cly-chat-list${activeConversation ? " cly-hide-mobile" : ""}`} style={{ width: 300, flexShrink: 0, borderRight: `1px solid ${'var(--color-line)'}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${'var(--color-line)'}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setStatusOpen(o => !o)} className="cly-btn" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: 'var(--color-cream)', border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, padding: "7px 10px", textAlign: "left" }}>
              <span style={{ position: "relative", flexShrink: 0 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: peopleColorFor(user.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700 }}>{peopleInitials(user.name)}</span>
                <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: myPresence.color, border: "1.5px solid #fff" }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myPresence.label}</span>
              <ChevronDown size={13} style={{ color: 'var(--color-mute)' }} />
            </button>
            {statusOpen && (
              <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 30, padding: 8 }}>
                {[["auto", "Automatic (based on activity)"], ["online", "Online"], ["dnd", "Do Not Disturb"], ["offline", "Appear offline"]].map(([val, label]) => (
                  <button key={val} onClick={() => { setMyPresenceStatus(val); setStatusOpen(false); }} className="cly-btn" style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 8px", background: (myLiveUser.presenceStatus || "auto") === val ? 'var(--color-cream)' : "none", border: "none", borderRadius: 6, fontSize: 12.5 }}>
                    {label}
                  </button>
                ))}
                <div style={{ display: "flex", gap: 6, padding: "6px 8px 2px" }}>
                  <input value={customStatusText} onChange={e => setCustomStatusText(e.target.value)} placeholder="Custom statusÃ¢â‚¬Â¦" style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }} />
                  <button onClick={() => { setMyPresenceStatus("custom", customStatusText); setStatusOpen(false); }} disabled={!customStatusText.trim()} className="cly-btn" style={{ background: 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 6, padding: "0 10px", fontSize: 12, opacity: customStatusText.trim() ? 1 : 0.5 }}>Set</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: 'var(--color-mute)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people or chats" style={{ ...inputStyle, paddingLeft: 30 }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setLeftTab("chats")} className="cly-btn" style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: leftTab === "chats" ? 'var(--color-ink)' : "#fff", color: leftTab === "chats" ? "#fff" : 'var(--color-text)', border: `1px solid ${leftTab === "chats" ? 'var(--color-ink)' : 'var(--color-line)'}` }}>Chats</button>
            <button onClick={() => setLeftTab("people")} className="cly-btn" style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: leftTab === "people" ? 'var(--color-ink)' : "#fff", color: leftTab === "people" ? "#fff" : 'var(--color-text)', border: `1px solid ${leftTab === "people" ? 'var(--color-ink)' : 'var(--color-line)'}` }}>People</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {leftTab === "chats" ? (
            sortedConversations.length === 0 ? (
              <div style={{ padding: "16px 14px", fontSize: 12, color: 'var(--color-mute)' }}>No chats yet â€” start one from the People tab.</div>
            ) : sortedConversations.map(c => {
              const label = conversationLabel(c, user);
              const other = c.type === "direct" ? users.find(u => u.id === c.participantIds.find(id => id !== user.id)) : null;
              const otherPresence = other ? getPresenceDisplay(other) : null;
              const unread = conversationUnread(c);
              return (
                <button key={c.id} onClick={() => setActiveConversationId(c.id)} className="cly-btn" style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: activeConversationId === c.id ? 'var(--color-cream)' : "transparent", border: "none", textAlign: "left",
                }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: peopleColorFor(label), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                      {c.type === "group" ? <UsersRound size={15} /> : peopleInitials(label)}
                    </div>
                    {otherPresence?.dot && <span style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%", background: otherPresence.color, border: "2px solid #fff" }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: unread ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: unread ? 'var(--color-text)' : 'var(--color-mute)', fontWeight: unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.lastMessageText || "No messages yet"}
                    </div>
                  </div>
                  {unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: 'var(--color-products)', flexShrink: 0 }} />}
                </button>
              );
            })
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 4px" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-mute)', letterSpacing: 0.5 }}>PEOPLE</span>
                <button onClick={() => setGroupOpen(true)} className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-products)', fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>+ New group</button>
              </div>
              {contacts.length === 0 && <div style={{ padding: "8px 14px", fontSize: 12, color: 'var(--color-mute)' }}>No one else is linked to a portal account yet.</div>}
              {contacts.map(c => {
                const p = getPresenceDisplay(c.u);
                return (
                  <div key={c.u.id} className="cly-row" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px" }}>
                    <button onClick={() => handleSelectContact(c)} className="cly-btn" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, background: "transparent", border: "none", textAlign: "left" }}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: peopleColorFor(c.u.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                          {peopleInitials(c.u.name)}
                        </div>
                        {p.dot && <span style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, borderRadius: "50%", background: p.color, border: "2px solid #fff" }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-mute)', overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</div>
                      </div>
                    </button>
                    <button
                      disabled={!!activeCall || callConnecting}
                      title={`Video call ${c.u.name}`}
                      onClick={async () => { const cid = await getOrCreateDirectConversation(c.u.id, c.u.name); startCall(c.u.id, c.u.name, cid, "video"); }}
                      className="cly-btn"
                      style={{ background: "none", border: "none", color: 'var(--color-mute)', cursor: "pointer", flexShrink: 0, opacity: (!!activeCall || callConnecting) ? 0.4 : 1 }}
                    >
                      <Video size={15} />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className={`cly-chat-view${!activeConversation ? " cly-hide-mobile" : ""}`} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!activeConversation ? (
          <EmptyState icon={MessageSquare} title="Pick a chat" body="Select someone from People, or an existing chat, to start messaging." />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${'var(--color-line)'}`, position: "relative" }}>
              <button onClick={() => setActiveConversationId(null)} className="cly-mobile-only cly-btn" style={{ background: "none", border: "none", color: 'var(--color-text)', padding: 4, flexShrink: 0 }} aria-label="Back to chats">
                <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
              </button>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: peopleColorFor(conversationLabel(activeConversation, user)), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {activeConversation.type === "group" ? <UsersRound size={15} /> : peopleInitials(conversationLabel(activeConversation, user))}
              </div>
              <div 
                style={{ flex: 1, minWidth: 0, cursor: activeConversation.type === "direct" && otherParticipant?.u ? "pointer" : "default" }}
                onClick={() => {
                  if (activeConversation.type === "direct" && otherParticipant?.u) {
                    setProfileModalUserId(otherParticipant.id);
                  }
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, display: "inline-block" }} className={activeConversation.type === "direct" && otherParticipant?.u ? "cly-hover-underline" : ""}>
                  {conversationLabel(activeConversation, user)}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-mute)' }}>
                  {activeConversation.type === "group" ? `${activeConversation.participantIds.length} members` : (otherParticipant?.u ? getPresenceDisplay(otherParticipant.u).label : "Offline")}
                </div>
              </div>

              {activeConversation.type === "direct" && otherParticipant?.u && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={!!activeCall || callConnecting}
                    onClick={() => startCall(otherParticipant.id, otherParticipant.u.name, activeConversation.id, "audio")}
                    title="Start an audio call"
                    className="cly-btn"
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, opacity: (!!activeCall || callConnecting) ? 0.5 : 1 }}
                  >
                    <Phone size={14} />
                  </button>
                  <button
                    disabled={callConnecting}
                    onClick={async () => {
                      setCallConnecting(true);
                      try {
                        if (!auth.currentUser) throw new Error("Not logged in");
                        const token = await auth.currentUser.getIdToken();
                        const res = await fetch("/api/createMeet", { headers: { "Authorization": "Bearer " + token } });
                        if (!res.ok) throw new Error();
                        const data = await res.json();
                        await sendMessage(activeConversation.id, "Join my Google Meet: " + data.meetLink);
                        window.open(data.meetLink, "_blank");
                      } catch (err) {
                        setToast({ msg: "Failed to generate Meet link", type: "error" });
                      } finally {
                        setCallConnecting(false);
                      }
                    }}
                    title="Start a Google Meet video call"
                    className="cly-btn"
                    style={{ display: "flex", alignItems: "center", gap: 6, background: 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, opacity: callConnecting ? 0.5 : 1 }}
                  >
                    <Video size={14} /> Video call
                  </button>
                </div>
              )}

              {activeConversation.type === "group" && (
                <div style={{ position: "relative", display: "flex", gap: 8 }}>
                  <button onClick={async () => {
                    setCallConnecting(true);
                    try {
                      if (!auth.currentUser) throw new Error("Not logged in");
                      const token = await auth.currentUser.getIdToken();
                      const res = await fetch("/api/createMeet", { headers: { "Authorization": "Bearer " + token } });
                      if (!res.ok) throw new Error();
                      const data = await res.json();
                      await sendMessage(activeConversation.id, "Join Google Meet: " + data.meetLink);
                    } catch (err) {
                      setToast({ msg: "Failed to generate Meet link", type: "error" });
                    } finally {
                      setCallConnecting(false);
                    }
                  }} className="cly-btn" disabled={!!activeCall || callConnecting} style={{ display: "flex", alignItems: "center", gap: 6, background: 'var(--color-media)', color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, opacity: (!!activeCall || callConnecting) ? 0.5 : 1 }}>
                    <Video size={14} /> Group Meet
                  </button>
                  <div style={{ position: "relative" }}>
                  <button
                    disabled={!!activeCall || callConnecting}
                    onClick={() => setCallPickerOpen(o => !o)}
                    title="Start a video call with one member"
                    className="cly-btn"
                    style={{ display: "flex", alignItems: "center", gap: 6, background: inCallWithThisConvo ? 'var(--color-success)' : 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, opacity: (!!activeCall || callConnecting) ? 0.5 : 1 }}
                  >
                    <Video size={14} /> {inCallWithThisConvo ? "In call" : "Video call"}
                  </button>
                  {callPickerOpen && (
                    <div style={{ position: "absolute", top: "110%", right: 0, background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", width: 240, zIndex: 20, overflow: "hidden" }}>
                      <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: 'var(--color-mute)', borderBottom: `1px solid ${'var(--color-line)'}` }}>Call a member â€” video is 1:1 only</div>
                      {groupMembers.filter(m => m.id !== user.id && m.u).map(m => (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px" }}>
                          <span style={{ fontSize: 13 }}>{m.name}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setCallPickerOpen(false); startCall(m.id, m.name, activeConversation.id, "audio"); }} title="Audio call" className="cly-btn" style={{ background: "none", border: `1px solid ${'var(--color-line)'}`, borderRadius: 6, padding: "4px 6px" }}><Phone size={12} /></button>
                            <button onClick={() => { setCallPickerOpen(false); startCall(m.id, m.name, activeConversation.id, "video"); }} title="Video call" className="cly-btn" style={{ background: 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 6, padding: "4px 6px" }}><Video size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>
              )}

              <div style={{ position: "relative" }}>
                <button onClick={() => setMenuOpen(o => !o)} className="cly-btn" title="Chat options" style={{ background: "none", border: "none", color: 'var(--color-mute)', padding: 6, cursor: "pointer" }}>
                  <ChevronDown size={18} />
                </button>
                {menuOpen && (
                  <div style={{ position: "absolute", top: "110%", right: 0, background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", width: 190, zIndex: 20, overflow: "hidden" }}>
                    {activeConversation.type === "group" && (
                      <button onClick={() => { setMenuOpen(false); setMembersOpen(true); }} className="cly-btn" style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13 }}>Manage members</button>
                    )}
                    {activeConversation.type === "group" && (
                      <button onClick={handleLeaveGroup} className="cly-btn" style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, borderTop: `1px solid ${'var(--color-line)'}` }}>Leave group</button>
                    )}
                    {(activeConversation.type === "direct" || canManageGroup) && (
                      <button onClick={handleDeleteChat} className="cly-btn" style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13, color: 'var(--color-danger)', borderTop: `1px solid ${'var(--color-line)'}` }}>Delete chat</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--color-mute)', textAlign: "center", marginTop: 20 }}>No messages yet â€” say hello.</div>}
              {messages.map(m => {
                if (m.type === "call_log") {
                  return (
                    <div key={m.id} style={{ textAlign: "center", fontSize: 11.5, color: 'var(--color-mute)', display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Video size={12} /> {m.text} Ã‚Â· {formatClockTime(m.createdAt)}
                    </div>
                  );
                }
                const mine = m.senderId === user.id;
                const isEditing = editingId === m.id;
                return (
                  <div key={m.id} onMouseEnter={() => setHoveredId(m.id)} onMouseLeave={() => setHoveredId(h => h === m.id ? null : h)}
                    style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                    {!mine && activeConversation.type === "group" && <div style={{ fontSize: 10.5, color: 'var(--color-mute)', marginBottom: 2, marginLeft: 4 }}>{m.senderName}</div>}
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEdit(m); if (e.key === "Escape") setEditingId(null); }} autoFocus style={{ ...inputStyle, width: 220 }} />
                        <button onClick={() => saveEdit(m)} className="cly-btn" style={{ background: 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 11.5 }}>Save</button>
                        <button onClick={() => setEditingId(null)} className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-mute)', fontSize: 11.5 }}>Cancel</button>
                      </div>
                    ) : (
                      // A plain block/inline-block sized by the normal CSS box
                      // model (content size, capped at maxWidth) â€” not a flex
                      // item, so there's no flex-shrink math that can collapse
                      // it. The hover action icons are absolutely positioned
                      // beside it, entirely outside normal flow, so they can
                      // never influence its width either (this is what broke
                      // before: they were flex siblings in a row, and the
                      // flex-shrink algorithm + word-break:break-word's "can
                      // split anywhere" let the browser shrink the bubble
                      // down to a couple characters wide).
                      <div style={{ position: "relative", display: "inline-block", maxWidth: "min(420px, 70%)" }}>
                        {m.type === "file" ? (
                          (m.fileType || "").startsWith("image/") ? (
                            <a href={m.fileData} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                              <img src={m.fileData} alt={m.fileName} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, display: "block" }} />
                            </a>
                          ) : (
                            <a href={m.fileData} download={m.fileName} style={{ display: "flex", alignItems: "center", gap: 8, background: 'var(--color-cream)', borderRadius: 14, padding: "9px 13px", fontSize: 13, color: 'var(--color-text)', textDecoration: "none" }}>
                              <FileIcon size={16} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fileName}</span>
                              <span style={{ color: 'var(--color-mute)', fontSize: 11 }}>{Math.round((m.fileSize || 0) / 1000)}KB</span>
                            </a>
                          )
                        ) : (
                          <div style={{ background: mine ? 'var(--color-ink)' : 'var(--color-cream)', color: mine ? "#fff" : 'var(--color-text)', borderRadius: 14, padding: "9px 13px", fontSize: 13.5 }}>
                            {m.replyTo && (
                              <div style={{ borderLeft: `2px solid ${mine ? "rgba(255,255,255,0.4)" : 'var(--color-line)'}`, paddingLeft: 8, marginBottom: 5, opacity: 0.8 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700 }}>{m.replyTo.senderName}</div>
                                <div style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.replyTo.text}</div>
                              </div>
                            )}
                            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                          </div>
                        )}
                        {hoveredId === m.id && (
                          <div style={{
                            position: "absolute", top: "50%", transform: "translateY(-50%)",
                            ...(mine ? { right: "100%", marginRight: 6 } : { left: "100%", marginLeft: 6 }),
                            display: "flex", gap: 2, background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, padding: 3,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.12)", whiteSpace: "nowrap", zIndex: 5,
                          }}>
                            <button onClick={() => setReplyingTo(m)} title="Reply" className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-mute)', cursor: "pointer", padding: 3 }}><MessageSquare size={12} /></button>
                            {mine && (
                              <>
                                {m.type !== "file" && <button onClick={() => startEdit(m)} title="Edit" className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-mute)', cursor: "pointer", padding: 3 }}><Pencil size={12} /></button>}
                                <button onClick={() => handleDeleteMessage(m)} title="Delete" className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-mute)', cursor: "pointer", padding: 3 }}><Trash2 size={12} /></button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--color-mute)', marginTop: 2, marginLeft: mine ? 0 : 4, marginRight: mine ? 4 : 0 }}>
                      {formatClockTime(m.createdAt)}{m.editedAt ? " Ã‚Â· edited" : ""}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {replyingTo && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderTop: `1px solid ${'var(--color-line)'}`, background: 'var(--color-cream)' }}>
                <div style={{ minWidth: 0, borderLeft: `2px solid ${'var(--color-products)'}`, paddingLeft: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>Replying to {replyingTo.senderName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-mute)', overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {replyingTo.type === "file" ? `Ã°Å¸â€œÅ½ ${replyingTo.fileName}` : replyingTo.text}
                  </div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-mute)', cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, padding: 14, borderTop: replyingTo ? "none" : `1px solid ${'var(--color-line)'}`, alignItems: "flex-end" }}>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: "none" }} />
              <button onClick={handleFileClick} title="Attach a file (up to 500KB)" className="cly-btn" style={{ background: "none", border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, width: 40, height: 40, color: 'var(--color-mute)', flexShrink: 0 }}>
                <FileIcon size={16} />
              </button>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Write a messageÃ¢â‚¬Â¦"
                rows={1}
                style={{ ...inputStyle, resize: "none", flex: 1, fontFamily: "inherit" }}
              />
              <button onClick={handleSend} disabled={!messageText.trim() || sending} className="cly-btn" style={{ background: 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", height: 40, opacity: (!messageText.trim() || sending) ? 0.5 : 1 }}>
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {groupOpen && (
        <Modal title="New group chat" onClose={() => setGroupOpen(false)} width={400}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Group name">
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Creative Team" style={inputStyle} />
            </Field>
            <Field label="Members">
              <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, padding: 8 }}>
                {contacts.map(c => (
                  <label key={c.u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 4px" }}>
                    <input type="checkbox" checked={groupSelection.includes(c.u.id)} onChange={() => toggleGroupMember(c.u.id)} />
                    {c.u.name} <span style={{ color: 'var(--color-mute)', fontSize: 11.5 }}>Ã‚Â· {c.person ? c.person.department : ROLE_META[c.u.role]?.label}</span>
                  </label>
                ))}
              </div>
            </Field>
            <button
              disabled={!groupName.trim() || groupSelection.length === 0}
              onClick={handleCreateGroup}
              className="cly-btn"
              style={{ background: 'var(--color-ink)', color: "#fff", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: 700, opacity: (!groupName.trim() || groupSelection.length === 0) ? 0.5 : 1 }}
            >
              Create group
            </button>
          </div>
        </Modal>
      )}

      {membersOpen && activeConversation && (
        <Modal title={`Manage "${activeConversation.name}" members`} onClose={() => { setMembersOpen(false); setAddMemberSelection([]); }} width={420}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Current members ({groupMembers.length})</div>
              <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto", border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, padding: 8 }}>
                {groupMembers.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, padding: "3px 2px" }}>
                    <span>{m.name}{m.id === user.id ? " (you)" : ""}</span>
                    {canManageGroup && m.id !== user.id && (
                      <button onClick={() => removeGroupMember(activeConversation, m.id)} title="Remove" className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-danger)', cursor: "pointer" }}><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Add members</div>
              {addableContacts.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--color-mute)' }}>Everyone's already in this group.</div>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 6, maxHeight: 160, overflowY: "auto", border: `1px solid ${'var(--color-line)'}`, borderRadius: 8, padding: 8 }}>
                    {addableContacts.map(c => (
                      <label key={c.u.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <input type="checkbox" checked={addMemberSelection.includes(c.u.id)} onChange={() => setAddMemberSelection(sel => sel.includes(c.u.id) ? sel.filter(id => id !== c.u.id) : [...sel, c.u.id])} />
                        {c.u.name}
                      </label>
                    ))}
                  </div>
                  <button disabled={addMemberSelection.length === 0} onClick={handleAddMembers} className="cly-btn"
                    style={{ marginTop: 10, background: 'var(--color-ink)', color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", width: "100%", fontSize: 13, fontWeight: 700, opacity: addMemberSelection.length === 0 ? 0.5 : 1 }}>
                    Add selected
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {profileModalUserId && (
        <ProfileDetailsModal
          user={users.find(u => u.id === profileModalUserId)}
          person={people.find(p => p.id === profileModalUserId)}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
    </div>
  );
}

// Global overlay for incoming/active calls â€” mounted once at the app root
// so a call rings (and stays connected) no matter which page you're on.
function CallOverlay({ incomingCall, activeCall, callConnecting, localStream, remoteStream, onAnswer, onDecline, onEnd }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const ringAudioCtxRef = useRef(null);
  const ringIntervalRef = useRef(null);

  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null; }, [localStream]);
  useEffect(() => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null; }, [remoteStream]);

  // Simple two-tone ringtone, synthesized on the fly â€” no audio file to
  // host. Plays on a loop while there's an incoming call not yet answered.
  useEffect(() => {
    function stopRing() {
      if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
      if (ringAudioCtxRef.current) { try { ringAudioCtxRef.current.close(); } catch (e) { /* already closed */ } ringAudioCtxRef.current = null; }
    }
    if (incomingCall && !activeCall) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringAudioCtxRef.current = ctx;
      function playChime() {
        if (ctx.state === "closed") return;
        [880, 660].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = freq;
          osc.type = "sine";
          const start = ctx.currentTime + i * 0.18;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start); osc.stop(start + 0.18);
        });
      }
      playChime();
      ringIntervalRef.current = setInterval(playChime, 1800);
      return stopRing;
    }
    return stopRing;
  }, [incomingCall, activeCall]);

  // Live "how long has this call been going" timer.
  useEffect(() => {
    if (!activeCall) { setElapsed(0); return; }
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (activeCall.startedAt || Date.now())) / 1000)), 1000);
    return () => clearInterval(t);
  }, [activeCall?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatElapsed(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function toggleMute() {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }
  function toggleCamera() {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => { t.enabled = cameraOff; });
    setCameraOff(c => !c);
  }

  if (incomingCall && !activeCall) {
    return (
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#fff", border: `1px solid ${'var(--color-line)'}`, borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,0.18)", padding: 18, width: 300 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: peopleColorFor(incomingCall.callerName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
            {peopleInitials(incomingCall.callerName)}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{incomingCall.callerName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-mute)', display: "flex", alignItems: "center", gap: 4 }}><PhoneIncoming size={12} /> Incoming video callÃ¢â‚¬Â¦</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDecline} className="cly-btn" style={{ flex: 1, background: "#fff", border: `1px solid ${'var(--color-dangerSoft)'}`, color: 'var(--color-danger)', borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700 }}>
            <PhoneOff size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Decline
          </button>
          <button disabled={callConnecting} onClick={onAnswer} className="cly-btn" style={{ flex: 1, background: 'var(--color-success)', color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700 }}>
            <Phone size={14} style={{ verticalAlign: -2, marginRight: 5 }} />{callConnecting ? "JoiningÃ¢â‚¬Â¦" : "Answer"}
          </button>
        </div>
      </div>
    );
  }

  if (activeCall) {
    const otherName = activeCall.role === "caller" ? activeCall.calleeName : activeCall.callerName;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(20,18,16,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "min(900px, 90vw)", height: "min(600px, 70vh)", background: "#111", borderRadius: 16, overflow: "hidden" }}>
          {remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: peopleColorFor(otherName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
                {peopleInitials(otherName)}
              </div>
              <div style={{ fontSize: 14 }}>{activeCall.role === "caller" ? `Calling ${otherName}Ã¢â‚¬Â¦` : "ConnectingÃ¢â‚¬Â¦"}</div>
            </div>
          )}
          <video ref={localVideoRef} autoPlay playsInline muted style={{ position: "absolute", bottom: 16, right: 16, width: 160, height: 110, objectFit: "cover", borderRadius: 10, border: "2px solid rgba(255,255,255,0.3)", transform: "scaleX(-1)" }} />
          <div style={{ position: "absolute", top: 14, left: 18, color: "#fff", fontSize: 13.5, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            {otherName}{remoteStream && <span style={{ fontWeight: 400, marginLeft: 8, opacity: 0.85 }}>{formatElapsed(elapsed)}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
          <button onClick={toggleMute} className="cly-btn" style={{ width: 46, height: 46, borderRadius: "50%", background: muted ? "#fff" : "rgba(255,255,255,0.15)", color: muted ? "#111" : "#fff", border: "none" }}>
            {muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button onClick={toggleCamera} className="cly-btn" style={{ width: 46, height: 46, borderRadius: "50%", background: cameraOff ? "#fff" : "rgba(255,255,255,0.15)", color: cameraOff ? "#111" : "#fff", border: "none" }}>
            {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>
          <button onClick={onEnd} className="cly-btn" style={{ width: 46, height: 46, borderRadius: "50%", background: 'var(--color-danger)', color: "#fff", border: "none" }}>
            <PhoneOff size={18} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

