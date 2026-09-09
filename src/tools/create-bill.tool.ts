import { createQuickbooksBill } from "../handlers/create-quickbooks-bill.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "create-bill";
const toolDescription = "Create a bill in QuickBooks Online.";

// Shared ref shape used across bill fields
const refSchema = z.object({ value: z.string(), name: z.string().optional() });

const toolSchema = z.object({
  bill: z.object({
    Line: z.array(z.object({
      Amount: z.number(),
      DetailType: z.string(),
      Description: z.string().optional(),
      // AccountRef used for AccountBasedExpenseLineDetail (simple expense account lines)
      AccountRef: z.object({
        value: z.string(),
        name: z.string().optional(),
      }).optional(),
      // ItemBasedExpenseLineDetail — used for billable material/sub bills with project tagging
      ItemBasedExpenseLineDetail: z.object({
        ItemRef: refSchema.optional().describe("Service/Item ID (e.g. '56' for Building Materials)"),
        ClassRef: refSchema.optional().describe("MasterFormat class ID"),
        CustomerRef: refSchema.optional().describe("Customer:Job sub-customer ID"),
        BillableStatus: z.enum(["Billable", "NotBillable", "HasBeenBilled"]).optional(),
        MarkupInfo: z.object({
          Percent: z.number().optional(),
        }).optional().describe("Markup percentage — use { Percent: 12 } not MarkupPercent"),
        UnitPrice: z.number().optional(),
        Qty: z.number().optional(),
        TaxCodeRef: refSchema.optional(),
      }).optional(),
      // AccountBasedExpenseLineDetail — alternative to AccountRef for account-based lines
      AccountBasedExpenseLineDetail: z.object({
        AccountRef: refSchema,
        ClassRef: refSchema.optional(),
        CustomerRef: refSchema.optional(),
        BillableStatus: z.enum(["Billable", "NotBillable", "HasBeenBilled"]).optional(),
        MarkupInfo: z.object({ Percent: z.number().optional() }).optional(),
        TaxCodeRef: refSchema.optional(),
      }).optional(),
    })),
    VendorRef: z.object({
      value: z.string(),
      name: z.string().optional(),
    }),
    TxnDate: z.string().optional().describe("Bill date (YYYY-MM-DD)"),
    DueDate: z.string().optional(),
    DocNumber: z.string().optional().describe("Vendor invoice number"),
    DepartmentRef: refSchema.optional().describe("Department/Location ID (e.g. '11' for 1773 Donner Dr)"),
    PrivateNote: z.string().optional().describe("Internal memo not visible on printed bill"),
    Balance: z.number().optional(),
    TotalAmt: z.number().optional(),
    APAccountRef: refSchema.optional(),
    SalesTermRef: refSchema.optional(),
    CurrencyRef: refSchema.optional(),
  }),
});

const toolHandler = async (args: { [x: string]: any }) => {
  const response = await createQuickbooksBill(args.bill);

  if (response.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating bill: ${response.error}`,
        },
      ],
    };
  }

  const bill = response.result;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(bill),
      }
    ],
  };
};

export const CreateBillTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 