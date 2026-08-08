const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const rsvpBlock = `
              <div style={{ marginTop: 15, background: 'var(--color-cream)', padding: 12, borderRadius: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: 'var(--color-mute)', display: "block", marginBottom: 8 }}>Your RSVP</span>
                <div style={{ display: "flex", gap: 10 }}>
                  {['Going', 'Maybe', 'Not Going'].map(status => {
                    const currentStatus = selectedEvent.rsvps?.[user.id] === status;
                    return (
                      <button 
                        key={status}
                        onClick={() => {
                          const newRsvps = { ...(selectedEvent.rsvps || {}), [user.id]: status };
                          updateEvent(selectedEvent.id, { rsvps: newRsvps });
                          setSelectedEvent({ ...selectedEvent, rsvps: newRsvps });
                          notify('RSVP updated to ' + status, 'ok');
                        }}
                        className="cly-btn" 
                        style={{ flex: 1, background: currentStatus ? 'var(--color-events)' : 'var(--color-line)', color: currentStatus ? '#fff' : 'var(--color-text)', border: "none", padding: "8px", borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                      >
                        {status}
                      </button>
                    )
                  })}
                </div>
              </div>
`;

const icsBlock = `
              <div style={{ marginTop: 10 }}>
                <button 
                  onClick={() => {
                    const formatDate = (dateStr, timeStr) => {
                      const d = new Date(dateStr + 'T' + timeStr);
                      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    };
                    const start = formatDate(selectedEvent.date, selectedEvent.time);
                    const d = new Date(selectedEvent.date + 'T' + selectedEvent.time);
                    d.setMinutes(d.getMinutes() + selectedEvent.duration);
                    const end = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    const icsData = [
                      'BEGIN:VCALENDAR',
                      'VERSION:2.0',
                      'BEGIN:VEVENT',
                      'DTSTART:' + start,
                      'DTEND:' + end,
                      'SUMMARY:' + selectedEvent.title,
                      'DESCRIPTION:' + (selectedEvent.description || '') + '\\n\\nJoin: ' + (selectedEvent.meetLink || ''),
                      'END:VEVENT',
                      'END:VCALENDAR'
                    ].join('\\r\\n');
                    const blob = new Blob([icsData], { type: 'text/calendar' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = selectedEvent.title.replace(/\\s+/g, '_') + '.ics';
                    a.click();
                  }}
                  className="cly-btn"
                  style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, background: 'var(--color-line)', color: 'var(--color-text)', textDecoration: "none", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}
                >
                  <CalendarDays size={18} /> Add to Calendar (.ics)
                </button>
              </div>
`;

app = app.replace(
  '{selectedEvent.meetLink ? (',
  rsvpBlock + '\n\n' + icsBlock + '\n\n              {selectedEvent.meetLink ? ('
);

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx updated with RSVP and ICS support.');
