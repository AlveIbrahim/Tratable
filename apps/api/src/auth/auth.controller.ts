import { Body, Controller, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { loginSchema, registerSchema } from "@tratable/shared";
import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE = "tratable_rt";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
};

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Create an account, returning an access token and setting a refresh-token cookie" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password", "name"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8, maxLength: 128 },
        name: { type: "string", minLength: 1, maxLength: 120 },
      },
    },
  })
  @ApiResponse({ status: 201, description: "accessToken + user; refresh token set as an httpOnly cookie" })
  @ApiResponse({ status: 409, description: "An account with this email already exists" })
  async register(@Body(new ZodValidationPipe(registerSchema)) dto: any, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...tokens } = await this.authService.register(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    return tokens;
  }

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Log in, returning an access token and setting a refresh-token cookie" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "accessToken + user; refresh token set as an httpOnly cookie" })
  @ApiResponse({ status: 401, description: "Invalid email or password" })
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: any, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...tokens } = await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    return tokens;
  }

  @Public()
  @Post("refresh")
  @ApiOperation({
    summary: "Exchange the httpOnly refresh-token cookie for a new access token (rotates the refresh token)",
  })
  @ApiResponse({ status: 201, description: "New accessToken + user; refresh cookie rotated" })
  @ApiResponse({ status: 401, description: "Missing, invalid, or expired refresh token" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException("Missing refresh token");
    const { refreshToken, ...tokens } = await this.authService.refresh(raw);
    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    return tokens;
  }

  @Public()
  @Post("logout")
  @ApiOperation({ summary: "Revoke the current refresh token and clear its cookie" })
  @ApiResponse({ status: 201, description: "{ ok: true }" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await this.authService.revokeRefreshToken(raw);
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTS);
    return { ok: true };
  }
}
