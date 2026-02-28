"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/posts", label: "Publications", icon: "📝" },
  { href: "/settings", label: "Paramètres", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 220,
      minHeight: "100vh",
      borderRight: "1px solid var(--card-border)",
      padding: "1.5rem 1rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem",
      background: "var(--card-bg)",
    }}>
      <div style={{ marginBottom: "1.5rem", padding: "0 0.5rem" }}>
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700 }}>🤖 AutoLinkedIn</h1>
        <p style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: 4 }}>Tech Wow — IA Générative</p>
      </div>

      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.625rem 0.75rem",
              borderRadius: 8,
              fontSize: "0.875rem",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--primary)" : "var(--foreground)",
              background: active ? "rgba(59,130,246,0.1)" : "transparent",
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div style={{ marginTop: "auto", padding: "0.75rem", borderTop: "1px solid var(--card-border)", fontSize: "0.6875rem", color: "var(--muted)" }}>
        Cron: tous les jours 8h
      </div>
    </aside>
  );
}
