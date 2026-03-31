import React, {useState, useEffect} from 'react';
import {DatePicker, Select, Row, Col, DatePickerProps} from 'antd';
import dayjs, {Dayjs} from 'dayjs';
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const {Option} = Select;
dayjs.extend(customParseFormat);

function getTimezoneOffset(tz: string) {
    const offset = dayjs().tz(tz).utcOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const minutes = String(absOffset % 60).padStart(2, '0');
    return `${sign}${hours}:${minutes}`;
}

interface DateAndSelectedFieldAkaColumnSelectorProps {
    selectedDataset: string;
    selectedDimension: string | undefined;
    selectedDimensionUniqueValue: string | number | undefined;
    selectedFieldAkaColumn: string | undefined;
    startDate: string;
    onStartDateChange: (startDate: string) => void;
    endDate: string;
    onEndDateChange: (endDate: string) => void;
    timeGranularity: 'none'|'daily' |'hourly' |  '30min' | '15min';
    onTimeGranularityChange: (timeGranularity: 'none'| 'daily' | 'hourly' |  '30min' | '15min') => void;
    selectedTimeInterval: DatePickerProps['picker'] | 'showAll';
    onSelectTimeInterval: (selectedTimeInterval: DatePickerProps['picker'] | 'showAll') => void;
    aggregationType: 'avg' | 'sum' | 'min' | 'max'
    onAggregationTypeChange: (aggregationType: 'avg' | 'sum' | 'min' | 'max') => void;
    timezone: string; // Add timezone prop
    onTimezoneChange: (timezone: string) => void; // Add onTimezoneChange prop
}

const PickerWithType = ({
                            type,
                            onChange,
                            defaultValue,
                            disabled,
                            format,
                            value,

                        }: {
                                type: DatePickerProps['picker'] | 'showAll'//PickerType;
                                onChange: DatePickerProps['onChange'];
                                defaultValue: DatePickerProps['defaultValue'];
                                disabled: DatePickerProps['disabled']
                                format: DatePickerProps['format']
                                value: DatePickerProps['value']
                            }) => {
    if (type === 'showAll') {
        return (
                <DatePicker
                    picker={undefined}
                    onChange={onChange}
                    defaultValue={defaultValue}
                    disabled={disabled}
                    format={format}
                    style={{marginLeft: 2, marginRight: 5}}
                />
        );
    }

    return (
        <DatePicker
            picker={type}
            onChange={onChange}
            defaultValue={defaultValue}
            disabled={disabled}
            format={format}
            style={{marginLeft: 2, marginRight: 5}}
            value={value}
        />
    );
};

