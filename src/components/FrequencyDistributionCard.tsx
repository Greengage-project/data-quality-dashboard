import React, { useState } from 'react';
import { Card, Col, Button, Tooltip } from 'antd';
import { FullscreenExitOutlined, FullscreenOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as Plotly from "plotly.js";
import Histogram from "./Histogram.tsx";
import { DataArray } from "../Dashboard.tsx";

interface FrequencyDistributionCardProps {
    inputData?: DataArray;
    onSelected: (indicesArray: number[], mergedRanges: [number, number][]) => void;
    onDeselect: () => void;
    loadingStatus: (loading: boolean) => void;
    selectedFieldAkaColumn: string;
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

export function FrequencyDistributionCard({
    inputData,
    onSelected,
    onDeselect,
    loadingStatus,
    selectedFieldAkaColumn,
    isDisabled,
}: FrequencyDistributionCardProps) {
    const [isHistogramFullScreen, setIsHistogramFullScreen] = useState(false);
    const [histogramBinMethod, setHistogramBinMethod] = useState<string>('rice');
    const [histogramCustomBins, setHistogramCustomBins] = useState<number | undefined>(undefined);

    const cardContent = (
        <Card
            size="small"
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Frequency Distribution
                        <Tooltip title={
                            <span>
                                Shows the distribution of values in a histogram format. <br />
                                The X axis (horizontal) represents the value of the variable.
                                Each vertical bar represents a range of values, with the width of the bar representing the size of the range. <br />
                                The Y axis (vertical) represents the frequency of the values, with the height of the bar representing the number of values (e.g. number of measurements) in that range.
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
                        icon={isHistogramFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        onClick={() => setIsHistogramFullScreen(!isHistogramFullScreen)}
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
                <Histogram
                    inputData={inputData}
                    onSelected={onSelected}
                    onDeselect={onDeselect}
                    onClick={(event: Plotly.PlotMouseEvent) => {
                        console.log("Histogram click event", event)
                    }}
                    loadingStatus={loadingStatus}
                    selectedFieldAkaColumn={selectedFieldAkaColumn}
                    binMethod={histogramBinMethod}
                    onBinMethodChange={setHistogramBinMethod}
                    customBins={histogramCustomBins}
                    onCustomBinsChange={setHistogramCustomBins}
                    isFullScreen={isHistogramFullScreen}
                    onToggleFullScreen={() => setIsHistogramFullScreen(!isHistogramFullScreen)}
                />
            )}
        </Card>
    );

    if (isHistogramFullScreen) {
        return <div style={fullScreenStyle}>{cardContent}</div>;
    }

    return cardContent;
}
