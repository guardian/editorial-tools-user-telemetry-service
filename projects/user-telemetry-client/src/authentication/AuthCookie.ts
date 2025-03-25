export function cookieAuthentication(requestInit: RequestInit): RequestInit {
        return {
            ...requestInit,
            credentials: "include"
        }
}
