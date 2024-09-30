import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Login } from "./components/login";
import { toast } from "sonner";
import { Navbar } from "./components/navbar";

const API_URL = "/universe/registry"; // Base API URL

interface Universe {
	valid: boolean;
	newApiKey?: string;
}

interface Universes {
	[universeId: string]: Universe;
}

const PulseRegistryManager: React.FC = () => {
	const [newUniverseId, setNewUniverseId] = useState<string>("");
	const [newApiKey, setNewApiKey] = useState<string>("");
	const queryClient = useQueryClient();

	const {
		data: isLoggedIn,
		refetch: refetchSession,
		isPending: isLoggingIn,
	} = useQuery({
		queryKey: ["session"],
		queryFn: async () => {
			const response = await fetch("/ui/session", {
				method: "GET",
				credentials: "include",
			});
			const data = await response.json();
			return data.session;
		},
	});

	const {
		data: universes,
		isLoading,
		isError,
	} = useQuery<Universes>({
		queryKey: ["universes"],
		queryFn: async () => {
			const response = await fetch(`${API_URL}/list`, {
				method: "GET",
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Failed to fetch universes");
			}
			return response.json();
		},
		enabled: !!isLoggedIn,
	});

	const loginMutation = useMutation({
		mutationFn: async (apiKey: string) => {
			const response = await fetch("/ui/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ apiKey }),
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error("Login failed");
			}
			return response.json();
		},
		onSuccess: () => {
			refetchSession();
		},
		onError: () => {
			toast.error("Failed to login. Check your API key and try again.");
		},
	});

	const addUniverseMutation = useMutation({
		mutationFn: async ({ universeId, openCloudApiKey }: { universeId: string; openCloudApiKey: string }) => {
			const response = await fetch(`${API_URL}/add`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ universeId, openCloudApiKey }),
			});
			if (!response.ok) {
				throw new Error("Failed to add universe");
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["universes"] });
		},
	});

	const updateUniverseMutation = useMutation({
		mutationFn: async ({ universeId, openCloudApiKey }: { universeId: string; openCloudApiKey: string }) => {
			const response = await fetch(`${API_URL}/update`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ universeId, openCloudApiKey }),
			});
			if (!response.ok) {
				throw new Error("Failed to update universe");
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["universes"] });
		},
	});

	const deleteUniverseMutation = useMutation({
		mutationFn: async (universeId: string) => {
			const response = await fetch(`${API_URL}/remove`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ universeId }),
			});
			if (!response.ok) {
				throw new Error("Failed to delete universe");
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["universes"] });
		},
	});

	const handleAddUniverse = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		try {
			await addUniverseMutation.mutateAsync({ universeId: newUniverseId, openCloudApiKey: newApiKey });
			alert("Universe added successfully");
			setNewUniverseId("");
			setNewApiKey("");
		} catch (error) {
			console.error("Error adding universe:", error);
			alert("Failed to add universe");
		}
	};

	if (!isLoggedIn || isLoggingIn) {
		return <Login handleLogin={loginMutation.mutate} isLoggingIn={isLoggingIn} />;
	}

	if (isLoading) return <div>Loading...</div>;
	if (isError) return <div>Error fetching universes</div>;

	return (
		<>
			<Navbar loggedIn={true} />
			<div>
				<h1>Pulse Registry Manager</h1>

				<div>
					<h2>Add Universe</h2>
					<form onSubmit={handleAddUniverse}>
						<input
							type="number"
							value={newUniverseId}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUniverseId(e.target.value)}
							placeholder="Universe ID"
							required
						/>
						<input
							type="text"
							value={newApiKey}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewApiKey(e.target.value)}
							placeholder="Open Cloud API Key"
							required
						/>
						<button type="submit">Add Universe</button>
					</form>
				</div>

				<div>
					<h2>Universe List</h2>
					<div>
						{Object.entries(universes || {}).map(([universeId, data]) => (
							<div key={universeId}>
								<div>
									<input type="number" value={universeId} disabled />
									{!data.valid ? <div>Open Cloud API Key is inactive. Please edit!</div> : <span>Open Cloud API Key is active</span>}
								</div>
								<div>
									<input
										type="text"
										placeholder="Update Open Cloud API Key"
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => (data.newApiKey = e.target.value)}
									/>
									<button onClick={() => updateUniverseMutation.mutate({ universeId, openCloudApiKey: data.newApiKey || "" })}>
										Update
									</button>
									<button onClick={() => deleteUniverseMutation.mutate(universeId)}>Delete</button>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</>
	);
};

export default PulseRegistryManager;
