import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  "sweep unclaimed resumes",
  { minuteUTC: 30 },
  internal.members.sweepUnclaimedResumes,
  {},
);

export default crons;
