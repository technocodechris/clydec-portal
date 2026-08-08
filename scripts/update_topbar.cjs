const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

app = app.replace('function Topbar({ user, onLogout, onMenuClick, title, subtitle }) {', 'function Topbar({ user, onLogout, onMenuClick, title, subtitle, theme, setTheme }) {');

app = app.replace('<LogOut size={13} /> Log out\n        </button>', '<LogOut size={13} /> Log out\n        </button>\n        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="cly-btn" style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: "var(--color-text)", background: "transparent" }}>\n          {theme === "light" ? "🌙 Dark" : "☀️ Light"}\n        </button>');

// Replace all usages of Topbar to pass theme
app = app.replace(/<Topbar\s+user=\{user\}\s+onLogout=\{handleLogout\}\s+onMenuClick=\{[a-zA-Z0-9_().>]+\}\s+title=\{[a-zA-Z0-9_". ]+\}\s*(subtitle=\{.*?\})?\s*\/>/g, (match) => match.replace('/>', 'theme={theme} setTheme={setTheme} />'));

fs.writeFileSync('src/App.jsx', app);
console.log('Updated Topbar and App usages.');
