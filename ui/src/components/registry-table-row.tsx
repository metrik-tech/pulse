import { TableCell, TableRow } from "./ui/table";
import { Universe, API_URL } from "../App";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { DialogClose } from "./ui/dialog";

export function RegistryTableRow({
  universeId,
  data,
}: {
  universeId: string;
  data: Universe;
}) {
  const [newApiKey, setNewApiKey] = useState<string>("");
  const queryClient = useQueryClient();

  const { mutateAsync: updateUniverse } = useMutation({
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

  const { mutateAsync: deleteUniverse } = useMutation({
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

  return (
    <TableRow>
      <TableCell>{universeId}</TableCell>
      <TableCell>
        {!data.valid ? (
          <span className="text-red-400">Inactive</span>
        ) : (
          "Active"
        )}
      </TableCell>
      <TableCell>{data.clients}</TableCell>
      <TableCell>-</TableCell>
      <TableCell className="flex items-center justify-start gap-x-1.5">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="outline-none">
              Update API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Open Cloud API Key</DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                toast.promise(
                  updateUniverse({
                    universeId,
                    openCloudApiKey: newApiKey,
                  }),
                  {
                    loading: "Updating universe in registry...",
                    success: "Universe updated successfully",
                    error: "Failed to update universe",
                  }
                );
              }}
              className="mt-2 flex flex-col justify-start items-start gap-y-1"
            >
              <Label htmlFor="#update-api-key-input">
                New Open Cloud API Key
              </Label>
              <Input
                id="update-api-key-input"
                type="password"
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                required
                className="w-full mt-1"
                value={newApiKey}
                onChange={(e) => {
                  setNewApiKey(e.target.value);
                }}
              />
              <DialogClose asChild>
                <Button type="submit" className="mt-2">
                  Update API Key for Universe
                </Button>
              </DialogClose>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="outline-none !text-red-500">
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Universe</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-zinc-500">
              Are you sure you want to delete this universe?
            </p>
            <DialogClose asChild className="mt-3">
              <Button
                type="submit"
                variant="destructive"
                className="outline-none"
                onClick={() => {
                  toast.promise(deleteUniverse(universeId), {
                    loading: "Deleting universe...",
                    success: "Universe deleted successfully",
                    error: "Failed to delete universe",
                  });
                }}
              >
                Delete Universe
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
