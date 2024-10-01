import { Logo } from "./logo";

export function Navbar({ loggedIn }: { loggedIn: boolean }) {
	return (
		<div className="flex items-center justify-between">
			<Logo />
			{loggedIn && <p>Logged in</p>}
			<p className="text-sm font-medium text-zinc-300">Built in Canada by Metrik</p>
		</div>
	);
}
