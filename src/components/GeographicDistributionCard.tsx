import React, { useState, CSSProperties } from 'react';
import { Card, Col, Button, Tooltip } from 'antd';
import { FullscreenExitOutlined, FullscreenOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as Plotly from "plotly.js";
import MapPlot from "./MapPlot.tsx";
import { DataArray } from "../Dashboard.tsx";

interface GeographicDistributionCardProps {
    inputData?: DataArray;
    selectedFieldAkaColumn: string;
    includeCoordinates: boolean;
    latitudeLongitudeColumnNames: string[];
    selectedCalendarHeatmapIndex?: number;
    histogramSelectionRanges: [number, number][];
    isDisabled: boolean;
}

const fullScreenStyle: CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 1000,
    background: 'white',
    padding: '20px',
};

export function GeographicDistributionCard({
    inputData,
    selectedFieldAkaColumn,
    includeCoordinates,
    latitudeLongitudeColumnNames,
    selectedCalendarHeatmapIndex,
    histogramSelectionRanges,
    isDisabled
}: GeographicDistributionCardProps) {
    const [isMapFullScreen, setIsMapFullScreen] = useState(false);
    const [mapVisualizationType, setMapVisualizationType] = useState<'scattermap' | 'densitymap'>('scattermap');
    const [mapColorscale, setMapColorscale] = useState<Plotly.ColorScale | undefined>('Magma');
    const [mapReverseColorscale, setMapReverseColorscale] = useState<boolean>(true);

    const cardContent = (
        <Card
            size="small"
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Geographic Distribution
                        <Tooltip title={
                            <span>
                                Shows the distribution of values over a map. <br />
                                The color of the points represents the value of the variable in a specific time.
                            </span>
                        }
                            overlayInnerStyle={{
                                width: '400px',
                                whiteSpace: 'pre-line',
                                textAlign: 'left'
                            }}
                        >
                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        </Tooltip>
                    </div>
                    <Button
                        type="text"
                        icon={isMapFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        onClick={() => setIsMapFullScreen(!isMapFullScreen)}
                        style={{ border: 'none', padding: 0 }}
                        disabled={isDisabled}
                    />
                </div>
            }
            styles={{
                header: { height: '24px', minHeight: '24px', backgroundColor: '#f0f0f0a0', padding: '0 12px' },
                body: { height: 'calc(100% - 24px)', padding: '5px', overflow: 'hidden' }
            }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
            {inputData && (selectedFieldAkaColumn !== '') && (
                <MapPlot
                    inputData={inputData}
                    selectedFieldAkaColumn={selectedFieldAkaColumn}
                    includeCoordinates={includeCoordinates}
                    latitudeLongitudeColumnNames={latitudeLongitudeColumnNames}
                    selectedCalendarHeatmapIndex={selectedCalendarHeatmapIndex}
                    histogramSelectionRanges={histogramSelectionRanges}
                    isFullScreen={isMapFullScreen}
                    onToggleFullScreen={() => setIsMapFullScreen(!isMapFullScreen)}
                    colorscale={mapColorscale}
                    onColorscaleChange={setMapColorscale}
                    reverseColorscale={mapReverseColorscale}
                    onReverseColorscaleChange={setMapReverseColorscale}
                    visualizationType={mapVisualizationType}
                    onVisualizationTypeChange={setMapVisualizationType}
                />
            )}
        </Card>
    );

    if (isMapFullScreen) {
        return <div style={fullScreenStyle}>{cardContent}</div>;
    }

    return cardContent;
}
