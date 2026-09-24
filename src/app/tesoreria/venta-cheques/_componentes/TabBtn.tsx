'use client';



export function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>
      {children}
    </button>
  );
}
