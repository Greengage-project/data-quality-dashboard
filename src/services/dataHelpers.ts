import * as Plotly from "plotly.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { DatePickerProps } from "antd";
import { getDayOfYear, getDaysInMonth, getDaysInYear } from "date-fns";
import { ResponseData} from "./dataConnector";  
dayjs.extend(utc);
dayjs.extend(timezone);

function generateTimestampsInTimezone(
    startTimestamp: number,
    endTimestamp: number,
    timezone: string,
    granularity: 'daily' | 'hourly' | '30min' | '15min'
): number[] {
    const timestamps: number[] = [];
    let currentDate = dayjs.tz(startTimestamp, timezone);
    const endDateTime = dayjs.tz(endTimestamp, timezone);

    let increment: number;
    let unit: 'day' | 'hour' | 'minute';

    switch (granularity) {
        case 'daily':
            increment = 1;
            unit = 'day';
            currentDate = currentDate.startOf('day');
            break;
        case 'hourly':
            increment = 1;
            unit = 'hour';
            currentDate = currentDate.startOf('hour');
            break;
        case '30min':
            increment = 30;
            unit = 'minute';
            currentDate = currentDate.startOf('minute');
            break;
        case '15min':
            increment = 15;
            unit = 'minute';
            currentDate = currentDate.startOf('minute');
            break;
    }

    while (currentDate.isBefore(endDateTime) || currentDate.isSame(endDateTime, unit)) {
        if (granularity === 'daily') {
            timestamps.push(currentDate.startOf('day').valueOf());
            currentDate = currentDate.add(increment, unit);
        } else {
            timestamps.push(currentDate.valueOf());
            currentDate = currentDate.add(increment, unit);
        }
    }

    return timestamps;
}

/* export function GetNumericalTypeColumnNamesFromDataFrame(df: DataFrame | undefined) {
    const numericalColumnNames: (string | number)[] = []
    if (df !== undefined) {
        for (let i = 0; i < df.shape[1]; i++) {
            //console.log(df.ctypes.values[i])
            //console.log(df.ctypes['$data'][i])
            //if (df.ctypes['$data'][i] === 'float32' || df.ctypes['$data'][i] === 'int32' || df.ctypes['$data'][i] === 'int64' || df.ctypes['$data'][i] === 'float64') {
            if (df.ctypes.values[i] === 'float32') {
                numericalColumnNames.push(df.ctypes.index[i])
            }

        }
        return numericalColumnNames
    } else {
        return []
    }
}
 */
//==================================================================================================
// function to find consecutive true indices in a boolean array and store it as an array of x0,
// x1  EpochTime pairs where y(-inf,+inf) "paper" solid should be drawn on top of the Trend Line graph.
// ==================================================================================================

export function findConsecutiveTrueIndices(arr: boolean[]) {
    const result = [];
    let startIndex = -1;

    for (let i = 0; i < arr.length; i++) {
        if (arr[i]) {
            // If it's the first true element in the sequence, set the start index
            if (startIndex === -1) {
                startIndex = i; // so it is 0
            }
        } else {
            // If there was a sequence of true elements before this false element
            if (startIndex !== -1) {
                let endIndex = i - 1;

                // Expand the indices by 1 left and right, making sure not to go out of bounds
                startIndex = Math.max(0, startIndex - 1);
                endIndex = Math.min(arr.length - 1, endIndex + 1);

                result.push([startIndex, endIndex]);
                startIndex = -1;
            }
        }
    }

    // Handle the case where the last element is true
    if (startIndex !== -1) {
        let endIndex = arr.length - 1;

        // Expand the indices by 1 left and right, making sure not to go out of bounds
        startIndex = Math.max(0, startIndex - 1);
        endIndex = Math.min(arr.length - 1, endIndex + 1);

        result.push([startIndex, endIndex]);
    }

    return result;
}


function isSorted(arr: number[]): boolean {
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] < arr[i - 1]) return false;
    }
    return true;
}


