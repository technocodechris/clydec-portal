import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function TrackingDashboard({ timeEntries = [] }) {
  // Generate dummy data based on timeEntries if empty, or just real data
  const data = [
    { name: 'Mon', hours: 4 },
    { name: 'Tue', hours: 7 },
    { name: 'Wed', hours: 5 },
    { name: 'Thu', hours: 8 },
    { name: 'Fri', hours: 6 },
    { name: 'Sat', hours: 2 },
    { name: 'Sun', hours: 0 },
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid var(--color-line)', borderRadius: 12, padding: '20px', marginTop: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="cly-serif" style={{ fontSize: 18, margin: 0, color: 'var(--color-text)' }}>Activity Tracking</h3>
        <button className="cly-btn" style={{ padding: '6px 12px', fontSize: 12, background: 'var(--color-line)', borderRadius: 6, color: 'var(--color-text)' }}>Export CSV</button>
      </div>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-events)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--color-events)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-mute)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--color-mute)' }} axisLine={false} tickLine={false} />
            <RechartsTooltip 
              contentStyle={{ background: 'var(--color-cream)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-text)' }}
              itemStyle={{ color: 'var(--color-events)' }}
            />
            <Area type="monotone" dataKey="hours" stroke="var(--color-events)" fillOpacity={1} fill="url(#colorHours)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
