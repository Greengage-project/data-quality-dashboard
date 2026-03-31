import React, { useEffect, useState, lazy, Suspense } from 'react'
import { MenuUnfoldOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Layout, Menu, theme, message, Spin } from 'antd'

// External React Components
import HomeScreen from "./HomeScreen.tsx";
const Dashboard = lazy(() => import("./Dashboard.tsx"))
import Keycloak from "keycloak-js";


interface DashboardShellProps {
    keycloakInstance: Keycloak,
}

const DashboardShell: React.FC<DashboardShellProps> = ({ keycloakInstance, }) => {

    const { Header, Sider } = Layout
    const { token: { colorBgContainer } } = theme.useToken()
    const [messageApi, contextHolder] = message.useMessage();
    const [collapsed, setCollapsed] = useState<boolean>(true)
    const [currentDashboardKey, setCurrentDashboardKey] = useState<string>("Home")
    const [currentDashboard, setCurrentDashboard] = useState(<HomeScreen setPage={setCurrentDashboardKey}
        keycloakInstance={keycloakInstance} />)

    //TODO Suggest better solution for handling onClickDashboardMenuItem that is not using case switch (possible?)

    useEffect(() => {
        switch (currentDashboardKey) {
            case 'Home':
                console.log('Home Screen selected');
                setCurrentDashboard(<HomeScreen setPage={setCurrentDashboardKey} keycloakInstance={keycloakInstance} />);
                break;
            case 'Dashboard':
                console.log('Dashboard selected');
                setCurrentDashboard(<Dashboard keycloakInstance={keycloakInstance} />);
                break;
            case 'Authenticate':
                console.log('Authenticate');
                if (keycloakInstance) {
                    keycloakInstance.login()
                }
                break;
            case 'unAuthenticate':
                console.log('unAuthenticate');
                if (keycloakInstance) {
                    keycloakInstance.logout()
                }
                break;

            default:
                messageApi.info(`Sorry, ${currentDashboardKey} does not exist.`)
                console.log(`Sorry, ${currentDashboardKey} does not exist.`);
        }
    }, [currentDashboardKey]);


    const onClickDashboardMenuItem: MenuProps['onClick'] = async event => {
        console.log(event)
        setCurrentDashboardKey(event.key)

    }

    const items: MenuProps['items'] = [

        {
            key: 'dashboards',
            icon: <MenuUnfoldOutlined />,
            label: 'Dashboards',
            children: [

                {
                    key: 'Home',
                    label: 'Home',
                    onClick: onClickDashboardMenuItem,

                },
                {
                    key: 'Dashboard',
                    label: 'GREENGAGE Data Quality Dashboard',
                    onClick: onClickDashboardMenuItem,
                    disabled: keycloakInstance ? !keycloakInstance.authenticated : true
                },
                {
                    key: 'Authenticate',
                    label: 'login',
                    onClick: onClickDashboardMenuItem,
                    disabled: keycloakInstance ? keycloakInstance.authenticated : true
                },
                {
                    key: 'unAuthenticate',
                    label: 'logout',
                    onClick: onClickDashboardMenuItem,
                    disabled: keycloakInstance ? !keycloakInstance.authenticated : true

                },
            ]
        }
    ]

    return (
        <Layout>
            {// holds the context for the ant-design message component
                contextHolder}
            <Sider trigger={null} collapsible collapsed={collapsed} collapsedWidth={40}
                style={{ position: "absolute", zIndex: 1, marginTop: -12, marginLeft: -10 }}>

                <Menu
                    theme="light"
                    mode="inline"
                    /* defaultSelectedKeys={['11']}
                    defaultOpenKeys={['1']}*/
                    selectable={true}
                    selectedKeys={[currentDashboardKey]}
                    items={items}
                    style={{}}
                />
            </Sider>
            <Suspense fallback={
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    width: '100vw',
                    backgroundColor: 'white'
                }}>
                    <Spin size="large" />
                    <div style={{ marginTop: '10px' }}>Loading Dashboard...</div>
                </div>
            }>
                {currentDashboard}
            </Suspense>

        </Layout>
    )
}

export default DashboardShell