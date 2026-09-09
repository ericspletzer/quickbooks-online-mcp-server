import { getQuickbooksVendor } from "../handlers/get-quickbooks-vendor.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "get-vendor";
const toolDescription = "Get a vendor by ID from QuickBooks Online.";
const toolSchema = z.object({
  id: z.string(),
});

const toolHandler = async (args: { [x: string]: any }) => {
  // CE patch 2026-04-27: RegisterTool wraps schema in {params:...} so args shape
  // is {params:{id:"..."}}. Read via args.params.id, fallback to args.id
  // for any future SDK version that unwraps automatically.
  const response = await getQuickbooksVendor((args.params ?? args).id);

  if (response.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting vendor: ${response.error}`,
        },
      ],
    };
  }

  const vendor = response.result;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(vendor),
      }
    ],
  };
};

export const GetVendorTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 