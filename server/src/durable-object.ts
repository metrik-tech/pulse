import { DurableObject } from "cloudflare:workers";
import { getDecryptedKV } from "encrypt-workers-kv";
import { z } from "zod";
import { publishMessage } from "./open-cloud";

type Session = {
  quit: boolean;
  universeId: number;
  cloudKey: string;
};

const TOPIC = "pulse";

async function increment(universeId: number, env: Env) {
  const clients = await env.UNIVERSE_REGISTRY.get(`${universeId}:clients`);

  await env.UNIVERSE_REGISTRY.put(`${universeId}:clients`, String(Number(clients) + 1));
}

async function decrement(universeId: number, env: Env) {
  const clients = await env.UNIVERSE_REGISTRY.get(`${universeId}:clients`);

  await env.UNIVERSE_REGISTRY.put(`${universeId}:clients`, String(Number(clients) - 1));
}

export class SocketDurableObject extends DurableObject<Env> {
  sessions: Map<WebSocket, Session>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.sessions = new Map();

    const websockets = this.ctx.getWebSockets();

    websockets.forEach(async (webSocket) => {
      const meta = webSocket.deserializeAttachment();
      const existsAlready = this.sessions.has(webSocket);

      !existsAlready && this.sessions.set(webSocket, meta);

      if (!existsAlready) {
        await increment(meta.universeId, env);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;

    if (path.endsWith("/connect")) {
      const apiKey = new URL(request.url).searchParams.get("apiKey");

      if (!apiKey) {
        return Response.json({ error: "Missing API Key" }, { status: 400 });
      }

      if (apiKey !== this.env.API_KEY) {
        return Response.json({ error: "Invalid API Key" }, { status: 401 });
      }

      const [universeId] = path.split("/").slice(2);

      const openCloudKey = new TextDecoder().decode(await getDecryptedKV(this.env.UNIVERSE_REGISTRY, universeId, this.env.ENCRYPTION_KEY));

      if (!openCloudKey) {
        return Response.json({ error: "Universe does not exist" }, { status: 404 });
      }

      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return Response.json({ error: "Expected header Upgrade: websocket" }, { status: 426 });
      }

      const pair = new WebSocketPair();

      this.ctx.acceptWebSocket(pair[1]);

      pair[1].serializeAttachment({
        universeId: Number(universeId),
        cloudKey: openCloudKey,
        quit: false,
      });

      this.sessions.set(pair[1], {
        universeId: Number(universeId),
        cloudKey: openCloudKey,
        quit: false,
      });

      await increment(Number(universeId), this.env);

      return new Response(null, {
        status: 101,
        webSocket: pair[0],
      });
    }

    if (path.endsWith("/send")) {
      const [universeId] = path.split("/").slice(2);
      const apiKeyHeader = request.headers.get("Authorization")?.split("Bearer ")[1];

      if (apiKeyHeader !== this.env.API_KEY) {
        return Response.json({ error: "Invalid API Key" }, { status: 401 });
      }

      const bodySchema = z
        .object({
          message: z.any(),
          topic: z.string(),
          serverId: z.string().optional(),
          destination: z.union([z.literal("roblox"), z.literal("server")]),
        })
        .strict();

      const body = await request.json<{
        message: any;
        topic: string;
        serverId?: string;
        destination: "roblox" | "server";
      }>();

      const result = bodySchema.safeParse(body);

      if (!result.success) {
        return Response.json({ error: result.error.issues[0].message }, { status: 400 });
      }

      this.env.ANALYTICS_ENGINE.writeDataPoint({
        blobs: [body.topic, body.destination, JSON.stringify(body.message), body.serverId ?? "null"],
        indexes: [universeId],
      });

      if (body.destination === "roblox") {
        await publishMessage({
          cloudKey: new TextDecoder().decode(await getDecryptedKV(this.env.UNIVERSE_REGISTRY, universeId, this.env.ENCRYPTION_KEY)),
          universeId: Number(universeId),
          topic: TOPIC,
          message: {
            topic: body.topic,
            message: body.message,
            serverId: body.serverId,
          },
        });
      }

      if (body.destination === "server") {
        for (const [ws, session] of this.sessions) {
          if (session.universeId === Number(universeId)) {
            ws.send(
              JSON.stringify({
                topic: body.topic,
                message: body.message,
              })
            );
          }
        }
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid path" }, { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (message === "ping") {
      ws.send("pong");
      return;
    }

    const session = this.sessions.get(ws);

    if (!session || session?.quit) {
      ws.close(1011, "WebSocket broken");
      if (session) {
        await decrement(session.universeId, this.env);
      }
      return;
    }

    const dataSchema = z
      .object({
        topic: z.string(),
        message: z.any(),
        serverId: z.string().optional(),
      })
      .strict();

    let data: {
      topic: string;
      message: any;
      serverId?: string;
    } | null = null;

    try {
      data = JSON.parse(message as string) as {
        topic: string;
        message: any;
        serverId?: string;
      };
    } catch (e) {
      ws.send(JSON.stringify({ error: "Invalid message" }));
      return;
    }

    const result = dataSchema.safeParse(data);

    if (!result.success) {
      ws.send(JSON.stringify({ error: result.error.issues[0].message }));
      return;
    }

    await publishMessage({
      cloudKey: session.cloudKey,
      universeId: session.universeId,
      topic: TOPIC,
      message: data,
    });

    ws.send(JSON.stringify({ success: true }));
  }

  async closeOrErrorHandler(ws: WebSocket, code: number) {
    console.log("Closing...");
    const session = this.sessions.get(ws) || ({} as Session);
    session.quit = true;
    this.sessions.delete(ws);
    await decrement(session.universeId, this.env);
    ws.close(code, "Closing...");
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.closeOrErrorHandler(ws, code);
  }

  async webSocketError(ws: WebSocket, error: Error) {
    this.closeOrErrorHandler(ws, 1011);
  }
}
