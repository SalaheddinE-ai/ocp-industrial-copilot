import falconMark from "@/assets/falcon-mark.png";

export function FalconLogo({
  size = 36,
  withWordmark = true,
  tagline,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  tagline?: string;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span
        className="relative shrink-0 rounded-xl border border-border bg-surface-2 flex items-center justify-center overflow-hidden"
        style={{ height: size, width: size }}
      >
        <img
          src={falconMark}
          alt="Falcon logo"
          width={1024}
          height={1024}
          className="h-[76%] w-[76%] object-contain dark:invert"
        />
      </span>
      {withWordmark && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-[0.18em] uppercase">
            Falcon
          </span>
          {tagline && (
            <span className="block text-[10px] tracking-wide text-muted-foreground">{tagline}</span>
          )}
        </span>
      )}
    </span>
  );
}
