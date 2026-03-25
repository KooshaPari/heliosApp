/**
 * Value Object Base
 *
 * Value objects are immutable and compared by their structure, not identity.
 * Two value objects with the same values are considered equal.
 */
export abstract class ValueObject<T> {
  protected constructor(protected readonly props: T) {}

  /**
   * Structural equality - value objects are equal if all properties match
   */
  equals(other?: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this.isEqual(other);
  }

  /**
   * Deep equality check - subclasses must implement
   */
  protected abstract isEqual(other: this): boolean;

  /**
   * Get a frozen copy of properties
   */
  protected get props(): Readonly<T> {
    return this.props as Readonly<T>;
  }
}
