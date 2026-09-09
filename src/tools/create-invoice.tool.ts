import { createQuickbooksInvoice } from "../handlers/create-quickbooks-invoice.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "create_invoice";
const toolDescription = "Create an invoice in QuickBooks Online.";

const lineItemSchema = z.object({
  item_ref: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  description: z.string().optional(),
  linked_txn_id: z.string().optional().describe("TimeActivity ID to link this line to — when present, invoice line carries LinkedTxn and flips HasBeenBilled on the TA"),
  service_date: z.string().optional().describe("Date the work/goods were actually delivered (YYYY-MM-DD) — sets SalesItemLineDetail.ServiceDate. Distinct from the invoice TxnDate; put the real service date here rather than only in the description."),
  class_ref: z.string().optional().describe("Class ID for this line (sets SalesItemLineDetail.ClassRef). Requires QBO class tracking to be set to per-line, not per-transaction."),
});

const toolSchema = z.object({
  customer_ref: z.string().min(1),
  line_items: z.array(lineItemSchema).min(1),
  doc_number: z.string().optional(),
  txn_date: z.string().optional(),
  private_note: z.string().optional().describe("Internal memo on the invoice (PrivateNote) — not visible to customer"),
});

const toolHandler = async ({ params }: any) => {
  const response = await createQuickbooksInvoice(params);
  if (response.isError) {
    return { content: [{ type: "text" as const, text: `Error creating invoice: ${response.error}` }] };
  }
  return {
    content: [
      { type: "text" as const, text: `Invoice created successfully:` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const CreateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 