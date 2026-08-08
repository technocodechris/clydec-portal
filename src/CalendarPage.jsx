function CalendarPage({ user, users, people, events, createEvent, updateEvent, deleteEvent, notify }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("all"); // "all" | "company" | "my"
  const [showForm, setShowForm] = useState(false);
  
  // form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:MM
  const [duration, setDuration] = useState(60); // minutes
  const [type, setType] = useState("company"); // company | huddle
  const [attendees, setAttendees] = useState([]);
  const [description, setDescription] = useState("");
  const [creatingMeet, setCreatingMeet] = useState(false);

  const filteredEvents = events.filter(e => {
    if (viewMode === "company") return e.type === "company";
    if (viewMode === "my") return e.organizerId === user.id || (e.attendees || []).includes(user.id);
    return true; // all
  });

  const generateMeetLink = async () => {
    try {
      const res = await fetch("/api/createMeet");
      if (!res.ok) throw new Error("Failed to generate link");
      const data = await res.json();
      return data.meetLink;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !date || !time) {
      notify("Please fill required fields", "error");
      return;
    }
    setCreatingMeet(true);
    let meetLink = await generateMeetLink();
    if (!meetLink) {
      notify("Warning: Could not auto-generate Meet link.", "error");
    }
    
    createEvent({
      title,
      date,
      time,
      duration: parseInt(duration, 10),
      type,
      attendees,
      description,
      meetLink: meetLink || "",
      organizerId: user.id,
      createdAt: Date.now()
    });
    
    notify("Event created!", "ok");
    setShowForm(false);
    setCreatingMeet(false);
    setTitle(""); setDate(""); setTime(""); setDuration(60); setType("company"); setAttendees([]); setDescription("");
  };

  // Calendar logic
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = new Date();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="cly-btn" onClick={prevMonth} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "6px 10px", borderRadius: 6 }}><ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /></button>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {currentDate.toLocaleString('default', { month: 'long' })} {year}
          </div>
          <button className="cly-btn" onClick={nextMonth} style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "6px 10px", borderRadius: 6 }}><ChevronRight size={16} /></button>
          <button className="cly-btn" onClick={() => setCurrentDate(new Date())} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, marginLeft: 10 }}>Today</button>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select className="cly-input" value={viewMode} onChange={e => setViewMode(e.target.value)} style={{ padding: "8px 12px", width: "auto" }}>
            <option value="all">All Events</option>
            <option value="company">Company Events</option>
            <option value="my">My Schedule</option>
          </select>
          <button className="cly-btn" onClick={() => setShowForm(true)} style={{ background: COLORS.events, border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarCheck size={16} /> New Event
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "rgba(255,255,255,0.05)", padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", gap: 1, background: "rgba(255,255,255,0.05)" }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} style={{ background: COLORS.bg }} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dateNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
            const isToday = today.getDate() === dateNum && today.getMonth() === month && today.getFullYear() === year;
            const dayEvents = filteredEvents.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
            
            return (
              <div key={dateNum} style={{ background: COLORS.bg, padding: 8, borderTop: "1px solid rgba(255,255,255,0.02)", borderLeft: "1px solid rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 4, minHeight: 100 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? COLORS.events : "#fff", opacity: isToday ? 1 : 0.7, alignSelf: "flex-end" }}>
                  {dateNum}
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayEvents.map(e => (
                    <div key={e.id} style={{ background: e.type === "company" ? "rgba(168, 85, 247, 0.15)" : "rgba(59, 130, 246, 0.15)", borderLeft: `3px solid ${e.type === "company" ? COLORS.events : COLORS.media}`, padding: "4px 6px", borderRadius: 4, fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.time} {e.title}</div>
                      {e.meetLink && (
                        <a href={e.meetLink} target="_blank" rel="noreferrer" style={{ color: COLORS.media, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                          <Video size={10} /> Join
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Array.from({ length: (42 - (firstDay + daysInMonth)) % 7 }).map((_, i) => <div key={`empty-end-${i}`} style={{ background: COLORS.bg }} />)}
        </div>
      </div>

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: COLORS.surface, width: "100%", maxWidth: 500, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Schedule Event</div>
              <button onClick={() => setShowForm(false)} className="cly-btn" style={{ background: "none", border: "none", color: "#fff", opacity: 0.7 }}><XCircle size={20} /></button>
            </div>
            <div style={{ padding: 24, overflowY: "auto" }}>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Title *</div>
                  <input className="cly-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event Title" required />
                </div>
                <div style={{ display: "flex", gap: 15 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Date *</div>
                    <input type="date" className="cly-input" value={date} onChange={e => setDate(e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Time *</div>
                    <input type="time" className="cly-input" value={time} onChange={e => setTime(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Duration (Minutes)</div>
                  <input type="number" className="cly-input" value={duration} onChange={e => setDuration(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Event Type</div>
                  <select className="cly-input" value={type} onChange={e => { setType(e.target.value); if (e.target.value === "company") setAttendees([]); }}>
                    <option value="company">Company Wide (Everyone)</option>
                    <option value="huddle">Huddle / Specific Group</option>
                  </select>
                </div>
                {type === "huddle" && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Attendees (Hold Ctrl/Cmd to select multiple)</div>
                    <select multiple className="cly-input" style={{ height: 120 }} value={attendees} onChange={e => setAttendees(Array.from(e.target.selectedOptions, o => o.value))}>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 5 }}>Description</div>
                  <textarea className="cly-input" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Event details..." />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="submit" disabled={creatingMeet} className="cly-btn" style={{ flex: 1, background: COLORS.events, border: "none", color: "#fff", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                    {creatingMeet ? <Loader2 size={18} className="cly-spin" /> : <CalendarCheck size={18} />}
                    {creatingMeet ? "Generating Meet Link..." : "Create Event & Meet Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
