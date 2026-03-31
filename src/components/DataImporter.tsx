import React, { useEffect, useState } from 'react';
import '../App.css';
import { druidConnectorConfig } from '../configDashboard';
import { DataConnectorConfig } from '../services/dataConnector';
import { GetDataGaps } from "../services/dataHelpers";
import { useDruidConnector } from '../services/druidConnectorNative';
interface DatasetSelectorProps {
    availableDatasets: string[],
    setAvailableDatasets: (datasets: string[]) => void,
    selectedDataset: string,
    setSelectedDataset: (dataset: string) => void,
    selectedFieldAkaColumn: string,
    setSelectedFieldAkaColumn: (field: string) => void,
    selectedPrimaryCategoricalDimension: string | undefined,
    setSelectedPrimaryCategoricalDimension: (dimension: string) => void,
    selectedPrimaryCategoricalDimensionUniqueValue: string | undefined,
    setSelectedPrimaryCategoricalDimensionUniqueValue: (uniqueValue: string) => void,
    latitudeLongitudeColumnNames: string[],
    setLatitudeLongitudeColumnNames: (latlon: string[]) => void,
    includeCoordinates: boolean,
    setIncludeCoordinates: (includeCoordinates: boolean) => void,
    setRefreshData: (refreshData: boolean) => void,
    refreshData: boolean,
    currentColumnsInfo: { name: string, dataType: string }[],
    setCurrentColumnsInfo: (columnsInfo: { name: string, dataType: string }[]) => void
}

