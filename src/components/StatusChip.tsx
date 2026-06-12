type Estado = 'pendiente' | 'en_proceso' | 'completado';

const map: Record<string, { cls: string; label: string }> = {
  pendiente:   { cls: 'chip-pendiente', label: 'Pendiente' },
  en_proceso:  { cls: 'chip-en-proceso', label: 'En proceso' },
  completado:  { cls: 'chip-completado', label: 'Completado' },
};

export default function StatusChip({ estado }: { estado: Estado | string }) {
  const m = map[estado] ?? { cls: 'chip-pendiente', label: estado };
  return <span className={m.cls}>{m.label}</span>;
}
