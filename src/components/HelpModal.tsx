"use client";

import { useState } from "react";
import { HandHelping, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "./AuthProvider";
import { SignInPrompt } from "./SignInPrompt";

interface HelpModalProps {
  /** Location-specific mode — shows on a card */
  locationName?: string;
  locationAddress?: string;
  /** Compact button for cards vs. full button for intro panel */
  variant?: "card" | "panel";
}

export function HelpModal({ locationName, locationAddress, variant = "panel" }: HelpModalProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const { user } = useAuth();

  const isLocationSpecific = !!locationAddress;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mockup: just show confirmation
    setSubmitted(true);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSubmitted(false);
      setEmail("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {variant === "card" ? (
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            <HandHelping className="w-3 h-3" />
            I can help here
          </button>
        ) : (
          <button className="flex-1 flex items-center justify-center gap-1.5 bg-white text-blue-700 font-semibold text-xs py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors shadow-md">
            <HandHelping className="w-3.5 h-3.5" />
            I Want to Help
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          /* Success state */
          <div className="py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">Thank you!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isLocationSpecific
                ? `We'll send you a detailed guide for how you can help with ${locationName || locationAddress}.`
                : "We'll send you a guide with specific ways you can help bring Alpha to your area."
              }
            </p>
            <div className="bg-blue-50 rounded-lg p-3 text-left text-sm space-y-2">
              <p className="font-medium text-blue-900">Your email package will include:</p>
              <ul className="text-blue-800 space-y-1 ml-4 list-disc">
                <li>What we&apos;re looking for in your area</li>
                <li>How to connect us with property owners</li>
                <li>How to help with zoning &amp; permitting</li>
                <li>How to rally other parents</li>
              </ul>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="mt-4">
              Got it
            </Button>
          </div>
        ) : (
          /* Form state */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HandHelping className="w-5 h-5 text-blue-600" />
                {isLocationSpecific ? "Help With This Location" : "I Want to Help"}
              </DialogTitle>
              <DialogDescription>
                {isLocationSpecific
                  ? `You can make a real difference for ${locationName || locationAddress}. We'll send you a guide with specific actions you can take.`
                  : "Parents have 100x the local knowledge we do. We'll send you a guide with specific ways you can help bring Alpha to your neighborhood."
                }
              </DialogDescription>
            </DialogHeader>

            {user ? (
              /* Already signed in */
              <div className="space-y-4 mt-2">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <p className="text-green-800">
                    <Mail className="w-4 h-4 inline mr-1" />
                    We&apos;ll send your guide to <strong>{user.email}</strong>
                  </p>
                </div>

                {isLocationSpecific && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Location</p>
                    <p className="text-muted-foreground">{locationAddress}</p>
                  </div>
                )}

                <div className="text-sm space-y-2">
                  <p className="font-medium">Ways you can help:</p>
                  <div className="grid gap-2">
                    {[
                      { icon: "🏢", text: "Connect us with property owners or landlords" },
                      { icon: "📋", text: "Help navigate local zoning and permitting" },
                      { icon: "👥", text: "Rally other parents to show demand" },
                      { icon: "🔑", text: "Introduce us to local government contacts" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2 bg-white border rounded-md p-2">
                        <span className="text-base">{item.icon}</span>
                        <span className="text-sm text-muted-foreground">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                  <Button onClick={handleSubmit}>Send Me the Guide</Button>
                </div>
              </div>
            ) : (
              /* Not signed in — need email */
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <label htmlFor="help-email" className="text-sm font-medium">
                    Your email
                  </label>
                  <Input
                    id="help-email"
                    type="email"
                    placeholder="parent@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll send you a guide with specific ways you can help.
                  </p>
                </div>

                {isLocationSpecific && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">Location</p>
                    <p className="text-muted-foreground">{locationAddress}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>Cancel</Button>
                  <Button type="submit" disabled={!email.trim()}>Send Me the Guide</Button>
                </div>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
