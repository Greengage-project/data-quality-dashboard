import React from 'react';
import { Button, message } from 'antd';
import GREENGAGELogo from '/GREENGAGE_h_txt.png';
import Keycloak from "keycloak-js";


interface Props {
    setPage: (page: string) => void,
    keycloakInstance: Keycloak | undefined
}


const HomeScreen: React.FC<Props> = ({ setPage, keycloakInstance }) => {
    const [messageApi, contextHolder] = message.useMessage();

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "calc(100vh - 16px)",
                width: "calc(100vw)",
                backgroundColor: "white",
            }}>
            {// holds the context for the ant-design message component
                contextHolder
            }
            {/* Logo linking to Greengage website */}
            <a href="https://greengage-project.eu" target="_blank" rel="noopener noreferrer"  >
                <img src={GREENGAGELogo} alt="GREENGAGE" style={{ width: 500, height: "auto" }} />
            </a>

            <h2>Welcome to Data Quality Dashboard</h2>
            <div style={{ textAlign: "center" }}>
                <Button onClick={() => keycloakInstance ? keycloakInstance.login() : messageApi.info("error")}
                        disabled={keycloakInstance ? keycloakInstance.authenticated : false}>
                    Login
                </Button>
                <Button onClick={() => keycloakInstance ? keycloakInstance.logout() : messageApi.info("error")}
                        disabled={!keycloakInstance || !keycloakInstance.authenticated}>
                    Logout
                </Button>
                <br /><br />
                <div style={{ textAlign: "center" }} >
                    {keycloakInstance ? keycloakInstance.tokenParsed ? "You are logged in as: " + keycloakInstance.tokenParsed?.preferred_username : "Not logged in" : "Can't reach authentication server"}
                </div>
                <br />
            </div>
            <div style={{ textAlign: "center" }}>
                <Button onClick={() => setPage('Dashboard')}
                        disabled={keycloakInstance ? !keycloakInstance.authenticated : true}>
                    Open Dashboard
                </Button>
            </div>
        </div>
    );
};

export default HomeScreen;
