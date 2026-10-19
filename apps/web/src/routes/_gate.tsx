import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Bar } from "@/components/frame";

export const Route = createFileRoute("/_gate")({ component: GateLayout });

function GateLayout() {
  return (
    <div className="min-h-dvh bg-blue-bright px-edge pt-anchor pb-10 roomy:pb-16">
      <Bar />
      <Outlet />
    </div>
  );
}
