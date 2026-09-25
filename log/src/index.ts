import { ISettingsParam, Logger } from "tslog"

export enum ELogTargets {
    Console = 1 << 0,
    FileText = 1 << 1,
    FileJson = 1 << 2,
    Seq = 1 << 3
}

export function createLogger(name: string, options?: ISettingsParam) {
    return new Logger({
        name,
        type: 'pretty',
        ...options,
    })
}
// export const defaultLogger = createLogger('DefaultLogger', { })