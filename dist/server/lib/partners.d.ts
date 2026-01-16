/**
 * Partners module.
 *
 * This module provides partner definitions for external integrations.
 */
export type PartnerFieldDefinition = {
    key: string;
    label: string;
    type: 'text' | 'secret' | 'number' | 'json';
    required?: boolean;
    description?: string;
};
export type PartnerDefinition = {
    id: string;
    label: string;
    description?: string;
    fields: PartnerFieldDefinition[];
    verify?: {
        kind: 'http' | 'command';
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        command?: string;
        envPrefix?: string;
    };
};
/**
 * Load partner definitions.
 * Currently returns an empty array as a stub.
 */
export declare function loadPartnerDefinitions(): PartnerDefinition[];
/**
 * Interpolate a template string with credential values.
 * Replaces ${key} with the value from credentials[key].
 */
export declare function interpolateTemplate(template: string, credentials: Record<string, unknown>): string;
/**
 * Check which required fields are missing from credentials.
 */
export declare function missingRequiredFields(fields: PartnerFieldDefinition[], credentials: Record<string, unknown>): string[];
//# sourceMappingURL=partners.d.ts.map