// ===============================================================================================================
// Here one more version of datagaps where we try to avoid the danfojs merge function. For that we use Set and Map
// to find missing EpochTimes:
// ===============================================================================================================
export function GetDataGaps(
    data: ResponseData,
    timePeriod: DatePickerProps['picker'] | 'showAll',
    granularity: string,
    minEpochTime: number,
    startDate: string | undefined,
    sortData: boolean,
    timezone: string
): { dataGaps: Partial<Plotly.Shape>[], completenessScore: number } {
    // set timestep value in milliseconds based on the granularity
    let timeStep: number
    if (granularity === "hourly") {
        timeStep = 1000 * 60 * 60
    } else if (granularity === "daily") {
        timeStep = 1000 * 60 * 60 * 24
    } else if (granularity === "30min") {
        timeStep = 1000 * 60 * 30
    } else if (granularity === "15min") {
        timeStep = 1000 * 60 * 15
    } else {
        // if the granularity is not hourly or daily, we return an empty array of dataGaps
        return { dataGaps: [], completenessScore: 0 }
    }

    const dataGapColor = '#0000ff'
    const dataGapOpacity = 0.6


    //console.log("GetDataGaps", timePeriod)
    //console.time("GetDataGaps")

    //console.time("Extract Columns");
    const currentEpochTimes = [...data.EpochTime]; //shallow copy
    const currentDataValues = [...data.value]; //shallow copy  
    const a = null
    //console.log("a=",a," isNaN(a)?", Number.isNaN(a))

    //console.timeEnd("Extract Columns");

    //==================================================================================================
    // Drop duplicates using a Map to maintain value associations
    //==================================================================================================

    const uniqueMap = new Map<number, number>();
    currentEpochTimes.forEach((epochTime, index) => { // we use the index to keep the association with the value
        uniqueMap.set(epochTime, currentDataValues[index]);
    });

    //console.log('uniqueMap', uniqueMap)

    const uniqueCurrentEpochTimes = Array.from(uniqueMap.keys());
    const uniqueCurrentDataValues = Array.from(uniqueMap.values());

    // Sort if needed
    if (!isSorted(uniqueCurrentEpochTimes) && sortData) {
        const sortedEntries = Array.from(uniqueMap.entries())
            .sort(([a], [b]) => a - b);
        uniqueCurrentEpochTimes.splice(0, uniqueCurrentEpochTimes.length, ...sortedEntries.map(([time]) => time));
        uniqueCurrentDataValues.splice(0, uniqueCurrentDataValues.length, ...sortedEntries.map(([, value]) => value));
    }

    const duplicatesNumber = currentEpochTimes.length - uniqueCurrentEpochTimes.length;
    console.log(`Dropped ${duplicatesNumber} duplicates`);

    const firstDate = dayjs.tz(currentEpochTimes[0], timezone); // Use local timezone

    let lowerDateTimeBound: number, upperDateTimeBound: number;

    // create an array of dates that are present in the selected month or year in the utc format
    if (timePeriod === 'year') {
        lowerDateTimeBound = firstDate.startOf('year').valueOf();
        upperDateTimeBound = firstDate.endOf('year').valueOf();
    } else if (timePeriod === 'month') {
        lowerDateTimeBound = firstDate.startOf('month').valueOf();
        upperDateTimeBound = firstDate.endOf('month').valueOf();
    } else if (timePeriod === 'showAll') {
        if (granularity === "daily") {
            lowerDateTimeBound = firstDate.startOf('day').valueOf();
        } else {
            lowerDateTimeBound = firstDate.valueOf();
        }
        upperDateTimeBound = dayjs.tz(currentEpochTimes[currentEpochTimes.length - 1], timezone).valueOf();

    } else {
        throw new Error('Invalid boundary type. Use "year", "month" or "showAll.');
    }
    // cut off the upper bound to current time not to calculate the missing values after current time
    if (upperDateTimeBound > dayjs.tz(dayjs(), timezone).valueOf()) {
        upperDateTimeBound = dayjs.tz(dayjs(), timezone).valueOf()
        //console.log('upperDateTimeBound is higher than the current time');
    }
    // cut off the lower bound to minEpochTime not to calculate the missing values before minEpochTime
    if (granularity === 'hourly') {
    //console.log('minEpochTime hour beginning', dayjs(minEpochTime).startOf('hour').valueOf())
    if (lowerDateTimeBound < dayjs(minEpochTime).startOf('hour').valueOf()) {
            lowerDateTimeBound = dayjs(minEpochTime).startOf('hour').valueOf()
                //console.log('lowerDateTimeBound is lower than the minEpochTime');
        }
    } else if (granularity === 'daily') {
        if (lowerDateTimeBound < dayjs(minEpochTime).startOf('day').valueOf()) {
            lowerDateTimeBound = dayjs(minEpochTime).startOf('day').valueOf()
                //console.log('lowerDateTimeBound is lower than the minEpochTime');
        }
    }

    //console.time("allEpochTimes")
    // create an array of epoch times with a step of "timeStep" in milliseconds that starts at 
    // lowerDateTimeBound and is not higher than upperDateTimeBound
    console.log('lowerDateTimeBound', new Date(lowerDateTimeBound).toString())
    const allEpochTimesInCurrentTimeframe = generateTimestampsInTimezone(
        lowerDateTimeBound,
        upperDateTimeBound,
        timezone,
        granularity as 'daily' | 'hourly' | '30min' | '15min'
    );
    //console.log('allEpochTimesInCurrentTimeframe',allEpochTimesInCurrentTimeframe.map(ts => new Date(ts).toString()))

//const startDate1 = '2024-10-25';
//const endDate1 = '2024-10-30';
//const timestamps = generateTimestampsInTimezone(startDate1, endDate1, timezone, 'hourly');
//console.log(timestamps.map(ts => new Date(ts).toString()));
    //console.timeEnd("allEpochTimes")

    // IMPORTANT:
    // 2nd version using Array.from:
    // //console.time("allEpochTimes2")
    // const allEpochTimes2 = Array.from({length: Math.floor((upperDateTimeBound - lowerDateTimeBound) / timeStep) + 1}, (_, i) => lowerDateTimeBound + i * timeStep);
    // //console.timeEnd("allEpochTimes2")

    // New method to get missing EpochTime entries without using merge missing epochtimes are marked true:
    // convert epochTimesCurrent to a Set
    //console.time("epochTimesCurrent to Set and map:")
    const actualEpochTimesSet = new Set(currentEpochTimes) //new Set([...currentEpochTimes])

    // Map array "x"(here allEpochTimes) to mark elements not in "y"(epochTimesSet) as true
    // In other words if the epoch time (1h step) in the selected time period is not in the "current epoch times" array
    // (here also converted to a Set) mark it as true to later create datagap solid marker.
    const gapsFromMissingEntries = allEpochTimesInCurrentTimeframe.map(epochTime => !actualEpochTimesSet.has(epochTime)); //Check if an item is NOT in the epochTimesSet
    //console.timeEnd("epochTimesCurrent to Set and map:")
    /*     const missingEntriesCount = gapsFromMissingEntries.reduce((count, currentValue) => {
                if (currentValue === true) {
                    return count + 1;
                } else {
                    return count;
                }
            }, 0); */
    //nev simplified version:
    const missingEntriesCount = gapsFromMissingEntries.filter(Boolean).length;
    //console.log("missingEntriesCount",missingEntriesCount);


    //console.log("NEWRESULTS!!!", gapsFromMissingEntries);


    //==================================================================================================
    // function to find consecutive true indices in a boolean array and store it as an array of x0,
    // x1  EpochTime pairs where y(-inf,+inf) "paper" solid should be drawn on top of the Trend Line graph.
    // ==================================================================================================


    // ==================================================================================================
    // ==================================================================================================


    //==================================================================================================
    // Find missing values where there is a record (namely datetime epoch) but the value is missing,
    // hence the plotly graph will have a gap. and we want this gap marked.
    //==================================================================================================
    //console.time("check if dataFrame[selected variable] isNa")
    const gapsFromMissingValues = currentDataValues.map(value => value == null || Number.isNaN(value)); // loose equality (==) check against null also catches undefined
    const missingValuesCount = gapsFromMissingValues.filter(Boolean).length;
    const completenessScore = Number((100 - ((missingValuesCount + missingEntriesCount) * 100) / allEpochTimesInCurrentTimeframe.length).toFixed(2));
    //const completenessScore = Math.floor(10000 - ((missingValuesCount + missingEntriesCount) / allEpochTimesInCurrentTimeframe.length) * 10000) / 100


    //==================================================================================================
    //==================================================================================================

    // Method 1: Find missing values where there is a record (namely datetime epoch) but the value is missing,
    /*    const gapsFromMissingValuesEpochTimes:number[] = gapsFromMissingValues
            .reduce<number[]>((acc, value, index) => {
                if (value) {
                    acc.push(currentEpochTimes[index]);
                }
                return acc;
            }, []);
        console.timeEnd("findConsecutiveTrueIndices")*/
    // Method 2: Find missing values where there is a record (namely datetime epoch) but the value is missing,
    const gapsFromMissingValuesEpochTimes = currentEpochTimes.filter((_: number, index: number) => gapsFromMissingValues[index]);


    // find the indexes of gapsFromMissingValuesEpochTimes in the allEpochTimes
    //console.time("findIndeces")
    const indexes: number[] = gapsFromMissingValuesEpochTimes.map((value) => allEpochTimesInCurrentTimeframe.indexOf(value));
    //console.timeEnd("findIndeces")

    // change gapsFromMissingEntries so that values (index numbers) in indeces are changed to true
    indexes.forEach((index) => {
        gapsFromMissingEntries[index] = true;
    })


    //console.time("findConsecutiveTrueIndices")
    //const dataGapsEpochTimePairsMissingValues = findConsecutiveTrueIndices(gapsFromMissingValues);
    const dataGapsEpochTimePairsMissingEntries = findConsecutiveTrueIndices(gapsFromMissingEntries);
    //console.timeEnd("findConsecutiveTrueIndices")
    const dataGaps: Partial<Plotly.Shape>[] = []
    //console.time("generateDataGapsShapes")

    /*    dataGapsEpochTimePairsMissingValues.forEach((value) => {
            dataGaps.push({
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0: currentEpochTimes[value[0]],
                y0: 0,
                x1: currentEpochTimes[value[1]],
                y1: 1,
                fillcolor: dataGapColor,
                opacity: dataGapOpacity,
                line: {
                    width: 0
                }
            })
        })*/

    dataGapsEpochTimePairsMissingEntries.forEach((value) => {
        dataGaps.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: allEpochTimesInCurrentTimeframe[value[0]],
            y0: 0,
            x1: allEpochTimesInCurrentTimeframe[value[1]],
            y1: 1,
            fillcolor: dataGapColor,
            opacity: dataGapOpacity,
            line: {
                width: 0
            }
        })
    })
    //console.timeEnd("generateDataGapsShapes")
    //console.timeEnd("GetDataGaps")
    //console.log("dataGaps", dataGaps)
    console.log("completenessScore", completenessScore)
    return { dataGaps, completenessScore }
}

