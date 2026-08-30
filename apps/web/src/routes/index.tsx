import { createFileRoute } from "@tanstack/react-router";

import { Hero } from "@/components/hero/hero";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <Shell>
      <Hero />
    </Shell>
  );
}
