import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { setupSocketIO } from "./socket.js";
import internalRoutes from "./routes/internal.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(internalRoutes);

const httpServer = createServer(app);
const io = setupSocketIO(httpServer);

app.set("io", io);

httpServer.listen(PORT, () => {
  console.log(`Socket Server running on port ${PORT}`);
});
