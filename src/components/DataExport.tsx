// @ts-nocheck
import React, { useState } from "react";
import * as XLSX from 'xlsx';
import { saveAs } from "file-saver";
import { DataArray } from "../Dashboard.tsx";
import dayjs from "dayjs";

interface DataExportProps {
    dataFrame: DataArray | undefined;
}

const DataExport: React.FC<DataExportProps> = ({ dataFrame }) => {
    if (!dataFrame) {
        return null;
    }

    // Extract "EpochTime" and "value" arrays
    const epochTimeArray: number[] = dataFrame.EpochTime;
    const valueArray:number [] = dataFrame.value;

    const [storeAsDateTime, setStoreAsDateTime] = useState<boolean>(false);

    // Create an array of objects with "DateTime" and "value"
    const dataArray = epochTimeArray.map((epochTime, index) => ({
        DateTime: storeAsDateTime
            ? dayjs.utc(epochTime).format("YYYY-MM-DD HH:mm:ss")
            : epochTime,
        value: valueArray[index],
    }));

    const exportToJSON = () => {
        const json = JSON.stringify(dataArray, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        saveAs(blob, "data.json");
    };

    const exportToCSV = () => {
           // Convert the array of objects to CSV string add header row

        const csvHeader = storeAsDateTime ? "DateTime,value\n" : "EpochTime,value\n";
        const csvData = dataArray.map(item => `${item.DateTime},${item.value}`).join("\n");
        const csv = `${csvHeader}${csvData}`;
        const blob = new Blob([csv], { type: "text/csv" });
        saveAs(blob, "data.csv");
    };



    const exportToXML = () => {
        // Convert the array of objects to an XML string
        const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
        const xmlFooter = '\n</data>';
        const xmlData = dataArray.map(item => `<row><DateTime>${item.DateTime}</DateTime><value>${item.value}</value></row>`).join("\n");
        const xml = `${xmlHeader}${xmlData}${xmlFooter}`;
        const blob = new Blob([xml], { type: "application/xml" });
        saveAs(blob, "data.xml");
    };

    const exportToXLSX = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataArray);
        XLSX.utils.book_append_sheet(wb, ws, "data");
        XLSX.writeFile(wb, "data.xlsx");
    };



    const exportToText = () => {
        // Convert the array of objects to a plain text string
        const textData = dataArray.map(item => `DateTime: ${item.DateTime}, value: ${item.value}`).join("\n");
        const blob = new Blob([textData], { type: "text/plain" });
        saveAs(blob, "data.txt");
    };

    return (
        <div style={{paddingTop:10}}>
            <button onClick={exportToJSON}>Export to JSON</button>
            <button onClick={exportToCSV}>Export to CSV</button>
            <button onClick={exportToXML}>Export to XML</button>
            <button onClick={exportToXLSX}>Export to XLSX</button>
            <button onClick={exportToText}>Export to Text</button>
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={storeAsDateTime}
                        onChange={() => setStoreAsDateTime(!storeAsDateTime)}
                    />
                    Store EpochTime as DateTime string
                </label>
            </div>
        </div>

    );
};

export default DataExport;
