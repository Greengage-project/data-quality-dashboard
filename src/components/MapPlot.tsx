import React, {useState, useEffect} from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js';
import dayjs from "dayjs";
import {Dropdown, Checkbox, MenuProps, Space, DropdownProps, Button, Slider, InputNumber} from 'antd';
import {DownOutlined, FullscreenOutlined, FullscreenExitOutlined} from '@ant-design/icons';
import {calculateSpeed} from "../services/dataHelpers.ts";
import { ResponseData } from   '../services/dataConnector';

interface MapVizProps {
    inputData: ResponseData | undefined;
    selectedFieldAkaColumn: string;
    //onSiteClick: (siteID: number | undefined, siteName: string|undefined) => void;
    includeCoordinates: boolean;
    latitudeLongitudeColumnNames: string[];
    selectedCalendarHeatmapIndex: number | undefined;
    histogramSelectionRanges: [number, number][];
    isFullScreen?: boolean;
    onToggleFullScreen?: () => void;
    colorscale: Plotly.ColorScale | undefined;
    onColorscaleChange: (colorscale: string) => void;
    reverseColorscale: boolean;
    onReverseColorscaleChange: (reverse: boolean) => void;
    visualizationType: 'scattermap' | 'densitymap';
    onVisualizationTypeChange: (type: 'scattermap' | 'densitymap') => void;
}

