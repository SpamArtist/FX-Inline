import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";

type ControlPlaneSchema = typeof import("./schema.js").controlPlaneSchema;

export type DrizzleDb = NodePgDatabase<ControlPlaneSchema> | PgliteDatabase<ControlPlaneSchema>;
