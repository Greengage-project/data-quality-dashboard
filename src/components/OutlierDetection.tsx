// @ts-nocheck
import React, {useEffect, useState} from "react";
import Plot from 'react-plotly.js';
import {Button, Checkbox, Col, InputNumber, Row, Select, Slider, Tooltip} from "antd";
import {DataArray} from "../Dashboard.tsx";

const {Option} = Select;
import {sampleStandardDeviation} from 'simple-statistics';
import Plotly from "plotly.js";
import {createInterpolatorWithFallback, InterpolationMethod} from "commons-math-interpolation";

function findMatchingIndexes(array1: number[], array2: number[]) {
    const matchingIndexes = [];
    let i = 0;
    let j = 0;

    while (i < array1.length && j < array2.length) {
        if (array1[i] === array2[j]) {
            matchingIndexes.push(j);
            i++;
            j++;
        } else if (array1[i] < array2[j]) {
            i++;
        } else {
            j++;
        }
    }

    return matchingIndexes;
}

const array1 = [11, 13, 17];
const array2 = Array.from({length: 21}, (_, i) => i);

const matchingIndexes = findMatchingIndexes(array1, array2);


// set values in local storage
const setLocalStorage = (key: string, value: number | string) => {
    localStorage.setItem(key, JSON.stringify(value));
};

// get values from local storage
const getLocalStorage = (key: string, defaultValue: number | string | undefined) => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : defaultValue;
};



function getPrecisionFromDataFrameStats(dataArray: DataArray) {

    // Extract mean and standard deviation
    const mean = dataArray.value.reduce((sum, val) => sum + val, 0) / dataArray.value.length;
    const variance = dataArray.value.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataArray.value.length;
    const std = Math.sqrt(variance);

    // Calculate Min and Max based on mean and standard deviation
    const outlierMin = mean - 3 * std;
    const outlierMax = mean + 3 * std;

    // Calculate the range
    const range = outlierMax - outlierMin;

    // Define precision thresholds based on the range

    const precisionThresholds = [
        {threshold: .001, precision: 8},
        {threshold: .01, precision: 6},
        {threshold: .1, precision: 4},
        {threshold: 1, precision: 3},
        {threshold: 10, precision: 2},   // For range less than 10, precision of 2
        {threshold: 100, precision: 1},  // For range less than 100, precision of 1
        {threshold: 1000, precision: 0}  // For range less than 1000, precision of 0
        // Add more thresholds as needed
    ];

    // Find the precision based on the range
    let precision = 0;
    for (const thresholdData of precisionThresholds) {
        if (range < thresholdData.threshold) {
            precision = thresholdData.precision;
            break;
        }
    }

    return precision;
}

function interpolatePlotData(values: number[],
                             epochTimes: number[],
                             interpolationMethod: InterpolationMethod,
                             aggregationInterval: string) {

    console.time("interpolation");

    const tempVals = values;
    const tempEpochTime = epochTimes;

    const xVals = [];
    const yVals = [];

    for (let i = 0; i < tempVals.length; i++) {
        const val = tempVals[i];
        if (val !== null) {
            xVals.push(tempEpochTime[i]);
            yVals.push(val);
        }
    }

    const interpolatedValues = [];
    const interpolator = createInterpolatorWithFallback(interpolationMethod, xVals, yVals);

    const step = aggregationInterval === 'hourly' ? 3600000 : aggregationInterval === 'daily' ? 86400000 : aggregationInterval === '30min' ? 1800000 : 60000;
    for (let i = xVals[0]; i < xVals[xVals.length - 1]; i += step) {
        const y = interpolator(i);
        interpolatedValues.push([i, y]);
    }
    console.timeEnd("interpolation");
    return interpolatedValues;
}

interface OutlierDetectionProps {
  dataFrame: DataArray | undefined;
  outliers: number[];
  setOutliers: React.Dispatch<React.SetStateAction<number[]>>;
  movingAverageData: number[];
  setMovingAverageData: React.Dispatch<React.SetStateAction<number[]>>;
  setInterpolatedEpochTimes: React.Dispatch<React.SetStateAction<number[]>>;
  showOutliers: boolean;
  setShowOutliers: React.Dispatch<React.SetStateAction<boolean>>;
  showMovingAverage: boolean;
  setShowMovingAverage: React.Dispatch<React.SetStateAction<boolean>>;
  aggregationInterval: string;
  setOutlierTimestamps: React.Dispatch<React.SetStateAction<number[]>>;
  allValuesAreNull: boolean;
}