// ===============================================================================================================
// Function to get daily average values (LEGACY)
// ===============================================================================================================
export function GetDailyAverageValues(
    data: ResponseData,
    timePeriod: string | undefined
): { EpochTime: number[], value: (number | null)[] } {
    const dateTimeArray = [...data.EpochTime];
    const valuesArray = [...data.value];

    // Drop duplicates using Map (similar to GetDataGaps)
    const uniqueMap = new Map<number, number | null>();
    dateTimeArray.forEach((epochTime, index) => {
        uniqueMap.set(epochTime, valuesArray[index]);
    });

    const uniqueEpochTimeValues = Array.from(uniqueMap.keys());
    const uniqueDataValues = Array.from(uniqueMap.values());

    // Sort if needed (reusing logic from GetDataGaps)
    if (!isSorted(uniqueEpochTimeValues)) {
        const sortedEntries = Array.from(uniqueMap.entries())
            .sort(([a], [b]) => a - b);
        uniqueEpochTimeValues.splice(0, uniqueEpochTimeValues.length, ...sortedEntries.map(([time]) => time));
        uniqueDataValues.splice(0, uniqueDataValues.length, ...sortedEntries.map(([, value]) => value));
    }

    // Calculate day of year for each epoch time
    const dayGroups = new Map<number, number[]>();
    uniqueEpochTimeValues.forEach((epochTime, index) => {
        const dayOfYear = dayjs(epochTime).utc().dayOfYear();
        if (!dayGroups.has(dayOfYear)) {
            dayGroups.set(dayOfYear, []);
        }
        const value = uniqueDataValues[index];
        if (value !== null && !isNaN(value)) {
            dayGroups.get(dayOfYear)?.push(value);
        }
    });

    // Calculate daily averages
    const dailyAverages = new Map<number, number | null>();
    dayGroups.forEach((values, dayOfYear) => {
        const average = values.length > 0
            ? values.reduce((sum, val) => sum + val, 0) / values.length
            : null;
        dailyAverages.set(dayOfYear, average);
    });

    // Generate complete series of days
    let selectionRangeStart: number;
    let numberOfDaysInSelectedPeriod: number;

    if (!uniqueEpochTimeValues.length) {
        return { EpochTime: [], value: [] };
    }

    if (timePeriod === 'month') {
        selectionRangeStart = dayjs(uniqueEpochTimeValues[0]).startOf('month').valueOf();
        numberOfDaysInSelectedPeriod = getDaysInMonth(selectionRangeStart);
    } else if (timePeriod === 'year') {
        selectionRangeStart = dayjs(uniqueEpochTimeValues[0]).startOf('year').valueOf();
        numberOfDaysInSelectedPeriod = getDaysInYear(selectionRangeStart);
    } else {
        throw new Error('Invalid boundary type. Use "year" or "month".');
    }

    // Generate epoch times for each day at noon
    const epochTimes = Array.from(
        { length: numberOfDaysInSelectedPeriod },
        (_, i) => selectionRangeStart + i * 86400000 + 43200000 // 86400000 = 24h, 43200000 = 12h
    );

    // Filter out future dates
    const currentTime = dayjs.utc().valueOf();
    const filteredEpochTimes = epochTimes.filter(time => time <= currentTime);

    // Map to final arrays
    const resultEpochTimes: number[] = [];
    const resultValues: (number | null)[] = [];

    filteredEpochTimes.forEach(epochTime => {
        const dayOfYear = dayjs(epochTime).utc().dayOfYear();
        resultEpochTimes.push(epochTime);
        resultValues.push(dailyAverages.get(dayOfYear) ?? null);
    });

    return {
        EpochTime: resultEpochTimes,
        value: resultValues
    };
}


