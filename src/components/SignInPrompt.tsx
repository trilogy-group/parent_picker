"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithMagicLink } from "@/lib/auth";

interface SignInPromptProps {
  title: string;
  description: string;
}

export function SignInPrompt({ title, description }: SignInPromptProps) {
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

  if (emailSent) {
    return (
      <div className="py-6 text-center">
        <div className="text-4xl mb-4">📧</div>
        <h3 className="font-semibold text-lg mb-2">Check your email</h3>
        <p className="text-muted-foreground text-sm">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <p className="text-muted-foreground text-xs mt-2">
          Click the link in the email to sign in
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-4">{description}</p>

      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="signin-email" className="text-sm font-medium">
            Email Address
          </label>
          <Input
            id="signin-email"
            type="email"
            placeholder="parent@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Magic Link"
          )}
        </Button>
      </form>
    </div>
  );
}
