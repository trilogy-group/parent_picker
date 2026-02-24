"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthProvider";
import { SignInPrompt } from "./SignInPrompt";

export function InviteModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { session } = useAuth();

  const [showSignIn, setShowSignIn] = useState(false);

  const handleOpen = () => {
    if (!session) {
      setShowSignIn(true);
      return;
    }
    setOpen(true);
  };

  const handleSend = async () => {
    if (!email.trim() || !session) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send");
      } else {
        setSent(true);
        setEmail("");
        setTimeout(() => {
          setOpen(false);
          setSent(false);
        }, 2000);
      }
    } catch {
      setError("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full bg-blue-50 rounded-xl p-5 text-left hover:bg-blue-100/60 transition-colors"
      >
        <p className="text-[10px] font-semibold tracking-widest text-blue-600 mb-2">INVITE</p>
        <p className="text-[15px] leading-snug text-gray-900">Know a family who should weigh in? More families, better decisions.</p>
        <p className="text-sm font-semibold text-blue-600 mt-2">Invite a family &rarr;</p>
      </button>

      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="sm:max-w-md">
          <SignInPrompt
            title="Sign in to invite"
            description="Enter your email to receive a magic link."
          />
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a family</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter their email address"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {sent ? (
              <p className="text-sm text-green-600 font-medium">Invite sent!</p>
            ) : (
              <Button onClick={handleSend} disabled={sending || !email.trim()} className="w-full">
                {sending ? "Sending..." : "Send invite"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
