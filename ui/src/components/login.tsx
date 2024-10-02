import { useState } from "react";
import { Navbar } from "./navbar";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function Login({
  handleLogin,
}: {
  handleLogin: (key: string) => Promise<void>;
  isLoggingIn: boolean;
}) {
  const [loginApiKey, setLoginApiKey] = useState<string>("");

  return (
    <>
      <Navbar loggedIn={false} />
      <div className="h-screen absolute top-0 left-0 my-auto w-full flex flex-col items-center justify-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.promise(handleLogin(loginApiKey), {
              loading: "Logging in...",
              success: "Login successful",
              error: "Login failed",
            });
            handleLogin(loginApiKey);
          }}
          className="flex flex-col items-center justify-center gap-y-3"
        >
          <Input
            type="password"
            value={loginApiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLoginApiKey(e.target.value)
            }
            placeholder="Enter Pulse API Key"
            required
            className="w-96"
          />

          <Button
            variant="primary"
            type="submit"
            className="h-10 w-96 outline-none"
          >
            <span className="mr-1">Login</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="size-4"
            >
              <path
                fillRule="evenodd"
                d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                clipRule="evenodd"
              />
            </svg>
          </Button>
        </form>
      </div>
    </>
  );
}
