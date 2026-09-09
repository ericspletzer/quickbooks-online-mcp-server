import fs from "node:fs";
import path from "node:path";
import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface CreateAttachableInput {
  file_name?: string;
  file_path?: string;
  note?: string;
  category?: string;
  content_type?: string;
  include_on_send?: boolean;
  attachable_ref?: {
    entity_ref_type: string;
    entity_ref_value: string;
  };
}

const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".html": "text/html",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

function inferContentType(filePath: string, override?: string): string {
  if (override) return override;
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

export async function createQuickbooksAttachable(data: CreateAttachableInput): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    // BRANCH A — file_path provided: upload bytes via /upload endpoint.
    if (data.file_path) {
      if (!fs.existsSync(data.file_path)) {
        return { result: null, isError: true, error: `file_path does not exist: ${data.file_path}` };
      }
      if (!data.attachable_ref) {
        return { result: null, isError: true, error: "attachable_ref is required when file_path is set (qbo.upload links the file to a specific entity)" };
      }
      const fileName = data.file_name || path.basename(data.file_path);
      const contentType = inferContentType(data.file_path, data.content_type);
      const stream = fs.createReadStream(data.file_path);

      const uploadResponse: any = await new Promise((resolve, reject) => {
        (quickbooks as any).upload(
          fileName,
          contentType,
          stream,
          data.attachable_ref!.entity_ref_type,
          data.attachable_ref!.entity_ref_value,
          (err: any, result: any) => err ? reject(err) : resolve(result),
        );
      });

      // qbo.upload returns { AttachableResponse: [{ Attachable: {...} }], time: "..." } shape.
      const created = uploadResponse?.AttachableResponse?.[0]?.Attachable ?? uploadResponse;

      // Optional patches that /upload doesn't honor inline: include_on_send, note, category.
      const patch: any = {};
      const refs = (created?.AttachableRef || []).map((r: any) => ({
        ...r,
        ...(typeof data.include_on_send === "boolean" ? { IncludeOnSend: data.include_on_send } : {}),
      }));
      if (refs.length && typeof data.include_on_send === "boolean") patch.AttachableRef = refs;
      if (data.note) patch.Note = data.note;
      if (data.category) patch.Category = data.category;

      if (Object.keys(patch).length && created?.Id && created?.SyncToken !== undefined) {
        const updated: any = await new Promise((resolve, reject) => {
          (quickbooks as any).updateAttachable(
            { Id: created.Id, SyncToken: created.SyncToken, ...created, ...patch },
            (err: any, result: any) => err ? reject(err) : resolve(result),
          );
        });
        return { result: updated, isError: false, error: null };
      }
      return { result: created, isError: false, error: null };
    }

    // BRANCH B — metadata-only: legacy behavior (no file bytes).
    if (!data.file_name) {
      return { result: null, isError: true, error: "file_name is required when file_path is not provided" };
    }
    const payload: any = { FileName: data.file_name };
    if (data.note) payload.Note = data.note;
    if (data.category) payload.Category = data.category;
    if (data.content_type) payload.ContentType = data.content_type;
    if (data.attachable_ref) {
      payload.AttachableRef = [{
        EntityRef: {
          type: data.attachable_ref.entity_ref_type,
          value: data.attachable_ref.entity_ref_value,
        },
        ...(typeof data.include_on_send === "boolean" ? { IncludeOnSend: data.include_on_send } : {}),
      }];
    }

    return new Promise((resolve) => {
      (quickbooks as any).createAttachable(payload, (err: any, created: any) => {
        if (err) resolve({ result: null, isError: true, error: formatError(err) });
        else resolve({ result: created, isError: false, error: null });
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
