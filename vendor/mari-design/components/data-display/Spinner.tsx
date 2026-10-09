const SIZE = {
  sm: "w-[13px] h-[13px] border-[1.5px]",
  md: "w-[22px] h-[22px] border-2",
};

/* The one spinner — single animation, two sizes. sm for inline/button
   contexts, md for panel loads. Hairline ink ring with a biscay-2 lead
   segment, no drop shadow or glow. */
export function Spinner({ size = "sm", label = "Loading" }: { size?: "sm" | "md"; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block rounded-full border-ink/25 border-t-biscay-2 animate-spin ${SIZE[size]}`}
    />
  );
}
