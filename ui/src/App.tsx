import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Login } from "./components/login";
import { Navbar } from "./components/navbar";
import {
  Table,
  TableBody,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "./components/ui/table";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { toast } from "sonner";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { RegistryTableRow } from "./components/registry-table-row";

export const API_URL = "/universe/registry"; // Base API URL

export interface Universe {
  valid: boolean;
  clients: number;
}

interface Universes {
  [universeId: string]: Universe;
}

const PulseRegistryManager: React.FC = () => {
  const [newUniverseId, setNewUniverseId] = useState<string>("");
  const [newApiKey, setNewApiKey] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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

  const handleAddUniverse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setAddDialogOpen(false);

    toast.promise(
      addUniverseMutation.mutateAsync({
        universeId: newUniverseId,
        openCloudApiKey: newApiKey,
      }),
      {
        loading: "Adding universe...",
        success: "Universe added successfully",
        error: "Failed to add universe",
      }
    );

    setNewUniverseId("");
    setNewApiKey("");
  };

  if (isLoading || isLoggingIn)
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );

  if (!isLoggedIn) {
    return (
      <Login
        handleLogin={loginMutation.mutateAsync}
        isLoggingIn={isLoggingIn}
      />
    );
  }

  if (isError) return <div>Error fetching universes</div>;

  return (
    <>
      <Navbar loggedIn={true} />
      <div className="mt-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-medium mb-1">Universe Registry</h2>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add Universe</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Universe to Registry</DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleAddUniverse}
                className="*:space-y-1 *:w-full flex flex-col justify-start items-start gap-y-2"
              >
                <div className="mt-2">
                  <Label htmlFor="#universe-id-input">Universe ID</Label>
                  <Input
                    id="universe-id-input"
                    placeholder="Universe ID"
                    required
                    type="number"
                    enableStepper={false}
                    onChange={(e) => {
                      setNewUniverseId(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="#api-key-input">Open Cloud API Key</Label>
                  <Input
                    id="api-key-input"
                    placeholder="Open Cloud API Key"
                    required
                    type="password"
                    onChange={(e) => {
                      setNewApiKey(e.target.value);
                    }}
                  />
                </div>

                {/* <DialogClose asChild className="mt-3"> */}
                <Button type="submit">Add Universe</Button>
                {/* </DialogClose> */}
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <TableRoot className="mt-4">
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
                <RegistryTableRow
                  universeId={universeId}
                  data={data}
                  key={universeId}
                />
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      </div>
    </>
  );
};

export default PulseRegistryManager;
