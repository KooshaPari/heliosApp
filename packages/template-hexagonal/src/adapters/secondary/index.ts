/**
 * Secondary (Driven) Adapters
 *
 * These adapters implement the output ports and are called by the application layer.
 * They handle infrastructure concerns like database access, file system, etc.
 */

// Re-export adapters for use by dependency injection
// Example adapters:
// - PostgresProjectRepository: PostgreSQL implementation
// - InMemoryProjectRepository: In-memory for testing
// - FileSystemStorageAdapter: File system storage
