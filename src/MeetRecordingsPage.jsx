function MeetRecordingsPage({ user, notify }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/listMeetRecordings");
        if (!res.ok) throw new Error("Failed to fetch recordings");
        const data = await res.json();
        setRecordings(data.files || []);
      } catch (err) {
        console.error(err);
        notify("Could not load meet recordings", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, [notify]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Meet Recordings</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Access recent recordings from Google Drive</div>
        </div>
        <button onClick={() => window.location.reload()} className="cly-btn" style={{ background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", padding: 20, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5, gap: 10 }}>
            <Loader2 className="cly-spin" size={20} /> Loading recordings...
          </div>
        ) : recordings.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
            No recordings found in the Meet Recordings folder.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 15 }}>
            {recordings.map(file => (
              <a key={file.id} href={file.webViewLink} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                <div className="cly-btn" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: 15, transition: "0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(59, 130, 246, 0.15)", color: COLORS.media, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Video size={20} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>{new Date(file.createdTime).toLocaleString()}</div>
                    </div>
                  </div>
                  {file.hasThumbnail && <img src={file.thumbnailLink} alt="Thumbnail" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6 }} />}
                  {!file.hasThumbnail && (
                     <div style={{ width: "100%", height: 140, background: "rgba(255,255,255,0.02)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3 }}>
                       <PlaySquare size={40} />
                     </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
