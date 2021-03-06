/** A service result. */
export interface IServiceResultBase {
	/** The error. */
	error?: IServiceError;
}

/** A service result. */
export interface IServiceResult<T> extends IServiceResultBase {
	/** The value. */
	value?: T;
}

/** An error. */
export interface IServiceError {
	/** The error code. */
	code?: string;
	/** The error message. (For developers, not end users.) */
	message?: string;
	/** Advanced error details. */
	details?: any;
	/** The inner error. */
	innerError?: IServiceError;
}

/** Options for an HTTP client. */
export interface IHttpClientOptions {
	/** The fetch object. */
	fetch: HttpClientUtility.IFetch;
	/** The base URI of the service. */
	baseUri?: string;
}

/** Helpers for HTTP clients. */
export namespace HttpClientUtility {

	/** The fetch function. */
	export interface IFetch {
		(uri: string, request: IFetchRequest): Promise<IFetchResponse>;
	}

	/** The minimal fetch request. */
	export interface IFetchRequest {
		method?: string;
		headers?: any;
		body?: string;
	}

	/** The minimal fetch response. */
	export interface IFetchResponse {
		status: number;
		headers: {
			get(name: string): string | null;
		};
		json(): Promise<any>;
	}

	/** A fetch response with any fetched content. */
	export interface IFetchedResponseWithContent {
		/** The fetch response. */
		response: IFetchResponse;
		/** The fetched JSON, if any. */
		json?: any;
	}

	const standardErrorCodes: { [index: number]: string } = {
		'304': 'notModified',
		'400': 'invalidRequest',
		'401': 'notAuthenticated',
		'403': 'notAuthorized',
		'404': 'notFound',
		'409': 'conflict',
		'413': 'requestTooLarge',
		'429': 'tooManyRequests',
		'500': 'internalError',
		'503': 'serviceUnavailable'
	};

	const jsonContentType = 'application/json';

	/** Fetch JSON using the specified fetch, URI, and request. */
	export function fetchResponse(fetch: IFetch, uri: string, request: IFetchRequest): Promise<IFetchedResponseWithContent> {
		return fetch(uri, request)
			.then(response => {
				if (!response.headers || !response.status || typeof response.json !== 'function') {
					throw new TypeError('fetch must resolve Promise with { status, headers, json() }.');
				}
				const contentType = response.headers.get('content-type');
				if (!contentType) {
					return Promise.resolve({ response: response, json: {} });
				}
				if (contentType.toLowerCase().substr(0, jsonContentType.length) === jsonContentType) {
					const jsonPromise = response.json();
					if (!jsonPromise || typeof jsonPromise.then !== 'function') {
						throw new TypeError('json() of fetch response must return a Promise.');
					}
					return jsonPromise.then(json => ({ response: response, json: json }));
				}
				return Promise.resolve({ response: response });
			});
	}

	/** Creates an error result for the specified response. */
	export function createResponseError(status: number, json?: any): IServiceResultBase {
		if (json && json.code) {
			return { error: json };
		}
		const isClientError = status >= 400 && status <= 499;
		const isServerError = status >= 500 && status <= 599;
		const errorCode = standardErrorCodes[status] || (isClientError ? 'invalidRequest' : 'invalidResponse');
		const message = isServerError ? 'HTTP server error' : isClientError ? 'HTTP client error' : 'Unexpected HTTP status code';
		return { error: { code: errorCode, message: `${message}: ${status}` } };
	}

	/** Creates an error result for a required request field. */
	export function createRequiredRequestFieldError(name: string): IServiceResultBase {
		return { error: { code: 'invalidRequest', message: `The request field '${name}' is required.` } };
	}
}
