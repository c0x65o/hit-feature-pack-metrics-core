import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    tableId: z.ZodString;
    columnKey: z.ZodString;
    entityKind: z.ZodString;
    entityIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=segments-table-metrics.schema.d.ts.map