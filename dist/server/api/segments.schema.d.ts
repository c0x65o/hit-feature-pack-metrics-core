import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    key: z.ZodString;
    entityKind: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rule: z.ZodObject<{
        kind: z.ZodString;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        kind: z.ZodString;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        kind: z.ZodString;
    }, z.ZodTypeAny, "passthrough">>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    key: string;
    label: string;
    entityKind: string;
    rule: {
        kind: string;
    } & {
        [k: string]: unknown;
    };
    isActive: boolean;
    description?: string | null | undefined;
}, {
    key: string;
    label: string;
    entityKind: string;
    rule: {
        kind: string;
    } & {
        [k: string]: unknown;
    };
    description?: string | null | undefined;
    isActive?: boolean | undefined;
}>;
//# sourceMappingURL=segments.schema.d.ts.map