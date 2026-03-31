import {druidConfig} from "../configDashboard.ts";
import Keycloak from "keycloak-js";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

interface FetchParams {
    method: string;
    headers: { [key: string]: string };
    body: string;
}

interface GetDataParams {
    keycloakInstance: Keycloak;
    selectedDataset: string;
    selectedFieldAkaColumn: string;
    selectedPrimaryCategoricalDimension: string | undefined;
    selectedPrimaryCategoricalDimensionUniqueValue: string | number;
    selectedTimeInterval: string | undefined
    startDate: string;
    endDate: string;
    selectedAggregationTimeStep: 'daily' | 'hourly' | 'none' | '30min' | '15min';
    selectedAggregationType: 'min' | 'max' | 'avg' | 'sum';
    latitudeLongitudeColumnNames: string[];
    delimitedCoordinatesArrayColumnName: string;
    timezone: string; // Add timezone parameter
}

async function fetchData(url: string, params: FetchParams) {
    const response = await fetch(url, params);
    return response.json();
}

// Helper to get the correct time interval column for Druid queries
function getTimeIntervalColumn(timeStep: 'daily' | 'hourly' | 'none' | '30min' | '15min') {
    switch (timeStep) {
        case 'hourly':
            return "TIME_FLOOR(__time, 'PT1H')";  // Hour level
        case 'daily':
            return "TIME_FLOOR(__time, 'P1D')"; // Day level
        case '30min':
            return "TIME_FLOOR(__time, 'PT30M')"; // 30 minutes level
        case '15min':
            return "TIME_FLOOR(__time, 'PT15M')"; // 15 minutes level
        default:
            return '(__time)'; // Default: Milliseconds
    }
}

// function to determine if latitude and longitude columns are also added to query or not
function getLatitudeLongitudeColumns(latitudeLongitudeColumnNames: string[], delimitedCoordinatesArrayColumnName: string, selectedAggregationTimeStep: 'hourly' | 'daily' | 'none' | '30min' | '15min', aggeregationType: string) {
    if (latitudeLongitudeColumnNames[0] !== '' && latitudeLongitudeColumnNames[1] !== '') {
        if (selectedAggregationTimeStep === 'none') {
            return `, "${latitudeLongitudeColumnNames[0]}" AS "latitude", 
            "${latitudeLongitudeColumnNames[1]}" AS "longitude"`;
        } else { // If aggregation is selected
            //return `, ${aggeregationType}("${latitudeLongitudeColumnNames[0]}") AS "latitude",
            //${aggeregationType}("${latitudeLongitudeColumnNames[1]}") AS "longitude"`;
            // IMPORTANT: This is not optimal because we average,min, max the latitude and longitude values
            // The option is to take a "real" laat lon value from the dataset and not aggregate it.
            // Depending on a case it might not be the best solution but it might be better than averaging the coordinates

            // get the first value of the coordinates in the selected time interval
            //return `, EARLIEST("${latitudeLongitudeColumnNames[0]}") AS "latitude",
            //EARLIEST("${latitudeLongitudeColumnNames[1]}") AS "longitude"`;
            // get the last value of the coordinates in the selected time interval
            return `, LATEST("${latitudeLongitudeColumnNames[0]}") AS "latitude",
            LATEST("${latitudeLongitudeColumnNames[1]}") AS "longitude"`;


            // filter out the non-existent values before taking one of them because if first or last value are null
            // then we do not get any lat lon within the time interval
            //return `, LATEST_BY("${latitudeLongitudeColumnNames[0]}", __time) FILTER(WHERE "${latitudeLongitudeColumnNames[0]}" IS NOT NULL) AS "latitude",
            //LATEST_BY("${latitudeLongitudeColumnNames[1]}", __time) FILTER(WHERE "${latitudeLongitudeColumnNames[1]}" IS NOT NULL) AS "longitude"`;

        }

    }
    if (delimitedCoordinatesArrayColumnName !== '') {
        if (selectedAggregationTimeStep === 'none') {
            return `, ARRAY_OFFSET("${delimitedCoordinatesArrayColumnName}",1) AS "latitude", 
            ARRAY_OFFSET("${delimitedCoordinatesArrayColumnName}", 0) AS "longitude"`;
        } else {
            return `, ${aggeregationType}(ARRAY_OFFSET("${delimitedCoordinatesArrayColumnName}",1)) AS "latitude",
             ${aggeregationType}(ARRAY_OFFSET("${delimitedCoordinatesArrayColumnName}", 0)) AS "longitude"`;
        }
    }
    return '';
}

