import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    tableId: z.ZodString;
    columnKey: z.ZodString;
    entityKind: z.ZodString;
    entityIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    entityKind: string;
    tableId: string;
    columnKey: string;
    entityIds: string[];
}, {
    entityKind: string;
    tableId: string;
    columnKey: string;
    entityIds: string[];
}>;
//# sourceMappingURL=segments-table-buckets-evaluate.schema.d.ts.map