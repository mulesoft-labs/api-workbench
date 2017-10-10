declare module 'popsicle' {
  import http = require('http')

  module popsicle {
    export function request (options: string | Options): popsicle.Request

    interface Options {
      url: string
      method?: string
      body?: any
      query?: string | QueryMap
      timeout?: number
      headers?: HeaderMap
      options?: any
      use?: Function[]
      transport?: any
    }

    interface QueryMap {
      [key: string]: string
    }

    interface HeaderMap {
      [key: string]: string
    }

    // TODO: Document `tough-cookie`.
    class CookieJar {

    }

    class Headers {
      headers: HeaderMap
      headerNames: HeaderMap

      set (name: string, value: string): Headers
      set (headers: HeaderMap): Headers
      append (name: string, value: string): Headers
      name (name: string): string
      get (): HeaderMap
      get (name: string): string
      remove (name: string): Headers
      type (): string
      type (type: string): Request
    }

    class Request extends Headers implements Promise<Response> {
      // Standard options.
      url: string
      method: string
      body: any
      query: string | QueryMap
      timeout: number

      // Node options.
      jar: CookieJar
      maxRedirects: number
      rejectUnauthorized: boolean
      agent: http.Agent
      stream: boolean
      raw: boolean
      encoding: string

      // Browser options.
      withCredentials: boolean

      // Misc. options.
      parse: boolean

      // State.
      opened: boolean
      aborted: boolean

      // Progress.
      uploaded: number
      downloaded: number
      completed: number
      uploadedSize: number
      uploadedTotal: number
      downloadedSize: number
      downloadedTotal: number

      // Link to the response instance (when completed).
      response: Response

      constructor (options: Options)

      // Utilities.
      fullUrl (): string
      error (message: string): Error
      progress (fn: (request: Request) => any): Request
      abort (): Request

      // Plugins.
      use (fn: (request: Request) => any): Request
      before (fn: (request: Request) => Promise<any>): Request
      after (fn: (request: Request) => Promise<any>): Request
      always (fn: (request: Request) => Promise<any>): Request

      // Control flow.
      then <T> (onResolve: (response?: Response) => T): Promise<T>
      then <T> (onResolve: void, onReject?: (error?: Error) => T): Promise<T>
      then <T> (onResolve: (response?: Response) => T, onReject?: (error?: Error) => T): Promise<T>
      //catch <T> (onReject: (error?: Error) => T): Promise<T>
      
      catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<Response | TResult>
      exec (cb: (err?: Error, response?: Response) => any): void

      readonly [Symbol.toStringTag]: "Promise";
    }

    class Response extends Headers {
      request: Request
      body: any
      status: number
      statusText: string
      statusType (): number
      error (message: string): Error
      toJSON (): any
    }

    function jar (): CookieJar

    function form (): FormData

    var plugins: any
  }

  export = popsicle
}
