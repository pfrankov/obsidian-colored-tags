import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("Vitest server configuration", () => {
	it("does not start a network listener in middleware mode", async () => {
		const { stdout } = await execFileAsync(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				`
      import { Server } from 'node:net';
      import path from 'node:path';
      import { createServer } from 'vite';

      let listens = 0;
      const originalListen = Server.prototype.listen;
      Server.prototype.listen = function () {
        listens++;
        return this;
      };
      const server = await createServer({
        configFile: path.resolve('vitest.config.ts'),
        server: { middlewareMode: true, hmr: false },
      });
      try {
        console.log(JSON.stringify({ ws: server.config.server.ws ?? null, listens }));
      } finally {
        Server.prototype.listen = originalListen;
        await server.close();
      }
    `,
			],
			{ timeout: 10000 },
		);

		expect(JSON.parse(stdout)).toEqual({ ws: false, listens: 0 });
	}, 15000);
});
