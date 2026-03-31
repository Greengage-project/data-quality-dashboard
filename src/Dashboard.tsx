import React, { useEffect, useState, CSSProperties } from 'react';
import * as Plotly from "plotly.js";

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { DatePickerProps } from 'antd';
import { DeleteOutlined, CheckOutlined, InfoCircleOutlined, FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import { Col, Layout, Row, Spin, theme, Checkbox, Card,  Tooltip, Button, Modal } from 'antd'; // Import Ant Design components
import './table.css'; // Import the CSS file
import customParseFormat from 'dayjs/plugin/customParseFormat';

//DateTime Imports
import dayjs from 'dayjs';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import CalendarHeatmap from "./components/CalendarHeatmap.tsx";
import DropdownContentSelector from "./components/DropdownContentSelector.tsx";
import DescriptiveStatistics from "./components/DescriptiveStatistics.tsx";
import OptionSelector from "./components/OptionSelector.tsx";
import MapPlot from "./components/MapPlot.tsx";
import TrendLine from "./components/TrendLine.tsx";
import Histogram from "./components/Histogram.tsx";
import { GetDataGaps } from "./services/dataHelpers";
import DataQualitySummary from "./components/DataQualitySummary.tsx";
import DataTable from "./components/DataTable.tsx";
import OutlierDetection from "./components/OutlierDetection.tsx";
//import InterpolationTest from "./components/InterpolationTest.tsx";
//import DataExport from "./components/DataExport.tsx";
import DataImporter from "./components/DataImporter.tsx";
import { calculateUniquenessScoreFromArray } from "./services/dataQualityHelpers";
import Keycloak from "keycloak-js";
import { useDruidConnector } from './services/druidConnectorNative';
import { DataConnectorConfig } from './services/dataConnector';
import { druidConnectorConfig } from './configDashboard';
import { GeographicDistributionCard } from "./components/GeographicDistributionCard.tsx";
import { FrequencyDistributionCard } from "./components/FrequencyDistributionCard.tsx";
import { TemporalDistributionCard } from "./components/TemporalDistributionCard.tsx";
import { TimeSeriesAnalysisCard } from "./components/TimeSeriesAnalysisCard.tsx";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

interface DashboardProps {
    keycloakInstance: Keycloak;
}

export interface DataArray {
    EpochTime: number[];
    value: number[];
    latitude?: number[];
    longitude?: number[];
}

const Dashboard: React.FC<DashboardProps> = ({ keycloakInstance }) => {
    const druidConnector = useDruidConnector(druidConnectorConfig);
    //==================================================================================================================
    // State variables
    //==================================================================================================================

    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const isSmallScreen = windowWidth < 992; // lg breakpoint for antd


    //==================================================================================================================
    // General logic/validity check variables
    //==================================================================================================================
    const [allValuesAreNull, setAllValuesAreNull] = useState<boolean>(false);


    // INFOBox variables:
    const [agGridRows, setAgGridRows] = useState<any[]>([]); // This will be used to store the data for the AgGrid
    // Druid Dataset selector variables:
    const [availableDatasets, setAvailableDatasets] = useState<string[]>([]);
    const [selectedDataset, setSelectedDataset] = useState('');
    const [selectedFieldAkaColumn, setSelectedFieldAkaColumn] = useState<string>("");

    const [minValidValue, setMinValidValue] = useState<number | undefined>(undefined);
    const [maxValidValue, setMaxValidValue] = useState<number | undefined>(undefined);


    //==================================================================================================================
    // Dataset Selection variables
    //==================================================================================================================
    const [currentColumnsInfo, setCurrentColumnsInfo] = useState<{ name: string, dataType: string }[]>([]);

    //==================================================================================================================
    // Outlier Detection variables
    //==================================================================================================================
    const [outliers, setOutliers] = useState<number[]>([]);
    const [movingAverageData, setMovingAverageData] = useState<number[]>([]);
    const [interpolatedEpochTimes, setInterpolatedEpochTimes] = useState<number[]>([]);
    const [outlierTimestamps, setOutlierTimestamps] = useState<number[]>([]);

    //==================================================================================================================
    // Trendline variables
    //==================================================================================================================
    const [showOutliers, setShowOutliers] = useState<boolean>(false);

    //==================================================================================================================
    // Calendar Heatmap variables
    //==================================================================================================================
    const [calendarHeatmapSelectedPointIndex, setCalendarHeatmapSelectedPointIndex] = useState<number | undefined>(undefined);


    const [histogramSelectionIndices, setHistogramSelectionIndices] = useState<number[]>([]);
    const [histogramSelectionRanges, setHistogramSelectionRanges] = useState<[number, number][]>([]);
    const [minEpochTimeOfSelectedField, setMinEpochTimeOfSelectedField] = useState<number | undefined>(undefined);
    const [maxEpochTimeOfSelectedField, setMaxEpochTimeOfSelectedField] = useState<number | undefined>(undefined);
    const [minEpochTimeCurrentTimeframe, setMinEpochTimeCurrentTimeframe] = useState<number | undefined>(undefined);
    const [maxEpochTimeCurrentTimeframe, setMaxEpochTimeCurrentTimeframe] = useState<number | undefined>(undefined);
    const [loadingData, setLoadingData] = useState<boolean>(false);
    const [loadingPercent, setLoadingPercent] = useState<number>(0);
    const [loadingTrendline, setLoadingTrendline] = useState<boolean>(false);
    const [loadingHistogram, setLoadingHistogram] = useState<boolean>(false);
    const [loadingCalendarHeatmap, setLoadingCalendarHeatmap] = useState<boolean>(false);
    const [startDate, setStartDate] = useState<string | undefined>(dayjs().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
    const [endDate, setEndDate] = useState<string | undefined>(dayjs().endOf('month').format('YYYY-MM-DD HH:mm:ss'));
    const [selectedTimeInterval, setSelectedTimeInterval] = useState<DatePickerProps['picker'] | 'showAll'>('showAll');
    const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone); //detect local timezone
    const [selectedAggregationInterval, setSelectedAggregationInterval] = useState<'none' | 'daily' | 'hourly' | '30min' | '15min'>('hourly')
    const [selectedAggregationType, setSelectedAggregationType] = useState<'avg' | 'sum' | 'min' | 'max'>('avg');//<'average' | 'sum' | 'count' | 'min' | 'max' | 'std' | 'var' | 'first' | 'last' | 'any' | 'all' | 'none'>('average');

    const [uniquenessScore, setUniquenessScore] = useState<number>(0);
    const [completenessScore, setCompletenessScore] = useState<number>(0);
    const [selectedPrimaryCategoricalDimension, setSelectedPrimaryCategoricalDimension] = useState<string | undefined>('');
    const [selectedPrimaryCategoricalDimensionUniqueValue, setSelectedPrimaryCategoricalDimensionUniqueValue] = useState<string>('');
    const [currentFieldAkaColumnData, setCurrentFieldAkaColumnData] = useState<DataArray | undefined>(undefined);
    const [outData, setOutData] = useState<DataArray | undefined>(undefined); //This one will be fed to the elements based on the needed granularity (hourly or daily) and time interval (month or year)
    const [currentDataGaps, setCurrentDataGaps] = useState<Partial<Plotly.Shape>[] | undefined>(undefined);
    const [dataFrameRevision, setDataFrameRevision] = useState(0);

    const [latitudeLongitudeColumnNames, setLatitudeLongitudeColumnNames] = useState<string[]>(['', '']);
    const [includeCoordinates, setIncludeCoordinates] = useState(true);


    // Additional content division related variables:
    const [selectedContent, setSelectedContent] = useState('dataImporter');
    const [showCalendarHeatmap, setShowCalendarHeatmap] = useState(false);
    const [fieldAkaColumnAvailable, setFieldAkaColumnAvailable] = useState(false);

    const [refreshData, setRefreshData] = useState<boolean>(false);
    const [delimitedCoordinates, setDelimitedCoordinates] = useState<boolean>(false);
    const scl3: Array<[number, string]> = [[0, 'rgb(155,0,0)'], [0.5, 'rgb(255,160,22)'], [1, 'rgb(255,246,152)']];

    const [showMovingAverage, setShowMovingAverage] = useState<boolean>(false);

    const [noDataInSelectedPeriod, setNoDataInSelectedPeriod] = useState<boolean>(false);

    // Add new state for data throttling
    const [isThrottlingData, setIsThrottlingData] = useState<boolean>(false);
    const MAX_SAFE_DATA_POINTS = 10000; // Adjust this number based on testing

    // Add state for large data warning
    const [showLargeDataWarning, setShowLargeDataWarning] = useState<boolean>(false);
    const [tempResponseData, setTempResponseData] = useState<any>(null);

    // Add the full screen styles with proper typing
    const fullScreenStyle: CSSProperties = {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,  // Lower than dropdown z-index
        background: 'white',
        padding: '20px',
    };

    //==================================================================================================================
    // Fetch data - Get data for the selected SiteID, time period and selected selectedFieldAkaColumn (Default: NO2)
    // Triggered when the selectedPrimaryCategoricalDimensionUniqueValue, startDate, endDate or selectedFieldAkaColumn state variables change
    //==================================================================================================================
    useEffect(() => {
        if (selectedDataset !== '' && selectedFieldAkaColumn !== '' && startDate && endDate && selectedAggregationInterval && selectedAggregationType) {
            setOutliers([])
            setShowOutliers(false)
            setOutlierTimestamps([])
            setShowMovingAverage(false)
            setMovingAverageData([])
            setLoadingData(true);
            setNoDataInSelectedPeriod(false);
            
            const startISO = dayjs.tz(startDate, timezone).format('YYYY-MM-DDTHH:mm:ss');
            const endISO = dayjs.tz(endDate, timezone).format('YYYY-MM-DDTHH:mm:ss');

            // Add data throttling check
            if (selectedAggregationInterval === 'none') {
                const startMs = dayjs.tz(startDate, timezone).valueOf();
                const endMs = dayjs.tz(endDate, timezone).valueOf();
                const totalHours = Math.ceil((endMs - startMs) / (1000 * 60 * 60));
                
                if (totalHours > MAX_SAFE_DATA_POINTS) {
                    setIsThrottlingData(true);
                    Modal.confirm({
                        title: 'Performance Warning',
                        content: `You are attempting to load ${totalHours} data points with no aggregation. This may cause performance issues. Would you like to:`,
                        okText: 'Switch to Hourly Aggregation',
                        cancelText: 'Cancel',
                        onOk() {
                            setSelectedAggregationInterval('hourly');
                            setIsThrottlingData(false);
                        },
                        onCancel() {
                            setLoadingData(false);
                            setIsThrottlingData(false);
                        }
                    });
                    return;
                }
            }

            console.time("Druid data fetch");
            druidConnector.fetchData({
                selectedDataset,
                selectedFieldAkaColumn,
                selectedPrimaryCategoricalDimension,
                selectedPrimaryCategoricalDimensionUniqueValue,
                selectedTimeInterval,
                startDate,
                endDate,
                selectedAggregationInterval,
                selectedAggregationType,
                latitudeLongitudeColumnNames: includeCoordinates ? (!delimitedCoordinates ? latitudeLongitudeColumnNames : ['', '']) : ['', ''],
                timezone
            })
                .then(({ responseData, minEpochResponseData, maxEpochResponseData, minEpochCurrentTimeframeData, maxEpochCurrentTimeframeData, uniquenessScore }) => {
                    console.timeEnd("Druid data fetch");
                    if (responseData.EpochTime.length === 0 || responseData.value.every(item => item === null || item === undefined)){    // || item === '')) {
                        console.log("No data available or all values are null/empty")
                        setCompletenessScore(0)
                        setUniquenessScore(0)
                        setCurrentFieldAkaColumnData(undefined);
                        setShowCalendarHeatmap(false);
                        setLoadingData(false)
                        setFieldAkaColumnAvailable(true)
                        setLoadingPercent(0);
                        setNoDataInSelectedPeriod(true); // Set to true when no data is available
                    } else {
                        // Check if data points exceed 400k
                        if (responseData.EpochTime.length > 400000) {
                            setTempResponseData({
                                responseData,
                                minEpochResponseData,
                                maxEpochResponseData,
                                minEpochCurrentTimeframeData,
                                maxEpochCurrentTimeframeData,
                                uniquenessScore
                            });
                            setShowLargeDataWarning(true);
                            setLoadingData(false);
                            return;
                        }

                        setAllValuesAreNull(responseData.value.every((value: number | null | undefined) => value === null || value === undefined));
                        console.log('responseData', responseData.value.length)
                        
                        setCurrentFieldAkaColumnData(responseData);
                        setMinEpochTimeOfSelectedField(minEpochResponseData);
                        setMaxEpochTimeOfSelectedField(maxEpochResponseData);
                        setMinEpochTimeCurrentTimeframe(minEpochCurrentTimeframeData);
                        setMaxEpochTimeCurrentTimeframe(maxEpochCurrentTimeframeData);

                        // might be needed for the future IMPORTANT:
                        //else {
                        // requestedDataFrame = new DataFrame(responseData, {columns: ["EpochTime", "value"]})
                        // console.log("requestedDataFrame", requestedDataFrame)
                        //}

                        // IMPORTANT:Now we add a column to the dataframe containing readable utc dates
                        /*const DateTime = dataframe.EpochTime.values.map((epochTime: number) => {
                            const date = new Date(epochTime)
                            return date.toUTCString()
                        })
                        dataframe.addColumn("DateTime", DateTime, {inplace: true})*/

                        setLoadingPercent(0);
                        setLoadingCalendarHeatmap(true)
                        setLoadingTrendline(true)
                        setLoadingHistogram(true)
                        setLoadingData(false)
                        setDataFrameRevision(dataFrameRevision + 1) //not needed?
                        setFieldAkaColumnAvailable(true)
                        setHistogramSelectionIndices([])
                        setHistogramSelectionRanges([])
                        console.log("uniquenessScore aggregation None:", JSON.parse(JSON.stringify(uniquenessScore)))
                        const uniqueness = calculateUniquenessScoreFromArray(responseData.EpochTime);
                        console.log("uniquenessScore current aggregation setting:", uniqueness)
                        setUniquenessScore(uniqueness)
                        if (selectedTimeInterval === 'showAll' || selectedAggregationInterval === 'none') {
                            setShowCalendarHeatmap(false);
                            setLoadingCalendarHeatmap(false)
                        }
                        setNoDataInSelectedPeriod(false);
                        //console.log("responseData", responseData)
                    }
                })
                .catch(error => {
                    console.timeEnd("Druid data fetch");
                    console.error("Error fetching data:", error);
                    setLoadingData(false);
                    setNoDataInSelectedPeriod(true); // Set to true on error as well
                });
        }

        // Creating Danfo.js DataFrame



    }, [selectedDataset, startDate, selectedFieldAkaColumn, selectedTimeInterval,
        selectedAggregationInterval, selectedAggregationType, selectedPrimaryCategoricalDimensionUniqueValue, refreshData, timezone]);

    // when someone disselects one of main fields, we reset the currentFieldAkaColumnData
    useEffect(() => {
        if (selectedDataset && selectedFieldAkaColumn === '') {
            if (outData) {
                setCurrentFieldAkaColumnData(undefined)
                setNoDataInSelectedPeriod(false); // Reset the no data message
            }
        }
    }, [selectedDataset, selectedFieldAkaColumn])


    useEffect(() => {
        if (selectedDataset && selectedFieldAkaColumn === '' && outData) {
            setCurrentFieldAkaColumnData(undefined);
        }
    }, [selectedDataset, selectedFieldAkaColumn, outData]);

    //==================================================================================================================
    // Get data gaps and completeness score
    //==================================================================================================================    
    useEffect(() => {
        // Early return for undefined data or no aggregation
        if (currentFieldAkaColumnData === undefined || selectedAggregationInterval === 'none') {
            setOutData(currentFieldAkaColumnData)
            setCurrentDataGaps([])
            setShowCalendarHeatmap(false)
            setCompletenessScore(0)
            return
        }
        //
        // Set the map layout to the default values
       

        if (selectedTimeInterval === 'showAll' && (selectedAggregationInterval === 'hourly' || selectedAggregationInterval === 'daily' || selectedAggregationInterval === '30min' || selectedAggregationInterval === '15min')) {
            setOutData(currentFieldAkaColumnData)
            const { dataGaps, completenessScore } = GetDataGaps(
                currentFieldAkaColumnData,
                selectedTimeInterval,
                selectedAggregationInterval,
                minEpochTimeOfSelectedField!,
                startDate,
                true, // sortData  
                timezone
            )
            setCurrentDataGaps(dataGaps)
            setCompletenessScore(completenessScore)
            setShowCalendarHeatmap(false);
            setLoadingCalendarHeatmap(false)
            return
        } else if (selectedAggregationInterval === 'hourly' || selectedAggregationInterval === 'daily') { //

            const { dataGaps, completenessScore } = GetDataGaps(
                currentFieldAkaColumnData,
                selectedTimeInterval,
                selectedAggregationInterval,
                minEpochTimeOfSelectedField!,
                startDate,
                true, // sortData
                timezone
            )
            setCurrentDataGaps(dataGaps)
            setCompletenessScore(completenessScore)
            setOutData(currentFieldAkaColumnData)
            setShowCalendarHeatmap(true)

        } else if (selectedAggregationInterval === '30min' || selectedAggregationInterval === '15min') {

            const { dataGaps, completenessScore } = GetDataGaps(
                currentFieldAkaColumnData,
                selectedTimeInterval,
                selectedAggregationInterval,
                minEpochTimeOfSelectedField!,
                startDate,
                true,
                timezone
            )
            setCurrentDataGaps(dataGaps)
            setCompletenessScore(completenessScore)
            setOutData(currentFieldAkaColumnData)
            setShowCalendarHeatmap(false)
            setLoadingCalendarHeatmap(false)
        } else {
            setOutData(currentFieldAkaColumnData)

        }

        //setShowCalendarHeatmap(true);
    }, [currentFieldAkaColumnData])
    //==================================================================================================================


    // Update the AgGrid rows when the outData changes
    useEffect(() => {
        if (!outData) {
            setAgGridRows([]);
            return;
        }

        const rowData = outData.EpochTime.map((timeValue: number, index: number) => ({
            time: timeValue,
            value: outData.value[index],
            ...(outData.latitude && { latitude: outData.latitude[index] }),
            ...(outData.longitude && { longitude: outData.longitude[index] })
        }));

        setAgGridRows(rowData);
    }, [outData]);

    const handleHistogramDeselect = () => {
        console.log("handleHistogramDeselect")
        setHistogramSelectionIndices([])
        setHistogramSelectionRanges([])
    }

    //==================================================================================================================
    //Content Render
    //==================================================================================================================
    const { Header, Content } = Layout
    const { token: { colorBgContainer } } = theme.useToken()
    return (
        <Layout style={{
            background: colorBgContainer
        }}>
            <Header style={{ background: colorBgContainer, height: '57px', borderBottom: "1px solid black", paddingTop: 0, marginTop: "-20px" }}>

                {startDate && endDate && (
                    <div >
                        <OptionSelector
                            selectedDataset={selectedDataset}
                            selectedDimension={selectedPrimaryCategoricalDimension}
                            selectedDimensionUniqueValue={selectedPrimaryCategoricalDimensionUniqueValue}
                            selectedFieldAkaColumn={selectedFieldAkaColumn}
                            startDate={startDate}
                            onStartDateChange={setStartDate}
                            endDate={endDate}
                            onEndDateChange={setEndDate}
                            timeGranularity={selectedAggregationInterval}
                            onTimeGranularityChange={setSelectedAggregationInterval}
                            selectedTimeInterval={selectedTimeInterval}
                            onSelectTimeInterval={setSelectedTimeInterval}
                            aggregationType={selectedAggregationType}
                            onAggregationTypeChange={setSelectedAggregationType}
                            timezone={timezone}
                            onTimezoneChange={setTimezone}
                        />
                    </div>
                )}

            </Header>
            <Content
                style={{
                    //margin: '10px 10px',
                    //background: colorBgContainer,
                    // minHeight:1000,
                }}>
                {/*<Header style={{background: colorBgContainer, padding: 0}}/>*/}


                {/*
                ===========================================================================
                = Loding Data Spinners
                ===========================================================================
                */}
                {loadingData && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '55%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999,
                            textAlign: 'center',
                        }}
                    >
                        <Spin size="large" />
                        {/*<div style={{}}><b>{loadingPercent}% Loading</b></div>*/}
                        <div style={{}}><b>Fetching requested data</b></div>
                    </div>)
                }
                {loadingHistogram && (
                    <Spin
                        size="default"
                        style={{
                            position: 'absolute',
                            top: '30%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999,
                        }}
                    />

                )}
                {loadingTrendline && (
                    <Spin
                        size="default"
                        style={{
                            position: 'absolute',
                            top: '75%',
                            left: '75%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999,
                        }}
                    />
                )}
                {loadingCalendarHeatmap && showCalendarHeatmap && (
                    <Spin
                        size="default"
                        style={{
                            position: 'absolute',
                            top: '75%',
                            left: '25%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999,
                        }}
                    />
                )}
                {/*If no dataset and field was yet selected display message in the middle of the screen */}
                {(selectedDataset === '' || selectedFieldAkaColumn === '') && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999,
                            textAlign: 'center',
                            backgroundColor:  '#f0f0f0d0',
                            borderRadius: '10px',
                            padding: '10px',
                        }}
                    >
                        <h2>No data selected for import</h2>
                        <h2>Please use "Data import" tab to select a dataset and a field</h2>

                    </div>
                )}
                {noDataInSelectedPeriod && selectedFieldAkaColumn !== '' && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 9999,
                            textAlign: 'center',
                            backgroundColor: '#f0f0f0d0',
                            borderRadius: '10px',
                            padding: '10px',
                        }}
                    >
                        <h2>No data in the selected time period<br></br> for selected data field {selectedPrimaryCategoricalDimensionUniqueValue ? `and dimension` : ''} available</h2>
                    </div>
                )}

                {/*
                ===========================================================================
                = Top Row
                ===========================================================================
                */}
                <Row style={{
                    opacity: loadingData ? 0.3 : 1,
                }}>
                    {/*
                    ===========================================================================
                    = Render map visualization
                    ===========================================================================
                    */}
                    <Col xs={{ span: 24, order: 2 }} lg={{ span: 7, order: 1 }} style={{ paddingTop: "5px", height: isSmallScreen ? '400px' : 'calc(42vh)' }}>
                        <GeographicDistributionCard
                            inputData={outData}
                            selectedFieldAkaColumn={selectedFieldAkaColumn}
                            includeCoordinates={includeCoordinates}
                            latitudeLongitudeColumnNames={latitudeLongitudeColumnNames}
                            selectedCalendarHeatmapIndex={calendarHeatmapSelectedPointIndex}
                            histogramSelectionRanges={histogramSelectionRanges}
                            isDisabled={selectedDataset === '' || selectedFieldAkaColumn === '' || noDataInSelectedPeriod}
                        />
                    </Col>
                    {/*
                    ===========================================================================
                    = Render histogram
                    ===========================================================================
                    */}
                    <Col xs={{ span: 24, order: 3 }} lg={{ span: 9, order: 2 }} style={{ paddingLeft: isSmallScreen ? "0px" : "5px", paddingTop: "5px", height: isSmallScreen ? '400px' : 'calc(42vh)' }}>
                        <FrequencyDistributionCard
                            inputData={outData}
                            onSelected={(indicesArray: number[], mergedRanges: [number, number][]) => {
                                setHistogramSelectionIndices(indicesArray)
                                setHistogramSelectionRanges(mergedRanges)
                            }}
                            onDeselect={handleHistogramDeselect}
                            loadingStatus={setLoadingHistogram}
                            selectedFieldAkaColumn={selectedFieldAkaColumn}
                            isDisabled={selectedDataset === '' || selectedFieldAkaColumn === '' || noDataInSelectedPeriod}
                        />
                    </Col>


                    {/*
                    ===========================================================================
                    = Render InfoBox
                    ===========================================================================
                     */}
                    <Col xs={{ span: 24, order: 1 }} lg={{ span: 8, order: 3 }} style={{ paddingLeft: isSmallScreen ? "0px" : "5px", paddingTop: "5px", height: isSmallScreen ? '400px' : 'calc(42vh)' }}>
                        <Card 
                            size="small"
                            //title="Data Analysis Tools"
                            styles={{ body: { height: '100%', padding: '5px', overflow: 'auto' } }}
                            style={{ height: '100%' }}
                        >
                            <>
                                <DropdownContentSelector onContentChange={setSelectedContent} disableFields={
                                    selectedFieldAkaColumn === '' && outData === undefined }/>
                                {selectedContent === 'dataImporter' && (
                                    <DataImporter
                                        availableDatasets={availableDatasets}
                                        setAvailableDatasets={setAvailableDatasets}
                                        selectedDataset={selectedDataset}
                                        setSelectedDataset={setSelectedDataset}
                                        selectedFieldAkaColumn={selectedFieldAkaColumn}
                                        setSelectedFieldAkaColumn={setSelectedFieldAkaColumn}
                                        selectedPrimaryCategoricalDimension={selectedPrimaryCategoricalDimension}
                                        setSelectedPrimaryCategoricalDimension={setSelectedPrimaryCategoricalDimension}
                                        selectedPrimaryCategoricalDimensionUniqueValue={selectedPrimaryCategoricalDimensionUniqueValue}
                                        setSelectedPrimaryCategoricalDimensionUniqueValue={setSelectedPrimaryCategoricalDimensionUniqueValue}
                                        latitudeLongitudeColumnNames={latitudeLongitudeColumnNames}
                                        setLatitudeLongitudeColumnNames={setLatitudeLongitudeColumnNames}
                                        includeCoordinates={includeCoordinates}
                                        setIncludeCoordinates={setIncludeCoordinates}
                                        refreshData={refreshData}
                                        setRefreshData={setRefreshData}
                                        currentColumnsInfo={currentColumnsInfo}
                                        setCurrentColumnsInfo={setCurrentColumnsInfo}
                                    />
                                )}
                                {selectedContent === 'dataTable' && (
                                    <DataTable
                                        rowData={agGridRows}
                                        selectedFieldAkaColumn={selectedFieldAkaColumn}
                                    />
                                )}
                                {selectedContent === 'descriptiveStats' && (
                                    <DescriptiveStatistics
                                        inputData={outData}
                                        allValuesAreNull={allValuesAreNull}
                                    />
                                    
                                )}
                                {selectedContent === 'dataQualityMetrics' && startDate && endDate && (
                                    <DataQualitySummary
                                        siteID={selectedPrimaryCategoricalDimensionUniqueValue}
                                        startDate={startDate}
                                        endDate={endDate}
                                        selectedTimeInterval={selectedTimeInterval}
                                        selectedAggregationInterval={selectedAggregationInterval}
                                        completenessScore={completenessScore}
                                        field={selectedFieldAkaColumn}
                                        inputData={outData}
                                        minValidValue={minValidValue}
                                        setMinValidValue={setMinValidValue}
                                        maxValidValue={maxValidValue}
                                        setMaxValidValue={setMaxValidValue}
                                        minEpochTimeOfSelectedField={minEpochTimeOfSelectedField}
                                    />

                                )}
                                {selectedContent === 'dataExport' && (
                                    //<DataExport
                                    //    dataFrame={outData} />
                                    <></>
                                )}
                                {selectedContent === 'outlierDetection' && (
                                     <OutlierDetection
                                        dataFrame={outData}
                                        outliers={outliers}
                                        setOutliers={setOutliers}
                                        movingAverageData={movingAverageData}
                                        setMovingAverageData={setMovingAverageData}
                                        setInterpolatedEpochTimes={setInterpolatedEpochTimes}
                                        showOutliers={showOutliers}
                                        setShowOutliers={setShowOutliers}
                                        showMovingAverage={showMovingAverage}
                                        setShowMovingAverage={setShowMovingAverage}
                                        aggregationInterval={selectedAggregationInterval}
                                        setOutlierTimestamps={setOutlierTimestamps}
                                        allValuesAreNull={allValuesAreNull}
                                    /> 
                                    
                                )}
                                {selectedContent === 'interpolation' && (
                                    //<InterpolationTest
                                    //    dataFrame={outData}
                                    //    allValuesAreNull={allValuesAreNull}
                                    ///>
                                    <></>
                                )}

                            </>
                        </Card>
                    </Col>
                    {/*
                    ===========================================================================
                    = Bottom Row Items
                    ===========================================================================
                    */}
                    {/*
                    ===========================================================================
                    = Render calendar heatmap
                    ===========================================================================
                    */}
                    <Col xs={{ span: 24, order: 4 }} lg={{ span: 12, order: 4 }} style={{ height: isSmallScreen ? '400px' : 'calc(58vh - 53px)', paddingTop: "5px" }}>
                        <TemporalDistributionCard
                            showCalendarHeatmap={showCalendarHeatmap}
                            startDate={startDate}
                            selectedDataset={selectedDataset}
                            selectedFieldAkaColumn={selectedFieldAkaColumn}
                            selectedAggregationInterval={selectedAggregationInterval}
                            selectedTimeInterval={selectedTimeInterval}
                            inputData={outData}
                            selectedPrimaryCategoricalDimensionUniqueValue={selectedPrimaryCategoricalDimensionUniqueValue}
                            loadingStatus={setLoadingCalendarHeatmap}
                            minEpochTime={minEpochTimeOfSelectedField}
                            setSelectedPointIndex={setCalendarHeatmapSelectedPointIndex}
                            timezone={timezone}
                            isDisabled={selectedDataset === '' ||
                                selectedFieldAkaColumn === '' ||
                                noDataInSelectedPeriod ||
                                selectedTimeInterval === "showAll" ||
                                selectedAggregationInterval === "none" ||
                                selectedAggregationInterval === "30min" ||
                                selectedAggregationInterval === "15min"}
                            endDate={endDate}
                            loadingData={loadingData}
                            loadingCalendarHeatmap={loadingCalendarHeatmap}
                        />
                    </Col>

                    {/*
                    ===========================================================================
                    = Render trend line graph
                    ===========================================================================
                    */}
                    <Col xs={{ span: 24, order: 5 }} lg={{ span: 12, order: 5 }} style={{ paddingLeft: isSmallScreen ? "0px" : "5px", paddingTop: "5px", height: isSmallScreen ? '400px' : 'calc(58vh - 53px)' }}>
                        <TimeSeriesAnalysisCard
                            inputData={outData}
                            loadingStatus={setLoadingTrendline}
                            dataGaps={currentDataGaps}
                            selectionIndicesArray={histogramSelectionIndices}
                            aggregationInterval={selectedAggregationInterval}
                            movingAverageData={movingAverageData}
                            interpolatedEpochTimes={interpolatedEpochTimes}
                            showOutliers={showOutliers}
                            setShowOutliers={setShowOutliers}
                            outlierTimestamps={outlierTimestamps}
                            currentVariable={selectedFieldAkaColumn || ''}
                            period={selectedTimeInterval || 'showAll'}
                            showMovingAverage={showMovingAverage}
                            setShowMovingAverage={setShowMovingAverage}
                            isDisabled={selectedDataset === '' || selectedFieldAkaColumn === '' || noDataInSelectedPeriod}
                        />
                    </Col>
                </Row>


            </Content>
            <Modal
                title="Large Dataset Warning"
                open={showLargeDataWarning}
                onOk={() => {
                    setShowLargeDataWarning(false);
                    if (tempResponseData) {
                        const { responseData, minEpochResponseData, maxEpochResponseData, 
                               minEpochCurrentTimeframeData, maxEpochCurrentTimeframeData, uniquenessScore } = tempResponseData;
                        
                        setAllValuesAreNull(responseData.value.every((value: number | null | undefined) => value === null || value === undefined));
                        setCurrentFieldAkaColumnData(responseData);
                        setMinEpochTimeOfSelectedField(minEpochResponseData);
                        setMaxEpochTimeOfSelectedField(maxEpochResponseData);
                        setMinEpochTimeCurrentTimeframe(minEpochCurrentTimeframeData);
                        setMaxEpochTimeCurrentTimeframe(maxEpochCurrentTimeframeData);
                        
                        setLoadingPercent(0);
                        setLoadingCalendarHeatmap(true)
                        setLoadingTrendline(true)
                        setLoadingHistogram(true)
                        setLoadingData(false)
                        setDataFrameRevision(dataFrameRevision + 1) //not needed?
                        setFieldAkaColumnAvailable(true)
                        setHistogramSelectionIndices([])
                        setHistogramSelectionRanges([])
                        console.log("uniquenessScore aggregation None:", JSON.parse(JSON.stringify(uniquenessScore)))
                        const uniqueness = calculateUniquenessScoreFromArray(responseData.EpochTime);
                        console.log("uniquenessScore current aggregation setting:", uniqueness)
                        setUniquenessScore(uniqueness)
                        if (selectedTimeInterval === 'showAll' || selectedAggregationInterval === 'none') {
                            setShowCalendarHeatmap(false);
                            setLoadingCalendarHeatmap(false)
                        }
                        setNoDataInSelectedPeriod(false);

                    }
                    
                    setTempResponseData(null);
                }}
                onCancel={() => {
                    setShowLargeDataWarning(false);
                    setTempResponseData(null);
                    setLoadingData(false);
                }}
                okText="Continue Loading"
                cancelText="Go Back"
            >
                <p style={{ color: '#cf1322', fontWeight: 'bold' }}>Warning: You are attempting to load more than 400,000 data points.</p>
                <p>Loading such a large dataset may:</p>
                <ul>
                    <li>Cause severe performance issues in the dashboard</li>
                    <li>Cause individual visualization to crash</li>
                    <li>Make the application unresponsive</li>
                    <li>Potentially crash your web browser</li>
                </ul>
                <p>To prevent these issues, we strongly recommend:</p>
                <ul>
                    <li>Reducing the selected time period</li>
                    <li>Using a larger aggregation interval (e.g., hourly or daily)</li>
                    <li>Applying additional filters if available</li>
                </ul>
                <p>Do you still want to proceed with loading this large dataset?</p>
            </Modal>
        </Layout>
    )
}
export default Dashboard;
