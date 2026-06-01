# Proposal: CRUD Personas (Empleadas + Clientes)

## Intent

Salon owners need staff and client management per salon. Empleadas CRUD handles hire, role changes, and deactivation with role-based compensation visibility. Clientes CRUD powers the WhatsApp bot via phone lookups and provides the customer database for loyalty tracking.

## Scope

### In Scope
- Empleadas: List (by salon, role/active filter), Get, Create (bcrypt), Update, Toggle active
- Clientes: List (paginated, searchable), Get, Create, Update, SearchByPhone, FindOrCreate (n8n)
- 2 controllers + 2 domain ports + 2 TypeORM repos
- Routes: `/api/salones/:salonId/empleadas` and `/api/salones/:salonId/clientes`
- DTOs excluding passwordHash; compensation fields filtered by role

### Out of Scope
- Password reset, employee login, loyalty logic, no-show automation, frontend pages

## Capabilities

### New Capabilities
- `empleadas-crud`: Staff CRUD with role-based access, password hashing, compensation field visibility
- `clientes-crud`: Client CRUD with phone search and n8n FindOrCreate endpoint

### Modified Capabilities
- None — entities exist. New ports avoid coupling with auth module.

## Approach

Single `modules/personas/` hexagonal module following `catalogo` pattern. New `IEmpleadaRepository`/`IClienteRepository` ports (not extending auth interfaces). 11 use cases, thin controllers. Compensation fields visible only to DUEÑA/ADMIN. Password hashed on create; rehashed on update only if field present. Phone search via query param. FindOrCreate transactional with unique `(salonId, telefono)` index.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/personas/` | New | Hexagonal module (~20 files) |
| `apps/api/src/shared/container.ts` | Modified | DI registration |
| `apps/api/src/app.ts` | Modified | Mount routes |
| `packages/validation/src/` | Modified | Add personas.schema.ts |
| Database | Modified | Unique indexes on `(salonId, numeroWhatsApp)` and `(salonId, telefono)` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| n8n FindOrCreate race condition | Medium | DB unique index + transaction |
| Role escalation by ADMIN | Low | Cannot assign role ≥ own role |
| Password leak in responses | Low | DTO strips passwordHash |
| Self-deactivation | Low | Guard: `targetId !== currentUserId` |

## Rollback Plan

Remove routes from app.ts. Revert container registrations. Drop `personas/` directory. No data migration — entities unchanged.

## Dependencies

- Existing UsuarioEntity, ClienteEntity, SalonEntity
- bcrypt, Rol enum, requireRole/validate middleware (all present)

## Success Criteria

- [ ] 11 use cases implemented
- [ ] Password hashed on create; rehashed on update only when field present
- [ ] Compensation fields hidden for non-DUEÑA/non-ADMIN roles
- [ ] Phone search returns correct cliente or null
- [ ] 50+ tests passing
- [ ] Tenant isolation enforced on all endpoints
