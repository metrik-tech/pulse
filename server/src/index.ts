import { DurableObject } from "cloudflare:workers";
import { putEncryptedKV, getDecryptedKV } from "encrypt-workers-kv";
import { publishMessage } from "./open-cloud";
import { z } from "zod";
import { parse, serialize } from "cookie";

const TOPIC = "pulse";
const ROUTES = {
	interact: /^\/universe\/\d+\/[^\/]+$/,
	registryAdd: /^\/universe\/registry\/add$/,
	registryRemove: /^\/universe\/registry\/remove$/,
	registryUpdate: /^\/universe\/registry\/update$/,
	registryList: /^\/universe\/registry\/list$/,
};

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

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const path = new URL(request.url).pathname;

		if (path.startsWith("/ui")) {
			if (path === "/ui/session" && request.method === "GET") {
				const cookie = request.headers.get("Cookie");
				const parsedCookie = parse(cookie ?? "");

				return Response.json({ session: parsedCookie["pulse.session"] ? true : false });
			}

			if (path === "/ui/login" && request.method === "POST") {
				const body = await request.json<{ apiKey: string }>();

				if (!body.apiKey) {
					return Response.json({ error: "Missing API Key" }, { status: 400 });
				}

				if (body.apiKey !== env.API_KEY) {
					return Response.json({ error: "Invalid API Key" }, { status: 401 });
				}

				const session = serialize("pulse.session", body.apiKey, {
					secure: true,
					httpOnly: true,
					expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 1 mo
				});

				return Response.json(null, {
					headers: {
						"Set-Cookie": session,
					},
				});
			}
		}

		if (ROUTES.interact.test(path)) {
			const [universeId] = path.split("/").slice(2);

			console.log(universeId);

			const id = env.SOCKET.idFromName(universeId);
			console.log(id);
			const stub = env.SOCKET.get(id);

			return stub.fetch(request, {
				method: request.method,
			});
		}

		const cookieHeader = request.headers.get("Cookie");
		const cookie = cookieHeader ? parse(cookieHeader) : {};

		if (cookie["pulse.session"] !== env.API_KEY) {
			return Response.json({ error: "Invalid API Key" }, { status: 401 });
		}

		if (ROUTES.registryAdd.test(path) && request.method === "POST") {
			const body = await request.json<{ universeId: number; openCloudApiKey: string }>();
			if (await env.UNIVERSE_REGISTRY.get(String(body.universeId))) {
				return Response.json({ error: "Universe already exists" }, { status: 409 });
			}

			const { ok } = await publishMessage({
				cloudKey: body.openCloudApiKey,
				universeId: body.universeId,
				topic: "pulse_test",
				message: "test",
			});

			if (!ok) {
				return Response.json({ error: "Invalid Open Cloud API Key" }, { status: 400 });
			}

			await putEncryptedKV(env.UNIVERSE_REGISTRY, String(body.universeId), body.openCloudApiKey, env.ENCRYPTION_KEY);

			return Response.json({ success: true });
		}

		if (ROUTES.registryRemove.test(path) && request.method === "POST") {
			const body = await request.json<{ universeId: number }>();
			if (!(await env.UNIVERSE_REGISTRY.get(String(body.universeId)))) {
				return Response.json({ error: "Universe does not exist" }, { status: 404 });
			}

			await env.UNIVERSE_REGISTRY.delete(String(body.universeId));

			return Response.json({ success: true });
		}

		if (ROUTES.registryUpdate.test(path) && request.method === "POST") {
			const body = await request.json<{ universeId: number; openCloudApiKey: string }>();
			if (!(await env.UNIVERSE_REGISTRY.get(String(body.universeId)))) {
				return Response.json({ error: "Universe does not exist" }, { status: 404 });
			}

			await putEncryptedKV(env.UNIVERSE_REGISTRY, String(body.universeId), body.openCloudApiKey, env.ENCRYPTION_KEY);

			return Response.json({ success: true });
		}

		if (ROUTES.registryList.test(path) && request.method === "GET") {
			const universeIds = (await env.UNIVERSE_REGISTRY.list()).keys.map((key) => Number(key.name));

			const valid = await Promise.all(
				universeIds.map(async (universeId) => {
					const openCloudKey = new TextDecoder().decode(
						await getDecryptedKV(env.UNIVERSE_REGISTRY, String(universeId), env.ENCRYPTION_KEY)
					);

					const { ok } = await publishMessage({
						cloudKey: openCloudKey,
						universeId: universeId,
						topic: "pulse_test",
						message: "test",
					});

					return {
						universeId,
						valid: ok,
					};
				})
			);

			const asObject = valid.reduce((acc, curr) => {
				acc[curr.universeId] = { valid: curr.valid };
				return acc;
			}, {} as Record<number, { valid: boolean }>);

			return Response.json(asObject);
		}

		return Response.json({ error: "Invalid path" }, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