const DataImporter: React.FC<DatasetSelectorProps> = ({
    availableDatasets,
    setAvailableDatasets,
    selectedDataset,
    setSelectedDataset,
    selectedFieldAkaColumn,
    setSelectedFieldAkaColumn,
    selectedPrimaryCategoricalDimension,
    setSelectedPrimaryCategoricalDimension,
    selectedPrimaryCategoricalDimensionUniqueValue,
    setSelectedPrimaryCategoricalDimensionUniqueValue,
    latitudeLongitudeColumnNames,
    setLatitudeLongitudeColumnNames,
    includeCoordinates,
    setIncludeCoordinates,
    refreshData,
    setRefreshData,
    currentColumnsInfo,
    setCurrentColumnsInfo
}) => {
    const druidConnector = useDruidConnector(druidConnectorConfig);
    const [availableFieldsList, setAvailableFieldsList] = useState<string[]>([]);
    const [availableDimensionsUniqueValues, setAvailableDimensionsUniqueValues] = useState<string[]>([]);
    const [availableLatLonColumns, setAvailableLatLonColumns] = useState<string[] | undefined>([]);
    const [availableCoordinatesArrayColumns, setAvailableCoordinatesArrayColumns] = useState<string[]>([]);
    const [columnCounts, setColumnCounts] = useState<Record<string, number>>({});
    const [hasTimestampDuplicate, setHasTimestampDuplicate] = useState(false);
    const [timestampDuplicateCount, setTimestampDuplicateCount] = useState<number | undefined>(undefined);
    const [showFilters, setShowFilters] = useState(true);
    const [showUniqueValueInputField, setShowUniqueValueInputField] = useState(false);
    const [tempUniqueNumericValue, setTempUniqueNumericValue] = useState('');
    const [disableSubmitButton, setDisableSubmitButton] = useState(false);
    const [datasetIsTimeseries, setDatasetIsTimeseries] = useState(true);
    const [queryResultNotEmpty, setQueryResultNotEmpty] = useState(false);

    // Initial data fetch
    useEffect(() => {
        druidConnector.fetchAvailableDatasets()
            .then(data => {
                if (JSON.stringify(data) !== JSON.stringify(availableDatasets)) {
                    setAvailableDatasets(data);
                    setSelectedDataset('');
                }
            })
            .catch(error => {
                console.error("Error fetching availableDatasetsTemp:", error);
            });
    }, []);

    useEffect(() => {
        if (selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimension !== '' && selectedDataset !== '') {
            const selectedColumn = currentColumnsInfo.find(column => column.name === selectedPrimaryCategoricalDimension);
            if (selectedColumn && selectedColumn.dataType !== "VARCHAR") {
                setShowUniqueValueInputField(true);
            }
        }
        if (selectedDataset !== '') {
            handleDatasetChange({ target: { value: selectedDataset } });
        }
    }, []);

    useEffect(() => {
        if (selectedDataset !== '') {
            if (selectedFieldAkaColumn !== '') {
                handleColumnChange({ target: { value: selectedFieldAkaColumn } });
            }
            if (selectedPrimaryCategoricalDimension && selectedPrimaryCategoricalDimension !== '') {
                handleColumnFilterChange({ target: { value: selectedPrimaryCategoricalDimension } });
            }
            if (selectedPrimaryCategoricalDimensionUniqueValue && selectedPrimaryCategoricalDimensionUniqueValue !== '') {
                handleUniqueValueChange({ target: { value: selectedPrimaryCategoricalDimensionUniqueValue } });
            }
        }
    }, [selectedDataset]);

    useEffect(() => {
        if (selectedPrimaryCategoricalDimension) {
            console.log("selectedPrimaryCategoricalDimension", selectedPrimaryCategoricalDimension);
            const selectedColumn = currentColumnsInfo.find(column => column.name === selectedPrimaryCategoricalDimension);
            if (selectedColumn && selectedColumn.dataType === "VARCHAR") {
                druidConnector.fetchUniqueValues(selectedPrimaryCategoricalDimension, selectedDataset).then(data => {
                    setAvailableDimensionsUniqueValues(data.map(String));
                }).catch(error => {
                    console.error("Error fetching unique values:", error);
                });
                setShowUniqueValueInputField(false);
            } else {
                druidConnector.fetchUniqueValues(selectedPrimaryCategoricalDimension, selectedDataset).then(data => {
                }).catch(error => {
                    console.error("Error fetching unique values:", error);
                });
                setAvailableDimensionsUniqueValues([]);
                setShowUniqueValueInputField(true);
            }
        }
    }, [selectedPrimaryCategoricalDimension]);

    const handleDatasetChange = async (event: { target: { value: string } }) => {
        setSelectedFieldAkaColumn('');
        setSelectedPrimaryCategoricalDimensionUniqueValue('');
        setSelectedPrimaryCategoricalDimension('');
        setLatitudeLongitudeColumnNames(["", ""]);
        setShowUniqueValueInputField(false);
        setTempUniqueNumericValue('');
        setSelectedDataset(event.target.value);
        setAvailableFieldsList([]);
        setAvailableDimensionsUniqueValues([]);
        setTempUniqueNumericValue('');

        if (event.target.value === '') {
            setColumnCounts({});
            setHasTimestampDuplicate(false);
            setTimestampDuplicateCount(undefined);
            setAvailableLatLonColumns(undefined);
            setLatitudeLongitudeColumnNames(["", ""]);
        } else {
            if (await druidConnector.checkIfIsTimeseries(event.target.value)) {
                console.log("Selected dataset is a time series");
                setDatasetIsTimeseries(true);

                try {
                    const columnsObjArray = await druidConnector.fetchAvailableColumns(event.target.value);
                    setCurrentColumnsInfo(columnsObjArray);
                    const columnNamesList = columnsObjArray.map((column: { name: string; }) => column.name);

                    setAvailableFieldsList(columnNamesList);
                    druidConnector.checkForTimeseriesDuplicates(event.target.value, selectedPrimaryCategoricalDimension, selectedPrimaryCategoricalDimensionUniqueValue).then(data => {
                        setTimestampDuplicateCount(data);
                        setHasTimestampDuplicate(data > 0);
                    }).catch(error => {
                        console.error("Error checking for time series duplicates:", error);
                    });

                    const latLonColumns = columnsObjArray.filter((column: { dataType: string; }) =>
                        column.dataType === "DOUBLE" || column.dataType === "FLOAT")
                        .map((column: { name: string; }) => column.name);

                    const coordinatesArrayColumns = columnsObjArray.filter((column: { dataType: string; }) =>
                        column.dataType === "ARRAY")
                        .map((column: { name: string; }) => column.name);
                    if (coordinatesArrayColumns.length > 0) {
                        setAvailableCoordinatesArrayColumns(coordinatesArrayColumns);
                    } else {
                        setAvailableCoordinatesArrayColumns([]);
                    }

                    const lat = columnNamesList.find((column: string) => column.toLowerCase().includes("lat") || column.toLowerCase().includes("latitude"));
                    const lon = columnNamesList.find((column: string) => column.toLowerCase().includes("lon") || column.toLowerCase().includes("longitude"));

                    if (latLonColumns.length > 1) {
                        setAvailableLatLonColumns(latLonColumns);
                        if (latitudeLongitudeColumnNames[0] && latitudeLongitudeColumnNames[1] &&
                            latLonColumns.includes(latitudeLongitudeColumnNames[0]) && latLonColumns.includes(latitudeLongitudeColumnNames[1])) {
                            setLatitudeLongitudeColumnNames(latitudeLongitudeColumnNames);
                        } else if (lat && lon) {
                            setLatitudeLongitudeColumnNames([lat, lon]);
                        } else {
                            setLatitudeLongitudeColumnNames(["", ""]);
                        }
                    } else {
                        setAvailableLatLonColumns([]);
                    }
                } catch (error) {
                    console.error("Error handling dataset change:", error);
                }
            } else {
                console.log("Selected dataset is not a time series");
                setDatasetIsTimeseries(false);
                setColumnCounts({});
                setHasTimestampDuplicate(false);
                setTimestampDuplicateCount(undefined);
                setAvailableLatLonColumns(undefined);
                setLatitudeLongitudeColumnNames(["", ""]);
                setAvailableCoordinatesArrayColumns([]);
            }
        }
    };

    const handleColumnChange = async (event: { target: { value: string }; }) => {
        setSelectedFieldAkaColumn(event.target.value);
    };

    const handleColumnFilterChange = async (event: { target: { value: string } }) => {
        if (event.target.value === '') {
            setSelectedPrimaryCategoricalDimension('');
            setSelectedPrimaryCategoricalDimensionUniqueValue('');
            setAvailableDimensionsUniqueValues([]);
            setShowUniqueValueInputField(false);
            druidConnector.checkForTimeseriesDuplicates(selectedDataset, '', '').then(data => {
                setTimestampDuplicateCount(data);
                setHasTimestampDuplicate(data > 0);
            }).catch(error => {
                console.error("Error checking for time series duplicates:", error);
            });
        } else {
            try {
                const selectedColumn = currentColumnsInfo.find(column => column.name === event.target.value);

                if (selectedColumn && selectedColumn.dataType === "VARCHAR") {
                    setSelectedPrimaryCategoricalDimension(event.target.value);
                    setSelectedPrimaryCategoricalDimensionUniqueValue('');
                    druidConnector.fetchUniqueValues(event.target.value, selectedDataset)
                        .then(data => {
                            setAvailableDimensionsUniqueValues(data.map(String));
                        })
                        .catch(error => {
                            console.error("Error fetching unique values:", error);
                        });
                    setShowUniqueValueInputField(false);
                } else {
                    setSelectedPrimaryCategoricalDimension(event.target.value);
                    setAvailableDimensionsUniqueValues([]);
                    setSelectedPrimaryCategoricalDimensionUniqueValue('');
                    setShowUniqueValueInputField(true);
                }
            } catch (error) {
                console.error("Error handling column filter change:", error);
            }
        }
    };

    const handleUniqueValueChange = async (event: { target: { value: string } }) => {
        setSelectedPrimaryCategoricalDimensionUniqueValue(event.target.value);
        druidConnector.checkForTimeseriesDuplicates(selectedDataset, selectedPrimaryCategoricalDimension, event.target.value).then(data => {
            setTimestampDuplicateCount(data);
            setHasTimestampDuplicate(data > 0);
        }).catch(error => {
            console.error("Error checking for time series duplicates:", error);
        });
    };

    const handleUniqueValueInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = event.target.value;
        console.log("handleUniqueValueInputChange", inputValue);
        const isValidNumber = !isNaN(parseFloat(inputValue)) && isFinite(parseFloat(inputValue));

        if (inputValue === selectedPrimaryCategoricalDimensionUniqueValue || !isValidNumber) {
            setDisableSubmitButton(true);
        } else {
            setDisableSubmitButton(false);
        }

        if (isValidNumber) {
            setTempUniqueNumericValue(inputValue);
        }
    };

    const handleSubmitUniqueValue = () => {
        const inputFieldValue = tempUniqueNumericValue;
        setSelectedPrimaryCategoricalDimensionUniqueValue(inputFieldValue);
        setDisableSubmitButton(true);
        druidConnector.checkForTimeseriesDuplicates(selectedDataset, selectedPrimaryCategoricalDimension, inputFieldValue).then(data => {
            setTimestampDuplicateCount(data);
            setHasTimestampDuplicate(data > 0);
        }).catch(error => {
            console.error("Error checking for time series duplicates:", error);
        });
    };

    const handleLatLonChange = (event: { target: { value: string, id: string }; }) => {
        if (event.target.id === "latitude-select") {
            setLatitudeLongitudeColumnNames([event.target.value, latitudeLongitudeColumnNames[1]]);
            if (event.target.value !== '' && latitudeLongitudeColumnNames[1] !== '') {
                setRefreshData(!refreshData);
            }
        } else {
            setLatitudeLongitudeColumnNames([latitudeLongitudeColumnNames[0], event.target.value]);
            if (latitudeLongitudeColumnNames[0] !== '' && event.target.value !== '') {
                setRefreshData(!refreshData);
            }
        }
    };

    return (
        <div style={{ paddingTop: 10 }}>
            <select id="dataset-select"
                style={{ maxWidth: "400px", minWidth: "270px", overflow: "hidden", textOverflow: "ellipsis" }}
                value={selectedDataset}
                onChange={handleDatasetChange}>
                <option value="">Select a dataset</option>
                {availableDatasets.map(dataset => (
                    <option key={dataset} value={dataset}>{dataset}</option>
                ))}
            </select>
            <label htmlFor="dataset-select"><b> -Dataset (required)</b></label>
            <br />
            <select id="column-select"
                style={{ maxWidth: "400px", minWidth: "270px", overflow: "hidden", textOverflow: "ellipsis" }}
                value={selectedFieldAkaColumn}
                onChange={handleColumnChange}
                disabled={!datasetIsTimeseries || selectedDataset === ''}>
                <option value="">Select field</option>
                {
                    currentColumnsInfo.filter((column: {
                        dataType: string;
                        name: string;
                    }) => column.dataType !== "VARCHAR" && 
                           column.dataType !== "ARRAY" && 
                           column.name !== latitudeLongitudeColumnNames[0] && 
                           column.name !== latitudeLongitudeColumnNames[1])
                        .map((column: { name: string; }) => (
                            <option key={column.name} value={column.name}>{column.name}</option>
                        ))
                }
            </select>
            <label htmlFor="column-select"><b> -Data field (required)</b></label>
            <br /><br />
            {
                !datasetIsTimeseries
                    ? (
                        <div>
                            <i style={{ backgroundColor: "red" }}>SELECTED Dataset is not a time series.</i>
                        </div>
                    )
                    : selectedDataset !== '' && hasTimestampDuplicate
                        ? selectedPrimaryCategoricalDimensionUniqueValue === ''
                            ? (
                                <div style={{ borderBottom: "1px solid black" }}>
                                    <span className="hover-label-timestamp-duplicates-dataset"
                                        style={{ fontSize: "1em" }}>&#9888;</span>
                                    <i style={{ backgroundColor: "yellow" }}>{timestampDuplicateCount} timestamp duplicates
                                        have been detected in the selected dataset.</i>
                                </div>
                            ) : (
                                <div style={{ borderBottom: "1px solid black" }}>
                                    <span className="hover-label-timestamp-duplicates-dataset-and-dimension"
                                        style={{ fontSize: "1em" }}>&#9888;</span>
                                    <i style={{ backgroundColor: "yellow" }}>{timestampDuplicateCount} timestamp duplicates
                                        have been detected with current dimension filter options.</i>
                                </div>
                            )
                        : selectedDataset !== '' && selectedPrimaryCategoricalDimensionUniqueValue !== ''
                            ? (
                                <div style={{ borderBottom: "1px solid black" }}>
                                    <span></span>
                                    <i>&#0000;</i>
                                </div>
                            )
                            : selectedDataset !== ''
                                ? (
                                    <div style={{ borderBottom: "1px solid black" }}>
                                        <span></span>
                                        <i>&#0000;</i>
                                    </div>
                                )
                                : (
                                    <div style={{ borderBottom: "1px solid black" }}>
                                        <span></span>
                                        <i>&#0000;</i>
                                    </div>)
            }
            Dimension (category) filter:
            {showFilters && (
                <>
                    <br />
                    &emsp;&emsp;
                    <select
                        id="filter-select"
                        style={{ minWidth: "170px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}
                        value={selectedPrimaryCategoricalDimension}
                        onChange={handleColumnFilterChange}
                        disabled={!datasetIsTimeseries || selectedDataset === ''}
                    >
                        <option value="">Select dimension</option>
                        {availableFieldsList.map(column => (
                            <option key={column} value={column}>{column}</option>
                        ))}
                    </select>
                    <label htmlFor="filter-select"> -Primary categorical dimension</label>
                    <br />&emsp;&emsp;
                    {showUniqueValueInputField ? (
                        <>
                            <input
                                type="number"
                                id="unique-value-input"
                                style={{
                                    minWidth: "170px",
                                    maxWidth: "200px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    textAlign: "right",
                                    appearance: "textfield"
                                }}
                                disabled={!datasetIsTimeseries || selectedDataset === '' || selectedPrimaryCategoricalDimension === ''}
                                onInput={handleUniqueValueInputChange}
                                inputMode="numeric"
                                placeholder={"Enter value"}
                            />
                            &emsp;
                            <button
                                onClick={handleSubmitUniqueValue}
                                disabled={!datasetIsTimeseries || selectedDataset === '' || selectedPrimaryCategoricalDimension === '' || disableSubmitButton}
                            >
                                Submit
                            </button>
                        </>
                    ) : (
                        <>
                            <select
                                id="unique-value-select"
                                style={{
                                    minWidth: "170px",
                                    maxWidth: "200px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis"
                                }}
                                value={selectedPrimaryCategoricalDimensionUniqueValue}
                                onChange={handleUniqueValueChange}
                                disabled={!datasetIsTimeseries || selectedDataset === '' || selectedPrimaryCategoricalDimension === ''}
                            >
                                <option value="">Select a unique value</option>
                                {availableDimensionsUniqueValues.map(value => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                            <label htmlFor="unique-value-select"> -Unique value</label>
                        </>
                    )}
                </>
            )}
            <br /><br />
            <label htmlFor="include-coordinates" className="hover-label-geo-location">Point to geo location
                fields:</label>
            <br />

                    &emsp;&emsp;
                    <select
                        id="latitude-select"
                        style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}
                        value={latitudeLongitudeColumnNames[0]}
                        onChange={handleLatLonChange}
                        disabled={!datasetIsTimeseries || selectedDataset === ''}
                    >
                        <option value="">Select column</option>
                        {availableLatLonColumns?.map(column => (
                            <option key={column} value={column}>{column}</option>
                        ))}
                    </select>
                    <label htmlFor="latitude-select"> -Latitude</label>
                    <br />
                    &emsp;&emsp;
                    <select
                        id="longitude-select"
                        style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}
                        value={latitudeLongitudeColumnNames[1]}
                        onChange={handleLatLonChange}
                        disabled={!datasetIsTimeseries || selectedDataset === ''}
                    >
                        <option value="">Select column</option>
                        {availableLatLonColumns?.map(column => (
                            <option key={column} value={column}>{column}</option>
                        ))}
                    </select>
                    <label htmlFor="longitude-select"> -Longitude</label>
               
            <br />
             </div>
    );
};

export default DataImporter;
