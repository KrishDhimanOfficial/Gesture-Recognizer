interface InfoProps {
    signal?: AbortSignal
    withCredentials?: boolean
}

class Fetch {
    constructor(
        private baseURL: string = 'http://localhost:4000/api',
        private token: string = ''
    ){}

    private async request(
        method: string,
        endURL: string,
        data?: object | FormData,
        headers?: object,
        config: InfoProps = {}
    ) {

        const finalHeaders: HeadersInit = {
            ...(data instanceof FormData ? {} : { "Content-Type": "application/json" }),
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...(headers || {})
        }

        const res = await fetch(`${this.baseURL}${endURL}`, {
            method,
            headers: finalHeaders,
            body: data instanceof FormData ? data : JSON.stringify(data),
            credentials: config.withCredentials ? "include" : "same-origin",
            signal: config.signal
        })

        let parsed

        try {
            parsed = await res.json()
        } catch (e) {
            parsed = null // empty response body case
        }

        if (!res.ok) {
            throw new Error(parsed?.message || `Request failed: ${res.status}`)
        }

        return parsed
    }

    post(url: string, data: object, headers?: object, config?: InfoProps) {
        return this.request('POST', url, data, headers, config)
    }

    get(url: string, headers?: object, config?: InfoProps) {
        return this.request('GET', url, undefined, headers, config)
    }

    put(url: string, data: object, headers?: object, config?: InfoProps) {
        return this.request('PUT', url, data, headers, config)
    }

    patch(url: string, data?: object, headers?: object, config?: InfoProps) {
        return this.request('PATCH', url, data, headers, config)
    }

    delete(url: string, headers?: object, config?: InfoProps) {
        return this.request('DELETE', url, undefined, headers, config)
    }
}

export default new Fetch()