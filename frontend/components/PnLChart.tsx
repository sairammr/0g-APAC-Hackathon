'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { getSnapshots } from '@/lib/api';

export default function PnLChart({ tokenId }: { tokenId: number | string }) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    getSnapshots(tokenId).then((rows: any[]) => {
      const sorted = [...rows].sort((a, b) => a.ts - b.ts);
      setData(sorted.map(r => ({
        ts: new Date(r.ts * 1000).toLocaleTimeString(),
        pnL: Number(r.realized_pnl || 0) / 1e18,
        sharpe: (r.sharpe_e6 || 0) / 1e6,
      })));
    });
  }, [tokenId]);
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="ts" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="pnL" stroke="#10b981" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
