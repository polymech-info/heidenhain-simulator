import { substitute } from './strings.js'

export type Hash<T> = Record<string, T>;
export interface List<T> {
  [index: number]: T
  length: number
}
/**
 * Interface of the simple literal object with any string keys.
 */
export type IObjectLiteral = Record<string, any>;

export type JSONPathExpression = string;



const _resolve = (config) => {
  for (const key in config) {
    if (config[key] && typeof config[key] == 'string') {
      const resolved = substitute(config[key], config);
      config[key] = resolved;
    }
  }
  return config;
}
export const resolveConfig = (config) => {
  config = _resolve(config);
  config = _resolve(config);
  return config;
}

export { substitute } from './strings.js'
export * from './constants.js'