export async function fetchDataFromDruid(params: GetDataParams) {
    const {
        keycloakInstance,
        selectedDataset,
        selectedFieldAkaColumn,
        selectedPrimaryCategoricalDimension,
        selectedPrimaryCategoricalDimensionUniqueValue,
        selectedTimeInterval,
        startDate,
        endDate,
        selectedAggregationTimeStep,
        selectedAggregationType,
        latitudeLongitudeColumnNames,
        delimitedCoordinatesArrayColumnName,
        timezone // Add timezone parameter
    } = params;

    const selectionRangeStart = dayjs.tz(startDate, timezone).valueOf();
    const selectionRangeEnd = dayjs.tz(endDate, timezone).valueOf();

    // Helper function to escape single quotes
    const escapeSingleQuotes = (str: string | number) => {
        if (typeof str === 'number') {
            return str;
        }
        return str.replace(/'/g, "''");
    };

    const selectedColumn = selectedFieldAkaColumn;
    const fetchParams: FetchParams = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": druidConfig.authorizationType + druidConfig.authorization
        },
        body: ""
    };

// Construct the query based on time interval and aggregations
    const aggregationType = selectedAggregationType.toLowerCase(); // Normalize to lowercase

    if (params.selectedTimeInterval === 'showAll') {
        fetchParams.body = JSON.stringify({
            query: `SELECT
                       TIMESTAMP_TO_MILLIS(${getTimeIntervalColumn(selectedAggregationTimeStep)}) AS "__time",
                       ${selectedAggregationTimeStep ==='none' ? `"${selectedColumn}"` : `${aggregationType}("${selectedColumn}") AS "${selectedColumn}"`}
                       ${getLatitudeLongitudeColumns(latitudeLongitudeColumnNames,delimitedCoordinatesArrayColumnName, selectedAggregationTimeStep, aggregationType)}
                    FROM "${selectedDataset}"
                    ${(selectedPrimaryCategoricalDimension !== '' && selectedPrimaryCategoricalDimensionUniqueValue !=='' ) ? `WHERE "${selectedPrimaryCategoricalDimension}" = '${escapeSingleQuotes(selectedPrimaryCategoricalDimensionUniqueValue)}'` : ''}
                    ${selectedAggregationTimeStep ==='none' ? '' : `GROUP BY ${getTimeIntervalColumn(selectedAggregationTimeStep)}`}
                    `,
            context: {sqlQueryId: "DQDquery_Main"},
            resultFormat: "object"
        });
    } else { // Construct the query with time interval
        fetchParams.body = JSON.stringify({
            query: `SELECT
                       TIMESTAMP_TO_MILLIS(${getTimeIntervalColumn(selectedAggregationTimeStep)}) AS "__time",
                       ${selectedAggregationTimeStep ==='none' ? `"${selectedColumn}"` : `${aggregationType}("${selectedColumn}") AS "${selectedColumn}"`}
                       ${getLatitudeLongitudeColumns(latitudeLongitudeColumnNames,delimitedCoordinatesArrayColumnName, selectedAggregationTimeStep, aggregationType)}
                    FROM "${selectedDataset}" 
                    ${startDate ? `WHERE __time >= '${startDate}'` : ''} 
                    ${endDate ? `AND __time <= '${endDate}'` : ''}
                    ${(selectedPrimaryCategoricalDimension !== '' && selectedPrimaryCategoricalDimensionUniqueValue !=='' ) ? ` AND "${selectedPrimaryCategoricalDimension}" = '${selectedPrimaryCategoricalDimensionUniqueValue}'` : ''}
                    ${selectedAggregationTimeStep ==='none' ? '' : `GROUP BY ${getTimeIntervalColumn(selectedAggregationTimeStep)}`}
                    `,
            context: {sqlQueryId: "DQDquery_Main"},
            resultFormat: "object"
        });
    }

    const minMaxEpochParamsSelectedField        : FetchParams = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": druidConfig.authorizationType + druidConfig.authorization
        },
        body: JSON.stringify({
            query: `SELECT 
                        MIN(TIMESTAMP_TO_MILLIS(${getTimeIntervalColumn(selectedAggregationTimeStep)})) AS "minTimestamp",
                        MAX(TIMESTAMP_TO_MILLIS(${getTimeIntervalColumn(selectedAggregationTimeStep)})) AS "maxTimestamp"
                    FROM "${selectedDataset}"
                    ${(selectedPrimaryCategoricalDimension !== '' && selectedPrimaryCategoricalDimensionUniqueValue !=='' ) ? `WHERE "${selectedPrimaryCategoricalDimension}" = '${escapeSingleQuotes(selectedPrimaryCategoricalDimensionUniqueValue)}'` : ''}`,
            context: {sqlQueryId: "DQDquery_minMaxEpoch"},
            resultFormat: "object"
        })
    };

    const uniquenessFetchParams: FetchParams = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": druidConfig.authorizationType + druidConfig.authorization
        },
        body: ""
    };

    if (selectedTimeInterval === 'showAll') {
        uniquenessFetchParams.body = JSON.stringify({
            query: `SELECT 
                        COUNT(DISTINCT __time) AS distinct_count, 
                        COUNT(__time) AS total_count 
                    FROM "${selectedDataset}"
                    ${selectedPrimaryCategoricalDimension !== '' ? `WHERE "${selectedPrimaryCategoricalDimension}" = '${escapeSingleQuotes(selectedPrimaryCategoricalDimensionUniqueValue)}'` : ''}`,
            context: {sqlQueryId: "DQDquery_uniqueness"},
            resultFormat: "object"
        });
    } else {
        uniquenessFetchParams.body = JSON.stringify({
            query: `SELECT 
                            COUNT(DISTINCT __time) AS distinct_count, 
                            COUNT(__time) AS total_count FROM "${selectedDataset}" 
                            ${startDate ? `WHERE __time >= '${startDate}'` : ''} 
                            ${endDate ? `AND __time <= '${endDate}'` : ''}
                            ${selectedPrimaryCategoricalDimension !== '' ? ` AND "${selectedPrimaryCategoricalDimension}" = '${selectedPrimaryCategoricalDimensionUniqueValue}'` : ''}`,
            context: {sqlQueryId: "DQDquery_uniqueness"},
            resultFormat: "object"
        });
    }

    const minMaxEpochTimeCurrentTimeframe: FetchParams = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": druidConfig.authorizationType + druidConfig.authorization
        },
        body: JSON.stringify({
            query: `SELECT 
                        MIN(TIMESTAMP_TO_MILLIS(${getTimeIntervalColumn(selectedAggregationTimeStep)})) AS "minTimestamp",
                        MAX(TIMESTAMP_TO_MILLIS(${getTimeIntervalColumn(selectedAggregationTimeStep)})) AS "maxTimestamp"
                    FROM "${selectedDataset}"
                    WHERE __time >= '${startDate}' AND __time <= '${endDate}'
                    ${(selectedPrimaryCategoricalDimension !== '' && selectedPrimaryCategoricalDimensionUniqueValue !=='' ) ? `AND "${selectedPrimaryCategoricalDimension}" = '${escapeSingleQuotes(selectedPrimaryCategoricalDimensionUniqueValue)}'` : ''}`,
            context: {sqlQueryId: "DQDquery_minMaxEpochCurrentTimeframe"},
            resultFormat: "object"
        })
    };

    //console.log("fetchParams.body", fetchParams.body);
    //console.log(druidConfig.url+"sql", fetchParams)

    const [response, minMaxEpochResponse, uniquenessResponse, minMaxEpochCurrentTimeframeResponse] = await Promise.all([
        fetchData(druidConfig.url + "sql", fetchParams),
        fetchData(druidConfig.url + "sql", minMaxEpochParamsSelectedField), // Fetch min and max epoch data
        fetchData(druidConfig.url + "sql", uniquenessFetchParams), // Fetch uniqueness data
        fetchData(druidConfig.url + "sql", minMaxEpochTimeCurrentTimeframe) // Fetch min and max epoch data within the current timeframe
    ]);

    const responseData = response.map((entry: { [x: string]: any; __time: string | number | Date; }) => {
        if (latitudeLongitudeColumnNames[0] !== '' && latitudeLongitudeColumnNames[1] !== '') {
            return {
                timestamp: entry.__time,
                value: entry[selectedColumn],
                latitude: entry.latitude,
                longitude: entry.longitude
            }
        } else if (delimitedCoordinatesArrayColumnName !== '') {
            return {
                timestamp: entry.__time,
                value: entry[selectedColumn],
                latitude: entry.latitude,
                longitude: entry.longitude
            }
        }
        return {
            timestamp: entry.__time,
            value: entry[selectedColumn],
        }

    })
    const minEpochResponseData = minMaxEpochResponse[0]["minTimestamp"];
    const maxEpochResponseData = minMaxEpochResponse[0]["maxTimestamp"];
    const minEpochCurrentTimeframeData = minMaxEpochCurrentTimeframeResponse[0]["minTimestamp"];
    const maxEpochCurrentTimeframeData = minMaxEpochCurrentTimeframeResponse[0]["maxTimestamp"];
    // Calculate the score in % and round it to two digits after coma
    const uniquenessScore = Math.round((uniquenessResponse[0].distinct_count / uniquenessResponse[0].total_count) * 100 * 100) / 100;

    return {
        responseData,
        minEpochResponseData,
        maxEpochResponseData, // Include max epoch data
        minEpochCurrentTimeframeData, // Include min epoch data within the current timeframe
        maxEpochCurrentTimeframeData, // Include max epoch data within the current timeframe
        uniquenessScore
    };
}