// Speed calculation based on the distance between two points and the time difference between them
// The distance is calculated using the equirectangular approximation
function equirectangularDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180; // φ in radians
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const x = deltaLambda * Math.cos((phi1 + phi2) / 2);
    const y = deltaPhi;
    const distance = Math.sqrt(x * x + y * y) * R; // in meters
    return distance;
}

export function calculateSpeed(latitudes: number[], longitudes: number[], epochTimes: number[]) {
    const results = [];

    // Add the first entry with 0 km/h
    results.push({
        timestamp: new Date(epochTimes[0]).toISOString(),
        speedKmph: "0.00",
        coords: { lat: latitudes[0], lon: longitudes[0] }
    });

    for (let i = 1; i < latitudes.length; i++) {
        const lat1 = latitudes[i - 1];
        const lon1 = longitudes[i - 1];
        const time1 = epochTimes[i - 1];
        const lat2 = latitudes[i];
        const lon2 = longitudes[i];
        const time2 = epochTimes[i];

        const distance = equirectangularDistance(lat1, lon1, lat2, lon2); // distance in meters
        const timeDiff = (time2 - time1) / 1000; // time difference in seconds

        let speedKmph = 0;
        if (timeDiff !== 0) {
            const speedMps = distance / timeDiff; // speed in meters per second
            speedKmph = speedMps * 3.6; // convert to kilometers per hour
        }

        results.push({
            timestamp: new Date(time2).toISOString(),
            speedKmph: speedKmph.toFixed(2),
            coords: { lat: lat2, lon: lon2 }
        });
    }

    return results;
}
