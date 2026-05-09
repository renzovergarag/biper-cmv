export interface AgenteConectado {
    userId: string;
    email: string;
    nombre: string;
    socketId: string;
    connectedAt: string;
}

const agentesConectados = new Map<string, AgenteConectado>();

export function setAgent(agent: AgenteConectado): void {
    agentesConectados.set(agent.userId, agent);
}

export function removeAgent(userId: string): void {
    agentesConectados.delete(userId);
}

export function listAgents(): AgenteConectado[] {
    return Array.from(agentesConectados.values());
}

export function countAgents(): number {
    return agentesConectados.size;
}
