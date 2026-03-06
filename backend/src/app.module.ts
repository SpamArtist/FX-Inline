import { Module } from "@nestjs/common";
import { ApiController } from "./controllers/api.controller.js";

@Module({
  controllers: [ApiController],
})
export class AppModule {}
