import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Opts a route out of the global JwtAuthGuard. Use only for register/login/
 * refresh and the entire `public/` module (share-token-gated routes). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
