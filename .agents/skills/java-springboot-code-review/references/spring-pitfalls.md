# Spring Boot Pitfalls — Deep Reference

Read this file when the code under review involves complex Spring behavior: transactions,
proxies, async, security, caching, or context loading.

---

## Table of Contents
1. Transaction Pitfalls
2. Proxy & AOP Pitfalls
3. Bean Lifecycle & Scope Pitfalls
4. JPA / Hibernate Pitfalls
5. Security Pitfalls
6. Async & Scheduling Pitfalls
7. Caching Pitfalls
8. Configuration Pitfalls

---

## 1. Transaction Pitfalls

### Self-invocation bypass
`@Transactional` works via Spring AOP proxy. If method A (non-transactional) calls method B
(`@Transactional`) in the **same class**, the proxy is bypassed and B runs without a transaction.
**Fix**: Inject self (`@Autowired MyService self`) or restructure into two beans.

### Checked exceptions don't rollback by default
Spring only rolls back on `RuntimeException` and `Error` by default.
`@Transactional(rollbackFor = Exception.class)` is needed for checked exceptions.

### Wrong propagation
- `REQUIRES_NEW` creates a new transaction but the outer one is still suspended — exceptions
  in outer don't rollback inner and vice versa.
- `NOT_SUPPORTED` runs outside a transaction even if caller has one.
- Misuse of these can cause partial saves that are never rolled back.

### @Transactional on private methods
Has no effect with proxy-based transaction management — proxies cannot intercept private methods.
Public methods are the portable choice. Spring 6 class-based proxies also support protected and
package-visible methods by default; JDK proxies require public interface methods. Verify proxy mode.

### @Transactional on interface vs implementation
For current Spring proxy-based transaction management, interface annotations can be recognized
with both JDK and class-based proxies. Concrete-class annotations remain the recommended,
portable choice, especially with AspectJ weaving. Verify the Spring version and proxy/weaving
mode; do not report an interface annotation alone as a broken transaction.

### Transaction timeout ignored
`@Transactional(timeout = 5)` — if the DB driver doesn't support it, it silently does nothing.
Verify driver compatibility.

---

## 2. Proxy & AOP Pitfalls

### Self-invocation (all AOP annotations)
Applies to: `@Transactional`, `@Cacheable`, `@Async`, `@Secured`, `@PreAuthorize`, `@Retryable`.
All are proxy-based. Calling the annotated method from within the same class bypasses the proxy.

### Final classes / methods
CGLIB cannot proxy final classes or methods. Spring Boot will usually warn, but sometimes silently
creates a broken proxy. Always check if a Spring-managed bean's methods are unintentionally final.

---

## 3. Bean Lifecycle & Scope Pitfalls

### Singleton with mutable state
A `@Service` or `@Component` is a singleton by default — shared across all threads.
Storing request-specific state in instance fields is a classic concurrency bug.

### Prototype bean injected into singleton
The prototype bean is only created once (at injection time), effectively becoming a singleton.
Use `ObjectFactory<MyBean>` or `ApplicationContext.getBean()` to get a new instance each time.

### @RequestScope / @SessionScope in singleton
Will cause a proxy to be created, but if used incorrectly (e.g., accessed outside request thread),
will throw `ScopeNotActiveException` at runtime.

### @PostConstruct ordering
If bean A depends on bean B and both have `@PostConstruct`, execution order is not guaranteed
unless `@DependsOn("beanB")` is specified.

---

## 4. JPA / Hibernate Pitfalls

### LazyInitializationException
Accessing a `LAZY` relationship outside of an active Hibernate session (e.g., after the transaction
ends, in a controller layer) throws this at runtime. Fix: use `JOIN FETCH`, `@EntityGraph`,
or `@Transactional` at the service level that wraps the full operation.

### N+1 Query Problem
Loading a list of entities and then accessing a lazy collection on each = N additional queries.
Fix: `JOIN FETCH` in JPQL or `@EntityGraph` on the repository method.

### CascadeType.ALL on @ManyToOne
Rarely correct. Cascading REMOVE on a many-to-one can delete a shared parent entity when
a child is deleted. Use `CascadeType.ALL` only on the "owns" side (typically `@OneToMany`).

