/**
 * Domain Entity Base
 *
 * Entities have identity that persists across state changes.
 * Two entities with the same ID are considered equal.
 */
export abstract class Entity<T> {
  protected constructor(protected readonly _id: T) {}

  get id(): T {
    return this._id;
  }

  /**
   * Structural equality - two entities are equal if they have the same ID
   */
  equals(other?: Entity<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this._id === other._id;
  }

  /**
   * Value equality - subclasses should override this for value-based comparison
   */
  protected abstract isEqual(other: this): boolean;
}
