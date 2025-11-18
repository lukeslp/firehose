import { ReactNode, useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function CollapsibleSection({ 
  title, 
  children, 
  defaultCollapsed = false,
  className = "swiss-card"
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-section-title">{title}</h2>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs font-bold hover:opacity-70 transition-opacity px-2 py-1"
          aria-label={collapsed ? "Expand section" : "Collapse section"}
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>
      {!collapsed && children}
    </div>
  );
}
