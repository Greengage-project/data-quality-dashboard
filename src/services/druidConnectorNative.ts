import { DataConnector, DataConnectorConfig, FetchDataParams, ResponseData } from './dataConnector';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';


dayjs.extend(utc);
dayjs.extend(timezone);



export function useDruidConnector(config: DataConnectorConfig) {
  const fetchFromDruid = async (url: string, params: any): Promise<any> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.authorizationType + config.authorization
      },
      body: JSON.stringify(params)
    });
    return response.json();
  };

  const fetchData = async (params: FetchDataParams) => {
    const {
      selectedDataset,
      selectedFieldAkaColumn,
      selectedPrimaryCategoricalDimension,
      selectedPrimaryCategoricalDimensionUniqueValue,
      selectedTimeInterval,
      startDate,
      endDate,
      selectedAggregationInterval,
      selectedAggregationType,
      latitudeLongitudeColumnNames,
      timezone
    } = params;

    // Convert dates to ISO format with timezone offset
    const startISO = dayjs.tz(startDate, timezone)
      .format('YYYY-MM-DDTHH:mm:ssZZ');
    const endISO = dayjs.tz(endDate, timezone)
      .format('YYYY-MM-DDTHH:mm:ssZZ');
    console.log('startISO', startISO);
    console.log('endISO', endISO);

    const getGranularity = (timeStep: string) => {
      switch (timeStep) {
        case 'hourly':
          return { type: 'period', period: 'PT1H', timeZone: timezone };
        case 'daily':
          return { type: 'period', period: 'P1D', timeZone: timezone };
        case '30min':
          return { type: 'period', period: 'PT30M', timeZone: timezone };
        case '15min':
          return { type: 'period', period: 'PT15M', timeZone: timezone };
        default:
          return 'all';
      }
    };

    const getAggregator = (type: string, field: string) => {
      switch (type.toLowerCase()) {
        case 'min':
          return { type: 'doubleMin', name: field, fieldName: field };
        case 'max':
          return { type: 'doubleMax', name: field, fieldName: field };
        case 'avg':
          return { type: 'doubleMean', name: field, fieldName: field };
        case 'sum':
          return { type: 'doubleSum', name: field, fieldName: field };
        case 'geolocation':
          return { type: 'doubleAny', name: field, fieldName: field };
        default:
          return { type: 'doubleSum', name: field, fieldName: field };
      }
    };

    let mainQuery;

    if (selectedAggregationInterval === 'none') {
      // Use scan query for no aggregation
      mainQuery = {
        queryType: 'scan',
        dataSource: selectedDataset,
        intervals: selectedTimeInterval === 'showAll'
          ? ['1970-01-01T00:00:00.000Z/2099-12-31T23:59:59.999Z']
          : [`${startISO}/${endISO}`],
        columns: [
          '__time',
          selectedFieldAkaColumn,
          ...(latitudeLongitudeColumnNames[0] ? latitudeLongitudeColumnNames : [])
        ],
        filter: selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimensionUniqueValue ? {
          type: 'selector',
          dimension: selectedPrimaryCategoricalDimension,
          value: selectedPrimaryCategoricalDimensionUniqueValue
        } : undefined,
        
        
        resultFormat: 'compactedList',
        //order: 'ascending',
       
        context: {
          timestampResultField: '__time',
          //maxRowsQueuedForOrdering: 1000000,
          //maxSegmentPartitionsOrderedInMemory: 100
        }
      };
    } else {
      // Use timeseries query for aggregation
      mainQuery = {
        queryType: 'timeseries',
        dataSource: selectedDataset,
        granularity: getGranularity(selectedAggregationInterval),
        intervals: selectedTimeInterval === 'showAll'
          ? ['1970-01-01T00:00:00.000Z/2099-12-31T23:59:59.999Z']
          : [`${startISO}/${endISO}`],
        aggregations: [
          getAggregator(selectedAggregationType, selectedFieldAkaColumn),
          ...(latitudeLongitudeColumnNames[0] ? [
            getAggregator('geolocation', latitudeLongitudeColumnNames[0]), //
            getAggregator('geolocation', latitudeLongitudeColumnNames[1])
          ] : [])
        ],

        filter: {
          type: 'and',
          fields: [
            {
              type: 'not',
              field: {
                type: 'selector',
                dimension: selectedFieldAkaColumn,
                value: null
              }
            },
            ...(selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimensionUniqueValue ? [{
              type: 'selector',
              dimension: selectedPrimaryCategoricalDimension,
              value: selectedPrimaryCategoricalDimensionUniqueValue
            }] : [])
          ]
        },


        
       
        
        context: {
          skipEmptyBuckets: true,
          timestampResultField: '__time'
        }
      };
    }

    //==================================================================================================================
    // Min and Max Epoch Time (allTime) query for selected dataset and if dimension and unique value is selected, 
    // then filter by dimension and unique value - Using native Druid for better performance
    //==================================================================================================================
    const minMaxQuery = {
      queryType: 'timeseries',
      dataSource: selectedDataset,
      granularity: 'all',
      intervals: ['1970-01-01T00:00:00.000Z/2099-12-31T23:59:59.999Z'],
      aggregations: [
        {
          type: 'longMin',
          name: 'minTimestamp',
          fieldName: '__time'
        },
        {
          type: 'longMax',
          name: 'maxTimestamp',
          fieldName: '__time'
        }
      ],
      filter: selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimensionUniqueValue ? {
        type: 'selector',
        dimension: selectedPrimaryCategoricalDimension,
        value: selectedPrimaryCategoricalDimensionUniqueValue
      } : undefined,
      context: {
        skipEmptyBuckets: true
      }
    };

    //==================================================================================================================
    // Uniqueness Query - Using native Druid aggregations for better performance
    //==================================================================================================================
    const uniquenessQuery = {
      queryType: 'timeseries',
      dataSource: selectedDataset,
      granularity: 'all',
      intervals: ['1970-01-01T00:00:00.000Z/2099-12-31T23:59:59.999Z'],
      aggregations: [
        {
          type: 'hyperUnique',
          name: 'distinct_timestamps',
          fieldName: '__time'
        },
        {
          type: 'count',
          name: 'total_count'
        }
      ],
      filter: selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimensionUniqueValue ? {
        type: 'selector',
        dimension: selectedPrimaryCategoricalDimension,
        value: selectedPrimaryCategoricalDimensionUniqueValue
      } : undefined,
      context: {
        skipEmptyBuckets: true
      }
    };
    //==================================================================================================================
    // Min and Max Epoch Time (currentTimeframe) query for selected dataset and if dimension and unique value is selected, then filter by dimension and unique value - Using native Druid for better performance
    //==================================================================================================================

    const minMaxCurrentTimeframeQuery = {
      queryType: 'timeseries',
      dataSource: selectedDataset,
      granularity: 'all',
      intervals: [`${startISO}/${endISO}`],
      aggregations: [
        {
          type: 'longMin',
          name: 'minTimestamp',
          fieldName: '__time'
        },
        {
          type: 'longMax',
          name: 'maxTimestamp',
          fieldName: '__time'
        }
      ],
      filter: selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimensionUniqueValue ? {
        type: 'selector',
        dimension: selectedPrimaryCategoricalDimension,
        value: selectedPrimaryCategoricalDimensionUniqueValue
      } : undefined,
      context: {
        skipEmptyBuckets: true
      }
    };

    //==================================================================================================================
    // Fetch all queries
    //==================================================================================================================
    console.time("⏱️ Druid network request (raw data fetch)");
    
    // Time each query individually by wrapping them
    const mainResponsePromise = (async () => {
      console.time("Main data query");
      const result = await fetchFromDruid(config.url, mainQuery);
      console.timeEnd("Main data query");
      return result;
    })();
    
    const minMaxResponsePromise = (async () => {
      console.time("Min/Max all time query");
      const result = await fetchFromDruid(config.url, minMaxQuery);
      console.timeEnd("Min/Max all time query");
      return result;
    })();
    
    const uniquenessResponsePromise = (async () => {
      console.time("Uniqueness query");
      const result = await fetchFromDruid(config.url, uniquenessQuery);
      console.timeEnd("Uniqueness query");
      return result;
    })();
    
    const minMaxCurrentTimeframeResponsePromise = (async () => {
      console.time("Min/Max current timeframe query");
      const result = await fetchFromDruid(config.url, minMaxCurrentTimeframeQuery);
      console.timeEnd("Min/Max current timeframe query");
      return result;
    })();
    
    const [mainResponse, minMaxResponse, uniquenessResponse, minMaxCurrentTimeframeResponse] = await Promise.all([
      mainResponsePromise,
      minMaxResponsePromise,
      uniquenessResponsePromise,
      minMaxCurrentTimeframeResponsePromise
    ]);
    
    console.timeEnd("Druid network request (raw data fetch)");
    
    console.time("Local data processing");
    // Response Data 
    const responseData: ResponseData = {
      EpochTime: [],
      value: [],
    };

    if (latitudeLongitudeColumnNames[0] !== '' && latitudeLongitudeColumnNames[1] !== '') {
      responseData.latitude = [];
      responseData.longitude = [];
    }

    // Process scan query response (no aggregation). Needs to be processed differently than 
    // timeseries query response (with aggregation). Druid returns different data structures for each.
    if (selectedAggregationInterval === 'none') {
      // Flatten the events arrays from all segments
      const allEvents = Object.values(mainResponse).reduce((acc: any[], segment: any) => {
        const columns = segment.columns;
        const events = segment.events;

        // Map each event array to an object with named properties
        const mappedEvents = events.map((event: any[]) => {
          const eventObj: any = {};
          columns.forEach((col: string, index: number) => {
            eventObj[col] = event[index];
          });
          return eventObj;
        });

        return [...acc, ...mappedEvents];
      }, []);

      // Process the flattened events
      allEvents.forEach((row: any) => {
        responseData.EpochTime.push(row.__time);
        responseData.value.push(row[selectedFieldAkaColumn]);
        if (responseData.latitude && responseData.longitude) {
          responseData.latitude.push(row[latitudeLongitudeColumnNames[0]]);
          responseData.longitude.push(row[latitudeLongitudeColumnNames[1]]);
        }
      });
    } else {
      // Process timeseries query response (with aggregation)
      Object.values(mainResponse).forEach((result: any) => {
        responseData.EpochTime.push(new Date(result.timestamp).getTime());
        responseData.value.push(result.result[selectedFieldAkaColumn]);
        if (responseData.latitude && responseData.longitude) {
          responseData.latitude.push(result.result[latitudeLongitudeColumnNames[0]]);
          responseData.longitude.push(result.result[latitudeLongitudeColumnNames[1]]);
        }
      });
    }
    // Response Data results extraction - Handle native Druid response format
    console.log('minMaxResponse:', minMaxResponse);
    console.log('minMaxCurrentTimeframeResponse:', minMaxCurrentTimeframeResponse);
    
    // Handle empty responses or different formats
    const minMaxResult = minMaxResponse[0] || {};
    const minMaxCurrentResult = minMaxCurrentTimeframeResponse[0] || {};
    
    const minEpochResponseData = minMaxResult.result?.minTimestamp || 0;
    const maxEpochResponseData = minMaxResult.result?.maxTimestamp || 0;
    const minEpochCurrentTimeframeData = minMaxCurrentResult.result?.minTimestamp || 0;
    const maxEpochCurrentTimeframeData = minMaxCurrentResult.result?.maxTimestamp || 0;
    
    // Handle native Druid response format for uniqueness
    const uniquenessResult = Object.values(uniquenessResponse)[0] as any;
    const distinctCount = uniquenessResult?.result?.distinct_timestamps || 0;
    const totalCount = uniquenessResult?.result?.total_count || 0;
    const uniquenessScore = totalCount > 0 ? Math.round((distinctCount / totalCount) * 100 * 100) / 100 : 0;
    console.timeEnd("🔧 Local data processing");

    return {
      responseData,
      minEpochResponseData,
      maxEpochResponseData,
      minEpochCurrentTimeframeData,
      maxEpochCurrentTimeframeData,
      uniquenessScore
    };
  };

  const fetchAvailableDatasets = async (): Promise<string[]> => {
    const queryResult = await fetchFromDruid(config.url + 'sql', {
      query: `SELECT "TABLE_NAME" FROM "INFORMATION_SCHEMA"."TABLES" WHERE "TABLE_TYPE" = 'TABLE'`,
      context: { sqlQueryId: "DQDquery_available_datasets_on_druid" },
    });
    return queryResult.map((table: { TABLE_NAME: string }) => table.TABLE_NAME);
  };

  const fetchAvailableColumns = async (selectedDataset: string): Promise<{ name: string; dataType: string; }[]> => {
    const queryResult = await fetchFromDruid(config.url + 'sql', {
      query: `SELECT 
                  "COLUMN_NAME", 
                  "DATA_TYPE" 
                FROM 
                  "INFORMATION_SCHEMA"."COLUMNS" 
                WHERE 
                  "TABLE_NAME" = '${selectedDataset}'  
                  AND
                  "DATA_TYPE" NOT IN ('TIMESTAMP')`,
      context: { sqlQueryId: "DQDquery_selected_datasets_available_columns" },
    });
    return queryResult.map((column: { COLUMN_NAME: string; DATA_TYPE: string; }) => ({
      name: column.COLUMN_NAME,
      dataType: column.DATA_TYPE
    }));
  };

  const fetchUniqueValues = async (column: string, selectedDataset: string): Promise<(string | number)[]> => {
    const data = await fetchFromDruid(config.url + 'sql', {
      query: `SELECT DISTINCT "${column}" FROM "${selectedDataset}"  LIMIT 100`,
      context: { sqlQueryId: "DQDquery_unique_values" },
    });
    return data.map((item: { [x: string]: string | number; }) => item[column]);
  };

  const checkIfIsTimeseries = async (selectedDataset: string): Promise<boolean> => {
    const data = await fetchFromDruid(config.url + 'sql', {
      query: `
          SELECT
            CASE
              WHEN MAX(__time) != MIN(__time) THEN true
              ELSE false
            END AS is_timeseries 
          FROM "${selectedDataset}"`,
      context: { sqlQueryId: "DQDquery_unique_timestamps" },
    });
    return data[0].is_timeseries;
  };

  const checkForTimeseriesDuplicates = async (
    selectedDataset: string,
    filterColumnName?: string,
    filterUniqueValue?: string | number
  ): Promise<number> => {
    const data = await fetchFromDruid(config.url + 'sql', {
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
      context: { sqlQueryId: "DQDquery_timeseries_duplicates" },
    });
    return data.length > 0 ? data[0].COUNT : 0;
  };

  return {
    fetchData,
    fetchAvailableDatasets,
    fetchAvailableColumns,
    fetchUniqueValues,
    checkIfIsTimeseries,
    checkForTimeseriesDuplicates
  };
}
