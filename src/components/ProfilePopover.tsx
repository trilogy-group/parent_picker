"use client";

import { useState } from "react";
import { Settings, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { SignInPrompt } from "./SignInPrompt";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

export function ProfilePopover() {
  const { user, isLoading, isOfflineMode } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

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

        <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
          <DialogContent className="sm:max-w-md">
            <SignInPrompt
              title="Sign in to vote"
              description="Enter your email and we'll send you a code. No password needed."
            />
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
