import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { RLBoardProvider } from "@/lib/rlboard/context";
import { PerfProvider } from "@/lib/rlboard/perf";
import { SiteHeader } from "@/components/SiteHeader";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "rlboard — RL Logging Board v2 (modular RL training visualizer, 256k tokens)" },
      {
        name: "description",
        content:
          "Modular RL training visualization library: reward curves, token-level heatmaps, response explorer. Supports up to 256k token sequences with minimap + virtualized drill-down.",
      },
      { name: "author", content: "rlboard" },
      { property: "og:title", content: "rlboard — RL Logging Board v2" },
      { property: "og:description", content: "Modular RL training visualizer with 256k token support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <PerfProvider>
      <RLBoardProvider>
        <div className="min-h-screen bg-background text-foreground">
          <SiteHeader />
          <Outlet />
        </div>
      </RLBoardProvider>
    </PerfProvider>
  );
}
