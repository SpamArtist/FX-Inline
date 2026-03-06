import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { config } from "./config.js";
import { ApiExceptionFilter } from "./filters/api-exception.filter.js";

async function startServer() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Admin-Key",
      "Stripe-Signature",
    ],
  });

  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(config.port, config.host);

  // Keep startup logs free of secrets.
  console.log(`Backend listening on http://${config.host}:${config.port}`);
}

void startServer();
