import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface CreateInvoiceInput {
  customer_ref: string; // customer id
  line_items: Array<{
    item_ref: string; // item id
    qty: number;
    unit_price: number;
    description?: string;
    linked_txn_id?: string; // TimeActivity ID to link — flips HasBeenBilled on that TA
    service_date?: string; // YYYY-MM-DD — SalesItemLineDetail.ServiceDate (when the work was actually done)
    class_ref?: string; // Class id — SalesItemLineDetail.ClassRef (requires per-line class tracking in QBO)
  }>;
  doc_number?: string;
  txn_date?: string; // YYYY-MM-DD
  private_note?: string;
}

// Primitive field type map (based on Quickbooks Invoice entity reference docs)
const invoiceFieldTypeMap: Record<string, "string" | "number" | "boolean"> = {
  DocNumber: "string",
  TxnDate: "string",
  PrivateNote: "string",
  GlobalTaxCalculation: "string",
  ApplyTaxAfterDiscount: "boolean",
  TotalAmt: "number",
};

/**
 * Coerce primitive invoice fields to the expected QuickBooks Online types.
 */
function normalizeInvoiceFields(obj: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = { ...obj };
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const expected = invoiceFieldTypeMap[key];
    if (!expected) continue; // skip if not a primitive field we validate

    switch (expected) {
      case "string":
        normalized[key] = String(value);
        break;
      case "number":
        normalized[key] = typeof value === "number" ? value : Number(value);
        break;
      case "boolean":
        normalized[key] = typeof value === "boolean" ? value : value === "true";
        break;
    }
  }
  return normalized;
}

export async function createQuickbooksInvoice(data: CreateInvoiceInput): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    // QBO requires LinkedTxn at the invoice root, not per-line. Line-level LinkedTxn is silently dropped,
    // leaving the linked TimeActivities at HasBeenBilled=false. Verified against working precedent inv 85981.
    const linkedTxns = data.line_items
      .filter((l) => l.linked_txn_id)
      .map((l) => ({ TxnId: l.linked_txn_id as string, TxnType: "TimeActivity" }));

    const invoicePayload: any = {
      CustomerRef: { value: data.customer_ref },
      Line: data.line_items.map((l, idx) => ({
        Id: `${idx + 1}`,
        LineNum: idx + 1,
        Description: l.description || undefined,
        Amount: l.qty * l.unit_price,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: l.item_ref },
          Qty: l.qty,
          UnitPrice: l.unit_price,
          ...(l.service_date && { ServiceDate: l.service_date }),
          ...(l.class_ref && { ClassRef: { value: l.class_ref } }),
        },
      })),
      ...(linkedTxns.length > 0 && { LinkedTxn: linkedTxns }),
      DocNumber: data.doc_number,
      TxnDate: data.txn_date,
      PrivateNote: data.private_note,
    };

    const normalizedPayload = normalizeInvoiceFields(invoicePayload);

    return new Promise((resolve) => {
      (quickbooks as any).createInvoice(normalizedPayload, (err: any, created: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          resolve({ result: created, isError: false, error: null });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
} 