import { createQuickbooksAttachable } from "../handlers/create-quickbooks-attachable.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "create_attachable";
const toolDescription = "Create a new attachable in QuickBooks Online. When file_path is provided, the file bytes are uploaded via the /upload endpoint and linked to the entity. When file_path is omitted, only an Attachable metadata record is created (note/link only, no file).";
const toolSchema = z.object({
  file_name: z.string().min(1).optional().describe("File name shown in QBO. If omitted and file_path is provided, the basename of file_path is used."),
  file_path: z.string().optional().describe("Absolute local path to the file to upload. When set, the handler reads the bytes and calls qbo.upload(); otherwise a metadata-only Attachable is created."),
  note: z.string().optional().describe("Note about the attachment"),
  category: z.string().optional().describe("Attachment category"),
  content_type: z.string().optional().describe("MIME content type. Inferred from file_path extension if omitted."),
  include_on_send: z.boolean().optional().describe("If true, the attachment is included when the linked entity is emailed/sent. Defaults to false."),
  attachable_ref: z.object({
    entity_ref_type: z.string().describe("Entity type (e.g., 'Invoice', 'Bill')"),
    entity_ref_value: z.string().describe("Entity ID to attach to"),
  }).optional().describe("Reference to entity to attach to. Required when file_path is set."),
});

const toolHandler = async ({ params }: any) => {
  const response = await createQuickbooksAttachable(params);
  if (response.isError) return { content: [{ type: "text" as const, text: `Error: ${response.error}` }] };
  return { content: [{ type: "text" as const, text: `Attachable created:` }, { type: "text" as const, text: JSON.stringify(response.result, null, 2) }] };
};

export const CreateAttachableTool: ToolDefinition<typeof toolSchema> = { name: toolName, description: toolDescription, schema: toolSchema, handler: toolHandler };
