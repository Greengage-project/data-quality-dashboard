import { DataConnectorConfig } from './services/dataConnector';

const env = (import.meta as { env?: Record<string, string> }).env || {};

export const keycloakConfig = {
    // Frontend values are injected at build-time by Vite.
    url: env.VITE_KEYCLOAK_URL || '',
    realm: env.VITE_KEYCLOAK_REALM || '',
    clientId: env.VITE_KEYCLOAK_CLIENT_ID || '',
};

// Use this config only for local development
export const druidConnectorConfig: DataConnectorConfig = {
    url: '/druid/v2/',
    authorizationType: "", 
    authorization: ""
}

export const druidConfig = druidConnectorConfig;
