"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, clearSession } from "@/modules/auth/api";
import { useAuthStore } from "@/store/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  async function handleLogout() {
    await clearSession();
    logout();
    router.push("/login");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    if (!confirm("Change your password?")) return;
    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardTitle className="mb-2">Profile</CardTitle>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{user?.full_name}</p>
        <p className="text-sm text-zinc-500">{user?.email}</p>
      </Card>
      <Card>
        <CardTitle className="mb-4">Change password</CardTitle>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-emerald-600">{pwSuccess}</p>}
          <Button type="submit" disabled={pwLoading}>
            {pwLoading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
      <Card>
        <CardTitle className="mb-4">Session</CardTitle>
        <Button variant="destructive" onClick={handleLogout}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
