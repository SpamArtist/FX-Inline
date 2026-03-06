import { Controller, Get, Headers, HttpCode, Query } from "@nestjs/common";
import { requireAuthedUser } from "../auth.js";
import { parseBearerToken } from "../http.js";
import { getRatesForUser } from "../rates.js";

@Controller()
export class ApiController {
  @Get("rates/latest")
  @HttpCode(200)
  async rates(
    @Headers("authorization") authorization: string | undefined,
    @Query("force") force: string | undefined,
  ) {
    const authed = await this.resolveOptionalUser(authorization);
    const forceRefresh = force === "1";
    const result = await getRatesForUser(authed?.id || null, forceRefresh);

    return {
      snapshot: result.snapshot,
      planTier: result.planTier,
    };
  }

  private async resolveOptionalUser(authHeader: string | undefined) {
    const token = parseBearerToken(authHeader);
    if (!token) return null;

    return requireAuthedUser(token);
  }
}
