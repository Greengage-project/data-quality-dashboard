import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {ColDef, GridColumnsChangedEvent, GridReadyEvent} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../table.css'; // Import the CSS file
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { calc } from 'antd/es/theme/internal';

dayjs.extend(customParseFormat);
dayjs.extend(utc);

const dateFormat = 'YYYY/MM/DD HH:mm:ss'; // Correct the date format
interface DataTableProps {
    rowData: any[];
    selectedFieldAkaColumn: string;
}

const DataTable: React.FC<DataTableProps> = ({ rowData, selectedFieldAkaColumn }) => {
    if (rowData === undefined || rowData.length === 0) {
        return <div>No data available</div>;
    }

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            headerName: '#',
            valueGetter: 'node.rowIndex + 1',
            filter: false,
            sortable: false,
            resizable: true,
        },
        {
            headerName: 'Date Time',
            field: 'time',
            valueFormatter: (params) => dayjs(params.value).format(dateFormat),
        },
        { headerName: selectedFieldAkaColumn, field: 'value' },
        ...(rowData[0].latitude !== undefined && rowData[0].longitude !== undefined
            ? [
                { headerName: 'Latitude', field: 'latitude' },
                { headerName: 'Longitude', field: 'longitude' },
            ]
            : []),
    ], [selectedFieldAkaColumn, rowData]);

    const defaultColDef = useMemo(() => ({
        filter: true,
        sortable: true,
        resizable: true,
    }), []);

    const onGridReady = (params: GridReadyEvent | GridColumnsChangedEvent  ) => {
        params.api.autoSizeAllColumns();
    };

    return (
        <div className="ag-theme-alpine" style={{ height: 'calc(100% - 37px)', width: '100%', marginTop: "5px" }}>
            <AgGridReact
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                onGridReady={onGridReady}
                onGridColumnsChanged={onGridReady}
            />
        </div>
    );
};

export default React.memo(DataTable);
