import * as fs from "node:fs";
import * as path from "node:path";
import { diskStorage, type FileFilterCallback } from "multer";
import { makeId } from "@tratable/shared";

// Read directly from process.env rather than Nest's ConfigService: this
// config object is built once at module-decoration time (before the DI
// container exists) because the multer instance built from it needs
// its options synchronously. dotenv/config has already run by the time
// main.ts's module graph reaches this file — see main.ts's import order.
const uploadsDir = path.resolve(process.env.UPLOADS_DIR ?? "./uploads", "imports");
fs.mkdirSync(uploadsDir, { recursive: true });

const maxFileBytes = Number(process.env.IMPORT_MAX_FILE_MB ?? "50") * 1024 * 1024;

export const importUploadOptions = {
  storage: diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      cb(null, `${makeId("importJob")}${ext}`);
    },
  }),
  limits: { fileSize: maxFileBytes },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: FileFilterCallback) => {
    const ok = /\.(csv|tsv|txt)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error("Only .csv, .tsv, or .txt files are accepted"));
  },
};
