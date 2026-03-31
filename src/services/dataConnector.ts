export interface DataConnectorConfig {
  url: string;
  authorizationType: string;
  authorization: string;
}

export interface FetchDataParams {
  selectedDataset: string;
  selectedFieldAkaColumn: string;
  selectedPrimaryCategoricalDimension: string | undefined;
  selectedPrimaryCategoricalDimensionUniqueValue: string | number;
  selectedTimeInterval: string | undefined;
  startDate: string;
  endDate: string;
  selectedAggregationInterval: 'daily' | 'hourly' | 'none' | '30min' | '15min';
  selectedAggregationType: 'min' | 'max' | 'avg' | 'sum';
  latitudeLongitudeColumnNames: string[];
  timezone: string;
}
export interface ResponseData {
  EpochTime: number[];
  value: number[];
  latitude?: number[];
  longitude?: number[];
}

export interface DataConnector {
  fetchData(params: FetchDataParams): Promise<{
    responseData: ResponseData;
    minEpochResponseData: number;
    maxEpochResponseData: number;
    minEpochCurrentTimeframeData: number;
    maxEpochCurrentTimeframeData: number;
    uniquenessScore: number;
  }>;
  fetchAvailableDatasets(): Promise<string[]>;
  fetchAvailableColumns(selectedDataset: string): Promise<{ name: string; dataType: string; }[]>;
  fetchUniqueValues(column: string, selectedDataset: string): Promise<(string | number)[]>;
  checkIfIsTimeseries(selectedDataset: string): Promise<boolean>;
  checkForTimeseriesDuplicates(selectedDataset: string, filterColumnName?: string, filterUniqueValue?: string | number): Promise<number>;
}
