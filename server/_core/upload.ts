import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { getUserFromRequest } from "./context";
import { createTempUpload } from "../db/tempUploads";
import { logger } from "./logger";

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "uploads", "temp"));
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filter for Excel files only
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files (.xlsx, .xls) are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

/**
 * Validate .xlsx file magic bytes
 * .xlsx files are ZIP archives, which start with PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
 * @returns true if the file has valid ZIP/XLSX magic bytes
 */
async function isLikelyXlsx(filePath: string): Promise<boolean> {
  try {
    const fd = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(4);
    await fd.read(buffer, 0, 4, 0);
    await fd.close();

    // ZIP magic bytes: 50 4B 03 04
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  } catch {
    return false;
  }
}

/**
 * Validate .xls file magic bytes
 * .xls files (OLE2) start with D0 CF 11 E0 A1 B1 1A E1
 * @returns true if the file has valid OLE2/XLS magic bytes
 */
async function isLikelyXls(filePath: string): Promise<boolean> {
  try {
    const fd = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(8);
    await fd.read(buffer, 0, 8, 0);
    await fd.close();

    // OLE2 magic bytes: D0 CF 11 E0 A1 B1 1A E1
    return (
      buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0 &&
      buffer[4] === 0xA1 && buffer[5] === 0xB1 && buffer[6] === 0x1A && buffer[7] === 0xE1
    );
  } catch {
    return false;
  }
}

export function registerUploadRoutes(app: Express) {
  // Ensure temp directory exists
  const tempDir = path.join(process.cwd(), "uploads", "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // File upload endpoint — returns uploadId instead of filePath for security
  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      // Authenticate user
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Validate file magic bytes to prevent MIME type spoofing
      const ext = path.extname(req.file.originalname).toLowerCase();
      let isValidFile = false;

      if (ext === ".xlsx") {
        isValidFile = await isLikelyXlsx(req.file.path);
      } else if (ext === ".xls") {
        isValidFile = await isLikelyXls(req.file.path);
      }

      if (!isValidFile) {
        // Delete the invalid file
        await fsPromises.unlink(req.file.path).catch(() => {});
        res.status(400).json({
          error: "File content does not match the expected format. The file may be corrupted or have an incorrect extension.",
        });
        return;
      }

      // Generate uploadId and store in temp_uploads table
      const uploadId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours TTL

      await createTempUpload({
        id: uploadId,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: user.id,
        expiresAt,
      });

      // Return uploadId — never expose server filePath to client
      res.json({
        success: true,
        uploadId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });
    } catch (error) {
      logger.error("upload_failed", { error: error instanceof Error ? error.message : String(error) });
      // Clean up temp file if it was written but DB operations failed
      if (req.file?.path) {
        await fsPromises.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ error: "Upload failed" });
    }
  });
}
