import { cn } from "@/lib/utils";

export function CheckDots({ total, done, size = "md" }: { total: number; done: number; size?: "sm" | "md" }) {
  return (
    <div className={cn("flex flex-wrap", size === "md" ? "gap-2" : "gap-1.5")}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full border transition-all duration-1000",
            size === "md" ? "h-3 w-3" : "h-2 w-2",
            i < done ? "border-sage bg-sage" : "border-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}
