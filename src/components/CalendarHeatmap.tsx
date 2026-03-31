import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly, { ColorScale } from "plotly.js";
import { getDayOfYear, getDaysInMonth, getDaysInYear, getWeek } from "date-fns";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc'
import dayOfYear from 'dayjs/plugin/dayOfYear';
import timezone from 'dayjs/plugin/timezone';
import { Checkbox, Dropdown, DropdownProps, MenuProps, Space } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { ResponseData } from '../services/dataConnector';


dayjs.extend(utc)
dayjs.extend(dayOfYear);
dayjs.extend(timezone);

type HeatMapProps = {
    inputData: ResponseData | undefined;
    period: string | undefined;
    year: string; // TODO: get rid of Year and month to make the whole thing more universal
    month: string;
    granularity: string;
    datapoint: string | number | undefined;
    monitoredVariable?: string | undefined;
    loadingStatus: (status: boolean) => void;
    minEpochTime?: number | undefined;
    setSelectedPointIndex: (index: number) => void;
    timezone: string;
    selectedColorscale: Plotly.ColorScale | undefined;
    onColorscaleChange: (colorscale: string) => void;
    reverseColorscale: boolean;
    onReverseColorscaleChange: (reverse: boolean) => void;
}

const CalendarHeatmap: React.FC<HeatMapProps> = ({
    inputData,
    period,
    year,
    month,
    granularity,// = 'hourly',
    datapoint,
    monitoredVariable,// = undefined,
    loadingStatus,
    minEpochTime,
    setSelectedPointIndex,
    timezone,
    selectedColorscale,
    onColorscaleChange,
    reverseColorscale,
    onReverseColorscaleChange
}) => {
    // print to console all inputs that changed:

    const [revision, setRevision] = useState<number>(0);
    const [plotData, setPlotData] = useState<Partial<Plotly.PlotData>[]>([
        {
            x: undefined,
            y: undefined,
            z: undefined,
            text: undefined,
            hoverinfo: 'text',
            showscale: true,
            colorscale: 'Viridis',
            type: 'heatmap',
            xgap: .1, // horizontal gap (in pixels) between bricks
            ygap: .1, // vertical gap (in pixels) between bricks
            colorbar: {
                title: {
                    text: monitoredVariable,
                    side: 'right',
                    font: {
                        color: 'black',
                        size: 15,
                        family: 'Arial, sans-serif',
                    },
                },
                thickness: 20,
                x: 1.02,
                xpad: 10,
        },
        },
    ]);
    const [plotLayout, setPlotLayout] = useState<Partial<Plotly.Layout>>({
        xaxis: {
            showline: false,
            showgrid: false,
            zeroline: false,
            visible: true,  // Change to true to show axis
            showticklabels: false,  // Hide tick labels
        },
        yaxis: {
            showline: false,
            showgrid: false,
            zeroline: false,
            visible: false,
        },
        margin: {
            l: 40,   // left margin
            r: 30,   // right margin
            t: 40,   // top margin
            b: 50,   // bottom margin
            pad: 0  // padding between the plot area and the container
        },
    });

    const [open, setOpen] = useState(false);

    const colorscaleOptions = [
        'Blackbody', 'Bluered', 'Blues', 'Cividis', 'Earth', 'Electric', 'Greens', 'Greys', 'Hot', 'Jet', 'Magma', 'Picnic', 'Portland',
        'Rainbow', 'RdBu', 'Reds', 'Viridis', 'YlGnBu', 'YlOrRd'
    ];

    const customColorscales: { [key: string]: ColorScale } = {
        'Magma':
            [[0, "rgb(0,0,4)"],
            [0.13, "rgb(28,16,68)"],
            [0.25, "rgb(79,18,123)"],
            [0.38, "rgb(129,37,129)"],
            [0.5, "rgb(181,54,122)"],
            [0.63, "rgb(229,80,100)"],
            [0.75, "rgb(251,135,97)"],
            [0.88, "rgb(254,194,135)"],
            [1, "rgb(252,253,191)"]],
        'LimitedGreyscale':
            [[0, '#222222'],
            [1, '#eeeeee']],

        'BinnedGreyscale':
            [[0, "rgb(0, 0, 0)"], [0.1, "rgb(0, 0, 0)"],
            [0.1, "rgb(20, 20, 20)"], [0.2, "rgb(20, 20, 20)"],
            [0.2, "rgb(40, 40, 40)"], [0.3, "rgb(40, 40, 40)"],
            [0.3, "rgb(60, 60, 60)"], [0.4, "rgb(60, 60, 60)"],
            [0.4, "rgb(80, 80, 80)"], [0.5, "rgb(80, 80, 80)"],
            [0.5, "rgb(100, 100, 100)"], [0.6, "rgb(100, 100, 100)"],
            [0.6, "rgb(120, 120, 120)"], [0.7, "rgb(120, 120, 120)"],
            [0.7, "rgb(140, 140, 140)"], [0.8, "rgb(140, 140, 140)"],
            [0.8, "rgb(160, 160, 160)"], [0.9, "rgb(160, 160, 160)"],
            [0.9, "rgb(180, 180, 180)"], [1.0, "rgb(180, 180, 180)"]],

    };
    // const customColorscale:ColorScale | undefined = [
    // [0, '#eeeeee'],
    // [0.5,'#ff0000'],
    // [1, '#222222']];

    /*    const customColorscale: ColorScale | undefined = [
            [0.0, '#331317'],
            [0.25,"#7e2b21"],
            [0.5,"#b76713"],
            [0.75,"#d0a11f"],
            [1.0,"#fdf44a" ]
        ];*/

    const menuItems: MenuProps['items'] = [
        {
            key: 'colorscale',
            label: 'Colorscale',
            children: colorscaleOptions.map((scale) => ({
                key: scale,
                label: scale,
                style: {
                    height: 10,
                },
            })),
        },
        {
            key: 'reverseColorscale',
            label: (
                <Space>
                    <Checkbox checked={reverseColorscale} />
                    Reverse Colorscale
                </Space>
            ),
        },

    ];

    //const customColorscale: ColorScale | undefined = 'Magma'//Viridis colorscale
    //const reverseScale = true;

    // function that determines the title of the heatmap based on the period and granularity
    function DetermineTitle(period: string, granularity: string) {
        return (period === 'year' && granularity === 'hourly') ? 'Day of Year' :
            (period === 'year' && granularity === 'daily') ? 'Week of Month' :
                (period === 'month' && granularity === 'hourly') ? 'Day of Month' :
                    (period === 'month' && granularity === 'daily') ? 'Week of Month' :
                        '';
    }

    interface DataArray {
        EpochTime: number[];
        value: (number | null)[];
    }

    function mergeHourlyData(hourKeys: string[], inputData: DataArray): DataArray {
        // Create a map to store hour combinations from input data
        const hourlyMap = new Map<string, number>();

        // Process input data and store in hourly map
        inputData.EpochTime.forEach((time, index) => {
            const value = inputData.value[index];
            if (value !== null) {
                const hourlyKey = dayjs(time).format('YYYY-MM-DD HH');
                hourlyMap.set(hourlyKey, value);
            }
        });

        // Map the hour keys to values
        const values = hourKeys.map(hourKey =>
            hourlyMap.has(hourKey) ? hourlyMap.get(hourKey)! : NaN
        );

        // Convert keys back to epoch times for return value
        const epochTimes = hourKeys.map(key => dayjs(key).valueOf());

        return {
            EpochTime: epochTimes,
            value: values
        };
    }




    // For daily granularity (both year and month)
    function mergeDailyData(dayKeys: string[], inputData: DataArray): DataArray {
        const dailyGroups = new Map<string, number[]>();
        console.log('inputData.EpochTime', inputData.EpochTime)
    
        inputData.EpochTime.forEach((time, index) => {
            const dayKey = dayjs(time).format('YYYY-MM-DD');
            console.log('dayKey', dayKey)
            if (!dailyGroups.has(dayKey)) {
                dailyGroups.set(dayKey, []);
            }
            if (inputData.value[index] !== null) {
                dailyGroups.get(dayKey)!.push(inputData.value[index]!);
            }
        });
    
        const values = dayKeys.map(dayKey => {
            const dayValues = dailyGroups.get(dayKey);
            return dayValues?.length
                ? dayValues.reduce((sum, v) => sum + v, 0) / dayValues.length
                : NaN;
        });

        const epochTimes = dayKeys.map(key => dayjs(key).valueOf());
        return {
            EpochTime: epochTimes,
            value: values
        };
    }


    interface HeatmapAxisConfig {
        tickText: string[];
        tickVals: number[];
        stepData: number[];
    }

    interface HeatmapAxisData {
        xAxis: HeatmapAxisConfig;
        yAxis: HeatmapAxisConfig;
        dates: Date[];
    }

    function generateHourlyHeatmapConfig(
        selectionRangeStart: number,
        period: 'year' | 'month'
    ): HeatmapAxisData {
        const startDate = dayjs(selectionRangeStart);
        const numberOfDays = period === 'year'
            ? startDate.endOf('year').diff(startDate.startOf('year'), 'day') + 1
            : startDate.daysInMonth();

        console.log('numberOfDays', numberOfDays)

        // Y-axis (hours) is identical for both periods
        const yAxis: HeatmapAxisConfig = {
            tickText: Array.from(
                { length: 24 },
                (_, i) => `${String(i).padStart(2, '0')}:00`
            ),
            tickVals: Array.from({ length: 24 }, (_, i) => i),
            stepData: Array.from(
                { length: numberOfDays * 24 },
                (_, i) => i % 24
            )
        };

        // X-axis configuration differs between year and month
        const xAxis: HeatmapAxisConfig = period === 'year'
            ? {
                // Yearly view: months
                tickText: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                tickVals: Array.from({ length: 12 }, (_, month) => {
                    const prevMonthsDays = Array.from({ length: month }, (_, m) =>
                        startDate.month(m).daysInMonth()
                    ).reduce((sum, days) => sum + days, 0);
                    return prevMonthsDays;
                }),
                stepData: Array.from(
                    { length: numberOfDays * 24 },
                    (_, i) => Math.floor(i / 24)
                )
            }
            : {
                // Monthly view: days
                tickText: Array.from(
                    { length: numberOfDays },
                    (_, i) => i === 0 ? '1' : ((i + 1) % 5 === 0 ? `${i + 1}` : '')
                ).filter(Boolean),
                tickVals: Array.from(
                    { length: numberOfDays },
                    (_, i) => i === 0 ? 0 : ((i + 1) % 5 === 0 ? i : null)
                ).filter((val): val is number => val !== null),
                stepData: Array.from(
                    { length: numberOfDays * 24 },
                    (_, i) => Math.floor(i / 24)
                )
            };

        // Generate dates array for hover text
        const dates = Array.from(
            { length: numberOfDays },
            (_, i) => new Date(selectionRangeStart + i * 24 * 3600000)
        );

        return { xAxis, yAxis, dates };
    }

    function generateDailyHeatmapConfig(
        selectionRangeStart: number,
        period: 'year' | 'month'
    ): HeatmapAxisData {
        const startDate = dayjs(selectionRangeStart);
        const numberOfDays = period === 'year'
            ? startDate.endOf('year').diff(startDate.startOf('year'), 'day') + 1
            : startDate.daysInMonth();

        // Y-axis (days of week) is identical for both periods
        const yAxis: HeatmapAxisConfig = {
            tickText: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            tickVals: [0, 1, 2, 3, 4, 5, 6],
            stepData: Array.from({ length: numberOfDays }, (_, i) => {
                const date = startDate.add(i, 'day');
                return date.day() === 0 ? 6 : date.day() - 1;
            })
        };

        // X-axis configuration differs between year and month
        const xAxis: HeatmapAxisConfig = period === 'year'
            ? {
                // Yearly view: months
                tickText: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                tickVals: (() => {
                    const month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    if (numberOfDays === 366) month_days[1] = 29;
                    return month_days.reduce((acc: number[], days, i) => {
                        const prevValue = acc[i - 1] || -1;
                        acc.push(prevValue + (days / 7));
                        return acc;
                    }, []);
                })(),
                stepData: Array.from({ length: numberOfDays }, (_, i) => {
                    const date = startDate.add(i, 'day');
                    return getWeek(date.toDate(), { weekStartsOn: 1 });
                })
            }
            : {
                // Monthly view: weeks
                tickText: Array.from({ length: 6 }, (_, i) => `Week ${i + 1}`),
                tickVals: Array.from({ length: 6 }, (_, i) => i),
                stepData: Array.from({ length: numberOfDays }, (_, i) => 
                    getWeek(startDate.add(i, 'day').toDate(), { weekStartsOn: 1 })
                )
            };

        // Add dates array before return
        const dates = Array.from(
            { length: numberOfDays },
            (_, i) => startDate.add(i, 'day').toDate()
        );

        return { xAxis, yAxis, dates };
    }

    // ==================================================================================================================
    // Main React.useEffect hook that updates the plot data and layout
    // =================================================================================================================
    useEffect(() => {

        if (period === 'showAll') {
            loadingStatus(false)
            return
        }

        let data: number[] = []
        let epochMergedDF: DataArray = { EpochTime: [], value: [] };
        let xaxisTickText: string[] = []
        let xaxisTickVals: number[] = []
        let xaxisStepData: number[] = []

        let yaxisTickText: string[] = []
        let yaxisTickVals: number[] = []
        let yaxisStepData: number[] = []

        let hoverOverText: string[] = []
        let datesInSelectedTimePeriod: Date[] = []
        let datesInSelectedMonth: Date[] = []

        // needed to exclude fields from marking as Missing in the heatmap:
        let firstHour = 0;
        let firstDay = 0;
        let lastHour = 8784; // 365 days * 24 hours
        let lastDay = 366; // 365 days in a year




        if (inputData != undefined && period != null && granularity != null && datapoint != undefined && monitoredVariable != undefined) {

            // =================
            // DATA PREPARATION
            // =================

            //get rid of nulls and NaNs that prevent averaging using danfojs

            // Create a new DataFrame with only the 'EpochTime' and 'value' columns
            //let tempDF = inputData.loc({ columns: ["EpochTime", "value"] }).copy();

            // Instead of dropping NaN values, we'll keep them and handle them later
            const currentEpochTimes = [...inputData.EpochTime];
            const currentDataValues = [...inputData.value];

            console.log('currentEpochTimes', currentEpochTimes)
            console.log('currentDataValues', currentDataValues)


            const seen = new Set();
            const uniqueEpochTimeValues: number[] = [];
            const uniqueDataValues: (number | null)[] = [];

            for (let i = 0; i < currentEpochTimes.length; i++) {
                const epochTime = currentEpochTimes[i];
                const data = currentDataValues[i];
                if (!seen.has(epochTime)) {
                    seen.add(epochTime);
                    uniqueEpochTimeValues.push(epochTime);
                    uniqueDataValues.push(data);
                }
            }

            console.log("uniqueEpochTimeValues", uniqueEpochTimeValues);
            console.log("uniqueDataValues", uniqueDataValues);

            // Check if we have at least one data point
            //TODO: get rid of this ASAP
            if (uniqueEpochTimeValues.length > 0) {
                const tempDF = new Object({ EpochTime: uniqueEpochTimeValues, value: uniqueDataValues });
            } else {
                console.log("No data points available. Unable to create heatmap.");
                loadingStatus(false);
                return;
            }

            const duplicatesNumber = currentEpochTimes.length - uniqueEpochTimeValues.length;


            // ===============
            // MONTH PERIOD  
            // ===============

            if (period === 'month') {
                // Create start date in local time, then convert to UTC for consistency with data
                const selectionRangeStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`)
                    .local()                    // Ensure we're starting in local time
                    .startOf('month')          // Start of month in local time
                    .utc()                     // Convert to UTC
                    .valueOf();                // Get timestamp

                // Calculate end of month in local time, then convert to UTC
                const selectionRangeEnd = dayjs(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`)
                    .local()                    // Ensure we're starting in local time
                    .endOf('month')            // End of month in local time
                    .utc()                     // Convert to UTC
                    .valueOf();                // Get timestamp

                console.log('selectionRangeStart', new Date(selectionRangeStart).toISOString());
                console.log('selectionRangeEnd', new Date(selectionRangeEnd).toISOString());

                // Handle minEpochTime in local time
                if (minEpochTime !== undefined && minEpochTime > selectionRangeStart) {
                    firstDay = dayjs(minEpochTime)
                        .local()               // Convert to local time
                        .date();              // Get day of month
                    const hourOfDay = dayjs(minEpochTime)
                        .local()               // Convert to local time
                        .hour();              // Get hour
                    firstHour = (firstDay - 1) * 24 + hourOfDay;
                }

                // Handle current time in local time
                const CurrentTime = Date.now();
                if (CurrentTime < selectionRangeEnd) {
                    lastDay = dayjs(CurrentTime)
                        .local()               // Convert to local time
                        .date();              // Get day of month
                    const hourOfDay = dayjs(CurrentTime)
                        .local()               // Convert to local time
                        .hour();              // Get hour
                    lastHour = (lastDay - 1) * 24 + hourOfDay;
                }



                // ==========================
                // MONTH - HOURLY GRANULARITY
                // ==========================
                if (granularity === 'hourly') {
                    const numberOfDaysInSelectedPeriod = getDaysInMonth(selectionRangeStart);
                    console.log('numberOfDaysInSelectedPeriod', numberOfDaysInSelectedPeriod)
                    // Generate array of day-hour keys directly
                    const daysInMonth = dayjs(selectionRangeStart).daysInMonth();
                    const year = dayjs(selectionRangeStart).year();
                    const month = dayjs(selectionRangeStart).month() + 1; // month is 0-based
                    const dayHourKeys: string[] = [];

                    for (let day = 1; day <= daysInMonth; day++) {
                        for (let hour = 0; hour < 24; hour++) {
                            dayHourKeys.push(
                                `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}`
                            );
                        }
                    }

                    console.log("all day hours", dayHourKeys)
                    console.log('inputData all day hours', inputData.EpochTime.map(epoch => dayjs(epoch).format('YYYY-MM-DD HH')))


                    epochMergedDF = mergeHourlyData(dayHourKeys, inputData);

                    const {
                        xAxis,
                        yAxis,
                        dates
                    } = generateHourlyHeatmapConfig(selectionRangeStart, period);

                    // Update state variables
                    xaxisTickText = xAxis.tickText;
                    xaxisTickVals = xAxis.tickVals;
                    xaxisStepData = xAxis.stepData;
                    yaxisTickText = yAxis.tickText;
                    yaxisTickVals = yAxis.tickVals;
                    yaxisStepData = yAxis.stepData;
                    datesInSelectedTimePeriod = dates;

                    console.log('xaxisstepdata', xaxisStepData)
                    console.log('yaxisstepdata', yaxisStepData)


                    const dateTimeStrings = epochMergedDF.EpochTime.map((value: number) => {
                        return dayjs(value).format('YYYY/MM/DD HH:mm:ss [UTC]Z');
                    });
                    console.log("calendar heatmap epochMergedDF", epochMergedDF.value)
                    const values = epochMergedDF.value.map((value: number | null) => {
                        // Convert the value to a number if it's not already
                        const numberValue = Number(value);
                        return !isNaN(numberValue) ? numberValue.toFixed(2) : value;
                    });
                    console.log("calendar heatmap values", values)

                    hoverOverText = dateTimeStrings.map((dateString: string, i: number) => {
                        if (i < firstHour || i > lastHour) {
                            return `${dateString}</br> </br> Not Available`;
                        } else {
                            return `${dateString}</br> </br>${isNaN(values[i] as number) ? "Missing" : values[i]}`;
                        }
                    });


                }
                // =========================
                // MONTH - DAILY GRANULARITY
                // =========================
                if (granularity === 'daily') {
                    const numberOfDaysInSelectedPeriod = getDaysInMonth(selectionRangeStart);
                    const year = dayjs(selectionRangeStart).year();
                    const month = dayjs(selectionRangeStart).month() + 1;
                    const dayKeys: string[] = [];

                
                    for (let day = 1; day <= numberOfDaysInSelectedPeriod; day++) {
                        dayKeys.push(
                            `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        );
                    }

                    console.log('dayKeys', dayKeys)
                
                    epochMergedDF = mergeDailyData(dayKeys, inputData);
                    console.log('epochMergedDF', epochMergedDF)
                
                    // Rest of the code remains the same
                    yaxisTickText = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    yaxisTickVals = [0, 1, 2, 3, 4, 5, 6];
                
                    datesInSelectedMonth = dayKeys.map(key => new Date(key));
                    console.log('datesInSelectedMonth', datesInSelectedMonth)
                    // Override the getDay() method to consider Sunday as the seventh day
                    yaxisStepData = datesInSelectedMonth.map(date => {
                        // Override the getUTCDay() method to consider Sunday as the seventh day (6) and Monday as the first day (0)
                        if (date.getUTCDay() === 0) {
                            return 6;
                        } else {
                            return date.getUTCDay() - 1;
                        }
                    });
                    console.log('yaxisStepData', yaxisStepData)
                    xaxisStepData = datesInSelectedMonth.map(date => {
                        const inferred_week_no = getWeek(date, { weekStartsOn: 1 }); // Assuming week starts on Monday
                        if (inferred_week_no >= 52 && date.getMonth() === 0) {
                            return 0;
                        } else if (inferred_week_no === 1 && date.getMonth() === 11) {
                            return 53;
                        }
                        return inferred_week_no;
                    });

                    const formattedDate = datesInSelectedMonth.map(date => {
                        return dayjs(date).format('ddd, DD MMM, YYYY')

                    })

                    hoverOverText = epochMergedDF.value.map((value, i) => {
                        if (i < firstDay || i >= lastDay) {
                            return `${formattedDate[i]} </br></br> Not Available`;
                        } else {
                            return `${formattedDate[i]} </br></br> ${value === null || isNaN(value) ? "Missing" : value}`;
                        }
                    })
                }
            }


            // ==============
            // YEAR PERIOD  
            // ==============
            if (period === 'year') {


                const selectionRangeStart = Date.parse(year + "-01-01T00:00:00+00:00");
                const selectionRangeEnd = Date.parse(year + "-12-31T23:59:59+00:00");
                const CurrentTime = Date.now();
                //const currentTimeDayjs = dayjs(CurrentTime).utc().valueOf();
                //console.log("currentTimeDayjs", currentTimeDayjs)

                // check if minEpochTime is defined and if it is greater than the selectionRangeStart
                // if it is then we need to store which hour of the year is the first one that is greater than minEpochTime
                // so we can start the heatmap from that hour and not from the beginning of the year/month.
                // we use dayjs to determine the hour of the year (also day of year if granularity changes)

                if (minEpochTime !== undefined && minEpochTime > selectionRangeStart) {
                    firstDay = dayjs(minEpochTime).utc().dayOfYear();
                    const hourOfDay = dayjs(minEpochTime).utc().hour();
                    firstHour = (firstDay - 1) * 24 + hourOfDay;
                }

                if (CurrentTime < selectionRangeEnd) {
                    lastDay = dayjs(CurrentTime).utc().dayOfYear();
                    const hourOfDay = dayjs(CurrentTime).utc().hour();
                    lastHour = (lastDay - 1) * 24 + hourOfDay;
                }

                // =========================
                // YEAR - HOURLY GRANULARITY
                // =========================
                if (granularity === 'hourly') {
                    const numberOfDaysInSelectedPeriod = getDaysInYear(selectionRangeStart);
                    const year = dayjs(selectionRangeStart).year();
                    const dayHourKeys: string[] = [];

                    for (let day = 1; day <= numberOfDaysInSelectedPeriod; day++) {
                        for (let hour = 0; hour < 24; hour++) {
                            const date = dayjs(selectionRangeStart).dayOfYear(day);
                            dayHourKeys.push(
                                `${year}-${String(date.month() + 1).padStart(2, '0')}-${String(date.date()).padStart(2, '0')} ${String(hour).padStart(2, '0')}`
                            );
                        }
                    }

                    epochMergedDF = mergeHourlyData(dayHourKeys, inputData);

                    const {
                        xAxis,
                        yAxis,
                        dates
                    } = generateHourlyHeatmapConfig(selectionRangeStart, period);

                    // Update state variables
                    xaxisTickText = xAxis.tickText;
                    xaxisTickVals = xAxis.tickVals;
                    xaxisStepData = xAxis.stepData;
                    yaxisTickText = yAxis.tickText;
                    yaxisTickVals = yAxis.tickVals;
                    yaxisStepData = yAxis.stepData;
                    datesInSelectedTimePeriod = dates;

                    const dateTimeStrings = epochMergedDF.EpochTime.map((value: number) => {
                        return dayjs(value).format('YYYY/MM/DD HH:mm:ss [UTC]Z');
                    });
                    const values = epochMergedDF.value.map((value: number | null) => {
                        const numberValue = Number(value);
                        return !isNaN(numberValue) ? numberValue : null;
                    });

                    hoverOverText = dateTimeStrings.map((dateString: string, i: number) => {
                        if (i < firstHour || i > lastHour) {
                            return `${dateString}</br> </br> Not Available`;
                        } else {
                            return `${dateString}</br> </br>${values[i] === null || isNaN(values[i]) ? "Missing" : values[i]}`;
                        }
                    });


                }

                // =========================
                // YEAR - DAILY GRANULARITY
                // =========================
                if (granularity === 'daily') {
                    const numberOfDaysInSelectedPeriod = getDaysInYear(selectionRangeStart);
                    const epochArray = Array.from(
                        { length: numberOfDaysInSelectedPeriod },
                        (_, i) => selectionRangeStart + i * 24 * 3600000
                    );

                    // Convert epoch timestamps to date strings
                    const dayKeys = epochArray.map(epoch => 
                        dayjs(epoch).format('YYYY-MM-DD')
                    );

                    epochMergedDF = mergeDailyData(dayKeys, inputData);

                    xaxisTickText = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                    //TODO something is wrong here year 2020 has 365 and not 366 days
                    // see the heatmap generated for 2020
                    // also check this later if relevant:https://stackoverflow.com/questions/8619879/javascript-calculate-the-day-of-the-year-1-366

                    if (numberOfDaysInSelectedPeriod === 366) {
                        month_days[1] = 29; // Leap year
                    }

                    // Calculate tick values based on weeks
                    xaxisTickVals = month_days.reduce((acc: number[], days, i) => {
                        const prevValue = acc[i - 1] || -1; // -1 is the tick offset
                        acc.push(prevValue + (days / 7));
                        return acc;
                    }, []);
                    yaxisTickText = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                    yaxisTickVals = [0, 1, 2, 3, 4, 5, 6]


                    datesInSelectedTimePeriod = Array.from({ length: numberOfDaysInSelectedPeriod }, (_, i) => new Date(new Date(selectionRangeStart).getTime() + i * (1000 * 60 * 60 * 24)));

                    // Override the getDay() method to consider Sunday as the seventh day
                    yaxisStepData = datesInSelectedTimePeriod.map(date => {
                        // Override the getUTCDay() method to consider Sunday as the seventh day (6) and Monday as the first day (0)
                        if (date.getUTCDay() === 0) {
                            return 6;
                        } else {
                            return date.getUTCDay() - 1;
                        }
                    });
                    xaxisStepData = datesInSelectedTimePeriod.map(date => {
                        const inferred_week_no = getWeek(date, { weekStartsOn: 1 }); // Assuming week starts on Monday
                        if (inferred_week_no >= 52 && date.getMonth() === 0) {
                            return 0;
                        } else if (inferred_week_no === 1 && date.getMonth() === 11) {
                            return 53;
                        }
                        return inferred_week_no;
                    });
                    //const text = datesInSelectedTimePeriod.map(date => date.toISOString().split('T')[0]);
                    const formattedDate = datesInSelectedTimePeriod.map(date => {
                        return dayjs(date).format('ddd, DD MMM, YYYY')

                    })
                    const values = epochMergedDF.value.map((value: number | null) => {
                        // Convert the value to a number if it's not already
                        const numberValue = Number(value);

                        // Check if it's a valid number
                        if (!isNaN(numberValue)) {
                            // Use toFixed(1) to format with one decimal place
                            return numberValue.toFixed(2);
                        } else {
                            // Handle non-numeric values if needed
                            return NaN;
                        }
                    })

                    hoverOverText = values.map((value, i) => {
                        if (i < firstDay || i > lastDay) {
                            return `${formattedDate[i]} </br></br> Not Available`;
                        } else {
                            return `${formattedDate[i]} </br></br> ${isNaN(value as number) ? "Missing" : value}`;
                        }
                    });

                }


            }

            // =========================================================================================================
            // CREATE THE HEATMAP
            // =========================================================================================================


            let newPlotData: Partial<Plotly.PlotData>[] = []
            let missingData: number[]
            if ((period === 'year' || period === 'month') && granularity === 'daily') {
                const dataDaily = epochMergedDF.value;
                // Create a new array with NaN replaced by null (exclude those <firstDay) and non-NaN values replaced by NaN
                missingData = dataDaily.map((value, index) => {
                    if ((value === null || isNaN(value)) && index >= firstDay && index < lastDay) {
                        return 1;
                    } else {
                        return NaN;
                    }
                });
                console.log('firstHour', firstDay-1)
                console.log('lastHour', lastDay-1)
                const notAvailableData = dataDaily.map((_, index) => {
                    if (index < (firstDay - 1) || index > (lastDay - 1)) {
                        return 1;
                    } else {
                        return NaN;
                    }
                });
                console.log('dataDaily', dataDaily)
                console.log('missingData', missingData)
                console.log('notAvailableData', notAvailableData)

                newPlotData = [
                    {
                        type: 'heatmap',
                        x: xaxisStepData,
                        y: yaxisStepData,
                        z: dataDaily,//.map(value => value === null ? NaN : value),
                        hovertext: hoverOverText,
                        hoverinfo: 'text',
                        xgap: 1, // Adjust horizontal gap for border
                        ygap: 1, // Adjust vertical gap for border
                        showscale: true,
                        colorscale: selectedColorscale ? (customColorscales[selectedColorscale as keyof typeof customColorscales] || selectedColorscale) : undefined,
                        reversescale: reverseColorscale,
                        colorbar: {
                            title: {
                                text: monitoredVariable,
                                side: 'right',
                                font: {
                                    color: 'black',
                                    size: 15,
                                    family: 'Arial, sans-serif',
                                },
                            },
                            thickness: 20,
                            x: 1.02,
                            xpad: 10,
                    },
                        line: {
                            color: '#cccccc', // Light grey border color
                            width: 0.5, // Delicate border width
                        }
                    },
                    {
                        type: 'heatmap',
                        x: xaxisStepData,
                        y: yaxisStepData,
                        z: missingData,
                        xgap: 1,
                        ygap: 1,
                        showscale: false,
                        colorscale: [[0, '#0000ff'], [1, '#0000ff']],
                        opacity: 0.6,
                        hoverinfo: 'skip',
                        line: {
                            color: '#cccccc',
                            width: 0.5,
                        }
                    },
                    {
                        type: 'heatmap',
                        x: xaxisStepData,
                        y: yaxisStepData,
                        z: notAvailableData,
                        xgap: 1,
                        ygap: 1,
                        showscale: false,
                        colorscale: [[0, '#d3d3d3'], [1, '#d3d3d3']], // Light grey color
                        opacity: 0.1,
                        hoverinfo: 'skip',
                        line: {
                            color: '#cccccc',
                            width: 0.5,
                        }
                    }
                ];
            } else if ((period === 'year' || period === 'month') && granularity === 'hourly') {
                const dataHourly = epochMergedDF.value;
                missingData = dataHourly.map((value: number | null, index: number) => {
                    if ((value === null || isNaN(value)) && index >= firstHour && index <= lastHour) {
                        return 1;
                    } else {
                        return NaN;
                    }
                });

                // Add a new trace for "Not Available" elements
                const notAvailableData = dataHourly.map((value: number | null, index: number) => {
                    if (index < firstHour || index > lastHour) {
                        return 1; // Mark as "Not Available"
                    } else {
                        return NaN; // Not part of "Not Available"
                    }
                });

                newPlotData = [
                    {
                        type: 'heatmap',
                        x: xaxisStepData,
                        y: yaxisStepData,
                        z: dataHourly.map((value: number | null) => value === null ? NaN : value),
                        hovertext: hoverOverText,
                        hoverinfo: 'text',
                        xgap: .2,
                        ygap: .2,
                        showscale: true,
                        colorscale: selectedColorscale ? (customColorscales[selectedColorscale as keyof typeof customColorscales] || selectedColorscale) : undefined,
                        reversescale: reverseColorscale,
                        colorbar: {
                                title: {
                                    text: monitoredVariable,
                                    side: 'right',
                                    font: {
                                        color: 'black',
                                        size: 15,
                                        family: 'Arial, sans-serif',
                                    },
                                },
                                thickness: 20,
                                x: 1.02,
                                xpad: 10,
                        }
                    },
                    {
                        type: 'heatmap',
                        x: xaxisStepData,
                        y: yaxisStepData,
                        z: missingData,
                        xgap: .2,
                        ygap: .2,
                        showscale: false,
                        colorscale: [[0, '#0000ff'], [1, '#0000ff']],
                        opacity: 0.6,
                        hoverinfo: 'skip',
                    },
                    {
                        type: 'heatmap',
                        x: xaxisStepData,
                        y: yaxisStepData,
                        z: notAvailableData,
                        xgap: 1,
                        ygap: 1,
                        showscale: false,
                        colorscale: [[0, '#d3d3d3'], [1, '#d3d3d3']],
                        opacity: 0.1,
                        hoverinfo: 'skip',
                        line: {
                            color: '#cccccc',
                            width: 0.5,
                        }
                    }
                ];
            }


            //add traces that will draw the month lines:
            const monthLines = true;
            if (monthLines && (period === 'year') && (granularity === 'daily')) {
                const lineStyle = {
                    color: '#ffffff',//'#ffee00',
                    width: 1.5
                };

                for (let i = 0; i < datesInSelectedTimePeriod.length; i++) {
                    const date = datesInSelectedTimePeriod[i];
                    const dow = yaxisStepData[i];
                    const wkn = xaxisStepData[i];

                    if (date.getDate() === 1) {
                        newPlotData.push({ //vertical line at the beginning of the month
                            x: [wkn - 0.5, wkn - 0.5], // xstart, xend
                            y: [dow - 0.5, 6.5], //ystart, yend
                            mode: 'lines',
                            line: lineStyle,
                            hoverinfo: 'skip',
                            type: 'scatter'
                        });

                        if (dow) {
                            newPlotData.push({ //horizontal line at the beginning of the month
                                x: [wkn - 0.5, wkn + 0.5],
                                y: [dow - 0.5, dow - 0.5],
                                mode: 'lines',
                                line: lineStyle,
                                hoverinfo: 'skip',
                                type: 'scatter'
                            });

                            newPlotData.push({ //horizontal line at the end of the month
                                x: [wkn + 0.5, wkn + 0.5],
                                y: [dow - 0.5, -0.5],
                                mode: 'lines',
                                line: lineStyle,
                                hoverinfo: 'skip',
                                type: 'scatter'
                            });
                        }
                    }
                }
            }



            const newPlotLayout: Partial<Plotly.Layout> = {
                xaxis: {
                    title: {
                        text: DetermineTitle(period, granularity),
                        standoff: 15  // Add some space between the plot and the title
                    },
                    showline: false,
                    showgrid: false,
                    zeroline: false,
                    visible: true,
                    tickmode: 'array',
                    ticktext: xaxisTickText,
                    tickangle: -45,
                    tickvals: xaxisTickVals,
                    showticklabels: true,
                },
                yaxis: {
                    showline: false,
                    showgrid: false,
                    zeroline: false,
                    tickmode: 'array',
                    ticktext: yaxisTickText,
                    tickvals: yaxisTickVals,
                    autorange: 'reversed',
                },
                margin: {
                    l: 45,   // left margin
                    r: 10,   // right margin
                    t: 1,    // top margin
                    b: 50,   // bottom margin
                    pad: 0   // padding between the plot area and the container
                },
                font: {
                    size: 10,
                    color: '#000000'
                },
                showlegend: false
            }


            if (epochMergedDF.value.length > 0) {
                setPlotData(newPlotData);
                setPlotLayout(newPlotLayout);
                setRevision(revision + 1);
            } else if (epochMergedDF.value.length === 0) {
                const emptyLayout: Partial<Plotly.Layout> = {
                    title: {text: 'Data in selected period is not available'},
                    height: 100,
                    xaxis: {
                        //title: 'Date',
                        showline: false,
                        showgrid: false,
                        zeroline: false,
                        visible: false,
                    },
                    yaxis: {
                        showline: false,
                        showgrid: false,
                        zeroline: false,
                        visible: false,
                    },
                }
                setPlotLayout(emptyLayout);
                setRevision(revision + 1);
            }
            loadingStatus(false);
        } else {
            loadingStatus(false);
        }
    }, [inputData, selectedColorscale, reverseColorscale]);

    const handleMenuClick = ({ key }: { key: string }) => {
        if (colorscaleOptions.includes(key)) {
            onColorscaleChange(key);
        } else if (key === 'reverseColorscale') {
            onReverseColorscaleChange(!reverseColorscale);
        }
    };

    const handleOpenChange: DropdownProps['onOpenChange'] = (nextOpen, info) => {
        //console.log('onOpenChange', nextOpen, info);
        if (info.source === 'trigger' || nextOpen) {
            setOpen(nextOpen);
        }
    };



    const handleClick = (e: Plotly.PlotMouseEvent) => {
        console.log(e)
        const points = e.points[0];
        // @ts-ignore
        console.log(`Date: ${points.x}, Value: ${points.z}, 'PointIndex: ${points.pointIndex}`);
        setSelectedPointIndex(points.pointIndex);
    }

    return (
        <div style={{ 
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0px 0px 0px 0px' }}>
                <Dropdown
                    menu={{
                        items: menuItems,
                        onClick: (e) => handleMenuClick(e),
                        selectable: true,
                        //defaultOpenKeys: ['colorscale'],
                        selectedKeys: selectedColorscale ? [selectedColorscale as string] : [],
                    }}
                    trigger={['click']}
                    onOpenChange={handleOpenChange}
                    open={open}
                    placement="bottomLeft"
                    overlayStyle={{ overflowY: 'auto', maxHeight: '200px' }} // Style the dropdown here
                >
                    <a className="ant-dropdown-link"
                        onClick={e => e.preventDefault()}
                        style={{ textAlign: 'left', margin: '0px 0px 0px 10px', zIndex: 1, width: 'fit-content' }}
                    >
                        <Space>
                            Options
                            <DownOutlined />
                        </Space>
                    </a>
                </Dropdown>
                <span style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    marginRight: '100px',
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


            <Plot divId={"timeSeriesHeatmap"}
                config={{
                    responsive: true,
                    displaylogo: false,
                    //displayModeBar: false,
                }}
                useResizeHandler={true}
                style={{ width: "100%", height: "100%" }}
                data={plotData}
                layout={plotLayout}
                revision={revision}
                //onClick={handleClick}
            />
        </div>
    );
};

export default CalendarHeatmap;

