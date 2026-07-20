// Cron entrypoint (tech-spec §7). Deliberately thin so all logic lives in runMaintenance and is
// testable without a cron harness. Not reachable via HTTP.
import { runMaintenance } from './lib/maintenance'

export async function scheduled(
  ctrl: ScheduledController,
  env: CloudflareBindings,
  ctx: ExecutionContext,
): Promise<void> {
  ctx.waitUntil(runMaintenance(env.DB, new Date(ctrl.scheduledTime)))
}