### orphanRemoval = true misuse
Setting `orphanRemoval = true` on a collection means removing an item from the collection
**deletes it from the database**. If the entity is referenced elsewhere, this causes FK violations.

### equals/hashCode on JPA entities
If `equals`/`hashCode` use the `id` field, a new (unpersisted) entity has `id = null`,
causing broken behavior in sets and maps. Use a natural business key or UUID assigned at creation.

### Dirty checking with detached entities
Modifying a detached entity and calling `save()` will issue an UPDATE for the entire entity —
even fields you didn't intend to change. Use DTOs and selective updates.

---

## 5. Security Pitfalls

### @PreAuthorize on private methods
Like `@Transactional`, `@PreAuthorize` uses AOP and is bypassed for private methods and
self-invocations.

### Mass assignment via @RequestBody to Entity
Accepting an entity directly in a controller from user input allows the user to set any field,
including `id`, `role`, `createdAt`, etc. Always use a DTO and map manually.

### IDOR (Insecure Direct Object Reference)
Fetching a resource by ID from user input without checking ownership:
```java
// VULNERABLE
return orderRepo.findById(id); // user can access any order by guessing ID
// SAFE
return orderRepo.findByIdAndUserId(id, currentUserId);
```

### Sensitive data in logs
`log.info("User data: {}", user)` — if `User.toString()` includes passwords, tokens, or PII,
this creates a security leak in log files.

### @CrossOrigin("*") in production
Review origins against the API's actual authentication and credential policy. Wildcard origins
cannot be combined with credentialed CORS using `Access-Control-Allow-Origin: *`. A public API
using explicitly supplied bearer tokens is not inherently vulnerable solely because it permits
wildcard origins; prove the unwanted cross-origin access and its impact before reporting.

---

## 6. Async & Scheduling Pitfalls

### @Async self-invocation
Same proxy bypass problem. `this.asyncMethod()` will NOT run asynchronously.

### @Async without @EnableAsync
The annotation is silently ignored if `@EnableAsync` is not on a `@Configuration` class.

### Unhandled exceptions in @Async
Exceptions thrown in `@Async void` methods are silently swallowed unless an
`AsyncUncaughtExceptionHandler` is configured.

### @Scheduled without distributed lock
In a multi-instance deployment (multiple pods/nodes), a `@Scheduled` task runs on ALL instances
simultaneously. Use ShedLock or Quartz for distributed scheduling.

### Scheduled task overlap
A synchronous periodic task scheduled through a typical ScheduledThreadPoolExecutor does not
overlap with itself solely because it exceeds a fixed-rate interval. Overlap can arise from
`@Async`, multiple independent triggers, reactive scheduling, custom schedulers, or multiple
application instances. Inspect actual configuration before reporting. `fixedDelay` expresses
a completion-to-next-start delay; it is not a distributed lock.

---

## 7. Caching Pitfalls

### @Cacheable on method that modifies state
Read-only methods should be `@Cacheable`. Write methods should use `@CacheEvict` or `@CachePut`.
With `@Cacheable`, a cache hit skips the method body entirely, potentially suppressing required
mutations. Verify actual call paths and cache behavior before reporting.

### Wrong cache key
Default key is all method arguments. If two methods share a cache name but have different
argument types, keys can collide or produce unexpected results. Always specify `key` explicitly.

### Caching null results
By default, Spring caches `null` returns. If a downstream service returns null during
a transient failure, subsequent calls will serve a cached null indefinitely.
Use `unless = "#result == null"`.

### @Cacheable self-invocation
Same proxy issue — `this.cachedMethod()` bypasses the cache.

---

## 8. Configuration Pitfalls

### @Value on static fields
Does not work. Spring cannot inject values into static fields via `@Value`.

### @ConfigurationProperties without validation
Without `@Validated` on the properties class and `@NotNull`/`@NotBlank` on fields,
a misconfigured application will start with null config and fail at runtime, not startup.

### Profile-specific beans with no default
If a bean is `@Profile("prod")` and no default profile bean exists, any test or dev run
will fail with `NoSuchBeanDefinitionException`.

### Circular dependencies
Spring Boot 2.6+ disallows circular dependencies by default. If present, it indicates
a design issue — usually a service layer that should be split.
