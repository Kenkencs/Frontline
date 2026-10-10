import { createApiServer } from "./nodeServer";

// Loopback only. Vite proxies /api here, so the browser uses one origin.
const server = createApiServer();
server.listen(3001, "127.0.0.1", () =>
  console.log("Backend: http://127.0.0.1:3001/api/chat (mock responses)"),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
