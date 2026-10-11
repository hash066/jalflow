import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { planScenario } from "./planner.mjs";

const db = new DynamoDBClient({});

async function update(key, status, result) {
  await db.send(new UpdateItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: { ownerJob: { S: key } },
    UpdateExpression: "SET #status = :status, #result = :result",
    ExpressionAttributeNames: { "#status": "status", "#result": "result" },
    ExpressionAttributeValues: { ":status": { S: status }, ":result": { S: JSON.stringify(result) } },
  }));
}

export async function handler(event) {
  for (const record of event.Records) {
    const { owner, id } = JSON.parse(record.body);
    const key = `${owner}#${id}`;
    try {
      const stored = await db.send(new GetItemCommand({ TableName: process.env.TABLE_NAME, Key: { ownerJob: { S: key } }, ConsistentRead: true }));
      if (!stored.Item?.scenario?.S) throw new Error("Persisted scenario not found");
      await update(key, "RUNNING", { startedAt: new Date().toISOString() });
      const result = planScenario(JSON.parse(stored.Item.scenario.S));
      await update(key, "COMPLETE", { ...result, completedAt: new Date().toISOString() });
    } catch (error) {
      await update(key, "FAILED", { error: error instanceof Error ? error.message : "Planning failed", failedAt: new Date().toISOString() });
      throw error;
    }
  }
}
