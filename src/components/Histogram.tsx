import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from "plotly.js";
import { Select, InputNumber, Button, Tooltip } from "antd";
import { DeleteOutlined } from '@ant-design/icons';
import { ResponseData } from '../services/dataConnector';

type HistogramProps = {
    inputData: ResponseData | undefined;
    onClick: (event: Plotly.PlotMouseEvent) => void;
    onSelected: (indicesArray: number[], mergedRanges: [number, number][]) => void;
    onDeselect: () => void | undefined;
    loadingStatus: (status: boolean) => void;
    selectedFieldAkaColumn: string;
    binMethod: string;
    onBinMethodChange: (method: string) => void;
    customBins?: number;
    onCustomBinsChange: (bins: number | undefined) => void;
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
};

const Histogram: React.FC<HistogramProps> = ({
    inputData,
    onClick,
    onSelected,
    onDeselect,
    loadingStatus,
    selectedFieldAkaColumn,
    binMethod,
    onBinMethodChange,
    customBins,
    onCustomBinsChange,
    isFullScreen,
    onToggleFullScreen
}) => {
    if (inputData && inputData.EpochTime.length > 2000000) {
        console.log("Too much data to display, consider filtering");
        loadingStatus(false)
        return <div>Too many data points requested to render,<br />
            consider temporal or categorical filtering,<br />
            or change the aggregation interval.</div>;
    }

    //if (inputData && typeof inputData.value === "string") {
    //    console.log("String data type not supported for histogram");
    //    loadingStatus(false)
    //    return <div>String data type not supported for histogram</div>;
    //}

    const [histogramData, setHistogramData] = useState<Partial<Plotly.PlotData>[]>([]);
    const [histogramLayout, setHistogramLayout] = useState<Partial<Plotly.Layout>>({
        xaxis: {
            visible: false,
        },
        yaxis: {
            visible: false,
        }
    });
    const [revision, setRevision] = useState<number>(0);
    const [bins, setBins] = useState<number>(9999);
    const [tempCustomBins, setTempCustomBins] = useState<number | undefined>(customBins);
    const [hasNewInput, setHasNewInput] = useState<boolean>(false);
    const [selectedRanges, setSelectedRanges] = useState<[number, number][]>([]);

    // Add effect to reset selections when data changes
    useEffect(() => {
        setSelectedRanges([]);
        onDeselect();
    }, [inputData]);

    useEffect(() => {
        if (inputData != undefined) {
            const filteredValues = [...inputData.value].filter((value: number, index: number) => value !== null);

            if (filteredValues.length === 0) {
                const noDataMessage: Partial<Plotly.PlotData>[] = [{
                    type: 'scatter',
                    x: [0],
                    y: [0],
                    mode: 'text',
                    text: ['No values to display'],
                    textposition: 'middle center',
                    textfont: {
                        size: 16,
                        color: 'black'
                    }
                }];

                const noDataLayout: Partial<Plotly.Layout> = {
                    xaxis: { visible: false },
                    yaxis: { visible: false },
                };

                setHistogramData(noDataMessage);
                setHistogramLayout(noDataLayout);
                setRevision(revision + 1);
                loadingStatus(false);
                return;
            }

            const calculatedBins = customBins ?? calculateBins(filteredValues.length, binMethod);
            setBins(calculatedBins);

            const minValue = inputData.value.reduce((min, val) => val !== null ? Math.min(min, val) : min, Infinity);
            const maxValue = inputData.value.reduce((max, val) => val !== null ? Math.max(max, val) : max, -Infinity);

            const histogramData: Partial<Plotly.PlotData>[] = [
                {
                    x: filteredValues,
                    type: 'histogram',
                    marker: {
                        color: 'grey',
                    },
                    autobinx: (bins === 9999) ? true : false,
                    xbins: {
                        start: minValue * 0.99,
                        end: maxValue * 1.01,
                        size: (Math.ceil(maxValue) - Math.floor(minValue)) / calculatedBins,
                    },
                    hovertemplate: 
                        'Range: %{x}<br>' +
                        'Count: %{y}<br>' +
                        '<extra></extra>',
                    hoverlabel: {
                        bgcolor: 'white',
                        bordercolor: 'grey',
                        font: { color: 'black' }
                    },
                },
            ];
            const histogramLayout: Partial<Plotly.Layout> = {
                title: {text: ''},
                xaxis: {
                    title: {text: selectedFieldAkaColumn},
                    showline: false,
                    showgrid: false,
                    zeroline: false,
                    fixedrange: true,
                },
                yaxis: {
                    title: {
                        text: 'Count',
                        font: { size: 14 }
                    },
                    showline: false,
                    side: 'right',
                    fixedrange: true,
                },
                margin: {
                    l: 10,
                    t: 20,
                    b: 30,
                },

                dragmode: "select",
                hiddenlabels: [],
                shapes: selectedRanges.map(range => ({
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper',
                    x0: range[0],
                    x1: range[1],
                    y0: 0,
                    y1: 1,
                    fillcolor: 'red',
                    opacity: 0.3,
                    line: {
                        width: 0,
                    }
                })),
                annotations: selectedRanges.length > 0 ? [{
                    text: 'Double-click to reset selection',
                    xref: 'paper',
                    yref: 'paper',
                    x: 1,
                    y: 1,
                    xanchor: 'right',
                    yanchor: 'top',
                    showarrow: false,
                    font: {
                        size: 12,
                        color: 'grey'
                    }
                }] : [],
            };
            setHistogramData(histogramData);
            setHistogramLayout(histogramLayout);
            setRevision(revision + 1);
            loadingStatus(false)
        }
    }, [inputData, bins, binMethod, customBins, selectedRanges]);

    const handlePlotClick = (event: Plotly.PlotMouseEvent) => {
        console.log("reactive HistogramFC click", event);
        if (event && event.points && event.points.length > 0) {
            // First clear any existing selection
            if (selectedRanges.length > 0) {
                handleOnDeselect();
            }
            
            const point = event.points[0];
            
            // Get the bin range
            const pointX = Number(point.x);
            const binSize = Number(point.data.xbins?.size) || 0;
            const binStart = pointX - (binSize / 2);
            const binEnd = pointX + (binSize / 2);
            
            // Get the indices directly from the point
            // @ts-ignore (pointIndices exists but isn't in the type definitions)
            const indicesArray = point.pointIndices || [];
    
            // Call onSelected with the indices and range
            onSelected(indicesArray, [[binStart, binEnd]]);
    
            // Update the plot to show the selection
            const newData = [...histogramData];
            if (newData[0]) {
                newData[0] = {
                    ...newData[0],
                    selectedpoints: indicesArray
                };
            }
            setHistogramData(newData);
            setSelectedRanges([[binStart, binEnd]]);
            setRevision(prev => prev + 1);
        }
        
        onClick(event);
    }
    const handlePlotSelected = (event: Plotly.PlotSelectionEvent) => {
        console.log("reactive HistogramFC selected", event);
        if (event && event.points && event.points.length > 0) {
            const ranges: [number, number][] = event.points.map(point => {
                if (typeof point.x !== "number") {
                    return [0, 0];
                }
                // @ts-ignore
                const binStart = point.x - (point.fullData.xbins.size / 2);
                // @ts-ignore
                const binEnd = point.x + (point.fullData.xbins.size / 2);
                return [binStart, binEnd];
            });

            const mergedRanges = mergeRanges(ranges);
            setSelectedRanges(mergedRanges);

            // @ts-ignore
            const indicesArray = event.points.flatMap(obj => obj.pointIndices);

            console.log("Selected ranges:", mergedRanges);
            console.log("Selected indices:", indicesArray);

            onSelected(indicesArray, mergedRanges);
        }
    }

    const mergeRanges = (ranges: [number, number][]): [number, number][] => {
        if (ranges.length <= 1) return ranges;

        ranges.sort((a, b) => a[0] - b[0]);

        const result: [number, number][] = [ranges[0]];

        for (const range of ranges.slice(1)) {
            const lastRange = result[result.length - 1];
            if (range[0] <= lastRange[1]) {
                lastRange[1] = Math.max(lastRange[1], range[1]);
            } else {
                result.push(range);
            }
        }

        return result;
    }

    const calculateBins = (N: number, method: string): number => {
        switch (method) {
            case 'sqrt':
                return Math.ceil(Math.sqrt(N));
            case 'sturges':
                return Math.ceil(Math.log2(N) + 1);
            case 'rice':
                return Math.ceil(2 * Math.cbrt(N));
            case 'scott': {
                const stdDev = 1; // Assumed standard deviation
                const binWidth = 3.5 * stdDev / Math.cbrt(N);
                const range = 10; // Assumed data range
                return Math.ceil(range / binWidth);
            }
            case 'freedman-diaconis': {
                const iqr = 1; // Assumed interquartile range
                const binWidth = 2 * iqr / Math.cbrt(N);
                const range = 10; // Assumed data range
                return Math.ceil(range / binWidth);
            }
            default:
                throw new Error('Invalid method');
        }
    }

    const handleOnDeselect = () => {
        console.log("BristolDemo Histogram onDeselect event")
        setSelectedRanges([]);
        onDeselect()
    }

    const handleMethodChange = (value: string) => {
        onBinMethodChange(value);
        onCustomBinsChange(undefined); // Clear custom bins when method is changed
        onDeselect(); // Trigger onDeselect when method is changed
    }

    const handleCustomBinsChange = (value: number | null) => {
        const validValue = value !== null ? Math.max(1, value) : undefined;
        setTempCustomBins(validValue);
        setHasNewInput(validValue !== undefined && validValue !== customBins);
    }

    const applyCustomBins = () => {
        onCustomBinsChange(tempCustomBins);
        setHasNewInput(false);
        onDeselect(); // Trigger onDeselect when custom bins are applied
    }

    const clearCustomBins = () => {
        setTempCustomBins(undefined);
        onCustomBinsChange(undefined);
        onBinMethodChange('rice');
        setHasNewInput(false);
        onDeselect(); // Trigger onDeselect when custom bins are cleared
    }

    return (
        <div style={{ 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "10px",
                padding: "0 0 5px 0",  // Add some bottom padding
                flexShrink: 0  // Prevent this div from shrinking
            }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ marginRight: "5px", marginLeft: "10px", textAlign: "left", width: "100px" }}>
                        Bin Count: {bins}
                    </span>
                    <span style={{ textAlign: "right" }}> || </span>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <label htmlFor="customBins" style={{ marginRight: "5px", textAlign: "right", width: "100px" }}>
                        Set Bin Count:
                    </label>
                    <InputNumber
                        id="customBins"
                        style={{
                            width: "75px",
                            height: "28px",
                            display: "flex",
                            alignItems: "center"
                        }}
                        value={tempCustomBins}
                        onChange={handleCustomBinsChange}
                        min={1}
                    />
                    <Tooltip title="Apply custom bins" open={hasNewInput ? undefined : false}>
                        <Button
                            onClick={applyCustomBins}
                            style={{
                                marginLeft: "5px",
                                height: "28px",
                                backgroundColor: hasNewInput ? "#52c41a" : "white",
                                color: hasNewInput ? "white" : "rgba(0, 0, 0, 0.25)",
                                borderColor: hasNewInput ? "#52c41a" : "#d9d9d9",
                            }}
                            disabled={!hasNewInput}
                        >
                            Apply
                        </Button>
                    </Tooltip>
                    <Tooltip title="Clear custom bins" open={tempCustomBins !== undefined ? undefined : false}>
                        <Button
                            icon={<DeleteOutlined />}
                            onClick={clearCustomBins}
                            style={{
                                marginLeft: "5px",
                                height: "28px",
                                color: tempCustomBins !== undefined ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.25)",
                                borderColor: tempCustomBins !== undefined ? "#d9d9d9" : "transparent",
                                backgroundColor: "transparent",
                            }}
                            disabled={tempCustomBins === undefined}
                        />
                    </Tooltip>
                </div>
            </div>

            <div style={{ 
                flex: 1,  // Take remaining space
                minHeight: 0  // Important! Allows flex child to shrink below content size
            }}>
                <Plot
                    divId={"reactiveHistogram"}
                    config={{
                        responsive: true,
                        displaylogo: false,
                        modeBarButtonsToAdd: [],
                        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'zoom2d', 'pan2d',
                            'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d',
                            'hoverClosestCartesian', 'hoverCompareCartesian', 'hoverClosestPie',
                            'toggleHover', 'resetViews', 'toggleSpikelines', 'resetViewMapbox'],
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    data={histogramData}
                    layout={histogramLayout}
                    revision={revision}
                    onClick={handlePlotClick}
                    onUpdate={(figure) => {
                    }}
                    onSelected={handlePlotSelected}
                    onDeselect={handleOnDeselect}
                />
            </div>
        </div>
    );
}

export default Histogram;
