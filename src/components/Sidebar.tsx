"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/posts", label: "Publications", icon: "📝" },
  { href: "/agents", label: "Agents IA", icon: "🤖" },
  { href: "/workflow", label: "Workflow", icon: "⚡" },
  { href: "/topics", label: "Sujets", icon: "💡" },
  { href: "/settings", label: "Paramètres", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="desktop-sidebar"
        style={{
          width: 240,
          borderRight: "1px solid var(--card-border)",
          padding: "1.5rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 1rem", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700 }}>
            🚀 LinkedIn AutoPilot
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
            Automatisation IA
          </p>
        </div>

        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </aside>

      {/* Mobile Bottom Nav */}
      <nav
        className="mobile-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--card)",
          borderTop: "1px solid var(--card-border)",
          justifyContent: "space-around",
          padding: "0.5rem 0",
          zIndex: 50,
        }}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              fontSize: "0.625rem",
              color: pathname === item.href ? "var(--primary)" : "var(--muted)",
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
