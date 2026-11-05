import {toast} from "solid-toast";
import {errors} from "../resources/errors";

export const API_BASE_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '')

export const dropdowns = []

export function getJWT() {
    const cookie = document.cookie.split('; ').find(value => value.startsWith('jwt='))
    return cookie ? decodeURIComponent(cookie.slice(4)) : ''
}

export function storeJWT(token) {
    document.cookie = `jwt=${token}; Path=/; Max-Age=604800; SameSite=Lax; Secure`
}

export function clearJWT() {
    document.cookie = 'jwt=; Path=/; Max-Age=0; SameSite=Lax; Secure'
}

export function createNotification(type, message, options) {
    if (type === 'success') {
        return toast.success(message, options)
    } else if (type === 'error') {
        return toast.error(message, options)
    }
    return toast(message, options)
}

export async function api(path, method, body, notification = false, headers =  { 'Content-Type': 'application/json' }) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
        const requestHeaders = {...headers}
        const token = getJWT()
        if (token) requestHeaders.Authorization = token

        let res = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers: requestHeaders,
            body,
            credentials: 'include',
            signal: controller.signal,
        })

        if (res.status === 502) {
            toast.error('Server is waking up, please try again in a few seconds')
            return null
        }

        let data = await res.json()
        if (data && typeof data === 'object') {
            Object.defineProperty(data, 'status', {value: res.status})
        }

        if (data.error && notification) {
            toast.error(errors[data.error] || data.error)
        } else if (data.error && data.error === 'DISABLED') {
            toast.error(errors[data.error] || data.error)
        }

        return data
    } catch (e) {
        if (e.name === 'AbortError' || e instanceof TypeError) {
            toast.error('Server is waking up, please try again in a few seconds')
        } else {
            toast.error('There was an error processing your request. Please try again later.')
        }
        return null
    } finally {
        clearTimeout(timeout)
    }
}

export async function authedAPI(path, method, body, notification = false) {
    return await api(path, method, body, notification)
}

export async function fetchUser() {
    let user = await api('/user', 'GET', null, false)
    return user
}

export function addDropdown(setValue) {
    dropdowns.push(setValue)
}

export function closeDropdowns() {
    dropdowns.forEach(dropdown => dropdown(false))
}

export function getRandomNumber(min, max, chance) {
    const range = max - min + 1

    if (!chance)
        return Math.floor(Math.random() * range) + min;
    return Math.floor(chance.random() * range) + min;
}

export async function logout() {
    await api('/auth/logout', 'POST', null)
    clearJWT()
    window.location.reload()
}