import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

// Express 5 passes startup failures, such as a port already in use, to this callback.
const server = app.listen(env.port, (error) => {
  if (error) {
    console.error(`Server could not start on port ${env.port}:`, error.message);
    process.exit(1);
  }
  console.log(`Server listening on http://localhost:${env.port}`);
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
