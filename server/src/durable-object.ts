import { DurableObject } from "cloudflare:workers";
import { getDecryptedKV } from "encrypt-workers-kv";
import { z } from "zod";
import { publishMessage } from "./open-cloud";
import { TOPIC } from ".";

type Session = {
  quit: boolean;
  universeId: number;
  cloudKey: string;
};

export class SocketDurableObject extends DurableObject<Env> {
  sessions: Map<WebSocket, Session>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.sessions = new Map();

    this.ctx.getWebSockets().forEach((webSocket) => {
      let meta = webSocket.deserializeAttachment();

      this.sessions.set(webSocket, meta);
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

      return new Response(null, {
        status: 101,
        webSocket: pair[0],
      });
    }

    if (path.endsWith("/send")) {
      const apiKeyHeader = request.headers.get("Authorization")?.split("Bearer ")[1];

      if (apiKeyHeader !== this.env.API_KEY) {
        return Response.json({ error: "Invalid API Key" }, { status: 401 });
      }

      const bodySchema = z.object({
        message: z.any(),
        topic: z.string(),
        serverId: z.string().optional(),
        destination: z.union([z.literal("roblox"), z.literal("server")]),
      });

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

      const [universeId] = path.split("/").slice(2);

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
          console.log(session.universeId);
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
      return;
    }

    const dataSchema = z.object({
      topic: z.string(),
      message: z.any(),
      serverId: z.string().optional(),
    });

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
    ws.close(code, "Closing...");
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.closeOrErrorHandler(ws, code);
  }

  async webSocketError(ws: WebSocket, error: Error) {
    this.closeOrErrorHandler(ws, 1011);
  }
}
