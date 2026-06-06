/**
 * File Sandbox Routes
 * Handles file uploads and workspace management for the agent
 */

import { Hono } from "hono";
import { mkdir, writeFile, readFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ApiDeps } from "../app";

const WORKSPACE_BASE = "/tmp/skynet-workspace";

export function createFileRoutes(deps: ApiDeps): Hono {
  const router = new Hono();

  // Ensure workspace directory exists
  async function ensureWorkspace(sessionId: string): Promise<string> {
    const workspace = join(WORKSPACE_BASE, sessionId);
    if (!existsSync(workspace)) {
      await mkdir(workspace, { recursive: true });
    }
    return workspace;
  }

  // Upload files to workspace
  router.post("/upload", async (c) => {
    try {
      const body = await c.req.parseBody();
      const sessionId = (body.sessionId as string) || "default";
      const files = body.files as File[] | File;

      const workspace = await ensureWorkspace(sessionId);
      const uploaded: Array<{ name: string; path: string; size: number }> = [];

      const fileArray = Array.isArray(files) ? files : [files];

      for (const file of fileArray) {
        if (file instanceof File) {
          const fileName = file.name;
          const filePath = join(workspace, fileName);
          const buffer = await file.arrayBuffer();
          await writeFile(filePath, new Uint8Array(buffer));

          const fileStat = await stat(filePath);
          uploaded.push({
            name: fileName,
            path: filePath,
            size: fileStat.size,
          });
        }
      }

      return c.json({
        success: true,
        uploaded,
        workspace,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      }, 500);
    }
  });

  // List files in workspace
  router.get("/list", async (c) => {
    try {
      const sessionId = c.req.query("sessionId") || "default";
      const workspace = await ensureWorkspace(sessionId);

      const files = await readdir(workspace, { withFileTypes: true });
      const fileList = await Promise.all(
        files.map(async (file) => {
          const filePath = join(workspace, file.name);
          const fileStat = await stat(filePath);
          return {
            name: file.name,
            path: filePath,
            size: fileStat.size,
            isDirectory: file.isDirectory(),
            modified: fileStat.mtime,
          };
        })
      );

      return c.json({
        success: true,
        files: fileList,
        workspace,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "List failed",
      }, 500);
    }
  });

  // Read file content
  router.get("/read", async (c) => {
    try {
      const sessionId = c.req.query("sessionId") || "default";
      const fileName = c.req.query("fileName");

      if (!fileName) {
        return c.json({
          success: false,
          error: "fileName is required",
        }, 400);
      }

      const workspace = await ensureWorkspace(sessionId);
      const filePath = join(workspace, fileName as string);

      if (!existsSync(filePath)) {
        return c.json({
          success: false,
          error: "File not found",
        }, 404);
      }

      const content = await readFile(filePath, "utf-8");

      return c.json({
        success: true,
        content,
        path: filePath,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Read failed",
      }, 500);
    }
  });

  // Write file content
  router.post("/write", async (c) => {
    try {
      const body = await c.req.json();
      const sessionId = body.sessionId || "default";
      const fileName = body.fileName;
      const content = body.content;

      if (!fileName || content === undefined) {
        return c.json({
          success: false,
          error: "fileName and content are required",
        }, 400);
      }

      const workspace = await ensureWorkspace(sessionId);
      const filePath = join(workspace, fileName);

      await writeFile(filePath, content);

      return c.json({
        success: true,
        path: filePath,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Write failed",
      }, 500);
    }
  });

  // Delete file
  router.delete("/delete", async (c) => {
    try {
      const sessionId = c.req.query("sessionId") || "default";
      const fileName = c.req.query("fileName");

      if (!fileName) {
        return c.json({
          success: false,
          error: "fileName is required",
        }, 400);
      }

      const workspace = await ensureWorkspace(sessionId);
      const filePath = join(workspace, fileName as string);

      if (!existsSync(filePath)) {
        return c.json({
          success: false,
          error: "File not found",
        }, 404);
      }

      await writeFile(filePath, ""); // Clear file content (or use rm for actual deletion)

      return c.json({
        success: true,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      }, 500);
    }
  });

  // Clean up workspace
  router.post("/cleanup", async (c) => {
    try {
      const body = await c.req.json();
      const sessionId = body.sessionId;

      if (!sessionId) {
        return c.json({
          success: false,
          error: "sessionId is required",
        }, 400);
      }

      const workspace = join(WORKSPACE_BASE, sessionId);

      if (existsSync(workspace)) {
        await writeFile(workspace, ".cleanup", new Date().toISOString());
      }

      return c.json({
        success: true,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
      }, 500);
    }
  });

  return router;
}
