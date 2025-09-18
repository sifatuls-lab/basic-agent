declare module 'path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function extname(path: string): string;
}

declare module 'fs' {
  export interface Stats {
    isFile(): boolean;
  }

  export interface ReadStream {
    on(event: 'open', listener: () => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
    pipe(destination: unknown): this;
  }

  export function createReadStream(path: string): ReadStream;
  export function stat(
    path: string,
    callback: (error: unknown, stats: Stats) => void
  ): void;
}

declare module 'http' {
  export interface IncomingMessage {
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    url?: string;
    on(event: 'data', listener: (chunk: unknown) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
  }

  export interface ServerResponse {
    statusCode: number;
    writableEnded: boolean;
    setHeader(name: string, value: string): void;
    end(data?: unknown): void;
    on(event: 'error', listener: (error: unknown) => void): this;
  }

  export type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

  export function createServer(listener: RequestListener): {
    listen(port: number, callback?: () => void): void;
  };
}

declare module 'url' {
  interface URLSearchParams {
    entries(): IterableIterator<[string, string]>;
  }

  export class URL {
    constructor(input: string, base?: string);
    pathname: string;
    searchParams: URLSearchParams;
  }
}

declare module 'crypto' {
  export interface Hash {
    update(data: string): Hash;
    digest(): Buffer;
  }

  export function randomUUID(): string;
  export function createHash(algorithm: string): Hash;
}

declare class Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare const Buffer: {
  from(data: string | ArrayBuffer | ArrayLike<number>, encoding?: string): Buffer;
  concat(list: Buffer[]): Buffer;
};

declare var process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};