export const fetchAvailableDruidDatasets = async () => {
    try {
        const response = await fetch(druidConfig.url + 'sql', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": druidConfig.authorizationType + druidConfig.authorization
            },
            body: JSON.stringify({
                query: `SELECT "TABLE_NAME" FROM "INFORMATION_SCHEMA"."TABLES" WHERE "TABLE_TYPE" = 'TABLE'`,
                context: {sqlQueryId: "DQDquery_available_datasets_on_druid"},
                //resultFormat: "object"
            })
        });

        const queryResult = await response.json();
        const availableDatasets = queryResult.map((table: { TABLE_NAME: string; }) => table.TABLE_NAME);
        return availableDatasets
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

export const fetchAvailableDruidColumns = async (selectedDataset: string) => {
    try {
        const response = await fetch(druidConfig.url + 'sql', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": druidConfig.authorizationType + druidConfig.authorization
            },
            body: JSON.stringify({
                query: `SELECT 
                            "COLUMN_NAME", 
                            "DATA_TYPE" 
                        FROM 
                            "INFORMATION_SCHEMA"."COLUMNS" 
                        WHERE 
                            "TABLE_NAME" = '${selectedDataset}'  
                            AND
                            "DATA_TYPE" NOT IN ('TIMESTAMP')`,
                context: {sqlQueryId: "DQDquery_selected_datasets_available_columns"},
            })
        });
        const queryResult = await response.json();
        const columnsInformation = queryResult.map((column: { COLUMN_NAME: string; DATA_TYPE: string; }) =>
            ({
                name: column.COLUMN_NAME,
                dataType: column.DATA_TYPE
            })
        )
        //.filter((columnName: string) => columnName !== "__time")
        return columnsInformation;

    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

