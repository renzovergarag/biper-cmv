import { Router, Request, Response } from "express";
import { verifySocketToken } from "../lib/auth.js";
import { listAgents, countAgents } from "../socket/agents-state.js";

const router = Router();

function authenticateInternal(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const decoded = verifySocketToken(token);

  if (!decoded || decoded.rol !== "INTERNAL") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  next();
}

router.post("/internal/events", authenticateInternal, (req: Request, res: Response) => {
  const { evento } = req.body;

  if (!evento) {
    return res.status(400).json({ error: "Datos de evento requeridos" });
  }

  req.app.get("io").emit("evento:nuevo", { evento });

  res.json({ success: true });
});

router.get("/internal/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get(
    "/internal/agents-online",
    authenticateInternal,
    (_req: Request, res: Response) => {
        res.json({
            count: countAgents(),
            agents: listAgents().map((a) => ({
                userId: a.userId,
                email: a.email,
                nombre: a.nombre,
                connectedAt: a.connectedAt,
            })),
        });
    }
);

export default router;
