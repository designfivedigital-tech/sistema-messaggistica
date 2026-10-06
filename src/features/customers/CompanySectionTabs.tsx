import { NavLink } from "react-router-dom";

const SECTIONS = [
  { to: "/azienda", label: "Chat" },
  { to: "/azienda/clienti", label: "Clienti" },
] as const;

export function CompanySectionTabs() {
  return (
    <nav
      className="company-section-tabs"
      aria-label="Sezioni azienda"
    >
      {SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end
          className={({ isActive }) =>
            isActive
              ? "company-section-tabs__tab company-section-tabs__tab--active"
              : "company-section-tabs__tab"
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