// Count columns is not working because of Druid settings. The approximate count is turned off in the server settings.
// This requires more Resources from server. This is the error if one wants to have multiple columns checked for uniqueness:
//      Error: INVALID_INPUT (OPERATOR)
//      Query needs 3 merge buffers, but only 2 merge buffers were configured
//      org.apache.druid.query.ResourceLimitExceededException
export const fetchCountsForColumns = async (selectedDataset: string,
                                            availableColumns: string[],
                                            selectedColumnFilter: string | undefined,
                                            selectedUniqueValue: string | undefined) => {
    console.log("selectedDataset", selectedDataset, "availableColumns", availableColumns, "selectedColumnFilter",
        selectedColumnFilter, "selectedUniqueValue", selectedUniqueValue);
    try {
        console.time("fetchCountsForColumns")
        const columnsQuery = availableColumns.map(column => `COUNT("${column}") AS "Count_${column}", COUNT(DISTINCT "${column}") AS "UniqueCountApprox_${column}"`).join(', ');
        console.log(JSON.stringify({
            query: selectedUniqueValue ? `SELECT ${columnsQuery} FROM "${selectedDataset}" WHERE "${selectedColumnFilter}" = '${selectedUniqueValue}'` : `SELECT ${columnsQuery} FROM "${selectedDataset}"`,
            context: {sqlQueryId: "DQDquery_counts_per_column"},
        }))
        const response = await fetch(druidConfig.url + 'sql', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": druidConfig.authorizationType + druidConfig.authorization
            },
            body: JSON.stringify({
                query: selectedUniqueValue ? `SELECT ${columnsQuery} FROM "${selectedDataset}" WHERE "${selectedColumnFilter}" = '${selectedUniqueValue}'` : `SELECT ${columnsQuery} FROM "${selectedDataset}"`,
                context: {sqlQueryId: "DQDquery_counts_per_column"},
            })
        });
        //console.log("query", selectedUniqueValue ? `SELECT ${columnsQuery} FROM "${selectedDataset}" WHERE "${selectedColumnFilter}" = '${selectedUniqueValue}'` : `SELECT ${columnsQuery} FROM "${selectedDataset}"`)
        const queryResult = await response.json();
        console.log("data.count and unique", queryResult);
        console.timeEnd("fetchCountsForColumns")
        return queryResult[0];

    } catch (error) {
        console.error("Error fetching counts for columns:", error);
        throw error;
    }
};


