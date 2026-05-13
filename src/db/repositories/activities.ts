import {
  activitySchema,
  createActivitySchema,
  type CreateActivityInput,
} from "@/lib/schemas";

import { getDatabase } from "../client";
import { createId, nowIso } from "../utils";

export async function createActivity(input: CreateActivityInput) {
  const parsedInput = createActivitySchema.parse(input);
  const activity = activitySchema.parse({
    ...parsedInput,
    id: createId("activity"),
    createdAt: nowIso(),
  });

  await getDatabase().activities.add(activity);
  return activity;
}
