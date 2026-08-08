const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const commentBlock = `
                            {/* Comments Section */}
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: \`1px solid var(--color-border)\` }}>
                              <strong style={{ color: 'var(--color-mute)', display: "block", fontSize: 12, marginBottom: 8 }}>COMMENTS</strong>
                              {r.comments && r.comments.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                                  {r.comments.map((c, i) => (
                                    <div key={i} style={{ background: 'var(--color-bgDark)', padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                                      <span style={{ fontWeight: 600, marginRight: 6 }}>{c.authorName}</span>
                                      <span style={{ color: 'var(--color-mute)', fontSize: 11, marginRight: 8 }}>{new Date(c.createdAt).toLocaleString()}</span>
                                      <div style={{ marginTop: 4 }}>{c.text}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: 'var(--color-mute)', marginBottom: 12 }}>No comments yet.</div>
                              )}
                              <div style={{ display: "flex", gap: 8 }}>
                                <input 
                                  type="text" 
                                  placeholder="Add a comment... (Press Enter to post)" 
                                  style={{ flex: 1, padding: "8px 12px", background: 'var(--color-bgDark)', border: \`1px solid var(--color-border)\`, borderRadius: 6, color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                      const newComment = {
                                        text: e.target.value.trim(),
                                        authorId: user.id,
                                        authorName: user.name,
                                        createdAt: Date.now()
                                      };
                                      const updatedComments = [...(r.comments || []), newComment];
                                      updateReport(r.id, { comments: updatedComments });
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </div>
                            </div>
`;

app = app.replace(
  "{r.blockers && <div><strong style={{ color: 'var(--color-mute)', display: \"block\", fontSize: 12, marginBottom: 4 }}>BLOCKERS / QUESTIONS</strong> <div style={{ whiteSpace: \"pre-wrap\" }}>{r.blockers}</div></div>}",
  "{r.blockers && <div><strong style={{ color: 'var(--color-mute)', display: \"block\", fontSize: 12, marginBottom: 4 }}>BLOCKERS / QUESTIONS</strong> <div style={{ whiteSpace: \"pre-wrap\" }}>{r.blockers}</div></div>}\n" + commentBlock
);

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx updated with EOD comments support.');
