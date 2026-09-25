import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CompactText({
  text,
  middle = false,
  tooltip = true,
}: {
  text: string;
  middle?: boolean;
  tooltip?: boolean;
}) {
  const content = (
    <span
      className="compact-text"
      tabIndex={tooltip ? 0 : undefined}
      aria-label={text}
    >
      {middle && text.length > 20 ? (
        <>
          <span className="compact-text-head">{text.slice(0, -8)}</span>
          <span className="compact-text-tail">{text.slice(-8)}</span>
        </>
      ) : (
        <span className="compact-text-head">{text}</span>
      )}
    </span>
  );
  if (!tooltip) return content;
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          className="max-w-[min(32rem,90vw)] break-all"
          sideOffset={6}
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
