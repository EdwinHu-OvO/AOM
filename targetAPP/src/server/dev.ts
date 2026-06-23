import { startMockApi } from "./server.js";

const port = Number(process.env.PORT ?? 4545);
const { baseUrl } = await startMockApi(port);

console.log(`Mock API listening at ${baseUrl}`);
