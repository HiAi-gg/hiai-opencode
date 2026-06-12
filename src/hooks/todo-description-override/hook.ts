import { TODOWRITE_DESCRIPTION } from "./description";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSchemaForGemini(schema: unknown): unknown {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchemaForGemini(item));
  }

  const copy = { ...schema as Record<string, unknown> };

  const isObjectType = (typeVal: unknown): boolean =>
    typeof typeVal === "string" &&
    (typeVal.toLowerCase() === "object" || typeVal.toUpperCase() === "OBJECT");

  const isNullType = (typeVal: unknown): boolean =>
    typeof typeVal === "string" &&
    (typeVal.toLowerCase() === "null" || typeVal.toUpperCase() === "NULL");

  // 1. Simplify anyOf / any_of to avoid Gemini schema errors
  const anyOfKey = "anyOf" in copy ? "anyOf" : ("any_of" in copy ? "any_of" : null);
  if (anyOfKey) {
    const rawAnyOf = copy[anyOfKey];
    if (Array.isArray(rawAnyOf)) {
      const items = rawAnyOf.map((item) => sanitizeSchemaForGemini(item));
      const objectItems = items.filter(
        (item) => isRecord(item) && (isObjectType(item.type) || item.properties)
      );
      
      if (objectItems.length > 0) {
        const mergedProperties: Record<string, unknown> = {};
        const mergedRequired: string[] = [];
        for (const obj of objectItems) {
          if (isRecord(obj) && obj.properties && typeof obj.properties === "object") {
            Object.assign(mergedProperties, obj.properties);
          }
          if (isRecord(obj) && Array.isArray(obj.required)) {
            mergedRequired.push(...obj.required as string[]);
          }
        }
        copy.type = "object";
        copy.properties = mergedProperties;
        if (mergedRequired.length > 0) {
          copy.required = Array.from(new Set(mergedRequired));
        }
        delete copy.anyOf;
        delete copy.any_of;
      } else {
        const firstValidItem = items.find(
          (item) => isRecord(item) && !isNullType(item.type)
        );
        if (firstValidItem) {
          Object.assign(copy, firstValidItem);
        } else if (items.length > 0) {
          Object.assign(copy, items[0]);
        }
        delete copy.anyOf;
        delete copy.any_of;
      }
    }
  }

  // 2. Simplify oneOf / one_of / allOf / all_of
  const oneOfKey = "oneOf" in copy ? "oneOf" : ("one_of" in copy ? "one_of" : null);
  if (oneOfKey) {
    const rawOneOf = copy[oneOfKey];
    if (Array.isArray(rawOneOf)) {
      const items = rawOneOf.map((item) => sanitizeSchemaForGemini(item));
      const firstValidItem = items.find(
        (item) => isRecord(item) && !isNullType(item.type)
      );
      if (firstValidItem) {
        Object.assign(copy, firstValidItem);
      } else if (items.length > 0) {
        Object.assign(copy, items[0]);
      }
      delete copy.oneOf;
      delete copy.one_of;
    }
  }

  const allOfKey = "allOf" in copy ? "allOf" : ("all_of" in copy ? "all_of" : null);
  if (allOfKey) {
    const rawAllOf = copy[allOfKey];
    if (Array.isArray(rawAllOf)) {
      const items = rawAllOf.map((item) => sanitizeSchemaForGemini(item));
      const mergedProperties: Record<string, unknown> = {};
      const mergedRequired: string[] = [];
      for (const item of items) {
        if (isRecord(item) && item.properties && typeof item.properties === "object") {
          Object.assign(mergedProperties, item.properties);
        }
        if (isRecord(item) && Array.isArray(item.required)) {
          mergedRequired.push(...item.required as string[]);
        }
      }
      copy.type = "object";
      copy.properties = mergedProperties;
      if (mergedRequired.length > 0) {
        copy.required = Array.from(new Set(mergedRequired));
      }
      delete copy.allOf;
      delete copy.all_of;
    }
  }

  // 3. Clean up required fields to match Gemini specification (must have type: object and exist in properties)
  if (copy.required && Array.isArray(copy.required)) {
    if (!isObjectType(copy.type) && !copy.properties) {
      delete copy.required;
    } else {
      const properties = (copy.properties && typeof copy.properties === "object" ? copy.properties : {}) as Record<string, unknown>;
      const requiredList = copy.required as unknown[];
      const filtered = requiredList.filter((prop) => typeof prop === "string" && prop in properties);
      if (filtered.length === 0) {
        delete copy.required;
      } else {
        copy.required = filtered;
      }
      copy.type = "object";
    }
  }

  // 4. Recursively sanitize nested properties
  if (copy.properties && typeof copy.properties === "object") {
    const sanitizedProperties: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(copy.properties)) {
      sanitizedProperties[key] = sanitizeSchemaForGemini(prop);
    }
    copy.properties = sanitizedProperties;
  }

  // 5. Recursively sanitize array items
  if (copy.items) {
    copy.items = sanitizeSchemaForGemini(copy.items);
  }

  return copy;
}

export function createTodoDescriptionOverrideHook() {
  return {
    "tool.definition": async (
      input: { toolID: string },
      output: { description: string; parameters: unknown },
    ) => {
      if (input.toolID === "todowrite") {
        output.description = TODOWRITE_DESCRIPTION;
      }

      // Clean up parameters schema to be fully compatible with Gemini API
      if (output.parameters) {
        output.parameters = sanitizeSchemaForGemini(output.parameters);
      }
    },
  };
}
