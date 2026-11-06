export function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-4 w-4 border-2" : "h-8 w-8 border-[3px]";
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${dimensions}`}
    />
  );
}

/** A centred spinner for while a page or section is loading. */
export function LoadingBlock() {
  return (
    <div className="flex justify-center py-12 text-brand-600">
      <Spinner />
    </div>
  );
}
