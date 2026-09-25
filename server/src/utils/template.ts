import type { ILeadDocument } from '../models/lead.model.js';
import type { IUserDocument } from '../models/user.model.js';
import type { IBrokerageDocument } from '../models/brokerage.model.js';

export interface TemplateContextParams {
  lead: ILeadDocument;
  advisor?: IUserDocument | null | undefined;
  brokerage?: IBrokerageDocument | null | undefined;
  previousStage?: string | null | undefined;
  newStage?: string | undefined;
  extra?: Record<string, unknown> | undefined;
}

const FORBIDDEN_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'toLocaleString',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'hasOwnProperty',
]);

const SENSITIVE_KEY_REGEX = /(password|token|secret|hash|apiKey|auth|creditCard|ssn)/i;

/**
 * Resolves a dotted path in an object (e.g. 'lead.firstName' or 'customFields.loanAmount').
 * Defends against prototype pollution, internal method access, and inherited properties.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    if (FORBIDDEN_PROPERTIES.has(part)) {
      return undefined;
    }
    // Handle Mongoose Map if customFields is a Map
    if (current instanceof Map) {
      if (!current.has(part)) {
        return undefined;
      }
      current = current.get(part);
    } else {
      if (!Object.prototype.hasOwnProperty.call(current, part)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Tests whether a template string contains any interpolation placeholders.
 */
export function hasPlaceholders(template: string): boolean {
  if (!template) {
    return false;
  }
  return /\{\{\s*[a-zA-Z0-9_.-]+\s*\}\}/.test(template);
}

/**
 * Renders a template string by replacing `{{variable}}` and `{{nested.path}}` placeholders
 * with values from the provided data context.
 * Missing variables, functions, and forbidden properties are safely resolved to empty string `""`.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  if (!template) {
    return '';
  }

  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = resolvePath(context, key);
    if (value === undefined || value === null || typeof value === 'function') {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Builds a comprehensive context dictionary containing both nested and flat aliases
 * for lead, advisor, brokerage, stage, and custom attributes.
 * Sanitizes against sensitive secrets (passwords, hashes, tokens, API keys).
 */
export function buildTemplateContext(params: TemplateContextParams): Record<string, unknown> {
  const { lead, advisor, brokerage, previousStage, newStage, extra } = params;

  const leadFullName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
  const advisorName = advisor ? advisor.name : '';
  const advisorEmail = advisor ? advisor.email : '';
  const brokerageName = brokerage ? brokerage.name : '';

  // Extract custom fields cleanly, sanitizing against sensitive keys and prototype properties
  const customFields: Record<string, unknown> = {};
  if (lead.customFields) {
    if (lead.customFields instanceof Map) {
      for (const [k, v] of lead.customFields.entries()) {
        if (!SENSITIVE_KEY_REGEX.test(k) && !FORBIDDEN_PROPERTIES.has(k)) {
          customFields[k] = v;
        }
      }
    } else if (typeof lead.customFields === 'object') {
      for (const [k, v] of Object.entries(lead.customFields)) {
        if (!SENSITIVE_KEY_REGEX.test(k) && !FORBIDDEN_PROPERTIES.has(k)) {
          customFields[k] = v;
        }
      }
    }
  }

  // Sanitize extra properties
  const safeExtra: Record<string, unknown> = {};
  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra)) {
      if (!SENSITIVE_KEY_REGEX.test(k) && !FORBIDDEN_PROPERTIES.has(k)) {
        safeExtra[k] = v;
      }
    }
  }

  const context: Record<string, unknown> = {
    // Nested objects
    lead: {
      id: lead._id.toString(),
      firstName: lead.firstName,
      lastName: lead.lastName,
      fullName: leadFullName,
      name: leadFullName,
      email: lead.email,
      phone: lead.phone || '',
      status: lead.status,
      source: lead.source,
      score: lead.score,
      notes: lead.notes || '',
    },
    advisor: {
      id: advisor ? advisor._id.toString() : '',
      name: advisorName,
      email: advisorEmail,
    },
    brokerage: {
      id: brokerage ? brokerage._id.toString() : '',
      name: brokerageName,
      slug: brokerage ? brokerage.slug : '',
    },
    customFields,

    // Flat convenience aliases for templates using {{firstName}} instead of {{lead.firstName}}
    firstName: lead.firstName,
    lastName: lead.lastName,
    fullName: leadFullName,
    name: leadFullName,
    email: lead.email,
    phone: lead.phone || '',
    score: lead.score,
    source: lead.source,
    stage: newStage || lead.status,
    previousStage: previousStage || '',
    newStage: newStage || lead.status,
    advisorName,
    advisorEmail,
    brokerageName,

    // Any custom fields flattened as fallback if non-conflicting
    ...customFields,

    // Additional safe extra properties if provided
    ...safeExtra,
  };

  return context;
}