export const checkForTimeseriesDuplicates = async (selectedDataset: string, filterColumnName?: string | undefined,
                                                   filterUniqueValue?: string | number | undefined) => {
    console.log("selectedDataset", selectedDataset, "filterColumnName", filterColumnName, "filterUniqueValue", filterUniqueValue)
    // method to get exact count of duplicate timestamps, without having to change druid server options
    try {
        const response = await fetch(druidConfig.url + 'sql', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": druidConfig.authorizationType + druidConfig.authorization
            },
            body: JSON.stringify({
                query: (filterUniqueValue || filterUniqueValue !== '') ?
                    `SELECT COUNT(*) AS "COUNT" 
                     FROM (
                        SELECT __time 
                        FROM "${selectedDataset}" 
                        WHERE "${filterColumnName}" = '${filterUniqueValue}' 
                        GROUP BY __time 
                        HAVING COUNT(*) > 1)`
                    :
                    `SELECT COUNT(*) AS "COUNT" 
                     FROM (
                        SELECT __time 
                        FROM "${selectedDataset}" 
                        GROUP BY __time 
                        HAVING COUNT(*) > 1)`,
                context: {sqlQueryId: "DQDquery_timeseries_duplicates"},
            })
        });
        const data = await response.json();
        console.log("checkForTimeseriesDuplicates", data.length > 0 ? data[0].COUNT : 0)
        return data.length > 0 ? data[0].COUNT : 0;
    } catch (error) {
        console.error("Error checking for time series duplicates:", error);
    }
}

// Function to fetch unique values in the selected dimension (limit 100)
export const fetchUniqueValues = async (column: string, selectedDataset: string) => {
    try {
        const response = await fetch(druidConfig.url + 'sql', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": druidConfig.authorizationType + druidConfig.authorization
            },
            body: JSON.stringify({
                query: `SELECT DISTINCT "${column}" FROM "${selectedDataset}"  LIMIT 100`,
                context: {sqlQueryId: "DQDquery_unique_values"},
            },),

        });
        const data = await response.json();
        return data.map((item: { [x: string]: string | number; }) => item[column]);
    } catch (error) {
        console.error("Error fetching unique values:", error);
    }
};


// Function to check if the selected dataset is a timeseries dataset.
export const checkIfIsTimeseries = async (selectedDataset: string) => {
    try {
        const response = await fetch(druidConfig.url + 'sql', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": druidConfig.authorizationType + druidConfig.authorization
            },
            body: JSON.stringify({
                query: `
                SELECT
                    CASE
                        WHEN MAX(__time) != MIN(__time) THEN true
                        ELSE false
                    END AS is_timeseries 
                FROM "${selectedDataset}"`,
                context: {sqlQueryId: "DQDquery_unique_timestamps"},
            }),
        });
        const data = await response.json();
        return data[0].is_timeseries; // returns true or false
    } catch (error) {
        console.error("Error fetching unique timestamps:", error);
    }
};

