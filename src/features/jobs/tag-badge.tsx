import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TagBadgeProps = {
  className?: string;
  tag: string;
};

export function TagBadge({ className, tag }: TagBadgeProps) {
  return (
    <Badge
      className={cn(
        "border-primary/20 bg-primary/[0.08] px-1.5 py-0 text-[10px] text-primary",
        className,
      )}
      title={tag}
      variant="outline"
    >
      {tag}
    </Badge>
  );
}
