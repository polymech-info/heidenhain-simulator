import { z } from 'zod'

export const TLogLevelNameSchema = z.enum(["silly", "trace", "debug", "info", "warn", "error", "fatal"])
export type LogLevel = z.infer<typeof TLogLevelNameSchema>
export enum LogLevelEx {
    silly,
    trace,
    debug,
    info,
    warn,
    error,
    fatal
}