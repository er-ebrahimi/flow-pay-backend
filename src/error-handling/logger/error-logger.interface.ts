export interface ErrorLogger {
  log(error: unknown, response: object): void;
}