const OutlierDetection: React.FC<OutlierDetectionProps> = ({
                                                               dataFrame,
                                                               outliers,
                                                               setOutliers,
                                                               movingAverageData,
                                                               setMovingAverageData,
                                                               setInterpolatedEpochTimes,
                                                               showOutliers,
                                                               setShowOutliers,
                                                               showMovingAverage,
                                                               setShowMovingAverage,
                                                               aggregationInterval,
                                                               setOutlierTimestamps,
                                                               allValuesAreNull

                                                           }) => {

    if (!dataFrame ) {
        return <div>No data available</div>;
    }

    if (allValuesAreNull) {
        return <div style={{textAlign:"center"}}><br/>
            There is no data to perform outlier detection on.<br/>
            All imported values of selected field are null.<br/>
            See "Data Table" for more details.
        </div>;

    }

    if (aggregationInterval === 'none') {
        return (
            <div>
                <p>Outlier detection is only available for aggregated data.<br/> Please select a different aggregation
                    interval.</p>
            </div>
        )
    }

    const [values, setValues] = useState<number[] | undefined>(undefined);
    const [epochTimes, setEpochTimes] = useState<number[] | undefined>(undefined);
    const [frameSize, setFrameSize] = useState(5); // Set your desired frame size
    const [averagingMethod, setAveragingMethod] = useState<string>("EMA"); // Set your desired averaging method
    const [detectionMethod, setDetectionMethod] = useState<string>("residual"); // New detection method
    const [threshold, setThreshold] = useState<number>(getLocalStorage('threshold', undefined));
    const [tukeyStats, setTukeyStats] = useState<{q1: number, q3: number, iqr: number, lowerFence: number, upperFence: number} | null>(null);
    const [zScoreStats, setZScoreStats] = useState<{mean: number, std: number, threshold: number, lowerBound: number, upperBound: number} | null>(null);
    const [modifiedZScoreStats, setModifiedZScoreStats] = useState<{median: number, mad: number, threshold: number, lowerBound: number, upperBound: number} | null>(null);
    const [seasonalStats, setSeasonalStats] = useState<{
        period: number, 
        threshold: number, 
        mean: number, 
        std: number, 
        lowerBound: number, 
        upperBound: number,
        seasonalRange: {min: number, max: number},
        trendSlope: number,
        seasonalStrength: number,
        peakTiming: number
    } | null>(null);
    const [trendData, setTrendData] = useState<number[]>([]);
    const [seasonalPeriod, setSeasonalPeriod] = useState<number>(24);
    const [alpha, setAlpha] = useState(2 / (frameSize + 1)); // Calculate alpha based on frameSize
    const [resetChanges, setResetChanges] = useState(false);
    const [residuals, setResiduals] = useState<number[]>([]);
    const [thresholdInputDisplayPreecision, setThresholdInputDisplayPrecision] = useState(5);
    // showWalkingAverage is now controlled by parent component


    // Calculate a fixed Y-axis range to prevent the chart from resizing when toggling traces
    let yAxisRange: [number, number] | undefined = undefined;
    if (values && values.length > 0) {
        const validData = values.filter(v => typeof v === 'number' && isFinite(v));
        if (validData.length > 0) {
            const min = Math.min(...validData);
            const max = Math.max(...validData);
            const padding = (max - min) * 0.1 || 1; // Add 10% padding, with a fallback for flat data
            yAxisRange = [min - padding, max + padding];
        }
    }


    const calculateResiduals = (values: number[], smoothedData: number[]) => {
        const residuals = values.map((value, i) => value - smoothedData[i]);
        return residuals;
    };

    const findOutliers = (residuals: number[], threshold: number) => {
        return residuals.map((residual, i) => (Math.abs(residual) > threshold ? i : -1)).filter((index) => index !== -1);
    };

    const getOutliersTukeysFence = (values: number[]) => {
        // Calculate quartiles using linear interpolation for accuracy
        const sortedValues = [...values].sort((a, b) => a - b);
        const n = sortedValues.length;

        // Function to get percentile value with linear interpolation
        const getPercentile = (p: number) => {
            const pos = (n - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (sortedValues[base + 1] !== undefined) {
                return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
            } else {
                return sortedValues[base];
            }
        };

        const q1 = getPercentile(0.25);
        const q3 = getPercentile(0.75);
        const iqr = q3 - q1;
        
        // Calculate fences (using 3 * IQR for detecting extreme outliers)
        const lowerFence = q1 - 3 * iqr;
        const upperFence = q3 + 3 * iqr;
        
        // Store statistics for display
        setTukeyStats({
            q1: q1,
            q3: q3,
            iqr: iqr,
            lowerFence: lowerFence,
            upperFence: upperFence
        });
        
        // Find outliers
        const outliers = values.map((value, index) => {
            if (value < lowerFence || value > upperFence) {
                return index;
            }
            return -1;
        }).filter((index) => index !== -1);
        
        return outliers;
    }

    // Z-Score Method
    const getOutliersZScore = (values: number[], threshold: number = 3) => {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1));
        
        // Calculate bounds for display
        const lowerBound = mean - threshold * std;
        const upperBound = mean + threshold * std;
        
        // Store statistics for display
        setZScoreStats({
            mean: mean,
            std: std,
            threshold: threshold,
            lowerBound: lowerBound,
            upperBound: upperBound
        });
        
        const outliers = values.map((value, index) => {
            const zScore = Math.abs((value - mean) / std);
            return zScore > threshold ? index : -1;
        }).filter((index) => index !== -1);
        
        return outliers;
    }

    // Modified Z-Score (using Median Absolute Deviation)
    const getOutliersModifiedZScore = (values: number[], threshold: number = 3.5) => {
        const sorted = values.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        
        // Median Absolute Deviation
        const deviations = values.map(val => Math.abs(val - median));
        const mad = deviations.slice().sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
        
        // Calculate bounds for display
        const lowerBound = median - (threshold / 0.6745) * mad;
        const upperBound = median + (threshold / 0.6745) * mad;
        
        // Store statistics for display
        setModifiedZScoreStats({
            median: median,
            mad: mad,
            threshold: threshold,
            lowerBound: lowerBound,
            upperBound: upperBound
        });
        
        const outliers = values.map((value, index) => {
            const modifiedZScore = 0.6745 * (value - median) / mad;
            return Math.abs(modifiedZScore) > threshold ? index : -1;
        }).filter((index) => index !== -1);
        
        return outliers;
    }

    // Removed Isolation Forest and LOF due to computational complexity

    // Seasonal Decomposition
    const getOutliersSeasonal = (values: number[], period: number = 24, threshold: number = 3) => {
        // Simple seasonal decomposition
        const seasonal = [];
        const trend = [];
        const residuals = [];
        
        // Calculate seasonal component (optimized)
        const seasonalAverages = new Array(period).fill(0);
        const seasonalCounts = new Array(period).fill(0);
        
        for (let i = 0; i < values.length; i++) {
            const seasonalIndex = i % period;
            seasonalAverages[seasonalIndex] += values[i];
            seasonalCounts[seasonalIndex]++;
        }
        
        for (let i = 0; i < period; i++) {
            seasonalAverages[i] = seasonalCounts[i] > 0 ? seasonalAverages[i] / seasonalCounts[i] : 0;
        }
        
        for (let i = 0; i < values.length; i++) {
            seasonal[i] = seasonalAverages[i % period];
        }
        
        // Calculate trend (simplified moving average with smaller window)
        const trendWindow = Math.min(period, 7); // Reduced window size
        for (let i = 0; i < values.length; i++) {
            const start = Math.max(0, i - Math.floor(trendWindow / 2));
            const end = Math.min(values.length, i + Math.ceil(trendWindow / 2));
            const trendValues = values.slice(start, end);
            trend[i] = trendValues.reduce((sum, val) => sum + val, 0) / trendValues.length;
        }
        
        // Calculate residuals
        for (let i = 0; i < values.length; i++) {
            residuals[i] = values[i] - trend[i] - seasonal[i];
        }
        
        // Find outliers in residuals
        const mean = residuals.reduce((sum, val) => sum + val, 0) / residuals.length;
        const std = Math.sqrt(residuals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (residuals.length - 1));
        
        // Calculate bounds for display
        const lowerBound = mean - threshold * std;
        const upperBound = mean + threshold * std;
        
        // Calculate essential seasonal decomposition components
        const seasonalRange = {
            min: Math.min(...seasonal),
            max: Math.max(...seasonal)
        };
        
        // Calculate trend slope using simple linear regression
        const n = trend.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = trend.reduce((a, b) => a + b, 0);
        const sumXY = trend.reduce((sum, y, i) => sum + i * y, 0);
        const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
        const trendSlope = n * sumXY - sumX * sumY > 0 && n * sumXX - sumX * sumX > 0 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;
        
        // Calculate seasonal strength
        const dataMean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const totalVariance = values.reduce((sum, val) => sum + Math.pow(val - dataMean, 2), 0) / (values.length - 1);
        const seasonalMean = seasonal.reduce((sum, val) => sum + val, 0) / seasonal.length;
        const seasonalVariance = seasonal.reduce((sum, val) => sum + Math.pow(val - seasonalMean, 2), 0) / (seasonal.length - 1);
        let seasonalStrength = totalVariance > 0 ? seasonalVariance / totalVariance : 0;
        seasonalStrength = Math.min(seasonalStrength, 1); // Cap at 100%

        // Find peak timing in the seasonal cycle
        const peakTiming = seasonal.indexOf(Math.max(...seasonal));
        
        // Store trend data for visualization
        setTrendData(trend);
        
        // Store statistics for display
        setSeasonalStats({
            period: period,
            threshold: threshold,
            mean: mean,
            std: std,
            lowerBound: lowerBound,
            upperBound: upperBound,
            seasonalRange: seasonalRange,
            trendSlope: trendSlope,
            seasonalStrength: seasonalStrength,
            peakTiming: peakTiming
        });
        
        const outliers = residuals.map((val, i) => {
            const zScore = Math.abs((val - mean) / std);
            return zScore > threshold ? i : -1;
        }).filter(idx => idx !== -1);
        
        return outliers;
    }

    // Calculate exponential moving average (EMA)
    // 'alpha' is a parameter used in the calculation of the Exponential Moving Average (EMA).
    // It represents the smoothing factor or weight given to the most recent observation compared to the previous observations.
    // A smaller value of 'alpha' places more weight on recent data points, making the EMA more responsive to recent changes in the data.
    const calculateEMA = (values: number[], alpha: number) => {
        const ema = [];
        ema[0] = values[0];
        for (let i = 1; i < values.length; i++) {
            ema[i] = alpha * values[i] + (1 - alpha) * ema[i - 1];
        }
        return ema;
    };

    // Function to calculate simple moving average (SMA)
    // 'frameSize' is a parameter used in the calculation of the Simple Moving Average (SMA).
    // It determines the window size or the number of data points to consider when calculating the moving average.
    // For each data point in the time series, the SMA calculates the average of the preceding 'frameSize' data points.
    // A larger 'frameSize' results in a smoother moving average, but it may lag behind the actual trend changes in
    // the data. A smaller 'frameSize' provides a more responsive moving average but may be more sensitive to noise.
    const calculateSMA = (values: number[], frameSize: number) => {
        const sma = [];
        for (let i = 0; i < values.length; i++) {
            if (i < frameSize - 1) {
                sma[i] = values[i]; // Not enough data for the initial values
            } else {
                sma[i] = values.slice(i - frameSize + 1, i + 1).reduce((sum, value) => sum + value, 0) / frameSize;
            }
        }
        return sma;
    };


    const handleMethodChange = (newMethod: string) => {
        setAveragingMethod(newMethod);
    };

    const handleFrameSizeChange = (newValue: number | null) => {
        if (newValue !== null) {
            setFrameSize(newValue);

            // Calculate alpha based on frameSize
            const newAlpha = 2 / (newValue + 1);
            // Update the alpha state
            setAlpha(newAlpha);
        }
    };


    // Function to update threshold value
    const handleThresholdChange = (newValue: number | null) => {
        if (newValue !== null) {
            setThreshold(newValue);
            const newOutliers = findOutliers(residuals, newValue);
            setOutliers(newOutliers);
            if (epochTimes !== undefined) {
                const outliersEpochTimes = newOutliers.map((index) => epochTimes[index]);
                setOutlierTimestamps(outliersEpochTimes);
            } else {
                console.log("epochTimes is undefined");
                setOutlierTimestamps([]);
            }
        }
    };

    const handleDetectionMethodChange = (newMethod: string) => {
        setDetectionMethod(newMethod);
        // Hide moving average for methods that don't use it
        if (newMethod !== 'residual' && newMethod !== 'seasonal') {
            setShowMovingAverage(false);
        }
    };


    // calculate threshold based on IQR
    useEffect(() => {

        if (dataFrame !== undefined && dataFrame.value !== undefined) {
            // TODO: deal with case when we have fractions in the values array
            // setThreshold(Math.round(dataFrame.value.std() * 3));
            // calculate Q1 Q3, IQR and STD from values array from a copy of dataFrame.value
            const values: number[] = [...dataFrame.value];
            const epochTimes: number[] = [...dataFrame.EpochTime]
            console.time('OutlierDetection.tsx: sort values');
            const sortedValues = [...values].sort((a, b) => a - b);
            console.timeEnd('OutlierDetection.tsx: sort values');
            const q1 = sortedValues[Math.floor(sortedValues.length / 4)];
            const q3 = sortedValues[Math.floor(3 * sortedValues.length / 4)];
            const iqr = q3 - q1;
            setLocalStorage('q1', q1);
            setLocalStorage('q3', q3);
            setLocalStorage('iqr', iqr);
            setFrameSize(5);
            setThresholdInputDisplayPrecision(getPrecisionFromDataFrameStats(dataFrame));
            const interpolatedData = interpolatePlotData(values, epochTimes, 'linear', aggregationInterval);
            //set values and epochtime to new interpolated data
            setValues(interpolatedData.map((value) => value[1]));
            setEpochTimes(interpolatedData.map((value) => value[0]));
            setInterpolatedEpochTimes(interpolatedData.map((value) => value[0]));

        }
    }, [dataFrame]);

    useEffect(() => {
        if (dataFrame !== undefined && resetChanges) {
            setThreshold(getLocalStorage('defaultThreshold', threshold));
            const newOutliers = findOutliers(residuals, getLocalStorage('defaultThreshold', threshold));
            setOutliers(newOutliers);
            if (epochTimes !== undefined) {
                const outliersEpochTimes = newOutliers.map((index) => epochTimes[index]);
                setOutlierTimestamps(outliersEpochTimes);
            } else {
                console.log("epochTimes is undefined");
                setOutlierTimestamps([]);
            }
            setResetChanges(false);
        }
    }, [resetChanges]);


    useEffect(() => {

        if (dataFrame !== undefined && values !== undefined && epochTimes !== undefined) {

            let outlierIndices: number[] = [];
            let tempSmoothedData: number[] = [];

            if (detectionMethod === 'residual') {
                // Only residual method needs moving average
                if (alpha !== undefined && frameSize !== undefined && averagingMethod !== undefined) {
                    if (averagingMethod === "EMA") {
                        tempSmoothedData = calculateEMA(values, alpha);
                    } else if (averagingMethod === "SMA") {
                        tempSmoothedData = calculateSMA(values, frameSize || 5);
                    }

                    // Calculate residuals and threshold based on standard deviation
                    const residuals = calculateResiduals(values, tempSmoothedData);
                    setResiduals(residuals);

                    const mean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
                    const std = Math.sqrt(residuals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (residuals.length - 1));
                    const threshold = std * 3; // 99.7% of the residuals will fall within 3 standard deviations
                    
                    setThreshold(threshold);
                    setLocalStorage('defaultThreshold', threshold);
                    outlierIndices = findOutliers(residuals, threshold);
                }
            } else {
                // Other methods work directly on raw values
                switch (detectionMethod) {
                    case 'tukey':
                        outlierIndices = getOutliersTukeysFence(values);
                        break;
                    case 'zscore':
                        outlierIndices = getOutliersZScore(values, 3); // Use standard z-score threshold
                        break;
                    case 'modifiedZScore':
                        outlierIndices = getOutliersModifiedZScore(values, 3.5); // Use standard modified z-score threshold
                        break;
                    case 'seasonal':
                        outlierIndices = getOutliersSeasonal(values, seasonalPeriod, 3); // Use seasonal period from state
                        break;
                    default:
                        outlierIndices = [];
                }
            }
            
            console.log("Nr. of Outliers: ", outlierIndices.length);

            // Set states
            setMovingAverageData(tempSmoothedData);
            setOutliers(outlierIndices);
            // return  epochTimes values array at the indeces of the outliers
            const outliersEpochTimes = outlierIndices.map((index) => epochTimes[index]);
            setOutlierTimestamps(outliersEpochTimes);
            
            // For seasonal method, also set trend data for visualization
            if (detectionMethod === 'seasonal' && trendData.length > 0) {
                setMovingAverageData(trendData);
            }
        }
    }, [alpha, frameSize, averagingMethod, values, detectionMethod, seasonalPeriod, trendData]);


    return (
        <>
            {/* Detection method - always first */}
            <Row align="middle">
                <Col span={12} style={{paddingLeft: "20px"}}>
                    detection method:<br/>
                    <Select
                        value={detectionMethod}
                        style={{margin: "40 0px", width: "100%"}}
                        onChange={handleDetectionMethodChange}
                    >
                        <Option value="residual">
                            <Tooltip title="Detects outliers based on deviation from the moving average">
                                Residual
                            </Tooltip>
                        </Option>
                        <Option value="tukey">
                            <Tooltip title="Tukey's Fence (IQR-based)">
                                Tukey's Fence
                            </Tooltip>
                        </Option>
                        <Option value="zscore">
                            <Tooltip title="Z-Score (standard deviation)">
                                Z-Score
                            </Tooltip>
                        </Option>
                        <Option value="modifiedZScore">
                            <Tooltip title="Modified Z-Score (robust)">
                                Modified Z-Score
                            </Tooltip>
                        </Option>
                        <Option value="seasonal">
                            <Tooltip title="Seasonal Decomposition">
                                Seasonal
                            </Tooltip>
                        </Option>
                    </Select>
                </Col>
            </Row>

            {/* Seasonal period input - only for seasonal method */}
            {detectionMethod === 'seasonal' && (
                <Row align="middle">
                    <Col span={12} style={{paddingLeft: "20px"}}>
                        seasonal period:<br/>
                        <InputNumber
                            min={2}
                            max={168}
                            style={{width: "100%", marginTop: "4px"}}
                            value={seasonalPeriod}
                            onChange={(value) => setSeasonalPeriod(value || 24)}
                            addonAfter="points"
                        />
                    </Col>
                </Row>
            )}

            {/* Moving average settings - only for residual method */}
            {detectionMethod === 'residual' && (
                <div style={{paddingLeft: "20px", paddingRight: "20px"}}>
                    <Row gutter={[16, 8]}>
                        <Col span={10}>
                            <div>frame size:</div>
                            <InputNumber
                                min={2}
                                max={20}
                                style={{width: "100%"}}
                                step={1}
                                value={frameSize}
                                onChange={handleFrameSizeChange}
                                addonAfter={aggregationInterval === 'hourly' ? 'hours' : aggregationInterval === 'daily' ? 'days' : "x" + aggregationInterval}
                            />
                        </Col>
                        <Col span={4}>
                            <div>avg. method:</div>
                            <Select
                                defaultValue="EMA"
                                style={{width: "100%"}}
                                onChange={handleMethodChange}
                            >
                                <Option value="EMA"><Tooltip title="Exponential Moving Average">EMA</Tooltip></Option>
                                <Option value="SMA"><Tooltip title="Simple Moving Average">SMA</Tooltip></Option>
                            </Select>
                        </Col>
                    </Row>
                    <Row gutter={[16, 8]} align="bottom" style={{marginTop: '8px'}}>
                        <Col span={10}>
                            <div>threshold:</div>
                            <InputNumber
                                style={{width: "100%"}}
                                value={threshold}
                                onChange={handleThresholdChange}
                                precision={thresholdInputDisplayPreecision}
                                size={'middle'}
                            />
                        </Col>
                        <Col span={4}>
                            <Button id={'resetButton'} onClick={() => setResetChanges(true)} style={{width: "100%"}}>
                                <Tooltip title={<><span>Restore default</span><br /><span>threshold value</span></>}>
                                    Reset
                                </Tooltip>
                            </Button>
                        </Col>
                    </Row>
                    <Row>
                        <Col span={10}>
                            <div style={{fontSize: '11px', color: '#888', marginTop: '2px'}}>
                                (Default: 3 x Std. Dev. of residuals)
                            </div>
                        </Col>
                    </Row>
                </div>
            )}

            <Row align="middle">
                {detectionMethod === 'tukey' && tukeyStats && (
                    <Col span={12} style={{paddingLeft: "20px"}}>
                        <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>
                            Tukey's Fence Statistics:
                        </div>
                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                            <div>Q1 (25th percentile): {tukeyStats.q1.toFixed(3)}</div>
                            <div>Q3 (75th percentile): {tukeyStats.q3.toFixed(3)}</div>
                            <div>IQR (Q3 - Q1): {tukeyStats.iqr.toFixed(3)}</div>
                            <div style={{marginTop: '4px', fontWeight: 'bold'}}>
                                Fences (3 * IQR for extreme outliers):<br/>
                                [{tukeyStats.lowerFence.toFixed(3)}, {tukeyStats.upperFence.toFixed(3)}]
                            </div>
                        </div>
                    </Col>
                )}
                {detectionMethod === 'zscore' && zScoreStats && (
                    <Col span={12} style={{paddingLeft: "20px"}}>
                        <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>
                            Z-Score Statistics:
                        </div>
                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                            <div>Mean: {zScoreStats.mean.toFixed(3)}</div>
                            <div>Std Dev: {zScoreStats.std.toFixed(3)}</div>
                            <div>Threshold: ±{zScoreStats.threshold}σ</div>
                            <div style={{marginTop: '4px', fontWeight: 'bold'}}>
                                Bounds: [{zScoreStats.lowerBound.toFixed(3)}, {zScoreStats.upperBound.toFixed(3)}]
                            </div>
                        </div>
                    </Col>
                )}
                {detectionMethod === 'modifiedZScore' && modifiedZScoreStats && (
                    <Col span={12} style={{paddingLeft: "20px"}}>
                        <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>
                            Modified Z-Score Statistics:
                        </div>
                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                            <div>Median: {modifiedZScoreStats.median.toFixed(3)}</div>
                            <div>MAD: {modifiedZScoreStats.mad.toFixed(3)}</div>
                            <div>Threshold: ±{modifiedZScoreStats.threshold} (approx. ±3.5 * MAD)</div>
                            <div style={{marginTop: '4px', fontWeight: 'bold'}}>
                                Bounds: [{modifiedZScoreStats.lowerBound.toFixed(3)}, {modifiedZScoreStats.upperBound.toFixed(3)}]
                            </div>
                        </div>
                    </Col>
                )}
                {detectionMethod === 'seasonal' && seasonalStats && (
                    <Col span={12} style={{paddingLeft: "20px"}}>
                        <div style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '8px'}}>
                            Seasonal Decomposition Analysis:
                        </div>
                        <div style={{fontSize: '12px', lineHeight: '1.4'}}>
                            <div><strong>Seasonal Pattern:</strong></div>
                            <div>• Period: {seasonalStats.period} points</div>
                            <div>• Range: [{seasonalStats.seasonalRange.min.toFixed(2)}, {seasonalStats.seasonalRange.max.toFixed(2)}] (Amplitude)</div>
                            <div>• Peak at: Point {seasonalStats.peakTiming} in cycle</div>
                            <div>• Strength: {(seasonalStats.seasonalStrength * 100).toFixed(1)}% of total variance</div>
                            
                            <div style={{marginTop: '6px'}}><strong>Trend Component:</strong></div>
                            <div>• Slope: {seasonalStats.trendSlope.toFixed(4)} units per point</div>
                            
                            <div style={{marginTop: '6px'}}><strong>Outlier Detection on Residuals:</strong></div>
                            <div>• Std. Deviation of Residuals: {seasonalStats.std.toFixed(3)}</div>
                            <div>• Threshold: ±{seasonalStats.threshold}σ</div>
                            <div style={{fontWeight: 'bold'}}>
                                Fences: [{seasonalStats.lowerBound.toFixed(2)}, {seasonalStats.upperBound.toFixed(2)}]
                            </div>
                        </div>
                    </Col>
                )}
                {detectionMethod !== 'residual' && detectionMethod !== 'tukey' && detectionMethod !== 'zscore' && detectionMethod !== 'modifiedZScore' && detectionMethod !== 'seasonal' && (
                    <Col span={8} style={{paddingLeft: "20px"}}>
                        <div style={{fontSize: '12px', color: '#666'}}>
                            Threshold is auto-calculated for this method
                        </div>
                    </Col>
                )}
            </Row>
            <Row>
            <Col span={8} style={{paddingLeft: "20px"}}>
                Show potential outliers:<br/>
                <Checkbox
                    checked={showOutliers}
                    onChange={(e) => setShowOutliers(e.target.checked)}
                    style={{paddingLeft: "5px",
                        transform: "scale(1.5)",
                        //scale: "1.5"
                         }}

                />
            </Col>
            </Row>
            
            
            {(detectionMethod === 'residual' || detectionMethod === 'seasonal') &&
                <Row>
                    <Col span={8} style={{paddingLeft: "20px"}}>
                        Show {detectionMethod === 'seasonal' ? 'trend line' : 'moving average'}:<br/>
                        <Checkbox
                            checked={showMovingAverage}
                            onChange={(e) => setShowMovingAverage(e.target.checked)}
                            style={{
                                paddingLeft: "5px",
                                transform: "scale(1.5)",
                            }}
                        />
                    </Col>
                </Row>
            }

            {/* {epochTimes && values &&
                <Plot
                    style={{width: "100%", height: "100%"}}
                    config={{
                        responsive: true,
                        displaylogo: false,
                        displayModeBar: true,
                    }}
                    useResizeHandler={true}
                    data={[
                        {
                            x: epochTimes.map((value: number) => new Date(value)),
                            y: values,
                            type: "scattergl",
                            mode: "lines",
                            name: "Original Data",
                            showlegend: false,
                            line: {
                                color: "black",
                                width: .5,
                                dash: 'solid'
                            },
                        },
                        showMovingAverage && {
                            x: epochTimes.map((value: number) => new Date(value)),
                            y: movingAverageData,
                            type: "scattergl",
                            mode: "lines",
                            name: `${averagingMethod} (${averagingMethod === 'EMA' ? `alpha=${alpha.toFixed(2)}` : `frame=${frameSize}`})`,
                            showlegend: false,
                            line: {
                                color: "blue",
                                width: 2,
                            },
                        },
                        showOutliers && {
                            x: outliers.map((index) => new Date(epochTimes[index])),
                            y: outliers.map((index) => values[index]),
                            type: "scattergl",
                            mode: "markers",
                            name: "Outliers",
                            showlegend: false,
                            marker: {color: "red", size: 8, symbol: 4},
                        },
                    ].filter(Boolean) as Plotly.Data[]
                    } // Remove any falsy values from the array
                    layout={{
                        //title: "Data with Outliers Detected (EMA)",
                        //xaxis: { title: "Epoch Time" },
                        yaxis: {
                            autorange: false,
                            range: yAxisRange
                        },
                        margin: {
                            l: 30, // left margin
                            r: 30, // right margin
                            t: 30, // top margin
                            b: 20, // bottom margin
                            pad: 0, // padding between the plot area and the container
                        },
                        xaxis: {
                            showgrid: false,
                            zeroline: false,
                            autorange: false,
                            range: [new Date(epochTimes[0]), new Date(epochTimes[epochTimes.length - 1])],
                            type: "date",

                        },
                    }}
                />} */}

        </>
    );
}

export default OutlierDetection;