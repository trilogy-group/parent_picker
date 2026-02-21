"use client";

import { Mail, MapPin, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface HelpRequest {
  id: string;
  email: string;
  user_id: string | null;
  location_id: string | null;
  location_address: string | null;
  location_name: string | null;
  created_at: string;
}

interface AdminHelpRequestCardProps {
  request: HelpRequest;
}

export function AdminHelpRequestCard({ request }: AdminHelpRequestCardProps) {
  const date = new Date(request.created_at);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="w-4 h-4 text-muted-foreground" />
            {request.email}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Calendar className="w-3 h-3" />
            {dateStr}
          </div>
        </div>

        {request.location_address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>
              {request.location_name && (
                <span className="font-medium text-foreground">{request.location_name} — </span>
              )}
              {request.location_address}
            </span>
          </div>
        )}

        {!request.location_address && (
          <div className="text-xs text-muted-foreground italic">General help offer (no specific location)</div>
        )}
      </CardContent>
    </Card>
  );
}