const MapPlot: React.FC<MapVizProps> = ({
                                            inputData,
                                            selectedFieldAkaColumn,
                                            includeCoordinates,
                                            latitudeLongitudeColumnNames,
                                            selectedCalendarHeatmapIndex,
                                            histogramSelectionRanges,
                                            isFullScreen,
                                            onToggleFullScreen,
                                            colorscale,
                                            onColorscaleChange,
                                            reverseColorscale,
                                            onReverseColorscaleChange,
                                            visualizationType,
                                            onVisualizationTypeChange,
                                        }) => {
    const [scatterMapData, setScatterMapData] = useState<Partial<Plotly.PlotData>[]>([{type: 'scattermap' as any}]);
    const [scatterMapRevision, setScatterMapRevision] = useState<number>(0);
    const [open, setOpen] = useState(false);
    const [initialZoom, setInitialZoom] = useState<number | undefined>();
    const [initialCenter, setInitialCenter] = useState<{lat: number, lon: number} | undefined>();
    const [selectedPoints, setSelectedPoints] = useState<{count: number, mean: number | null}>({ count: 0, mean: null });
    const [colorScaleRange, setColorScaleRange] = useState<[number, number]>([0, 100]);
    const [dataRange, setDataRange] = useState<[number, number]>([0, 100]);

    // Add layout state
    const [mapLayout, setMapLayout] = useState<Partial<Plotly.Layout>>({
        dragmode: 'zoom',
        map: { style: 'carto-positron' },
        margin: { r: 0, t: 0, b: 0, l: 0 },
    } as any);

    const colorscaleOptions = [
        'Blackbody', 'Bluered', 'Blues', 'Cividis', 'Earth', 'Electric', 'Greens', 'Greys', 'Hot', 'Jet', 'Magma', 'Picnic', 'Portland',
        'Rainbow', 'RdBu', 'Reds', 'Viridis', 'YlGnBu', 'YlOrRd'
    ];

    const customColorscales: { [key: string]: Plotly.ColorScale } = {
        'Magma': [
            [0, "rgb(0,0,4)"],
            [0.13, "rgb(28,16,68)"],
            [0.25, "rgb(79,18,123)"],
            [0.38, "rgb(129,37,129)"],
            [0.5, "rgb(181,54,122)"],
            [0.63, "rgb(229,80,100)"],
            [0.75, "rgb(251,135,97)"],
            [0.88, "rgb(254,194,135)"],
            [1, "rgb(252,253,191)"]
        ]
    };

    const handleScatterMapClick = (event: Plotly.PlotMouseEvent) => {
        console.log('ScatterMap clicked', event);
    }

    const handleSelectionEvent = (event: Plotly.PlotSelectionEvent) => {
        if (event && event.points) {
            // Get values directly from the points data
            console.log("handleSelectionEvent - event.points", event.points);
            const selectedValues = event.points
                .map(point => {
                    const colors = point.data.marker?.color as number[];
                    return colors?.[point.pointIndex];
                })
                .filter((val): val is number => val !== null && val !== undefined);
            
            const count = selectedValues.length;
            const mean = count > 0 
                ? selectedValues.reduce((sum, val) => sum + val, 0) / count 
                : null;
            
            setSelectedPoints({ count, mean });

            // Update traces while preserving marker properties
            setScatterMapData(prevData => {
                // If we have multiple traces (histogram selection active)
                if (prevData.length > 1) {
                    return prevData.map((trace, traceIndex) => {
                        // Find points that belong to this trace
                        const tracePoints = event.points.filter(p => p.curveNumber === traceIndex);
                        
                        if (tracePoints.length === 0) {
                            // No points selected in this trace
                            return {
                                ...trace,
                                selectedpoints: undefined,
                                marker: {
                                    ...trace.marker,
                                    opacity: 0.1
                                }
                            };
                        }

                        // Create opacity array for this trace
                        const totalPoints = Array.isArray(trace.lat) ? trace.lat.length : 0;
                        const newOpacities = new Array(totalPoints).fill(0.1);
                        tracePoints.forEach(point => {
                            newOpacities[point.pointIndex] = 0.9;
                        });

                        return {
                            ...trace,
                            selectedpoints: tracePoints.map(p => p.pointIndex),
                            marker: {
                                ...trace.marker,
                                opacity: newOpacities
                            }
                        };
                    });
                }

                // Single trace case (no histogram selection)
                const baseTrace = {
                    ...prevData[0],
                    selectedpoints: event.points.map(p => p.pointIndex),
                };

                const totalPoints = Array.isArray(prevData[0].lat) ? prevData[0].lat.length : 0;
                const newOpacities = new Array(totalPoints).fill(0.1);
                
                event.points.forEach(point => {
                    newOpacities[point.pointIndex] = 0.9;
                });

                return [{
                    ...baseTrace,
                    marker: {
                        ...prevData[0].marker,
                        opacity: newOpacities
                    }
                }];
            });
        }
    };

    const handleDeselect = () => {
        setSelectedPoints({ count: 0, mean: null });
        // Reset opacity for all points on deselection
        setScatterMapData(prevData => {
            // Handle multiple traces
            if (prevData.length > 1) {
                return prevData.map(trace => ({
                    ...trace,
                    selectedpoints: undefined,
                    marker: {
                        ...trace.marker,
                        opacity: 0.9
                    }
                }));
            }

            // Single trace case
            const baseTrace = {
                ...prevData[0],
                selectedpoints: undefined,
                marker: {
                    ...prevData[0].marker,
                    opacity: 0.9
                }
            };
            return [baseTrace];
        });
    };

    useEffect(() => {
        console.time("MapPlot main Effect hook");


        if (inputData && inputData.latitude && inputData.longitude && inputData.value) {
            // filter input data to remove entries where one of the latitude, longitude or value is null
            // otherwise the plotly map will not work
            console.time("MapPlot useEffect - filtering input data");
            // initialize arrays to store filtered values
            let filteredValues: any[] = [];
            let filteredLatitudes: number[] = [];
            let filteredLongitudes: number[] = [];
            let filteredEpochTimes: number[] = [];

            // loop through the values and filter out null entries
            for (let i = 0; i < inputData.value.length; i++) {
                if (inputData.value[i] !== null && inputData.latitude[i] !== null && inputData.longitude[i] !== null) {
                    filteredValues.push(inputData.value[i]);
                    filteredLatitudes.push(inputData.latitude[i]);
                    filteredLongitudes.push(inputData.longitude[i]);
                    filteredEpochTimes.push(inputData.EpochTime[i]);
                }
            }

            console.timeEnd("MapPlot useEffect - filtering input data");
            
            // Get the speed from filtered datapoints
            // NOTE: This did not work as intended due to inaccuracy of GPS data. 
            // const speed = calculateSpeed(filteredLatitudes, filteredLongitudes, filteredEpochTimes);
            // console.log("speed",   speed);


            // calculate min and max lat and lon values for determining the center of the map
            const minLat = filteredLatitudes.reduce((min, current) => Math.min(min, current), Infinity);
            const maxLat = filteredLatitudes.reduce((max, current) => Math.max(max, current), -Infinity);
            const minLon = filteredLongitudes.reduce((min, current) => Math.min(min, current), Infinity);
            const maxLon = filteredLongitudes.reduce((max, current) => Math.max(max, current), -Infinity);
            // calculate center of the map - can be also extracted from plotly graph element - it is called center!!!
            const centerLat = (minLat + maxLat) / 2;
            const centerLon = (minLon + maxLon) / 2;

            // calculate distance between the min and max points to give geo range
            const latDistance = maxLat - minLat;
            const lonDistance = maxLon - minLon;

            // calculating zoom level based on the distance
            // fit the entire latitude range (360 degrees) within the map
            // logarithm base 2 of the ratio of the entire latitude range to the range covered by the data points
            const zoomLat = Math.log2(360 / latDistance);
            const zoomLon = Math.log2(360 / lonDistance);
            // take the minimum of the two zoom levels and subtract 1.1 to zoom out a bit

            const zoom = Math.min(zoomLat, zoomLon, 16) - 1.1;

            // Store initial zoom and center
            setInitialZoom(zoom);
            setInitialCenter({ lat: centerLat, lon: centerLon });

            // test min max lat lon for range within -90 to 90 and -180 to 180, if false return div with a message
            // that " latitude longitude values incorrect (outside of range)"
            if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) {
                console.log("!!!!!!!!!!!!!!!!!!!!!!!!OUT OF RANGE!!!!!!!!!!!!!!!!!!!!!!!")
                const newScatterMapData: Partial<Plotly.PlotData>[] = [{
                    type: visualizationType as any,
                    text: [] as string[],
                    lon: [] as number[],
                    lat: [] as number[],
                    mode: 'markers',
                    marker: {
                        color: [] as number[],
                        size: 15,
                        opacity: 0.9
                    }
                }];

                setScatterMapData(newScatterMapData);
                setMapLayout({
                    ...mapLayout,
                    title: {
                        text: `Latitude/Longitude values are incorrect<br>(out of range)`,
                        font: {size: 16, color: 'black'},
                        x: 0.5,
                        y: 0.5,
                    },
                });
                setScatterMapRevision(prev => prev + 1);
                return;
            }

            const newScatterMapData: Partial<Plotly.PlotData>[] = [

                {
                    name: "",
                    type: visualizationType as any,
                    // text based on the value of the selected field and corresponding filteredEpochTimes value converted to format
                    text: filteredValues.map((value: number | string | null, index: number) => {
                        const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                        return `${dayjs(filteredEpochTimes[index]).format('YYYY/MM/DD HH:mm:ss [UTC]Z')}<br>${selectedFieldAkaColumn}: ${formattedValue}<br>Latitude: ${filteredLatitudes[index]}<br>Longitude: ${filteredLongitudes[index]}`;
                        //return `${dayjs(filteredEpochTimes[index]).format('YYYY/MM/DD HH:mm:ss [UTC]Z')}<br>${selectedFieldAkaColumn}: ${formattedValue}<br>Latitude: ${filteredLatitudes[index]}<br>Longitude: ${filteredLongitudes[index]}<br>Speed: ${speed[index].speedKmph}`;

                    }),
                    //hoverinfo: 'text', // Set hoverinfo to 'text' to display custom text on hover
                    lat: filteredLatitudes,
                    lon: filteredLongitudes,
                    hovertemplate: '%{text}',
                    hoverlabel: {
                        align: 'left', // Align hover text to the left
                        bgcolor: 'white', // White background for hover text
                    },
                    //radius: 15,  //filteredValues.map((value: number) => value * 0.1),
                    showscale: visualizationType === 'scattermap',
                    showlegend: false,
                    marker: {
                        color: filteredValues,
                        colorscale: colorscale ? (customColorscales[colorscale as keyof typeof customColorscales] || colorscale) : undefined,
                            colorbar: { title: {text: selectedFieldAkaColumn,
                                side: 'right',
                                font: {
                                    color: 'black',
                                    size: 14,
                                    family: 'Arial, sans-serif',
                                },
                            },
                            },
                        reversescale: reverseColorscale,
                        opacity: 0.9,
                        size: 15,
                        autocolorscale: false,
                        sizemode: 'area',
                    },
                }
            ];

            setScatterMapData(newScatterMapData);

            console.time("MapPlot useEffect - calculate ranges");
            // Calculate ranges from the filtered values
            if (filteredValues.length > 0) {
                const [min, max] = filteredValues.reduce(
                    ([min, max], current) => [
                        Math.min(min, current),
                        Math.max(max, current)
                    ],
                    [filteredValues[0], filteredValues[0]]
                );
                setDataRange([min, max]);
                if (!colorScaleRange || (colorScaleRange[0] === dataRange[0] && colorScaleRange[1] === dataRange[1])) {
                    setColorScaleRange([min, max]);
                }
            }
            console.timeEnd("MapPlot useEffect - calculate ranges");

            setMapLayout({
                ...mapLayout,
                title: {},
            });

            // Only update center and zoom if they haven't been set by user interaction
            if (!(mapLayout as any).map?.center || !(mapLayout as any).map?.zoom) {
                setMapLayout({
                    ...mapLayout,
                    dragmode: 'zoom',
                    map: {
                        ...(mapLayout as any).map,
                        style: 'carto-positron',
                        center: {lat: centerLat, lon: centerLon},
                        zoom: zoom,
                    },
                    title: {},
                    margin: {r: 0, t: 0, b: 0, l: 0},
                } as any);
            }
            setScatterMapRevision(prev => prev + 1);
        } else {
            console.log("No lat/lon values detected");
            
            // Create all new states at once
            const newLayout: Partial<Plotly.Layout> = {
                dragmode: 'zoom' as const,
                ...mapLayout,
                margin: { r: 0, t: 0, b: 0, l: 0 },
                title: {
                    text: `No geolocation fields<br>detected, or selected<br>in the data import tab`,
                    font: {size: 16, color: 'black'},
                    x: 0.5,
                    y: 0.5,
                },
            };

                const newScatterMapData: Partial<Plotly.PlotData>[] = [{
                    type: visualizationType as any,
                text: [] as string[],
                lon: [] as number[],
                lat: [] as number[],
                mode: 'markers',
                marker: {
                    color: [] as number[],
                    size: 15,
                    opacity: 0.9
                }
            }];

            // Update all states together
            setMapLayout(newLayout);
            setScatterMapData(newScatterMapData);
            setInitialZoom(1);
            setInitialCenter({ lat: 0, lon: 0 });
            setDataRange([0, 100]);
            setColorScaleRange([0, 100]);
            setSelectedPoints({ count: 0, mean: null });
            setScatterMapRevision(prev => prev + 1);
        }
        console.timeEnd("MapPlot main Effect hook");
    }, [inputData, visualizationType, includeCoordinates]);

    // Add effect to reset selections and ranges when data changes
    useEffect(() => {
        setSelectedPoints({ count: 0, mean: null });
        if (inputData && inputData.value.length > 0) {
            const [min, max] = inputData.value.reduce(
                ([min, max], current) => [
                    Math.min(min, current),
                    Math.max(max, current)
                ],
                [inputData.value[0], inputData.value[0]]
            );
            setDataRange([min, max]);
            setColorScaleRange([min, max]);
        }
    }, [inputData]);

    // If histogram selection ranges are defined, create a new trace with the selected points
    useEffect(() => {
        // Reset selected points when histogram selection changes
        setSelectedPoints({ count: 0, mean: null });
        if (inputData && inputData.latitude && inputData.longitude && inputData.value && inputData.EpochTime) {
            if (histogramSelectionRanges.length > 0) {
                let selectedIndices: number[] = [];

                // Find indices within the histogram selection ranges
                histogramSelectionRanges.forEach(([min, max]) => {
                    inputData.value.forEach((val: number, index: number) => {
                        if (val >= min && val <= max) {
                            selectedIndices.push(index);
                        }
                    });
                });

                // Create a new trace for selected points, maintaining their original colors and style
                const newTrace: Partial<Plotly.PlotData> = {
                    type: "scattermap" as any,
                    lat: selectedIndices.map(i => inputData.latitude![i]), 
                    lon: selectedIndices.map(i => inputData.longitude![i]),
                    text: selectedIndices.map(i => `Selected datapoint:<br>${dayjs(inputData.EpochTime[i]).format('YYYY/MM/DD HH:mm:ss [UTC]Z')}<br>${selectedFieldAkaColumn}: ${inputData.value[i]}<br>Latitude: ${inputData.latitude![i]}<br>Longitude: ${inputData.longitude![i]}`),
                    hovertemplate: '%{text}',
                    hoverlabel: {
                        align: 'left',
                        bgcolor: 'red',
                    },
                    mode: 'markers',
                    marker: {
                        color: selectedIndices.map(i => inputData.value[i]),
                        colorscale: colorscale ? (customColorscales[colorscale as keyof typeof customColorscales] || colorscale) : undefined,
                        colorbar: {
                            title: {text: selectedFieldAkaColumn,
                                side: 'right',
                                font: {
                                    color: 'black',
                                    size: 14,
                                    family: 'Arial, sans-serif',
                                },
                            },
                        },
                        reversescale: reverseColorscale,
                        size: 15,
                        showscale: visualizationType === 'scattermap'
                    },
                    name: '',
                    showlegend: false,
                };

                // Hide the base trace and add the selection trace
                setScatterMapData(prevData => {
                    const baseTrace = {
                        ...prevData[0],
                        visible: false // Hide the base trace completely
                    };
                    return [baseTrace, newTrace];
                });
            } else {
                // Restore the base trace visibility when no selection
                setScatterMapData(prevData => {
                    const baseTrace = {
                        ...prevData[0],
                        visible: true // Show the base trace
                    };
                    return [baseTrace];
                });
            }
            setScatterMapRevision(prev => prev + 1);
        }
    }, [histogramSelectionRanges]);

    // If a calendar heatmap index is selected, create a new trace with the point at the selected index
    useEffect(() => {
            // if length of selectedCalendarHeatmapIndex is greater than 0 make a new trace with the point at the selected index
            // add this trace to the scatterMapData array IN THE FRONT AND REMOVE THE OLD ADDITIONAL TRACE
            // set the scatterMapRevision to force a rerender
            if (selectedCalendarHeatmapIndex !== undefined) {

                const newScatterMapData: Partial<Plotly.PlotData>[] = [
                    {
                        type: visualizationType as any,
                        text: [],
                        lon: [],
                        lat: [],
                        mode: 'markers',
                        marker: {
                            color: 'blue',
                            size: 50,
                        },

                    },
                ];
                const latValuesArray = inputData?.latitude;
                const lonValuesArray = inputData?.longitude;
                const epochTimeArray = inputData?.EpochTime;

                if (latValuesArray && lonValuesArray && epochTimeArray) {

                    newScatterMapData[0].lat = [latValuesArray[selectedCalendarHeatmapIndex]];
                    newScatterMapData[0].lon = [lonValuesArray[selectedCalendarHeatmapIndex]];
                    newScatterMapData[0].text = [`${dayjs(epochTimeArray[selectedCalendarHeatmapIndex]).format('YYYY/MM/DD HH:mm:ss [UTC]Z')}<br>Latitude: ${latValuesArray[selectedCalendarHeatmapIndex]}<br>Longitude: ${lonValuesArray[selectedCalendarHeatmapIndex]}`];
                }

                // now add the new trace on top of scatterMapData array (REMOVING OLD ADDITIONAL TRACE)
                setScatterMapData([...newScatterMapData, ...scatterMapData.slice(1)]);

                setScatterMapRevision(prev => prev + 1);
            }
        }
        , [selectedCalendarHeatmapIndex]);


    const handleVisualizationTypeChange = (key: 'densitymap' | 'scattermap') => {
        onVisualizationTypeChange(key);
        const newScatterMapData = scatterMapData.map((trace, index) =>
            index === 0 ? {
                ...trace,
                type: key as any,
                showscale: key === 'scattermap',
            } : trace
        );
        setScatterMapData(newScatterMapData as any);
    };

    const handleReverseColorscaleChange = (value: boolean) => {
        onReverseColorscaleChange(value);
        const newScatterMapData = scatterMapData.map((trace, index) =>
            index === 0 ? {
                ...trace,
                marker: {
                    ...trace.marker,
                    reversescale: value,
                },
            } : trace
        );
        setScatterMapData(newScatterMapData);
    };

    const handleColorscaleChange = (key: string) => {
        onColorscaleChange(key);
        const newScatterMapData = scatterMapData.map((trace, index) =>
            index === 0 ? {
                ...trace,
                marker: {
                    ...trace.marker,
                    colorscale: customColorscales[key] || key,
                },
            } : trace
        );
        setScatterMapData(newScatterMapData);
    };

    const handleMenuClick = ({key}: { key: string }) => {
        if (colorscaleOptions.includes(key)) {
            handleColorscaleChange(key);
        } else if (key === 'reverseColorscale') {
            handleReverseColorscaleChange(!reverseColorscale);
        } else if (key === 'densitymap' || key === 'scattermap') {
            handleVisualizationTypeChange(key);
        }
    };

    const handleOpenChange: DropdownProps['onOpenChange'] = (nextOpen, info) => {
        if (info.source === 'trigger' || nextOpen) {
            setOpen(nextOpen);
        }
    };

    return (
        <div style={{position: 'relative', width: '100%', height: '100%', display: 'flex'}}>
            <Plot
                config={{
                    displayModeBar: true,
                    scrollZoom: true,
                    modeBarButtonsToAdd: ['lasso2d'],
                    displaylogo: false
                }}
                useResizeHandler={true}
                style={{width: '100%', height: '100%'}}
                data={scatterMapData.map(trace => ({
                    ...trace,
                    marker: trace.marker ? {
                        ...trace.marker,
                        cmin: colorScaleRange[0],
                        cmax: colorScaleRange[1]
                    } : undefined
                }))}
                layout={mapLayout}
                revision={scatterMapRevision}
                onClick={handleScatterMapClick}
                onSelected={handleSelectionEvent}
                onDeselect={handleDeselect}
                onDoubleClick={() => {
                    if (initialZoom && initialCenter) {
                        setMapLayout({
                            ...mapLayout,
                            map: {
                                ...(mapLayout as any).map,
                                center: initialCenter,
                                zoom: initialZoom,
                            }
                        } as any);
                    }
                }}
                onRelayout={(newLayout) => {
                    const mapLayout = newLayout as any;
                    if (mapLayout.map?.center || mapLayout.map?.zoom) {
                        setMapLayout({
                            ...mapLayout,
                            map: {
                                ...mapLayout.map,
                                center: mapLayout.map.center || mapLayout.map?.center,
                                zoom: mapLayout.map.zoom || mapLayout.map?.zoom,
                            }
                        } as any);
                    }
                }}
            />
            <div style={{position: 'absolute', top: '10px', left: '10px', zIndex: 1}}>
                <Space direction="vertical" align="start" style={{ display: 'flex' }}>
                    <Dropdown
                        menu={{
                            items: [
                                {
                                    key: 'vizType',
                                    label: 'Type',
                                    children: [
                                        {
                                            key: 'densitymap',
                                            label: 'Density Map',
                                            style: {
                                                height: 11,
                                            },
                                        },
                                        {
                                            key: 'scattermap',
                                            label: 'Scatter Map',
                                            style: {
                                                height: 11,
                                            },
                                        },
                                    ],
                                },
                                {
                                    key: 'colorscale',
                                    label: 'Colorscale',
                                    disabled: visualizationType === 'densitymap',
                                    children: colorscaleOptions.map((scale) => ({
                                        key: scale,
                                        label: scale,
                                        style: {
                                            height: 11,
                                        },
                                    })),
                                },
                                {
                                    key: 'reverseColorscale',
                                    disabled: visualizationType === 'densitymap',
                                    label: (
                                        <Space>
                                            <Checkbox checked={reverseColorscale} disabled={visualizationType === 'densitymap'}/>
                                            Reverse Colorscale
                                        </Space>
                                    ),
                                },
                                {
                                    key: 'colorScaleRange',
                                    disabled: visualizationType === 'densitymap',
                                    label: (
                                        <div style={{ padding: '8px 0' }}>
                                            <div style={{ marginBottom: '8px' }}>Color Scale Range</div>
                                            <div style={{ width: '250px' }}>
                                                <Slider
                                                    range
                                                    min={dataRange[0]}
                                                    max={dataRange[1]}
                                                    step={(dataRange[1] - dataRange[0]) / 100}
                                                    value={colorScaleRange}
                                                    onChange={(value: number[]) => setColorScaleRange(value as [number, number])}
                                                />
                                                <div style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between',
                                                    marginTop: '8px' 
                                                }}>
                                                    <InputNumber
                                                        value={colorScaleRange[0]}
                                                        onChange={(value) => {
                                                            if (value !== null) {
                                                                setColorScaleRange([value, colorScaleRange[1]]);
                                                            }
                                                        }}
                                                        style={{ width: 110 }}
                                                        step={(dataRange[1] - dataRange[0]) / 100}
                                                    />
                                                    <InputNumber
                                                        value={colorScaleRange[1]}
                                                        onChange={(value) => {
                                                            if (value !== null) {
                                                                setColorScaleRange([colorScaleRange[0], value]);
                                                            }
                                                        }}
                                                        style={{ width: 110 }}
                                                        step={(dataRange[1] - dataRange[0]) / 100}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ),
                                },
                            ],
                            onClick: handleMenuClick,
                            selectable: true,
                            selectedKeys: [colorscale as string, visualizationType],
                        }}
                        trigger={['click']}
                        onOpenChange={handleOpenChange}
                        open={open}
                    >
                        <a className="ant-dropdown-link"
                           onClick={e => e.preventDefault()} style={{marginRight: '8px'}}>
                            <Space>
                                Options <DownOutlined/>
                            </Space>
                        </a>
                    </Dropdown>
                    {selectedPoints.count > 0 && (
                        <div style={{
                            background: 'white',
                            padding: '8px',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                            Selected points: {selectedPoints.count}<br/>
                            Mean value: {selectedPoints.mean?.toFixed(2) ?? 'N/A'}
                        </div>
                    )}
                </Space>
            </div>
        </div>
    );
};

export default MapPlot;
