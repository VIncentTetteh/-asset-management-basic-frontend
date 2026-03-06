import axios from "axios";
import { getOrganisationIdFromStorage } from "@/lib/authContext";

const api = axios.create({
    baseURL: "/api/v1",
    headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
    },
});

// Request interceptor: Attach token to every request automatically
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token && config.headers) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        const organisationId = getOrganisationIdFromStorage();
        if (organisationId && config.headers) {
            config.headers["X-Organisation-Id"] = organisationId;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor: Handle 401 Unauthorized globally
api.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response?.status === 401) {
        if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/register") {
            // Clear expired/invalid token and force re-login
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
    }
    return Promise.reject(error);
});

export default api;
