"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NotHereReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationName: string;
  onSubmit: (reason: string) => void;
}

export default function NotHereReasonModal({
  open,
  onOpenChange,
  locationName,
  onSubmit,
}: NotHereReasonModalProps) {
  const [reason, setReason] = useState("");

  function handleSubmit() {
    onSubmit(reason.trim());
    setReason("");
    onOpenChange(false);
  }

  function handleSkip() {
    onSubmit("");  // submit vote with no reason
    setReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What concerns you about this location?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500">
          Your feedback helps other parents and our team evaluate {locationName}.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Traffic is bad during school hours, flood zone, no sidewalks..."
          className="w-full min-h-[100px] rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            Submit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
