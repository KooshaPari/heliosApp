export async function probeEndpoint(endpoint: string): Promise<boolean> {
  // Mock implementation: always return true for test endpoints
  if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
    return true;
  }

  // In a real implementation, this would make a lightweight HTTP request
  return true;
}
