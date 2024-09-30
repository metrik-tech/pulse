import { z } from "zod";

export class Pulse {
  serverUrl: string;
  apiKey: string;
  public registry: Registry;

  constructor(config: { serverUrl: string; apiKey: string }) {
    this.serverUrl = config.serverUrl;
    this.apiKey = config.apiKey;
    this.registry = new Registry(config.apiKey, config.serverUrl);
  }

  Universe = (universeId: number) => new Universe(universeId, this);
}

class Universe {
  universeId: number;
  pulse: Pulse;
  wsReconnectAttempts: number = 0;

  constructor(universeId: number, pulse: Pulse) {
    this.universeId = universeId;
    this.pulse = pulse;
  }

  async send(data: {
    topic: string;
    message: any;
    serverId?: string;
    destination: "roblox" | "server";
  }): Promise<void> {
    const response = await fetch(
      `${this.pulse.serverUrl}/universes/${this.universeId}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.pulse.apiKey}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to send data to universe");
    }

    return;
  }

  async connect() {
    const ws = new WebSocket(
      `wss://${new URL(this.pulse.serverUrl).hostname}/universe/${
        this.universeId
      }/connect?apiKey=${this.pulse.apiKey}`
    );

    ws.addEventListener("close", () => {
      if (this.wsReconnectAttempts <= 3) {
        setTimeout(() => {
          console.log("WebSocket closed, reconnecting...");
          this.connect();
          this.wsReconnectAttempts++;
        }, 1000);
      }

      console.log("WebSocket closed and failed to reconnect");
    });

    ws.addEventListener("error", (error) => {
      console.log("Websocket Error:", error);
    });

    return {
      ws,
      subscribe: <T = unknown>(
        topic: string,
        callback: (data: T) => void,
        errorCallback?: (error: string) => void
      ) => {
        ws.addEventListener("message", (event) => {
          const data = JSON.parse(event.data) as {
            topic: string;
            message: T;
          } & {
            error?: string;
          };

          const dataSchema = z.object({
            topic: z.string(),
            message: z.any(),
          });

          const valid = dataSchema.safeParse(data);

          if (!valid.success) {
            errorCallback?.(data.error as string);
          }

          if (data.topic === topic) {
            callback(data.message as T);
          }
        });
      },
    };
  }
}

class Registry {
  private apiKey: string;
  private serverUrl: string;

  constructor(apiKey: string, serverUrl: string) {
    this.apiKey = apiKey;
    this.serverUrl = serverUrl;
  }

  async add(universeId: number, openCloudApiKey: string) {
    const response = await fetch(`${this.serverUrl}/universe/registry/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ universeId, openCloudApiKey }),
    });

    if (!response.ok) {
      throw new Error("Failed to add universe to registry");
    }

    return;
  }

  async remove(universeId: string) {
    const response = await fetch(`${this.serverUrl}/universe/registry/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ universeId: universeId }),
    });

    if (!response.ok) {
      throw new Error("Failed to remove universe from registry");
    }

    return;
  }

  async update(itemId: string) {
    const response = await fetch(`${this.serverUrl}/universe/registry/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        universeId: itemId,
        openCloudApiKey: "new-api-key",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update universe in registry");
    }

    return;
  }

  async list() {
    const response = await fetch(`${this.serverUrl}/universe/registry/list`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to list universes in registry");
    }

    return response.json() as Promise<Record<number, { valid: boolean }>>;
  }
}

const pulse = new Pulse({
  serverUrl: "https://pulse-server.ethan-d07.workers.dev",
  apiKey: "c033644abd8eb346ad76bf560d282b2b9a4bc26de9dc55deb673a0c5a0474bfb",
});

const universe = pulse.Universe(2745313133);

(async () => {
  const { subscribe } = await universe.connect();
  const { subscribe: subscribe2 } = await universe.connect();

  await universe.send({});

  subscribe<{ balls: boolean }>("test", (data) => {
    console.log(data.balls);
  });

  // multiple subscriptions work
  subscribe2<{ balls: boolean }>("test", (data) => {
    console.log(data.balls);
  });
})();
