export type PartnerFieldType = 'text' | 'secret' | 'number' | 'json';
export type PartnerFieldDefinition = {
    key: string;
    label: string;
    type: PartnerFieldType;
    required?: boolean;
    description?: string;
};
export type PartnerVerifyConfig = {
    kind: 'http';
    method?: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
} | {
    kind: 'command';
    command: string;
    envPrefix?: string;
};
export type PartnerDefinition = {
    id: string;
    label: string;
    description?: string;
    fields: PartnerFieldDefinition[];
    verify?: PartnerVerifyConfig;
};
export declare function loadPartnerDefinitions(cwd?: string): PartnerDefinition[];
export declare function interpolateTemplate(template: string, creds: Record<string, unknown>): string;
//# sourceMappingURL=partners.d.ts.map