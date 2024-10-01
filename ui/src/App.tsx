import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Login } from "./components/login";
import { Navbar } from "./components/navbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "./components/table";

const API_URL = "/universe/registry"; // Base API URL

interface Universe {
  valid: boolean;
  clients: number;
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
      console.log(data);
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
  });

  const addUniverseMutation = useMutation({
    mutationFn: async ({
      universeId,
      openCloudApiKey,
    }: {
      universeId: string;
      openCloudApiKey: string;
    }) => {
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

  const { mutate: updateUniverse } = useMutation({
    mutationFn: async ({
      universeId,
      openCloudApiKey,
    }: {
      universeId: string;
      openCloudApiKey: string;
    }) => {
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
      await addUniverseMutation.mutateAsync({
        universeId: newUniverseId,
        openCloudApiKey: newApiKey,
      });
      alert("Universe added successfully");
      setNewUniverseId("");
      setNewApiKey("");
    } catch (error) {
      console.error("Error adding universe:", error);
      alert("Failed to add universe");
    }
  };

  if (!isLoggedIn || isLoggingIn) {
    return (
      <Login
        handleLogin={loginMutation.mutateAsync}
        isLoggingIn={isLoggingIn}
      />
    );
  }

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error fetching universes</div>;

  return (
    <>
      <Navbar loggedIn={true} />
      <div>
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-medium mb-1">Universe Registry</h2>
        </div>

        <TableRoot>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Universe ID</TableHeaderCell>
                <TableHeaderCell>API Key active</TableHeaderCell>
                <TableHeaderCell>Connected clients</TableHeaderCell>

                <TableHeaderCell>Messages/s</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(universes || {}).map(([universeId, data]) => (
                <TableRow key={universeId}>
                  <TableCell>{universeId}</TableCell>
                  <TableCell>{!data.valid ? "Inactive" : "Active"}</TableCell>
                  <TableCell>{data.clients}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{/* update, delete */}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>

        <div>
          <h2>Add Universe</h2>
          <form onSubmit={handleAddUniverse}>
            <input
              type="number"
              value={newUniverseId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewUniverseId(e.target.value)
              }
              placeholder="Universe ID"
              required
            />
            <input
              type="text"
              value={newApiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewApiKey(e.target.value)
              }
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
                  {!data.valid ? (
                    <div>Open Cloud API Key is inactive. Please edit!</div>
                  ) : (
                    <span>Open Cloud API Key is active</span>
                  )}
                </div>
                <div>
                  <UpdateRegistryForm
                    updateUniverse={updateUniverse}
                    universeId={universeId}
                  />

                  <button
                    onClick={() => deleteUniverseMutation.mutate(universeId)}
                  >
                    Delete
                  </button>
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
function UpdateRegistryForm({
  updateUniverse,
  universeId,
}: {
  updateUniverse: ({
    universeId,
    openCloudApiKey,
  }: {
    universeId: string;
    openCloudApiKey: string;
  }) => void;
  universeId: string;
}) {
  const [newApiKey, setNewApiKey] = useState<string>("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateUniverse({
          universeId,
          openCloudApiKey: newApiKey,
        });
      }}
    >
      <input
        type="text"
        placeholder="Update Open Cloud API Key"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setNewApiKey(e.target.value)
        }
      />
      <button type="submit">Update</button>
    </form>
  );
}
