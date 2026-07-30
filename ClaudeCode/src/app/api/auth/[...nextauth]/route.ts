import { handlers } from "@/auth";

// Node runtime: the credentials authorize path uses Prisma and node:crypto,
// neither of which runs on the edge.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
