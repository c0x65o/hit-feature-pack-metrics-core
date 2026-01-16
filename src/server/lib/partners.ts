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
export function loadPartnerDefinitions(): PartnerDefinition[] {
  // Stub implementation: return empty array
  // Applications can extend this by providing their own partner definitions
  return [];
}

/**
 * Interpolate a template string with credential values.
 * Replaces ${key} with the value from credentials[key].
 */
export function interpolateTemplate(template: string, credentials: Record<string, unknown>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
    const value = credentials[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

/**
 * Check which required fields are missing from credentials.
 */
export function missingRequiredFields(fields: PartnerFieldDefinition[], credentials: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const field of fields) {
    if (!field.required) continue;
    const value = credentials[field.key];
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
      missing.push(field.key);
    }
  }
  return missing;
}
