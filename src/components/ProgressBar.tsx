export default function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}
