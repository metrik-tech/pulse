import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "sonner";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<div className="lg:max-w-7xl px-4 mt-6 mx-auto text-white min-h-screen h-full">
				<App />
			</div>
			<Toaster
				theme="dark"
				toastOptions={{
					classNames: {
						toast: "bg-zinc-950 border border-white/10",
					},
				}}
			/>
		</QueryClientProvider>
	</StrictMode>
);
