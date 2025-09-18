import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';

export interface RequestContext {
  method: string;
  url: string;
  path: string;
  query: Record<string, string>;
  headers: IncomingMessage['headers'];
  body: unknown;
  raw: IncomingMessage;
}

export class ResponseContext {
  private finished = false;

  constructor(private readonly res: ServerResponse) {}

  status(code: number): this {
    this.res.statusCode = code;
    return this;
  }

  json(payload: unknown): void {
    if (this.finished) {
      return;
    }

    this.res.setHeader('Content-Type', 'application/json');
    this.res.end(JSON.stringify(payload));
    this.finished = true;
  }

  send(payload: string | Buffer): void {
    if (this.finished) {
      return;
    }

    this.res.end(payload);
    this.finished = true;
  }

  sendFile(filePath: string): void {
    if (this.finished) {
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      this.status(500).send('Internal Server Error');
    });

    stream.on('open', () => {
      this.finished = true;
      stream.pipe(this.res);
    });
  }

  setHeader(name: string, value: string): this {
    this.res.setHeader(name, value);
    return this;
  }

  isFinished(): boolean {
    return this.finished || this.res.writableEnded;
  }

  get raw(): ServerResponse {
    return this.res;
  }
}

export type Middleware = (
  req: RequestContext,
  res: ResponseContext,
  next: () => void
) => void | Promise<void>;

export type RouteHandler = (
  req: RequestContext,
  res: ResponseContext
) => void | Promise<void>;

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath);

  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

class MiniExpressApp {
  private readonly middlewares: Middleware[] = [];
  private readonly routes: Route[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  get(pathname: string, handler: RouteHandler): void {
    this.routes.push({ method: 'GET', path: pathname, handler });
  }

  post(pathname: string, handler: RouteHandler): void {
    this.routes.push({ method: 'POST', path: pathname, handler });
  }

  listen(port: number, callback?: () => void): void {
    const server = createServer(async (req, res) => {
      const url = req.url ?? '/';
      const method = req.method ?? 'GET';
      const parsedUrl = new URL(url, 'http://localhost');
      const requestContext: RequestContext = {
        method,
        url,
        path: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams.entries()),
        headers: req.headers,
        body: undefined,
        raw: req
      };

      const responseContext = new ResponseContext(res);

      try {
        const proceed = await this.runMiddlewares(requestContext, responseContext);
        if (!proceed || responseContext.isFinished()) {
          return;
        }

        const route = this.routes.find(
          (registeredRoute) =>
            registeredRoute.method === method &&
            registeredRoute.path === requestContext.path
        );

        if (!route) {
          if (!responseContext.isFinished()) {
            responseContext.status(404).json({ error: 'Not Found' });
          }
          return;
        }

        await route.handler(requestContext, responseContext);

        if (!responseContext.isFinished()) {
          responseContext.send('');
        }
      } catch (error) {
        if (!responseContext.isFinished()) {
          responseContext.status(500).json({ error: 'Internal Server Error' });
        }
        console.error('MiniExpress encountered an error', error);
      }
    });

    server.listen(port, callback);
  }

  private async runMiddlewares(
    req: RequestContext,
    res: ResponseContext
  ): Promise<boolean> {
    for (const middleware of this.middlewares) {
      let nextCalled = false;

      await new Promise<void>((resolve, reject) => {
        const next = () => {
          nextCalled = true;
          resolve();
        };

        try {
          const result = middleware(req, res, next);
          if (result instanceof Promise) {
            result
              .then(() => {
                if (!nextCalled) {
                  resolve();
                }
              })
              .catch(reject);
          } else if (!nextCalled) {
            resolve();
          }
        } catch (middlewareError) {
          reject(middlewareError);
        }
      });

      if (res.isFinished()) {
        return false;
      }
    }

    return true;
  }
}

function parseJsonMiddleware(): Middleware {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      req.body = {};
      next();
      return;
    }

    const chunks: string[] = [];
    let resolved = false;

    const complete = (callback: () => void) => {
      if (!resolved) {
        resolved = true;
        callback();
      }
    };

    req.raw.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        chunks.push(chunk);
        return;
      }

      try {
        chunks.push((chunk as Buffer).toString('utf-8'));
      } catch (conversionError) {
        console.error('Failed to decode request chunk', conversionError);
      }
    });

    req.raw.on('end', () => {
      const rawBody = chunks.join('');
      if (!rawBody) {
        req.body = {};
        complete(next);
        return;
      }

      try {
        req.body = JSON.parse(rawBody);
        complete(next);
      } catch (error) {
        res.status(400).json({ error: 'Invalid JSON payload' });
        complete(() => undefined);
      }
    });

    req.raw.on('error', () => {
      res.status(400).json({ error: 'Invalid request body' });
      complete(() => undefined);
    });
  };
}

function staticMiddleware(root: string): Middleware {
  const safeRoot = path.resolve(root);

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const relativePath = req.path === '/' ? '/index.html' : req.path;
    const candidatePath = path.join(safeRoot, relativePath);

    if (!candidatePath.startsWith(safeRoot)) {
      res.status(403).send('Forbidden');
      return;
    }

    fs.stat(candidatePath, (error, stats) => {
      if (error || !stats.isFile()) {
        next();
        return;
      }

      res.setHeader('Content-Type', getMimeType(candidatePath));
      res.sendFile(candidatePath);
    });
  };
}

interface ExpressStatic {
  (root: string): Middleware;
}

export interface MiniExpress {
  (): MiniExpressApp;
  json: () => Middleware;
  static: ExpressStatic;
}

const express = (() => {
  const factory = () => new MiniExpressApp();
  (factory as MiniExpress).json = parseJsonMiddleware;
  (factory as MiniExpress).static = staticMiddleware;
  return factory as MiniExpress;
})();

export default express;
