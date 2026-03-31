import React, { useEffect, useState } from 'react';
import { Col, Row, InputNumber, Button, Tooltip, Checkbox, Progress } from 'antd';
import { DeleteOutlined, CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { calculateUniquenessScoreFromArray, calculateValidityScoreFromArray, calculateTimelinessScore } from "../services/dataQualityHelpers";
import dayjs from "dayjs";
import { ResponseData } from '../services/dataConnector';

interface DataQualitySummaryFullProps { 
    siteID: number | string | undefined;
    startDate: string;
    endDate: string;
    selectedTimeInterval: string | undefined;
    selectedAggregationInterval: string | undefined;
    completenessScore: number;
    field: string;
    inputData: ResponseData | undefined;
    minValidValue: number | undefined;
    setMinValidValue: (value: number | undefined) => void;
    maxValidValue: number | undefined;
    setMaxValidValue: (value: number | undefined) => void;
    maxEpochTimeOfSelectedField?: number;
    minEpochTimeOfSelectedField?: number; // Add this line
    maxEpochTime?: number; // Add this line
}

const DataQualitySummary: React.FC<DataQualitySummaryFullProps> = ({
    siteID,
    startDate,
    endDate,
    selectedTimeInterval,
    selectedAggregationInterval,
    completenessScore,
    field,
    inputData,
    minValidValue,
    setMinValidValue,
    maxValidValue,
    setMaxValidValue,
    maxEpochTimeOfSelectedField
}) => {
    const [tempMinValidValue, setTempMinValidValue] = useState<number | undefined>(minValidValue);
    const [tempMaxValidValue, setTempMaxValidValue] = useState<number | undefined>(maxValidValue);
    const [hasNewInput, setHasNewInput] = useState<boolean>(false);
    const [includeFutureCheck, setIncludeFutureCheck] = useState<boolean>(true);
    const [dataQualityResults, setDataQualityResults] = useState({
        uniquenessPercentScore: 0,
        valueUniquenessScore: 0,
        validityPercentScore: 0,
        timelinessScore: 0
    });
    const [completenessScoreState, setCompletenessScoreState] = useState(0);

    useEffect(() => {
        if (!inputData) return;
        
        const fetchDataAndPerformDataQualityChecks = async () => {
            const epochTimeArray = [...inputData.EpochTime];
            const valuesArray = [...inputData.value];
            const uniquenessScore = calculateUniquenessScoreFromArray(epochTimeArray);
            const valueUniquenessScore = calculateUniquenessScoreFromArray(valuesArray);
            const validityScore = calculateValidityScoreFromArray(
                epochTimeArray,
                valuesArray,
                Number.NEGATIVE_INFINITY,
                includeFutureCheck ? dayjs.utc().valueOf() : Number.POSITIVE_INFINITY,
                minValidValue,
                maxValidValue
            );
            const currentTime = Date.now();
            const timelinessScore = maxEpochTimeOfSelectedField !== undefined
                ? calculateTimelinessScore(maxEpochTimeOfSelectedField, currentTime)
                : 0;

            setDataQualityResults({
                uniquenessPercentScore: uniquenessScore,
                valueUniquenessScore: valueUniquenessScore,
                validityPercentScore: validityScore,
                timelinessScore: timelinessScore
            });
        };
        fetchDataAndPerformDataQualityChecks();
    }, [inputData, siteID, selectedTimeInterval, startDate, endDate, minValidValue, maxValidValue, maxEpochTimeOfSelectedField, includeFutureCheck]);

    useEffect(() => {
        setCompletenessScoreState(completenessScore);
    }, [completenessScore]);

    if (!inputData) {
        return <div>No data available</div>;
    }

    const handleMinValidValueChange = (value: number | null) => {
        const validValue = value !== null ? value : undefined;
        setTempMinValidValue(validValue);
        setHasNewInput(validValue !== minValidValue || tempMaxValidValue !== maxValidValue);
    }

    const handleMaxValidValueChange = (value: number | null) => {
        const validValue = value !== null ? value : undefined;
        setTempMaxValidValue(validValue);
        setHasNewInput(tempMinValidValue !== minValidValue || validValue !== maxValidValue);
    }

    const applyValidRange = () => {
        setMinValidValue(tempMinValidValue);
        setMaxValidValue(tempMaxValidValue);
        setHasNewInput(false);
    }

    const clearValidRange = () => {
        setTempMinValidValue(undefined);
        setTempMaxValidValue(undefined);
        setMinValidValue(undefined);
        setMaxValidValue(undefined);
        setHasNewInput(false);
    }

    const getScoreColor = (score: number): string => {
        if (score >= 90) return '#52c41a';  // Green
        if (score >= 70) return '#95de64';  // Light Green
        if (score >= 50) return '#fadb14';  // Yellow
        if (score >= 30) return '#fa8c16';  // Orange
        return '#f5222d';                   // Red
    };

    return (
        <div>
            <Row style={{ paddingTop: 20 }} justify="center">
                <Col span={7} style={{ textAlign: 'center' }}>
                    <div>
                        <Progress
                            type="circle"
                            percent={dataQualityResults.uniquenessPercentScore}
                            size={100}
                            strokeColor={getScoreColor(dataQualityResults.uniquenessPercentScore)}
                            strokeWidth={8}
                            format={(percent) => `${percent}%`}
                        />
                        <p style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>
                            Temporal Uniqueness
                            <Tooltip title="Measures if each timestamp has only one corresponding value">
                                <InfoCircleOutlined style={{ marginLeft: '5px', color: '#1890ff' }} />
                            </Tooltip>
                        </p>
                        <Progress
                            type="circle"
                            percent={dataQualityResults.valueUniquenessScore}
                            size={100}
                            strokeColor={getScoreColor(dataQualityResults.valueUniquenessScore)}
                            strokeWidth={8}
                            format={(percent) => `${percent}%`}
                        />
                        <p style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>
                            Value Uniqueness
                            <Tooltip title="Measures the percentage of unique values in the dataset">
                                <InfoCircleOutlined style={{ marginLeft: '5px', color: '#1890ff' }} />
                            </Tooltip>
                        </p>
                    </div>
                </Col>
                <Col span={7} style={{ textAlign: 'center' }}>
                    <Progress
                        type="circle"
                        percent={completenessScoreState}
                        size={100}
                        strokeColor={getScoreColor(completenessScoreState)}
                        strokeWidth={8}
                        format={(percent) => `${percent}%`}
                    />
                    {selectedAggregationInterval === 'none' ? (
                        <p style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>
                            Completeness N/A
                            <Tooltip title="Completeness score is only available for aggregated data">
                                <InfoCircleOutlined style={{ marginLeft: '5px', color: '#1890ff' }} />
                            </Tooltip>
                        </p>
                    ) : (
                        <p style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>
                            Completeness
                            <Tooltip title="Percentage of time intervals that contain data">
                                <InfoCircleOutlined style={{ marginLeft: '5px', color: '#1890ff' }} />
                            </Tooltip>
                        </p>
                    )}
                </Col>
                <Col span={7} style={{ textAlign: 'center' }}>
                    <Progress
                        type="circle"
                        percent={dataQualityResults.validityPercentScore}
                        size={100}
                        strokeColor={getScoreColor(dataQualityResults.validityPercentScore)}
                        strokeWidth={8}
                        format={(percent) => `${percent}%`}
                    />
                    <p style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>
                        Validity
                        <Tooltip title="Percentage of values that fall within the specified valid range">
                            <InfoCircleOutlined style={{ marginLeft: '5px', color: '#1890ff' }} />
                        </Tooltip>
                    </p>
                    <br />
                    <label style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>Valid Value Range</label>
                    <br />
                    <InputNumber
                        value={tempMinValidValue}
                        placeholder="Min"
                        onChange={handleMinValidValueChange}
                        style={{ width: "75px" }}
                    />
                    <InputNumber
                        value={tempMaxValidValue}
                        placeholder="Max"
                        onChange={handleMaxValidValueChange}
                        style={{ width: "75px" }}
                    />
                    <br />
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginTop: "10px" }}>
                        <Tooltip title="Apply valid range" open={hasNewInput ? undefined : false}>
                            <Button
                                onClick={applyValidRange}
                                icon={<CheckOutlined />}
                                style={{
                                    marginRight: "5px",
                                    height: "28px",
                                    backgroundColor: hasNewInput ? "#52c41a" : "white",
                                    color: hasNewInput ? "white" : "rgba(0, 0, 0, 0.25)",
                                    borderColor: hasNewInput ? "#52c41a" : "#d9d9d9",
                                }}
                                disabled={!hasNewInput}
                            />
                        </Tooltip>
                        <Tooltip title="Clear valid range" open={tempMinValidValue !== undefined || tempMaxValidValue !== undefined ? undefined : false}>
                            <Button
                                icon={<DeleteOutlined />}
                                onClick={clearValidRange}
                                style={{
                                    marginLeft: "5px",
                                    height: "28px",
                                    color: tempMinValidValue !== undefined || tempMaxValidValue !== undefined ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.25)",
                                    borderColor: tempMinValidValue !== undefined || tempMaxValidValue !== undefined ? "#d9d9d9" : "transparent",
                                    backgroundColor: "transparent",
                                }}
                                disabled={tempMinValidValue === undefined && tempMaxValidValue === undefined}
                            />
                        </Tooltip>
                    </div>
                    <div style={{ marginTop: "8px" }}>
                        <Checkbox 
                            checked={includeFutureCheck}
                            onChange={(e) => setIncludeFutureCheck(e.target.checked)}
                            style={{ fontSize: "12px", color: "rgba(0, 0, 0, 0.65)" }}
                        >
                            Consider future timestamps invalid
                        </Checkbox>
                    </div>
                </Col>
               {/* <Col span={6} style={{ textAlign: 'center' }}>
                    <Circle
                        progress={dataQualityResults.timelinessScore}
                        size={"100"}
                    />
                    <p style={{ color: 'black', margin: 'auto', textAlign: 'center' }}>Timeliness</p>
                </Col> */}
            </Row>
        </div>);
};

export default DataQualitySummary;
