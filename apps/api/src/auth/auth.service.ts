import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import { AuthTokens, LoginDto, makeId, RegisterDto } from "@tratable/shared";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens & { refreshToken: string }> {
    const existing = await this.db.db
      .selectFrom("users")
      .select("id")
      .where("email", "=", dto.email)
      .executeTakeFirst();
    if (existing) throw new ConflictException("An account with this email already exists");

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const id = makeId("user");
    await this.db.db
      .insertInto("users")
      .values({ id, email: dto.email, password_hash: passwordHash, name: dto.name })
      .execute();

    return this.issueTokens({ id, email: dto.email });
  }

  async login(dto: LoginDto): Promise<AuthTokens & { refreshToken: string }> {
    const user = await this.db.db
      .selectFrom("users")
      .select(["id", "email", "name", "password_hash"])
      .where("email", "=", dto.email)
      .executeTakeFirst();
    if (!user) throw new UnauthorizedException("Invalid email or password");

    const valid = await argon2.verify(user.password_hash, dto.password);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    return this.issueTokens({ id: user.id, email: user.email, name: user.name });
  }

  async refresh(rawToken: string): Promise<AuthTokens & { refreshToken: string }> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.db.db
      .selectFrom("refresh_tokens")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();

    if (!record || record.revoked_at || record.expires_at < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.db.db
      .selectFrom("users")
      .select(["id", "email", "name"])
      .where("id", "=", record.user_id)
      .executeTakeFirst();
    if (!user) throw new UnauthorizedException("User no longer exists");

    // Rotate: revoke the used token, issue a fresh pair.
    await this.db.db
      .updateTable("refresh_tokens")
      .set({ revoked_at: new Date().toISOString() })
      .where("id", "=", record.id)
      .execute();

    return this.issueTokens(user);
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.db.db
      .updateTable("refresh_tokens")
      .set({ revoked_at: new Date().toISOString() })
      .where("token_hash", "=", tokenHash)
      .execute();
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name?: string;
  }): Promise<AuthTokens & { refreshToken: string }> {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });

    const refreshTokenRaw = makeId("refreshToken") + makeId("refreshToken");
    const tokenHash = this.hashToken(refreshTokenRaw);
    const ttlDays = Number(this.config.get<string>("JWT_REFRESH_TTL_DAYS", "30"));
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.db.db
      .insertInto("refresh_tokens")
      .values({
        id: makeId("refreshToken"),
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      })
      .execute();

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: { id: user.id, email: user.email, name: user.name ?? "" },
    };
  }

  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
