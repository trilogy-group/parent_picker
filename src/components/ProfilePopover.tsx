"use client";

import { useState } from "react";
import { Settings, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { signInWithMagicLink } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProfilePopover() {
  const { user, isLoading, isOfflineMode } = useAuth();

  // Sign-in dialog state
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInEmail.trim()) return;
    setIsSubmitting(true);
    setSignInError(null);
    const { error } = await signInWithMagicLink(signInEmail);
    if (error) {
      setSignInError(error.message);
      setIsSubmitting(false);
    } else {
      setEmailSent(true);
      setIsSubmitting(false);
    }
  };

  const handleCloseSignIn = () => {
    setShowSignIn(false);
    setSignInEmail("");
    setEmailSent(false);
    setSignInError(null);
  };

  if (isOfflineMode) {
    return (
      <span className="text-xs px-2 py-1 rounded text-gray-600 bg-gray-100">
        Demo Mode
      </span>
    );
  }

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  }

  // Logged out: show sign-in button + dialog
  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowSignIn(true)}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign In
        </button>

        <Dialog open={showSignIn} onOpenChange={handleCloseSignIn}>
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
                  We sent a magic link to <strong>{signInEmail}</strong>
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  Click the link in the email to sign in
                </p>
                <Button variant="ghost" className="mt-4" onClick={handleCloseSignIn}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label htmlFor="signin-email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="parent@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                  />
                </div>
                {signInError && <p className="text-sm text-red-600">{signInError}</p>}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={handleCloseSignIn}>
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

  // Logged in: email + gear icon link to /profile
  return (
    <a
      href="/profile"
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
    >
      <span className="truncate max-w-[160px]">{user.email}</span>
      <Settings className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}
