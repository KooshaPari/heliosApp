export function sanitizeString(input: string, maxLength?: number): string {
  let result = input.trim();
  if (maxLength && result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  return result.replace(/[<>&"']/g, char => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&#x27;",
    };
    return entities[char] || char;
  });
}

export function sanitizeObject(
  obj: Record<string, unknown>,
  fieldLimits?: Record<string, number>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value, fieldLimits?.[key]);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>, fieldLimits);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function validateId(id: string, prefix?: string): boolean {
  if (!id || typeof id !== "string" || id.trim() === "") {
    return false;
  }
  if (id.length > 100) {
    return false;
  }
  if (prefix && !id.startsWith(prefix)) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function validateWorkspaceId(workspaceId: string): boolean {
  return validateId(workspaceId);
}

export function validateLaneId(laneId: string): boolean {
  return validateId(laneId);
}

export function validateSessionId(sessionId: string): boolean {
  return validateId(sessionId);
}

export function validateTerminalId(terminalId: string): boolean {
  return validateId(terminalId);
}

export function sanitizeTerminalInput(data: string): string {
  const maxLength = 10000;
  return sanitizeString(data, maxLength);
}
