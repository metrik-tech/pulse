export async function publishMessage({
	cloudKey,
	universeId,
	topic,
	message,
}: {
	cloudKey: string;
	universeId: number;
	topic: string;
	message: any;
}) {
	if (topic.length > 80) {
		throw new Error("Invalid topic - must be less than 80 characters");
	}

	const response = await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${universeId}/topics/${encodeURIComponent(topic)}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": cloudKey,
		},
		body: JSON.stringify({
			message: typeof message === "string" ? message : JSON.stringify(message),
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to publish message with code ${response.status}`);
	}

	return response;
}
