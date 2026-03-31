import React, { useEffect, useState } from 'react';
import DashboardShell from './DashboardShell.tsx';
import { keycloakConfig } from './configDashboard.ts';
import Keycloak from 'keycloak-js';
import { Layout, Spin, Typography, theme } from 'antd';

const { Text } = Typography;

const config: Keycloak.KeycloakConfig = keycloakConfig;

const App: React.FC = () => {
    const [authenticated, setAuthenticated] = useState(false);
    const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | undefined>(undefined);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [renderElement, setRenderElement] = useState<React.ReactElement | undefined>(undefined);

    useEffect(() => {
        console.log('Initializing Keycloak');
        setMessage('');

        const keycloak = new Keycloak(config);
        keycloak
            .init({ onLoad: 'check-sso',  checkLoginIframe: true })
            .then((authenticated) => {
                setAuthenticated(authenticated);
                setKeycloakInstance(keycloak);
                console.log(authenticated ? 'authenticated' : 'not authenticated');
                setLoading(false);
            })
            .catch((error) => {
                console.error('Keycloak initialization error:', error);
                setMessage('Error initializing Keycloak: \n\n' + error.error);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (keycloakInstance) {
            setRenderElement(<DashboardShell keycloakInstance={keycloakInstance} />);
        }
    }, [keycloakInstance]);

    const { token: { colorBgContainer } } = theme.useToken();
    return (
        <Layout style={{
            background: colorBgContainer,
        }}>
            {loading ? (
                <div style={{position: 'absolute', top: '50%', left: '50%', textAlign: 'center', transform: 'translate(-50%, -50%)'}}>
                    <Spin size="large"/>
                    <br/>
                    <p>Initializing App... </p>
                </div>
            ) : (
                <div>
                    {message && <Text type="danger">{message}</Text>}
                    {renderElement}
                </div>
            )}
        </Layout>
    );
};

export default App;
