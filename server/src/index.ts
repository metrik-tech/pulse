import { putEncryptedKV, getDecryptedKV } from "encrypt-workers-kv";
import { publishMessage } from "./open-cloud";
import { parse, serialize } from "cookie";

const ROUTES = {
  interact: /^\/universe\/\d+\/(send|connect)$/,
  clientCount: /^\/universe\/\d+\/clients$/,
  registryAdd: /^\/universe\/registry\/add$/,
  registryRemove: /^\/universe\/registry\/remove$/,
  registryUpdate: /^\/universe\/registry\/update$/,
  registryList: /^\/universe\/registry\/list$/,
};

export { SocketDurableObject } from "./durable-object";

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
          sameSite: "lax",
          path: "/",
          expires: new Date(new Date().setDate(new Date().getDate() + 7)), // 1 mo
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

    if (ROUTES.clientCount.test(path) && request.method === "GET") {
      const universeId = Number(path.split("/").slice(2)[0]);
      const clients = await env.UNIVERSE_REGISTRY.get(`${universeId}:clients`);

      return Response.json({ clients: Number(clients) });
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
      const universeIds = (await env.UNIVERSE_REGISTRY.list()).keys
        .map((key) => (!key.name.includes(":") ? Number(key.name) : null))
        .filter(Boolean);

      const valid = await Promise.all(
        universeIds.map(async (universeId) => {
          const openCloudKey = new TextDecoder().decode(
            await getDecryptedKV(env.UNIVERSE_REGISTRY, String(universeId), env.ENCRYPTION_KEY)
          );
          const clientCount = await env.UNIVERSE_REGISTRY.get(`${universeId}:clients`);

          const { ok } = await publishMessage({
            cloudKey: openCloudKey,
            universeId: universeId as number,
            topic: "pulse_test",
            message: "test",
          });

          return {
            universeId,
            valid: ok,
            clients: Number(clientCount ?? 0),
          };
        })
      );

      const asObject = valid.reduce((acc, curr) => {
        acc[curr.universeId as number] = { valid: curr.valid, clients: curr.clients };
        return acc;
      }, {} as Record<number, { valid: boolean; clients: number }>);

      return Response.json(asObject);
    }

    return Response.json({ error: "Invalid path" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
