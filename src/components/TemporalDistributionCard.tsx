import React, { useState } from 'react';
import { Card, Col, Button, Tooltip } from 'antd';
import { FullscreenExitOutlined, FullscreenOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as Plotly from "plotly.js";
import CalendarHeatmap from "./CalendarHeatmap.tsx";
import { DataArray } from "../Dashboard.tsx";
import { DatePickerProps } from 'antd';

interface TemporalDistributionCardProps {
    showCalendarHeatmap: boolean;
    startDate?: string;
    selectedDataset: string;
    selectedFieldAkaColumn: string;
    selectedAggregationInterval: 'none' | 'daily' | 'hourly' | '30min' | '15min';
    selectedTimeInterval: DatePickerProps['picker'] | 'showAll';
    inputData?: DataArray;
    selectedPrimaryCategoricalDimensionUniqueValue: string;
    loadingStatus: (loading: boolean) => void;
    minEpochTime?: number;
    setSelectedPointIndex: (index?: number) => void;
    timezone: string;
    isDisabled: boolean;
    endDate?: string;
    loadingData: boolean;
    loadingCalendarHeatmap: boolean;
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

export function TemporalDistributionCard({
    showCalendarHeatmap,
    startDate,
    selectedDataset,
    selectedFieldAkaColumn,
    selectedAggregationInterval,
    selectedTimeInterval,
    inputData,
    selectedPrimaryCategoricalDimensionUniqueValue,
    loadingStatus,
    minEpochTime,
    setSelectedPointIndex,
    timezone,
    isDisabled,
    endDate,
    loadingData,
    loadingCalendarHeatmap,
}: TemporalDistributionCardProps) {
    const [isCalendarHeatmapFullScreen, setIsCalendarHeatmapFullScreen] = useState(false);
    const [calendarColorscale, setCalendarColorscale] = useState<Plotly.ColorScale | undefined>('Magma');
    const [calendarReverseColorscale, setCalendarReverseColorscale] = useState<boolean>(true);

    const cardContent = (
        <Card
            size="small"
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Temporal Distribution
                        <Tooltip title={
                            <span>
                                Shows the distribution of values over time in a calendar format. <br />
                                Depending on selected aggregation interval, each cell represents an hour of a day or day of a month. <br />
                                The color of the cell represents the value of the variable (e.g. temperature) at that time according to the color scale visible in the legend.
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
                        icon={isCalendarHeatmapFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        onClick={() => setIsCalendarHeatmapFullScreen(!isCalendarHeatmapFullScreen)}
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
            {showCalendarHeatmap && startDate && (selectedDataset !== '') && (selectedFieldAkaColumn !== '')
                && (selectedAggregationInterval !== "none")
                && (selectedAggregationInterval !== "30min")
                && (selectedAggregationInterval !== "15min")
                && (selectedTimeInterval !== "showAll") && (
                    <CalendarHeatmap
                        inputData={inputData}
                        year={startDate.split('-')[0]}
                        month={startDate.split('-')[1]}
                        period={selectedTimeInterval}
                        granularity={selectedAggregationInterval}
                        datapoint={selectedPrimaryCategoricalDimensionUniqueValue}
                        monitoredVariable={selectedFieldAkaColumn}
                        loadingStatus={loadingStatus}
                        minEpochTime={minEpochTime}
                        setSelectedPointIndex={setSelectedPointIndex}
                        timezone={timezone}
                        selectedColorscale={calendarColorscale}
                        onColorscaleChange={setCalendarColorscale}
                        reverseColorscale={calendarReverseColorscale}
                        onReverseColorscaleChange={setCalendarReverseColorscale}
                    />
                )}
            {/* Message calendar heatmap not available for selected time period */}
            {inputData && !showCalendarHeatmap && startDate && endDate && selectedFieldAkaColumn &&
                !loadingData && !loadingCalendarHeatmap && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                        textAlign: 'center'
                    }}>
                        {selectedTimeInterval === "showAll" && (
                            <h3>Calendar heatmap is not available<br />
                                for the selected time period<br />
                                (use month or year)
                            </h3>
                        )}
                        {(selectedAggregationInterval === "none" ||
                            selectedAggregationInterval === "30min" ||
                            selectedAggregationInterval === "15min") && (
                                <h3>Calendar heatmap is not available<br />
                                    for the selected aggregation interval<br />
                                    (use hourly or daily)
                                </h3>
                            )}
                    </div>
                )}
        </Card>
    );
    
    if (isCalendarHeatmapFullScreen) {
        return <div style={fullScreenStyle}>{cardContent}</div>;
    }

    return cardContent;
}
