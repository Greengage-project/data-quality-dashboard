import React, { useState, Dispatch, SetStateAction } from 'react';
import { Card, Col, Button, Tooltip } from 'antd';
import { FullscreenExitOutlined, FullscreenOutlined, InfoCircleOutlined } from '@ant-design/icons';
import TrendLine from "./TrendLine.tsx";
import { DataArray } from "../Dashboard.tsx";
import { DatePickerProps } from 'antd';
import * as Plotly from "plotly.js";

interface TimeSeriesAnalysisCardProps {
    inputData?: DataArray;
    loadingStatus: Dispatch<SetStateAction<boolean>>;
    dataGaps?: Partial<Plotly.Shape>[];
    selectionIndicesArray: number[];
    aggregationInterval: 'none' | 'daily' | 'hourly' | '30min' | '15min';
    movingAverageData: number[];
    interpolatedEpochTimes: number[];
    showOutliers: boolean;
    setShowOutliers: Dispatch<SetStateAction<boolean>>;
    outlierTimestamps: number[];
    currentVariable: string;
    period: DatePickerProps['picker'] | 'showAll';
    showMovingAverage: boolean;
    setShowMovingAverage: Dispatch<SetStateAction<boolean>>;
    isDisabled: boolean;
}

const fullScreenStyle: React.CSSProperties = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 1000,
    background: 'white',
    padding: '20px',
};

export function TimeSeriesAnalysisCard({
    inputData,
    loadingStatus,
    dataGaps,
    selectionIndicesArray,
    aggregationInterval,
    movingAverageData,
    interpolatedEpochTimes,
    showOutliers,
    setShowOutliers,
    outlierTimestamps,
    currentVariable,
    period,
    showMovingAverage,
    setShowMovingAverage,
    isDisabled
}: TimeSeriesAnalysisCardProps) {
    const [isTrendLineFullScreen, setIsTrendLineFullScreen] = useState(false);
    const [showDataGaps, setShowDataGaps] = useState<boolean>(true);
    const [showDataMarkers, setShowDataMarkers] = useState<boolean>(false);

    const cardContent = (
        <Card
            size="small"
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Time Series Analysis
                        <Tooltip title={
                            <span>
                                Shows the development of a variable over time. <br />
                                The X axis (horizontal) represents the time. <br />
                                The Y axis (vertical) represents the value of the variable.
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
                        icon={isTrendLineFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        onClick={() => setIsTrendLineFullScreen(!isTrendLineFullScreen)}
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
            {inputData && currentVariable && (
                <TrendLine
                    inputData={inputData}
                    loadingStatus={loadingStatus}
                    dataGaps={dataGaps}
                    selectionIndicesArray={selectionIndicesArray}
                    aggregationInterval={aggregationInterval}
                    movingAverageData={movingAverageData}
                    interpolatedEpochTimes={interpolatedEpochTimes}
                    showOutliers={showOutliers}
                    setShowOutliers={setShowOutliers}
                    outlierTimestamps={outlierTimestamps}
                    currentVariable={currentVariable}
                    period={period || 'showAll'}
                    showMovingAverage={showMovingAverage}
                    setShowMovingAverage={setShowMovingAverage}
                    showDataGaps={showDataGaps}
                    onShowDataGapsChange={setShowDataGaps}
                    showDataMarkers={showDataMarkers}
                    onShowDataMarkersChange={setShowDataMarkers}
                    isFullScreen={isTrendLineFullScreen}
                    onToggleFullScreen={() => setIsTrendLineFullScreen(!isTrendLineFullScreen)}
                />
            )}
        </Card>
    );
    
    if (isTrendLineFullScreen) {
        return <div style={fullScreenStyle}>{cardContent}</div>;
    }

    return cardContent;
}
