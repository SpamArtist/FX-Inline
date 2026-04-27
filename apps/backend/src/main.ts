import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { resolveAdminDbPath } from "./settings-store.js";

const DEFAULT_PORT = 3307;
const DEFAULT_HOST = "127.0.0.1";
const MAX_BODY_BYTES = "1mb";

async function bootstrap() {
  const port = Number(process.env.FX_INLINE_ADMIN_API_PORT || DEFAULT_PORT);
  const host = process.env.FX_INLINE_ADMIN_API_HOST || DEFAULT_HOST;
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useBodyParser("json", { limit: MAX_BODY_BYTES });
  app.useBodyParser("urlencoded", { limit: MAX_BODY_BYTES, extended: true });
  await app.listen(port, host);

  process.stdout.write(
    `FX Inline admin API listening on http://${host}:${port} using ${resolveAdminDbPath()}\n`,
  );
}

await bootstrap();
