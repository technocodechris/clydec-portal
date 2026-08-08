function CalendarPage({ user, users, people, events, createEvent, updateEvent, deleteEvent, notify }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("all"); // "all" | "company" | "my"
  const [showForm, setShowForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
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
      const res = await fetch("/api/createMeet", { headers: { "Authorization": `Bearer ${await auth.currentUser.getIdToken()}` } });
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
          <button className="cly-btn" onClick={prevMonth} style={{ background: "#fff", border: "1px solid " + 'var(--color-line)', color: 'var(--color-text)', padding: "6px 10px", borderRadius: 6 }}><ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /></button>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
            {currentDate.toLocaleString('default', { month: 'long' })} {year}
          </div>
          <button className="cly-btn" onClick={nextMonth} style={{ background: "#fff", border: "1px solid " + 'var(--color-line)', color: 'var(--color-text)', padding: "6px 10px", borderRadius: 6 }}><ChevronRight size={16} /></button>
          <button className="cly-btn" onClick={() => setCurrentDate(new Date())} style={{ background: 'var(--color-cream)', border: "1px solid " + 'var(--color-line)', color: 'var(--color-text)', padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, marginLeft: 10 }}>Today</button>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select className="cly-input" value={viewMode} onChange={e => setViewMode(e.target.value)} style={{ padding: "8px 12px", width: "auto" }}>
            <option value="all">All Events</option>
            <option value="company">Company Events</option>
            <option value="my">My Schedule</option>
          </select>
          <button className="cly-btn" onClick={() => setShowForm(true)} style={{ background: 'var(--color-events)', border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarCheck size={16} /> New Event
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, border: "1px solid " + 'var(--color-line)', overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: 'var(--color-cream)', borderBottom: "1px solid " + 'var(--color-line)', padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 700, color: 'var(--color-text)', letterSpacing: 1, textTransform: "uppercase", opacity: 0.8 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", gap: 1, background: 'var(--color-line)' }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} style={{ background: 'var(--color-cream)' }} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dateNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
            const isToday = today.getDate() === dateNum && today.getMonth() === month && today.getFullYear() === year;
            const dayEvents = filteredEvents.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
            
            return (
              <div 
                key={dateNum} 
                onClick={() => {
                  setDate(dateStr);
                  setShowForm(true);
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)"; }}
                style={{ background: "rgba(255, 255, 255, 0.03)", padding: 8, display: "flex", flexDirection: "column", gap: 4, minHeight: 100, cursor: "pointer", transition: "background-color 0.2s" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: isToday ? 'var(--color-events)' : 'var(--color-text)', opacity: isToday ? 1 : 0.8, alignSelf: "flex-end" }}>
                  {dateNum}
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={(evt) => { evt.stopPropagation(); setSelectedEvent(e); }} style={{ background: e.type === "company" ? 'var(--color-eventsSoft)' : 'var(--color-productsSoft)', borderLeft: `3px solid ${e.type === "company" ? 'var(--color-events)' : 'var(--color-products)'}`, padding: "4px 6px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>
                      <div style={{ fontWeight: 600, color: e.type === "company" ? 'var(--color-eventsText)' : 'var(--color-productsText)', whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.time} {e.title}</div>
                      {e.meetLink && (
                        <a href={e.meetLink} target="_blank" rel="noreferrer" onClick={(evt) => evt.stopPropagation()} style={{ color: 'var(--color-success)', textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 3, fontWeight: 600 }}>
                          <Video size={10} /> Join Meet
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Array.from({ length: (42 - (firstDay + daysInMonth)) % 7 }).map((_, i) => <div key={`empty-end-${i}`} style={{ background: 'var(--color-cream)' }} />)}
        </div>
      </div>

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: 'var(--color-surface)', width: "100%", maxWidth: 500, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
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
                  <button type="submit" disabled={creatingMeet} className="cly-btn" style={{ flex: 1, background: 'var(--color-events)', border: "none", color: "#fff", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                    {creatingMeet ? <Loader2 size={18} className="cly-spin" /> : <CalendarCheck size={18} />}
                    {creatingMeet ? "Generating Meet Link..." : "Create Event & Meet Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {selectedEvent && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: 'var(--color-surface)', width: "100%", maxWidth: 450, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid " + 'var(--color-line)', display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Event Details</div>
              <button onClick={() => setSelectedEvent(null)} className="cly-btn" style={{ background: "none", border: "none", color: 'var(--color-text)', opacity: 0.7 }}><XCircle size={20} /></button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 15, color: 'var(--color-text)' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{selectedEvent.title}</div>
                <div style={{ fontSize: 13, color: 'var(--color-mute)', marginTop: 4 }}>
                  {new Date(selectedEvent.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {selectedEvent.time} ({selectedEvent.duration} mins)
                </div>
              </div>
              
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: 'var(--color-mute)', display: "block" }}>Type</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedEvent.type === "company" ? "Company Wide Meeting" : "Huddle"}</span>
              </div>

              {selectedEvent.description && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: 'var(--color-mute)', display: "block" }}>Description</span>
                  <div style={{ fontSize: 13, background: 'var(--color-cream)', padding: 12, borderRadius: 8, marginTop: 4 }}>{selectedEvent.description}</div>
                </div>
              )}

              {selectedEvent.meetLink ? (
                <div style={{ marginTop: 10 }}>
                  <a 
                    href={selectedEvent.meetLink} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="cly-btn" 
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: 'var(--color-success)', color: "#fff", textDecoration: "none", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}
                  >
                    <Video size={18} /> Join Google Meet
                  </a>
                </div>
              ) : (
                <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: 'var(--color-danger)', padding: 12, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
                  No Google Meet link was generated for this event. Make sure your calendar token is configured.
                </div>
              )}

              {(user.role === "ADMIN" || selectedEvent.organizerId === user.id) && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 15, borderTop: "1px solid " + 'var(--color-line)', paddingTop: 15 }}>
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this event?")) {
                        deleteEvent(selectedEvent.id);
                        setSelectedEvent(null);
                        notify("Event deleted!", "ok");
                      }
                    }} 
                    className="cly-btn" 
                    style={{ background: 'var(--color-danger)', border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}
                  >
                    Delete Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



