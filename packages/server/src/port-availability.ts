import { createServer } from "node:net";

export async function assertPortAvailable(port: number, hostname = "127.0.0.1"): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const probe = createServer();
		probe.unref();
		probe.once("error", (error: NodeJS.ErrnoException) => {
			if (error.code === "EADDRINUSE") {
				reject(
					new Error(
						`Port ${port} is already in use. Choose another port with "deepscience web --port ${port + 1}" or stop the process using port ${port}.`,
					),
				);
				return;
			}
			reject(new Error(`Cannot listen on ${hostname}:${port}: ${error.message}`));
		});
		probe.listen({ host: hostname, port }, () => {
			probe.close((error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	});
}
