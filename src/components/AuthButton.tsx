"use client";

import { useState } from "react";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "./AuthProvider";
import { signInWithMagicLink, signOut } from "@/lib/auth";

export function AuthButton() {
  const { user, isLoading, isOfflineMode } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const { error } = await signInWithMagicLink(email);

    if (error) {
      setError(error.message);
      setIsSubmitting(false);
    } else {
      setEmailSent(true);
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleClose = () => {
    setShowSignIn(false);
    setEmail("");
    setEmailSent(false);
    setError(null);
  };

  // In offline mode, show a demo mode badge
  if (isOfflineMode) {
    return (
      <span className="text-xs text-blue-200 bg-blue-700 px-2 py-1 rounded">
        Demo Mode
      </span>
    );
  }

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-blue-100 hidden sm:inline">
          {user.email}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-white hover:bg-blue-700"
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowSignIn(true)}
        className="text-white hover:bg-blue-700"
      >
        <LogIn className="h-4 w-4 mr-1" />
        Sign In
      </Button>

      <Dialog open={showSignIn} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign In to Vote</DialogTitle>
            <DialogDescription>
              Enter your email to receive a magic link. No password needed.
            </DialogDescription>
          </DialogHeader>

          {emailSent ? (
            <div className="py-6 text-center">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="font-semibold text-lg mb-2">Check your email</h3>
              <p className="text-muted-foreground text-sm">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Click the link in the email to sign in
              </p>
              <Button
                variant="ghost"
                className="mt-4"
                onClick={handleClose}
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="parent@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Magic Link"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
