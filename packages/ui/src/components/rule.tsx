export function Rule({ className }: { className?: string }) {
  return (
    <hr className={`border-t border-rule${className ? ` ${className}` : ""}`} />
  );
}
