import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type Orientation = "horizontal" | "vertical";

const ResizablePanelGroup = ({
  className,
  direction,
  orientation,
  ...props
}: React.ComponentProps<typeof Group> & { direction?: Orientation }) => (
  <Group
    orientation={orientation ?? direction ?? "horizontal"}
    className={cn(
      "flex h-full w-full data-[orientation=vertical]:flex-col",
      className,
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => (
  <Separator
    className={cn(
      "relative flex w-1 items-center justify-center bg-border/60 hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[orientation=vertical]:h-1 data-[orientation=vertical]:w-full",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
