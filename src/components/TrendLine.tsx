import React, {useEffect, useState} from 'react';
import Plot from 'react-plotly.js';
import Plotly from "plotly.js";
import {Checkbox, Dropdown, DropdownProps, MenuProps} from 'antd';
import {DownOutlined} from "@ant-design/icons";
import dayjs from "dayjs";
import { ResponseData } from '../services/dataConnector';

// Updated interface to include interpolatedEpochTimes
interface TrendLineProps {
  inputData: ResponseData | undefined;
  loadingStatus: React.Dispatch<React.SetStateAction<boolean>>;
  dataGaps: Partial<Plotly.Shape>[] | undefined;
  selectionIndicesArray: number[];
  aggregationInterval: string;
  movingAverageData: number[];
  interpolatedEpochTimes: number[];
  showOutliers: boolean;
  setShowOutliers: React.Dispatch<React.SetStateAction<boolean>>;
  outlierTimestamps: number[];
  currentVariable: string;
  period: string;
  showMovingAverage: boolean;
  setShowMovingAverage: React.Dispatch<React.SetStateAction<boolean>>;
  showDataGaps: boolean;
  onShowDataGapsChange: (show: boolean) => void;
  showDataMarkers: boolean;
  onShowDataMarkersChange: (show: boolean) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

const TrendLine: React.FC<TrendLineProps> = ({
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
                                                      showDataGaps,
                                                      onShowDataGapsChange,
                                                      showDataMarkers,
                                                      onShowDataMarkersChange,
                                                      isFullScreen,
                                                      onToggleFullScreen
                                                  }) => {


    const [graphData, setGraphData] = useState<Partial<Plotly.PlotData>[]>([{}]);
    const [graphLayout, setGraphLayout] = useState<Partial<Plotly.Layout>>({
        xaxis: {//title: 'Date',showline: false,showgrid: false,zeroline: false,
            visible: false
        },
        yaxis: {//showline: false,showgrid: false,zeroline: false,
            // removed visible: false to allow y-axis title to display
        },
    });
    const [revision, setRevision] = useState(0);
    const [safeToDisplay, setSafeToDisplay] = useState(true);
    const [open, setOpen] = useState(false);
    const [epochTimeArray, setEpochTimeArray] = useState<number[]>([]);
    const [valueArray, setValueArray] = useState<number[]>([]);
    const [mainDataTrace, setMainDataTrace] = useState<Partial<Plotly.PlotData>>({});
    const [dataGapsTrace, setDataGapsTrace] = useState<Partial<Plotly.PlotData>>({});
    const [movingAverageTrace, setMovingAverageTrace] = useState<Partial<Plotly.PlotData>>({});

    useEffect(() => {
        if (inputData) {
            const epochTimes = [...inputData.EpochTime];
            setEpochTimeArray(epochTimes);
            const values = [...inputData.value];
            setValueArray(values);
            const filteredValues = values.filter((value: number, index: number) => value !== null);
            const filteredEpochTimes = epochTimes.filter((value: number, index: number) => values[index] !== null);

            const nrRows = epochTimes.length;
            const safeToRenderMarkers = nrRows <= 1000000;
            setSafeToDisplay(safeToRenderMarkers)
            console.time("minMaxEpochTime");
            const minEpochTime = filteredEpochTimes.reduce((min: number, current: number) => Math.min(min, current), Infinity);
            const maxEpochTime = filteredEpochTimes.reduce((max: number, current: number) => Math.max(max, current), -Infinity);
            console.timeEnd("minMaxEpochTime");
            let xaxisRange: [number, number];
            if (period === 'month') {
                xaxisRange = [
                    dayjs(minEpochTime).startOf('month').valueOf(),
                    dayjs(minEpochTime).endOf('month').valueOf()
                ];
            } else if (period === 'year') {
                xaxisRange = [
                    dayjs(minEpochTime).startOf('year').valueOf(),
                    dayjs(minEpochTime).endOf('year').valueOf()
                ];
            } else {
                xaxisRange = [minEpochTime, maxEpochTime];
            }

            const newMainDataTrace: Partial<Plotly.PlotData> = {
                x: filteredEpochTimes,
                y: filteredValues,
                type: 'scattergl',
                name: '',
                mode: showDataMarkers && safeToRenderMarkers ? 'markers' : 'lines',
                marker: {color: 'black', size: 3},
                line: {color: 'black', width: .5},
                hoverinfo: 'text',
                text: filteredValues.map((value: number | string | null, index: number) => {
                    const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                    return `${dayjs(filteredEpochTimes[index]).format('YYYY/MM/DD HH:mm:ss [UTC]Z')}<br>${currentVariable}: ${formattedValue}`;
                }),
            };

            setMainDataTrace(newMainDataTrace);
            setGraphData([newMainDataTrace, dataGapsTrace]);

            console.log('Setting y-axis title to:', currentVariable);
            setGraphLayout({
                xaxis: {
                    showgrid: false,
                    zeroline: false,
                    rangeslider: {
                        visible: true,
                        range: xaxisRange,
                        thickness: 0.05,
                        bordercolor: 'black',
                        borderwidth: 1,
                        bgcolor: '#f4f4f4',
                    },
                    autorange: false,
                    range: xaxisRange,
                    type: 'date',
                },
                yaxis: {
                    title: {
                        text: currentVariable,
                        font: { size: 14 }
                    },
                    showline: false,
                    fixedrange: false,
                },
                margin: {t: 0, b: 2, l: 40, r: 5},
                showlegend: false,
                spikedistance: 20,
                font: {
                    size: 11,
                },
            } as Partial<Plotly.Layout>);

            setRevision((prevRevision) => prevRevision + 1);
            loadingStatus(false);
        }
    }, [inputData]);

    // now we create useEffect to be triggered when datagaps are calculated and comes as input and only shapes: dataGaps is updated
    useEffect(() => {
        setGraphData((prevData) => {
            let newData = [...prevData];
            const mainDataIndex = newData.findIndex(trace => trace.name === '');
            const outlierIndex = newData.findIndex(trace => trace.name === 'Outliers');
            const poiIndex = newData.findIndex(trace => trace.name === 'poi');
    
            if (dataGaps && showDataGaps) {
                const newDataGapsTrace: Partial<Plotly.PlotData> = {
                    type: 'scatter',
                    x: [],
                    y: [],
                    mode: 'lines',
                    line: {
                        color: 'red',
                        width: 2,
                    },
                    showlegend: false,
                };
                setDataGapsTrace(newDataGapsTrace);
    
                // Preserve the order: main data, data gaps, outliers (if exists), poi (if exists)
                newData = [
                    newData[mainDataIndex],
                    newDataGapsTrace,
                    ...(outlierIndex !== -1 ? [newData[outlierIndex]] : []),
                    ...(poiIndex !== -1 ? [newData[poiIndex]] : [])
                ];
    
                setGraphLayout((prevLayout) => ({
                    ...prevLayout,
                    shapes: dataGaps,
                    spikedistance: 20,
                }));
            } else {
                setDataGapsTrace({});
                newData = [
                    newData[mainDataIndex],
                    ...(outlierIndex !== -1 ? [newData[outlierIndex]] : []),
                    ...(poiIndex !== -1 ? [newData[poiIndex]] : [])
                ];
                setGraphLayout((prevLayout) => ({
                    ...prevLayout,
                    shapes: [],
                    spikedistance: 20,
                }));
            }
    
            return newData;
        });
    
        setRevision((prevRevision) => prevRevision + 1);
    }, [dataGaps, showDataGaps, mainDataTrace]);

    useEffect(() => {
        setGraphData((prevData) => {
            let newData = [...prevData];
            const outlierIndex = newData.findIndex(trace => trace.name === "Outliers");

            if (outlierTimestamps.length > 0) {
                const outlierTrace: Partial<Plotly.PlotData> = {
                    x: outlierTimestamps.map((timestamp) => new Date(timestamp)),
                    y: outlierTimestamps.map((timestamp) => valueArray[epochTimeArray.indexOf(timestamp)]),
                    type: 'scattergl' as const,
                    mode: 'markers',
                    marker: { color: 'red', size: 8, symbol: 'star' },
                    name: "Outliers",
                    visible: showOutliers
                };

                if (outlierIndex === -1) {
                    newData.push(outlierTrace);
                } else {
                    newData[outlierIndex] = outlierTrace;
                }
            } else if (outlierIndex !== -1) {
                newData.splice(outlierIndex, 1);
            }

            return newData;
        });

        setRevision((prevRevision) => prevRevision + 1);
    }, [outlierTimestamps, showOutliers, valueArray, epochTimeArray]);

    useEffect(() => {
        setGraphData((prevData) => {
            const outlierIndex = prevData.findIndex(trace => trace.name === "Outliers");
            if (outlierIndex !== -1) {
                prevData[outlierIndex].visible = showOutliers ? true : 'legendonly';
            }
            return prevData;
        });
        setRevision((prevRevision) => prevRevision + 1);

    }, [showOutliers]);


    // hook to set visibility of data markers
    useEffect(() => {
        setGraphData((prevData) => {
            prevData[0].mode = showDataMarkers && safeToDisplay ? 'markers' : 'lines'
            return prevData;
        });
        setRevision((prevRevision) => prevRevision + 1);
    }, [showDataMarkers]);


    useEffect(() => {
        setGraphData((prevData) => {
            const poiIndex = prevData.findIndex(trace => trace.name === "poi");
            if (selectionIndicesArray.length === 0) { // if no selection, remove the poi trace
                return prevData.filter(trace => trace.name !== "poi");
            }
            
            const newTrace: Partial<Plotly.PlotData> = {
                x: selectionIndicesArray.map(index => (prevData[0].x as Plotly.Datum[])[index]),
                y: selectionIndicesArray.map(index => (prevData[0].y as Plotly.Datum[])[index]),
                type: 'scattergl',
                mode: 'markers',
                marker: {color: 'red', size: 10},
                showlegend: false,
                name: "poi",
                hoverinfo: 'skip'
            };

            if (poiIndex === -1) { // if poi trace is not present, create it
                return [...prevData, newTrace];
            } else { // if poi trace is present, update it
                const updatedData = [...prevData];
                updatedData[poiIndex] = newTrace;
                return updatedData;
            }
        });

        setRevision(prev => prev + 1);
    }, [selectionIndicesArray]);


    const items: MenuProps['items'] = [
        {
            key: '1',
            label: 'Show Data Gaps',
            icon: <Checkbox
                checked={showDataGaps}
                disabled={(aggregationInterval === 'none')}
            />,
            onClick: () => onShowDataGapsChange(!showDataGaps),
        },
        {
            key: '2',
            label: <Checkbox
                checked={showDataMarkers}
                onChange={(e) => onShowDataMarkersChange(e.target.checked)}
                disabled={!safeToDisplay}
            >Show Data Markers </Checkbox>,
        },
        {
            key: '3',
            label: <Checkbox
                checked={showOutliers}
                onChange={(e) => setShowOutliers(e.target.checked)}
                disabled={(aggregationInterval === 'none' || outlierTimestamps.length < 1)}
            >Show Potential Outliers</Checkbox>,
        },
        {
            key: '4',
            label: <Checkbox
                checked={showMovingAverage}
                onChange={(e) => setShowMovingAverage(e.target.checked)}
                disabled={movingAverageData.length === 0}
            >Show Baseline</Checkbox>,
        },
    ];

    const handleOpenChange: DropdownProps['onOpenChange'] = (nextOpen, info) => {
        if (info.source === 'trigger' || nextOpen) {
            setOpen(nextOpen);
        }
    };

    useEffect(() => {
        if (movingAverageData.length > 0 && interpolatedEpochTimes.length > 0) {
            const newMovingAverageTrace: Partial<Plotly.PlotData> = {
                x: interpolatedEpochTimes,
                y: movingAverageData,
                type: 'scattergl',
                mode: 'lines',
                name: 'Moving Average',
                line: { color: 'blue', width: 2 },
                visible: showMovingAverage ? true : 'legendonly',
            };
            setMovingAverageTrace(newMovingAverageTrace);
            setGraphData((prevData) => {
                const maIndex = prevData.findIndex(trace => trace.name === "Moving Average");
                if (maIndex === -1) {
                    return [...prevData, newMovingAverageTrace];
                } else {
                    const newData = [...prevData];
                    newData[maIndex] = newMovingAverageTrace;
                    return newData;
                }
            });
            setRevision((prevRevision) => prevRevision + 1);
        }
    }, [movingAverageData, interpolatedEpochTimes, showMovingAverage]);

    return (
        <div style={{ 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0px 0px 0px 0px' }}>

            <Dropdown menu={{items}}
                      placement={'bottomLeft'}
                      trigger={['click']} //{['hover']}
                      onOpenChange={handleOpenChange}
                      open={open}
            >
                {/*                <div style={{textAlign: 'left', margin: '15px 10px 0px 0px', zIndex: 1, width: 'fit-content'}}>
                    <span style={{cursor: 'pointer'}}>Options<DownOutlined/></span>
                </div>*/}
                <a className="ant-dropdown-link"
                   style={{textAlign: 'left', margin: '0px 0px 0px 10px', zIndex: 1, width: 'fit-content'}}
                   onClick={e => e.preventDefault()}>
                    Options <DownOutlined/>
                </a>
            </Dropdown>
            <span style={{ 
        display: 'flex',
        alignItems: 'flex-end',
        marginRight: '10px',
        marginBottom: '5px',
        height: '100%'
    }}>
        <span style={{ 
            width: '20px', 
            height: '10px', 
            backgroundColor: 'rgba(0, 0, 255, 0.6)',
            display: 'inline-block',
            marginRight: '5px',
            marginBottom: '5px'
        }}></span>
        -Missing Data
    </span>
    </div>



            <div style={{ flex: 1, minHeight: 0 }}>
                <Plot
                    config={{
                        responsive: true,
                        displaylogo: false,
                        //displayModeBar: true,
                        doubleClick: 'reset',
                        modeBarButtonsToRemove: ['sendDataToCloud', 'hoverClosestCartesian', 'hoverCompareCartesian', 'zoom2d'],
                    }}
                    useResizeHandler={true}
                    style={{width: '100%', height: '100%'}}
                    data={graphData}
                    layout={graphLayout}
                    revision={revision}
                    onClick={(data) => {
                        console.log("clicked point:", data.points)
                    }}
                />
            </div>
        </div>
    );
};

export default TrendLine;
