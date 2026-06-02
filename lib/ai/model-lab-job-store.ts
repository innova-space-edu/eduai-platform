type DbClient = { from: (table: string) => any };

export async function saveQueuedVideoJob(db: DbClient, values: Record<string, unknown>) {
  const { data } = await db.from("model_lab_jobs").insert(values).select("id").single();
  return typeof data?.id === "string" ? data.id : null;
}

export async function updateJob(db: DbClient, jobId: string, values: Record<string, unknown>) {
  await db.from("model_lab_jobs").update(values).eq("id", jobId);
}

export async function updateJobByExternalId(db: DbClient, externalJobId: string, values: Record<string, unknown>) {
  await db.from("model_lab_jobs").update(values).eq("external_job_id", externalJobId);
}
