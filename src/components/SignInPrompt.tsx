"use client";

import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithOtpCode, verifyOtpCode } from "@/lib/auth";

interface SignInPromptProps {
  title: string;
  description: string;
}

export function SignInPrompt({ title, description }: SignInPromptProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const { error } = await signInWithOtpCode(email);

    if (error) {
      setError(error.message);
    } else {
      setCodeSent(true);
    }
    setIsSubmitting(false);
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    setError(null);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5 && next.every((d) => d)) {
      handleVerify(next.join(""));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...code];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setCode(next);
    if (pasted.length === 6) {
      handleVerify(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleVerify = async (token: string) => {
    setIsSubmitting(true);
    setError(null);

    const { error } = await verifyOtpCode(email, token);

    if (error) {
      setError("Invalid or expired code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
    setIsSubmitting(false);
  };

  const handleResend = async () => {
    setIsSubmitting(true);
    setError(null);
    setCode(["", "", "", "", "", ""]);

    const { error } = await signInWithOtpCode(email);

    if (error) {
      setError(error.message);
    } else {
      setError(null);
    }
    setIsSubmitting(false);
    inputRefs.current[0]?.focus();
  };

  if (codeSent) {
    return (
      <div className="py-4">
        <h3 className="font-semibold text-lg mb-1">Enter your code</h3>
        <p className="text-muted-foreground text-sm mb-4">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>

        <div className="flex gap-2 justify-center mb-4" onPaste={handleCodePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(i, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(i, e)}
              autoFocus={i === 0}
              className="w-11 h-13 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          ))}
        </div>

        {error && <p className="text-sm text-red-600 text-center mb-3">{error}</p>}

        {isSubmitting && (
          <div className="flex justify-center mb-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleResend}
            disabled={isSubmitting}
            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
          <span className="text-sm text-gray-400 mx-2">·</span>
          <button
            onClick={() => { setCodeSent(false); setError(null); setCode(["", "", "", "", "", ""]); }}
            className="text-sm text-gray-500 hover:underline"
          >
            Change email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-4">{description}</p>

      <form onSubmit={handleSendCode} className="space-y-4">
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
            "Send Sign-In Code"
          )}
        </Button>
      </form>
    </div>
  );
}
