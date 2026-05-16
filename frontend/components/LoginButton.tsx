'use client';
import { usePrivy } from '@privy-io/react-auth';

export function LoginButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  if (!ready) return null;
  if (!authenticated) {
    return <button onClick={login} className="px-3 py-1.5 bg-black text-white rounded">Connect</button>;
  }
  const addr = user?.wallet?.address;
  return (
    <button onClick={logout} className="px-3 py-1.5 border rounded text-sm">
      {addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connected'} · Logout
    </button>
  );
}
