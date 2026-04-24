/*
 * GROUPBUY Footer
 * Design: Ink background, wordmark-dark-red SVG, thin rule above
 * Three columns: brand + tagline, quick links, contact
 * Bottom bar: mono copyright + disclaimer
 */

const QUICK_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Current Deals", href: "#deals" },
  { label: "Pickup Info", href: "#pickup" },
  { label: "FAQ", href: "#faq" },
  { label: "Join Group", href: "#join" },
];

const CONTACT = [
  { label: "WhatsApp", value: "+61 407 249 272", href: "https://wa.me/61407249272" },
  { label: "Email", value: "hello@groupbuy.co", href: "mailto:hello@groupbuy.co" },
  { label: "Instagram", value: "@groupbuy.co", href: "https://instagram.com/groupbuy.co" },
];

export default function Footer() {
  return (
    <footer className="section-ink border-t border-white/10">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {/* Brand */}
          <div>
            <img
              src="/manus-storage/groupbuy-wordmark-redaccent-white-transparent_a5db7ccb.svg"
              alt="GROUPBUY"
              className="h-6 w-auto mb-4"
            />
            <p className="font-body text-[13px] text-[#8a857c] leading-relaxed max-w-xs">
              Premium meats, huge savings. Melbourne's South East group buy — running since 2020.
            </p>
            <p className="font-mono-brand text-[11px] text-[#c73e3a] mt-4 italic">
              "Brought to you anyway."
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-5">
              Quick Links
            </p>
            <nav className="flex flex-col gap-2">
              {QUICK_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="font-body text-[13px] text-[#f5f2ec]/50 hover:text-[#f5f2ec] transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div>
            <p className="font-display text-[10px] tracking-[0.25em] text-[#8a857c] mb-5">
              Contact
            </p>
            <div className="flex flex-col gap-3">
              {CONTACT.map((c) => (
                <div key={c.label}>
                  <p className="font-mono-brand text-[10px] text-[#8a857c] mb-0.5">
                    {c.label}
                  </p>
                  <a
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="font-body text-[13px] text-[#f5f2ec]/60 hover:text-[#f5f2ec] transition-colors"
                  >
                    {c.value}
                  </a>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 border border-white/10">
              <p className="font-display text-[10px] tracking-wider text-[#8a857c] mb-1">
                Pickup Hours
              </p>
              <p className="font-mono-brand text-[13px] text-[#f5f2ec]/70">
                Sat 08:00 — 11:00
              </p>
              <p className="font-body text-[11px] text-[#8a857c] mt-1">
                Lyndhurst, VIC 3975
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="font-mono-brand text-[11px] text-[#8a857c]">
            © {new Date().getFullYear()} GROUPBUY. All rights reserved.
          </p>
          <p className="font-mono-brand text-[10px] text-[#8a857c]/60 max-w-sm text-right">
            Prices subject to change. Orders confirmed on payment only.
          </p>
        </div>
      </div>
    </footer>
  );
}
