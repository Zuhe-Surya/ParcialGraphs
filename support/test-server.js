import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function close(server) {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

export async function startTestServer(apiHandler) {
  const requests = [];
  const apiServer = createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    requests.push(path);

    try {
      const result = await apiHandler(path);
      response.writeHead(result?.status ?? 200, {
        "content-type": "application/json",
      });
      response.end(JSON.stringify(result?.body ?? null));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: error.message }));
    }
  });

  const apiPort = await listen(apiServer);
  const reservationServer = createServer();
  const appPort = await listen(reservationServer);
  await close(reservationServer);

  const app = spawn(process.execPath, ["src/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      API_COLOMBIA_BASE_URL: `http://127.0.0.1:${apiPort}/api/v1`,
      PORT: String(appPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  app.stdout.setEncoding("utf8").on("data", (chunk) => {
    output += chunk;
  });
  app.stderr.setEncoding("utf8").on("data", (chunk) => {
    output += chunk;
  });

  const endpoint = `http://127.0.0.1:${appPort}/`;
  const startupDeadline = Date.now() + 10_000;

  try {
    while (Date.now() < startupDeadline) {
      if (app.exitCode !== null) {
        throw new Error(`El servidor GraphQL terminó al iniciar.\n${output}`);
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "{ saludo }" }),
        });
        const result = await response.json();

        if (result.data?.saludo) {
          return {
            endpoint,
            requests,
            async stop() {
              if (app.exitCode === null) {
                await new Promise((resolve, reject) => {
                  const timeout = setTimeout(
                    () => reject(new Error("El servidor GraphQL no terminó.")),
                    3_000,
                  );
                  app.once("exit", () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  app.kill();
                });
              }

              await close(apiServer);
            },
          };
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(`El servidor GraphQL no inició a tiempo.\n${output}`);
  } catch (error) {
    if (app.exitCode === null) {
      const exited = once(app, "exit");
      app.kill();
      await exited;
    }
    await close(apiServer);
    throw error;
  }
}

export async function executeGraphQL(endpoint, query) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const result = await response.json();

  assert.equal(response.status, 200, JSON.stringify(result.errors));
  return result;
}
