# `💗 pulse`

Pulse is a tool built by Metrik to allow for incredibly efficient realtime WebSocket communication between the web and Roblox. Pulse is built on top of Cloudflare Durable Objects and the Open Cloud MessagingService API.

Pulse makes use of a number of techniques to make the server as efficient as possible, including:
- Virtual MessagingService topics to avoid consuming too much usage
- Hibernation of Durable Objects between messages to reduce cost
- 

> [!NOTE]  
> A Cloudflare Workers 'Paid plan' account is required to use Pulse.

## Deploying the server

1. Clone the repository (or download the zip file) and navigate to the `server` directory.
2. Install the dependencies by running `pnpm install`.
> [!NOTE]
> If you don't have pnpm installed, read their docs at https://pnpm.io/installation
3. Create a new Cloudflare account if you do not already have one.
4. Subscribe to the Workers Paid plan (this is required to deploy the server).
5. Create a new KV namespace in Cloudflare using the command `pnpx wrangler kv:namespace create UNIVERSE_REGISTRY`. You may need to sign in on Cloudflare.
6. Replace the original `id` with your newly created KV namespace ID  in the `wrangler.toml` file under ```[[kv_namespaces]]```.
7. Run `pnpm run deploy` to deploy the server to Cloudflare Workers.
8. [Open the Worker's settings on Cloudflare (this link will take you right there)](https://dash.cloudflare.com/?to=/:account/workers/services/view/pulse-server/production/settings)
9.  Press '+ Add' beside 'Variables and Secrets'
10.  Enter `API_KEY` as the variable name and a randomly generated string as the variable. You can use https://generate-secret.vercel.app/64 to generate a sufficiently long string.
> [!CAUTION]  
> Do not forget this value! This is required to interact with the server, either through the UI or through the API/clients.
11.  Press 'Encrypt' and then 'Deploy'.
12.  Repeat steps 5 through 7 for the `ENCRYPTION_KEY` variable. You do not need to note down this variable.
13.  You are now done! Press the 'Visit' button at the top of the page to open the UI, and this will be the hostname you use with the Roblox & Server clients.

## Using the UI to add your universe to the registry

Pulse comes out of the box with a UI that you can use to inspect the throughput of the server, and manage the Universe Registry. The Universe Registry manages the Open Cloud API keys (which are required to communicate with Roblox games) for each universe you want to use with Pulse.

### Creating an Open Cloud API key

1. Go to the [Creator Hub](https://create.roblox.com/dashboard/creations) and if using with a group, select the group you want to use in the top left corner dropdown.
2. Select 'Open Cloud' and then 'API Keys' from the left sidebar.
3. Click 'Create API Key' and then give the key a name.
4. Under 'Access Permissions', select `messaging-service`, then 'Add API System'.
5. In the new search box that appears, search for the game you want to use with Pulse, and select it.
6. Under 'Security' put `0.0.0.0/0` in the 'Accepted IP Addresses' field.
7. Do not let the key expire, and then click 'Save & Generate Key'.
8. Save for the next step.

### Logging into the UI


## Installing & using the Roblox client
take it away, brandon!
should look something like this:
```lua
local PulseClient = require(location.of.pulse.client)

local pulse = PulseClient.new({
    serverUrl = "https://your-pulse-server",
    apiKey = "your-api-key",
})

pulse.Subscribe("test", function(message)
    pritn(message)
end)

pulse.Send(topic, message, {
    destination = "server" -- default, can be "roblox" for server-server comms.
    serverId = "optional-server-id" -- only needed if destination is "roblox". more useful when you are the server.
})
```

## Installing & using the TS client

```pnpm install @metrik/pulse```

```ts
import { Pulse } from "@metrik/pulse";

const pulse = new Pulse({
    serverUrl: "https://your-pulse-server",
    apiKey: "your-api-key",
});

const universe = pulse.Universe(2745313133);

const { subscribe } = await universe.connect();

subscribe("test", (message) => {
    console.log(message);
});

await universe.send({
    topic: "test",
    message: "hello world",
    serverId: "optional-server-id",
    destination: "roblox" // default, can be "server" for server-server comms (why you would want this is beyond me)
})

```
## UI

Pulse comes with a UI that you can use to interact with the Game Registry, as well as inspect stats about the operation of the server. It is available on the root path of your deployed Worker.
 
## Architecture

![Architecture Diagram](/assets/architecture.png)
