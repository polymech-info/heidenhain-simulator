/* -------------------------------------------------------------------------
 * aspects.ts
 *
 * A robust “aspect” system supporting:
 *   - before:    optionally modifies arguments (sync or async)
 *   - after:     optionally modifies return value (sync or async)
 *   - around:    complete control over function invocation
 *   - error:     intercept errors (sync or async)
 *
 * Only supports direct function wrappers (e.g. fn = before(fn, ...)).
 * ------------------------------------------------------------------------ */

/* -------------------------------------------------------------------------
 * 1) SIGNALS Enum (string-based to avoid symbol issues)
 * ------------------------------------------------------------------------ */
export enum SIGNALS {
    BEFORE = 'BEFORE',
    AFTER = 'AFTER',
    AROUND = 'AROUND',
    ERROR = 'ERROR',
  }
  
  /* -------------------------------------------------------------------------
   * 2) Basic Types
   * ------------------------------------------------------------------------ */
  type AnyFunction = (...args: any[]) => any;
  
  /**
   * If a function returns a Promise<T>, then its awaited type is T.
   * Otherwise, it's just ReturnType<T>.
   */
  type AwaitedReturn<T extends AnyFunction> =
    T extends (...args: any[]) => Promise<infer U> ? U : ReturnType<T>;
  
  /* -------------------------------------------------------------------------
   * 3) Advice Signatures
   * ------------------------------------------------------------------------ */
  
  /**
   * BEFORE advice:
   *   - Receives `context` (the `this` of the function)
   *   - Receives the original `args`
   *   - Can return either nothing (`void`) or new arguments (`Parameters<T>`)
   *   - Can be async, returning a Promise that resolves to new args or `void`
   */
  export type BeforeAdvice<T extends AnyFunction> = (
    context: ThisParameterType<T>,
    args: Parameters<T>
  ) => void | Parameters<T> | Promise<void | Parameters<T>>;
  
  /**
   * AFTER advice:
   *   - Receives `context`, the original function’s final (awaited) result,
   *     and the original arguments
   *   - Can return a new result (sync or async)
   */
  export type AfterAdvice<T extends AnyFunction> = (
    context: ThisParameterType<T>,
    result: AwaitedReturn<T>,
    args: Parameters<T>
  ) => AwaitedReturn<T> | Promise<AwaitedReturn<T>>;
  
  /**
   * AROUND advice:
   *   - Provides a `proceed(...args)` function that calls the original method
   *   - You can call `proceed` any number of times, or skip it
   *   - Supports both sync and async usage
   */
  export type AroundAdvice<T extends AnyFunction> = (
    proceed: (...args: Parameters<T>) => ReturnType<T>,
    context: ThisParameterType<T>,
    args: Parameters<T>
  ) => ReturnType<T>;
  
  /**
   * ERROR advice:
   *   - Intercepts errors thrown by the original function (sync or async)
   *   - Can return a fallback result or rethrow
   */
  export type ErrorAdvice<T extends AnyFunction> = (
    error: unknown,
    context: ThisParameterType<T>,
    args: Parameters<T>
  ) => ReturnType<T> | void;
  
  /* -------------------------------------------------------------------------
   * 4) ISignalMap: Each signal has a distinct function wrapper signature
   * ------------------------------------------------------------------------ */
  interface ISignalMap {
    [SIGNALS.BEFORE]: <T extends AnyFunction>(original: T, advice: BeforeAdvice<T>) => T;
    [SIGNALS.AFTER]: <T extends AnyFunction>(original: T, advice: AfterAdvice<T>) => T;
    [SIGNALS.AROUND]: <T extends AnyFunction>(original: T, advice: AroundAdvice<T>) => T;
    [SIGNALS.ERROR]: <T extends AnyFunction>(original: T, advice: ErrorAdvice<T>) => T;
  }
  
  /* -------------------------------------------------------------------------
   * 5) The SignalMap Implementation
   *    - This is where the actual "wrapping" logic lives.
   * ------------------------------------------------------------------------ */
  const SignalMap: ISignalMap = {
    /**
     * BEFORE:
     *  - Possibly modifies arguments
     *  - If returns a Promise, we await it before calling original
     *  - If returns an array, we use that as new arguments
     */
    [SIGNALS.BEFORE]<T extends AnyFunction>(original: T, advice: BeforeAdvice<T>): T {
      return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
        const maybeNewArgs = advice(this, args);
  
        if (maybeNewArgs instanceof Promise) {
          return maybeNewArgs.then((resolvedArgs) => {
            const finalArgs = resolvedArgs || args;
            const result = original.apply(this, finalArgs);
            return (result instanceof Promise) ? result : Promise.resolve(result);
          }) as ReturnType<T>;
        } else {
          const finalArgs = Array.isArray(maybeNewArgs) ? maybeNewArgs : args;
          return original.apply(this, finalArgs);
        }
      } as T;
    },
  
    /**
     * AFTER:
     *  - Possibly modifies the return value
     *  - If original is async, we chain on its promise
     *  - Advice can be sync or async
     */
    [SIGNALS.AFTER]<T extends AnyFunction>(original: T, advice: AfterAdvice<T>): T {
      return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
        const result = original.apply(this, args);
  
        if (result instanceof Promise) {
          return result.then((unwrapped) => {
            const maybeNewResult = advice(this, unwrapped, args);
            return (maybeNewResult instanceof Promise) ? maybeNewResult : maybeNewResult;
          }) as ReturnType<T>;
        } else {
          const maybeNewResult = advice(this, result as AwaitedReturn<T>, args);
          if (maybeNewResult instanceof Promise) {
            return maybeNewResult.then(r => r) as ReturnType<T>;
          }
          return maybeNewResult as ReturnType<T>;
        }
      } as T;
    },
  
    /**
     * AROUND:
     *  - Full control over invocation
     *  - Typically you do: proceed(...args)
     *  - If you want to skip or call multiple times, you can
     */
    [SIGNALS.AROUND]<T extends AnyFunction>(original: T, advice: AroundAdvice<T>): T {
      return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
        const proceed = (...innerArgs: Parameters<T>) => original.apply(this, innerArgs);
        return advice(proceed, this, args);
      } as T;
    },
  
    /**
     * ERROR:
     *  - Intercepts errors thrown by the original function or a rejected Promise
     *  - Optionally returns a fallback or rethrows
     */
    [SIGNALS.ERROR]<T extends AnyFunction>(original: T, advice: ErrorAdvice<T>): T {
      return function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
        try {
          const result = original.apply(this, args);
          if (result instanceof Promise) {
            // Handle async rejections
            return result.catch((err: unknown) => {
              return advice(err, this, args);
            }) as ReturnType<T>;
          }
          return result;
        } catch (err) {
          // Synchronous error
          return advice(err, this, args) as ReturnType<T>;
        }
      } as T;
    },
  };
  
  /* -------------------------------------------------------------------------
   * 6) Direct Usage Functions (no decorator support)
   * ------------------------------------------------------------------------ */
  
  /**
   * `before`:
   *   Direct usage => myFn = before(myFn, (ctx, args) => ...)
   */
  export function before<T extends AnyFunction>(fn: T, advice: BeforeAdvice<T>): T {
    return SignalMap[SIGNALS.BEFORE](fn, advice);
  }
  
  /**
   * `after`:
   *   Direct usage => myFn = after(myFn, (ctx, result, args) => ...)
   */
  export function after<T extends AnyFunction>(fn: T, advice: AfterAdvice<T>): T {
    return SignalMap[SIGNALS.AFTER](fn, advice);
  }
  
  /**
   * `around`:
   *   Direct usage => myFn = around(myFn, (proceed, ctx, args) => ...)
   */
  export function around<T extends AnyFunction>(fn: T, advice: AroundAdvice<T>): T {
    return SignalMap[SIGNALS.AROUND](fn, advice);
  }
  
  /**
   * `error`:
   *   Direct usage => myFn = error(myFn, (err, ctx, args) => ...)
   */
  export function error<T extends AnyFunction>(fn: T, advice: ErrorAdvice<T>): T {
    return SignalMap[SIGNALS.ERROR](fn, advice);
  }
  
  /* -------------------------------------------------------------------------
   * 7) Default Export
   * ------------------------------------------------------------------------ */
  export default {
    SIGNALS,
    before,
    after,
    around,
    error,
  };
  