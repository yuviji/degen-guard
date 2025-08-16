"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<any>();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      try {
        const r = await fetch("/api/cdp/dashboard", {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (r.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          return;
        }
        
        const j = await r.json();
        setData(j);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      }
    };

    fetchData();
    const t = setInterval(fetchData, 6000);
    return () => clearInterval(t);
  }, []);

  if (!data?.ready) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
        <p className="mt-4 text-gray-500">Preparing your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Portfolio — {data.address}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded p-4 bg-white shadow-sm">
          <div className="text-sm text-gray-500">Total (USD)</div>
          <div className="text-2xl font-bold">{data.totalUsd ?? "—"}</div>
        </div>
        <div className="md:col-span-2 border rounded p-4 bg-white shadow-sm">
          <div className="font-semibold mb-2">Tokens</div>
          {data.tokens && data.tokens.length > 0 ? (
            <ul className="space-y-1">
              {data.tokens.map((t: any, i: number) => (
                <li key={i} className="flex justify-between">
                  <span className="font-medium">{t.symbol}</span>
                  <span className="text-gray-600">{t.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No tokens found</p>
          )}
        </div>
      </div>
    </div>
  );
}
