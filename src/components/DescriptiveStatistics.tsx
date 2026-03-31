import React, {useEffect, useState} from 'react';
import Decimal from 'decimal.js';
import {AgGridReact} from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {ColDef, ColGroupDef} from "ag-grid-community";
import { ResponseData } from '../services/dataConnector';

interface DescriptiveStatisticsProps {
    inputData: ResponseData | undefined;
    allValuesAreNull: boolean;
}

interface StatObject {
    statMeasure: string;
    value: number;
}

interface DescriptiveStats {
    'Number of Values': number;
    'Mean (Average)': number;
    'Standard Deviation': number;
    'Minimum Value': number;
    'First Quartile (25%)': number;
    'Median (50%)': number;
    'Third Quartile (75%)': number;
    'Maximum Value': number;
}

function calculateDescriptiveStats(data: number[]): DescriptiveStats {
    const filteredData = data.filter(n => n !== null && !isNaN(n));
    const sorted = [...filteredData].sort((a, b) => a - b);
    
    const count = filteredData.length;
    const sum = filteredData.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    
    // Calculate standard deviation
    const squareDiffs = filteredData.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / count;
    const std = Math.sqrt(avgSquareDiff);
    
    // Calculate percentiles
    const getPercentile = (p: number) => {
        const index = (p / 100) * (count - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        if (upper === lower) return sorted[index];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    return {
        'Number of Values': count,
        'Mean (Average)': mean,
        'Standard Deviation': std,
        'Minimum Value': sorted[0],
        'First Quartile (25%)': getPercentile(25),
        'Median (50%)': getPercentile(50),
        'Third Quartile (75%)': getPercentile(75),
        'Maximum Value': sorted[sorted.length - 1]
    };
}

const DescriptiveStatistics: React.FC<DescriptiveStatisticsProps> = ({
    inputData,
    allValuesAreNull
}) => {
    const [statObjects, setStatObjects] = useState<StatObject[]>([]);

    useEffect(() => {
        if (inputData && !allValuesAreNull) {
            const stats = calculateDescriptiveStats(inputData.value);
            const newStatObjects = Object.entries(stats).map(([statMeasure, value]) => ({
                statMeasure,
                value: new Decimal(value).toDecimalPlaces(2).toNumber(),
            }));
            setStatObjects(newStatObjects);
        } else {
            setStatObjects([]);
        }
    }, [inputData, allValuesAreNull]);

    if (!inputData) {
        return <div>No data available</div>;
    }

    if (allValuesAreNull) {
        return <div style={{textAlign: "center"}}><br/>
            There is no data to perform descriptive statistics on.<br/>
            All imported values of selected field are null.<br/>
            See "Data Table" for more details.
        </div>;
    }

    const columnDefs: (ColDef<StatObject, any> | ColGroupDef<StatObject>)[] = [
        {
            headerName: 'Measure',
            field: 'statMeasure',

        },
        {
            headerName: 'Value',
            field: 'value',

        },
    ];

    return (
        <div className="ag-theme-alpine" style={{height: '100%', width: '100%', marginTop: '5px'}}>
            <AgGridReact
                columnDefs={columnDefs}
                rowData={statObjects}
                domLayout='autoHeight'
                rowHeight={32}
                headerHeight={32}
            />
        </div>
    );
};

export default DescriptiveStatistics;
