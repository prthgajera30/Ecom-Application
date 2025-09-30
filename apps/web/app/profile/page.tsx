"use client";
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  useEffect(() => { refresh(); }, [refresh]);
  if (!user) return <p>Please login to view your profile.</p>;
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-3">Profile</h2>
      <div className="text-sm">Email: {user.email}</div>
      <div className="text-sm">Role: {user.role}</div>
    </div>
  );
}
