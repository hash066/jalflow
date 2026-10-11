import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import crypto from "node:crypto";
import { validateScenario } from "./planner.mjs";

const db = new DynamoDBClient({}), sqs = new SQSClient({});
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });

export async function handler(event) {
  const owner = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!owner) return json(401, { error: "unauthorized" });
  if (event.requestContext.http.method === "POST") {
    if ((event.body || "").length > 500_000) return json(413, { error: "scenario too large" });
    let input;
    try { input = JSON.parse(event.body || "{}"); validateScenario(input); } catch (error) { return json(400, { error: error instanceof Error ? error.message : "invalid scenario" }); }
    const id = crypto.randomUUID(), createdAt = new Date().toISOString();
    await db.send(new PutItemCommand({ TableName: process.env.TABLE_NAME, Item: { ownerJob: { S: `${owner}#${id}` }, status: { S: "QUEUED" }, scenario: { S: JSON.stringify(input) }, createdAt: { S: createdAt }, expiresAt: { N: String(Math.floor(Date.now() / 1000) + 604800) } }, ConditionExpression: "attribute_not_exists(ownerJob)" }));
    await sqs.send(new SendMessageCommand({ QueueUrl: process.env.QUEUE_URL, MessageBody: JSON.stringify({ owner, id }) }));
    return json(202, { id, status: "QUEUED", createdAt });
  }
  const id = event.pathParameters?.id;
  if (!id) return json(400, { error: "job id required" });
  const result = await db.send(new GetItemCommand({ TableName: process.env.TABLE_NAME, Key: { ownerJob: { S: `${owner}#${id}` } }, ConsistentRead: true }));
  return result.Item ? json(200, { id, status: result.Item.status.S, result: result.Item.result?.S ? JSON.parse(result.Item.result.S) : null }) : json(404, { error: "not found" });
}
