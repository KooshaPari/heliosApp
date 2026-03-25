import type { SettingDefinition, SettingsSchema } from "./types.js";

/** Initial application settings schema. */
export const SETTINGS_SCHEMA: SettingsSchema = {
  // biome-ignore lint/style/useNamingConvention: Setting keys mirror external configuration schema names.
  renderer_engine: {
    key: "renderer_engine",
    type: "enum",
    enumValues: ["ghostty", "rio"] as const,
    default: "ghostty",
    description: "Terminal renderer engine",
    reloadPolicy: "restart",
  },
  theme: {
    key: "theme",
    type: "enum",
    enumValues: ["dark", "light", "system"] as const,
    default: "system",
    description: "Application color theme",
    reloadPolicy: "hot",
  },
  "terminal.scrollback_lines": {
    key: "terminal.scrollback_lines",
    type: "number",
    default: 10000,
    description: "Number of scrollback lines to retain",
    reloadPolicy: "hot",
    validation: (value: unknown): boolean =>
      typeof value === "number" && value >= 1000 && value <= 100000,
  },
  "telemetry.enabled": {
    key: "telemetry.enabled",
    type: "boolean",
    default: false,
    description: "Whether anonymous telemetry is collected",
    reloadPolicy: "restart",
  },
};

/** Return the default value for a schema key, or undefined if unknown. */
export function getDefault(key: string): unknown {
  const def: SettingDefinition | undefined = SETTINGS_SCHEMA[key];
  return def?.default;
}

/** Return a map of all schema keys to their default values. */
export function getAllDefaults(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(SETTINGS_SCHEMA)) {
    defaults[k] = v.default;
  }
  return defaults;
}

/** Validate a value against the schema for the given key. */
export function validateValue(key: string, value: unknown): { valid: boolean; reason?: string } {
  const def: SettingDefinition | undefined = SETTINGS_SCHEMA[key];

  // Unknown keys are always valid (forward-compat preservation).
  if (!def) {
    return { valid: true };
  }

  // Reject null and undefined for defined settings.
  if (value === null || value === undefined) {
    return {
      valid: false,
      reason: `${key}: value must not be null or undefined`,
    };
  }

  const validators: Record<
    string,
    (key: string, value: unknown, allowed: readonly string[]) => { valid: boolean; reason?: string }
  > = {
    string: (settingKey, settingValue) =>
      typeof settingValue === "string"
        ? { valid: true }
        : { valid: false, reason: `${settingKey}: expected string` },
    number: (settingKey, settingValue, _allowed) => {
      if (
        typeof settingValue !== "number" ||
        Number.isNaN(settingValue) ||
        !Number.isFinite(settingValue)
      ) {
        return { valid: false, reason: `${settingKey}: expected finite number` };
      }
      if (def.validation && !def.validation(settingValue)) {
        return { valid: false, reason: `${settingKey}: failed range validation` };
      }
      return { valid: true };
    },
    boolean: (settingKey, settingValue) =>
      typeof settingValue === "boolean"
        ? { valid: true }
        : { valid: false, reason: `${settingKey}: expected boolean` },
    enum: (settingKey, settingValue, allowed) => {
      if (allowed.includes(String(settingValue))) {
        return { valid: true };
      }
      break;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        return { valid: false, reason: `${key}: expected boolean` };
      }
      break;
    }
    case "enum": {
      if (!def.enumValues || !def.enumValues.includes(value as string)) {
        return {
          valid: false,
          reason: `${key}: expected one of [${(def.enumValues ?? []).join(", ")}]`,
        };
      }
      break;
    }
  }

  const enumValues = (def.enumValues ?? []) as readonly string[];
  const validator = validators[def.type] ?? validators.default;
  return validator(key, value, enumValues);
}