const OptionSelector: React.FC<DateAndSelectedFieldAkaColumnSelectorProps> = ({
                                                                                  selectedDataset,
                                                                                  selectedDimension,
                                                                                  selectedDimensionUniqueValue,
                                                                                  selectedFieldAkaColumn,
                                                                                  startDate,
                                                                                  onStartDateChange,
                                                                                  endDate,
                                                                                  onEndDateChange,
                                                                                  timeGranularity,
                                                                                  onTimeGranularityChange,
                                                                                  selectedTimeInterval,
                                                                                  onSelectTimeInterval,
                                                                                  aggregationType,onAggregationTypeChange,
                                                                                  timezone, 
                                                                                  onTimezoneChange 

                                                                              }) => {
    const [isDatePickerDisabled, setIsDatePickerDisabled] = useState<DatePickerProps['disabled']>(true)
    const [customFormat, setCustomFormat] = useState<DatePickerProps['format']>(undefined)
    const [localTimezone, setLocalTimezone] = useState(timezone);

    //==================================================================================================================
    //Event Handlers
    //==================================================================================================================
    const handleDateChange = (value: Dayjs, dateString: string|string[]) => {
        //console.log("OptionSelector.tsx: handleDateChange: value = ", value, "  dateString = ", dateString)

        if (value !== null) {
            if (selectedTimeInterval === 'year') {
                const newStartDate = value.startOf('year').format('YYYY-MM-DD HH:mm:ss');
                const newEndDate = value.endOf('year').format('YYYY-MM-DD HH:mm:ss');
                onStartDateChange(newStartDate);
                onEndDateChange(newEndDate);
            } else {
                const newStartDate = value.startOf('month').format('YYYY-MM-DD HH:mm:ss');
                const newEndDate = value.endOf('month').format('YYYY-MM-DD HH:mm:ss');
                onStartDateChange(newStartDate);
                onEndDateChange(newEndDate);
            }
        }
    };

    const handleSetPeriodType = (timeInterval: DatePickerProps['picker'] | 'showAll') => {

        if (timeInterval !== 'showAll') { //
            setIsDatePickerDisabled(false);
            onSelectTimeInterval(timeInterval); // Update parent state
            if (timeInterval === 'year') {
                setCustomFormat("YYYY");
                onStartDateChange(dayjs(startDate).startOf('year').format('YYYY-MM-DD HH:mm:ss'));
                onEndDateChange(dayjs(startDate).endOf('year').format('YYYY-MM-DD HH:mm:ss'));
            } else if (timeInterval === 'month') {
                setCustomFormat("YYYY MMMM");
                onStartDateChange(dayjs(startDate, 'YYYY/MM/DD').startOf('month').format('YYYY-MM-DD HH:mm:ss'));
                onEndDateChange(dayjs(startDate, 'YYYY/MM/DD').endOf('month').format('YYYY-MM-DD HH:mm:ss'));
            }
        } else {
            setIsDatePickerDisabled(true);
            onSelectTimeInterval(timeInterval); // Update parent state
            //setCustomFormat(newFormat);
        }
    };

    const handleTimeGranularityChange = (timeGranularity: 'none'| 'daily' | 'hourly' |  '30min' | '15min') => {
        onTimeGranularityChange(timeGranularity);
    }

    const handleAggregationTypeChange = (aggregationType: 'avg' | 'sum' | 'min' | 'max') => {
        onAggregationTypeChange(aggregationType);

    }

    const handleTimezoneChange = (value: string) => {
        setLocalTimezone(value);
        onTimezoneChange(value); // Pass the selected timezone back to the parent
    };

    useEffect(() => {
        const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setLocalTimezone(defaultTimezone);
        onTimezoneChange(defaultTimezone);
    }, []);

    //==================================================================================================================
    //Content Render
    //==================================================================================================================
    const fontSize = 16;

    return (

        <Row style={{ display: "flex", justifyContent: "space-between"}}>
            <span  style={{ fontSize: fontSize }}>
                <label htmlFor="Dataset" >Dataset: </label>
                <b style={{ fontSize: 16, marginLeft: selectedDataset? 0:200 }}>{selectedDataset}</b>&emsp;
                {/*
                 selectedDimension && selectedDimensionUniqueValue &&
                    (<><label htmlFor="Dimension">Dimension(value): </label>
                <b style={{ fontSize: 16 }}>{selectedDimension}({selectedDimensionUniqueValue})&emsp;</b></>)
                */}
                <label htmlFor="selectedFieldAkaColumn">Field: </label>
                <b style={{ fontSize: 16 }}>{selectedFieldAkaColumn}</b>
            </span>

            <span  style={{fontSize: fontSize, textAlign: 'right'}}>
                    <label htmlFor="timePeriod">Time period:</label>
                    <Select
                        id="timePeriod"
                        defaultValue={undefined}
                        value={selectedTimeInterval}
                        onChange={handleSetPeriodType}
                        style={{width: 100, marginLeft: 5, textAlign: 'left'}}
                    >
                        <Option value="year">Year</Option>
                        <Option value="month">Month</Option>
                        <Option value="showAll">Show All</Option>
                    </Select>

                        <PickerWithType
                            type={selectedTimeInterval}
                            onChange={handleDateChange}
                            defaultValue={dayjs(startDate, 'YYYY-MM-DD')}
                            disabled={isDatePickerDisabled}
                            format={customFormat}
                            value={dayjs(startDate, 'YYYY-MM-DD')}
                        />

                    <label htmlFor="aggregationInterval">Aggregation interval:</label>
                    <Select
                        id="aggregationInterval"
                        value={timeGranularity}
                        style={{width: 100, marginLeft: 5, textAlign: 'left'}}
                        onChange={handleTimeGranularityChange}>
                        <Option value="none">None</Option>
                        <Option value="daily">Daily</Option>
                        <Option value="hourly">Hourly</Option>
                        <Option value="30min" >30 min</Option>
                        <Option value="15min" >15 min</Option>

                    </Select>

                    <label style={{marginLeft: 5}} htmlFor="aggregationType">Agg. type:</label>
                    <Select
                        id="aggregationType"
                        value={aggregationType}
                        style={{width: 100, marginLeft: 5, textAlign: 'left'}}
                        onChange={handleAggregationTypeChange}
                        disabled={timeGranularity === 'none'}>
                        <Option value="avg">Average</Option>
                        <Option value="sum">Sum</Option>
                        <Option value="min">Min</Option>
                        <Option value="max">Max</Option>
                        {/*                     <Option value="count">Count</Option>
                        <Option value="std">Std</Option>
                        <Option value="var">Var</Option>
                        <Option value="first">First</Option>
                        <Option value="last">Last</Option>
                        <Option value="any">Any</Option>
                        <Option value="all">All</Option>
                        <Option value="none">None</Option>*/}
                    </Select>
                    {/* 
                    <label htmlFor="timezone">Timezone:</label>
                    <Select
                        id="timezone"
                        value={localTimezone}
                        onChange={handleTimezoneChange}
                        style={{ width: 200, marginLeft: 5 }}
                    >
                        <Option value="UTC">UTC ({getTimezoneOffset('UTC')})</Option>
                        <Option value="Europe/Vienna">Europe/Vienna ({getTimezoneOffset('Europe/Vienna')})</Option>
                        <Option value="Europe/Bucharest">Europe/Bucharest ({getTimezoneOffset('Europe/Bucharest')})</Option>
                        <Option value="America/New_York">America/New_York ({getTimezoneOffset('America/New_York')})</Option>
                       
                    </Select>
                     */}
            </span>
            {/*<Col span={5} style={{ fontSize: fontSize }}>
                <label htmlFor="startDate">Range: </label>
                <b>{startDate.slice(0,10)} - {endDate.slice(0,10)}</b>
            </Col>*/}

        </Row>

    );
};

export default OptionSelector