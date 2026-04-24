/*
 * GROUPBUY Announcement Banner
 * Design: Red background, mono text, dismissible
 * Used for active drop announcements or important notices
 */
import { useState } from "react";
import { X } from "lucide-react";

interface AnnouncementBannerProps {
  message: string;
  link?: { href: string; label: string };
}

export default function AnnouncementBanner({ message, link }: AnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-[#c73e3a] text-[#f5f2ec] relative">
      <div className="container flex items-center justify-between h-9">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-mono-brand text-[11px] tracking-wider truncate">
            {message}
          </span>
          {link && (
            <a
              href={link.href}
              className="font-display text-[10px] tracking-widest underline underline-offset-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              {link.label}
            </a>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 text-[#f5f2ec]/70 hover:text-[#f5f2ec] transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
