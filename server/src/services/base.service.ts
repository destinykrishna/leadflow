/**
 * Base domain service interface marker.
 * Domain services encapsulate business logic across models and repositories.
 */
export interface IDomainService {
  readonly serviceName: string;
}
