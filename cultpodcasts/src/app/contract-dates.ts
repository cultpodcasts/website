/**
 * Generated `@cultpodcasts/contracts` types describe the JSON wire format, so date-times are ISO strings.
 * {@link JsonDateInterceptor} turns those strings into `Date` objects before the app sees the body, so a type for
 * the value the app actually receives replaces the date keys `K` of `T` with `Date` (keeping `null` / `undefined`).
 *
 * Name the date keys explicitly: the interceptor converts by value shape, not by key, and a generated type cannot
 * tell a date-time string from any other string.
 */
export type WithDates<T, K extends keyof T> = Omit<T, K> & { [P in K]: DateOf<T[P]> };

/** `string` becomes `Date`; `null` and `undefined` are kept. */
export type DateOf<V> = V extends string ? Date : V;
