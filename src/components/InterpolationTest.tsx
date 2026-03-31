// @ts-nocheck
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { DataArray } from "../Dashboard.tsx";
import { createInterpolatorWithFallback, InterpolationMethod } from "commons-math-interpolation";
import { smooth } from "commons-math-interpolation/Loess";
import { Row, Col, Select } from "antd";

const { Option } = Select;

interface InterpolationTestProps {
    dataFrame: DataArray | undefined;
    allValuesAreNull: boolean;
}

const InterpolationTest: React.FC<InterpolationTestProps> = ({ dataFrame, allValuesAreNull }) => {

    const [interpolationMethod, setInterpolationMethod] = useState<InterpolationMethod>("linear");
    const [interpolatedPlotData, setInterpolatedPlotData] = useState<number[][]>([]);
    const [plotData, setPlotData] = useState<any[]>([]);
    const [layout, setLayout] = useState<any>({
        showlegend: false,
        margin: {
            l: 30, // left margin
            r: 30, // right margin
            t: 30, // top margin
            b: 20, // bottom margin
            pad: 0, // padding between the plot area and the container
        },
    });

    if (!dataFrame) {
        return <div>No data available</div>;
    }

    if (allValuesAreNull) {
        return <div style={{textAlign: "center"}}><br/>
            There is no data to perform interpolation on.<br/>
            All imported values of selected field are null.<br/>
            See "Data Table" for more details.
        </div>;
    }

    useEffect(() => {
        if (!dataFrame) return;
        console.time("interpolation");

        const tempVals = [...dataFrame.value];
        const tempEpochTime = [...dataFrame.EpochTime];

        const xVals = [];
        const yVals = [];

        for (let i = 0; i < tempVals.length; i++) {
            const val = tempVals[i];
            if (val !== null) {
                xVals.push(tempEpochTime[i]);
                yVals.push(val);
            }
        }



        const interpolatedValues = [];
        const interpolator = createInterpolatorWithFallback(interpolationMethod, xVals, yVals);

        const step = 3600000; // 1 hour in milliseconds
        for (let i = xVals[0]; i < xVals[xVals.length - 1]; i += step) {
            const y = interpolator(i);
            interpolatedValues.push([i, y]);
        }
        console.timeEnd("interpolation");
        setInterpolatedPlotData(interpolatedValues);
    }, [dataFrame, interpolationMethod]);


    useEffect(() => {
        setPlotData([
            {
                x: dataFrame?.EpochTime.map((val: string | number | Date) => new Date(val)),
                y: dataFrame?.value,
                mode: "markers",
                type: "scattergl",
                name: "Original Data",
            },
            {
                x: interpolatedPlotData.map((pair) => pair[0]),
                y: interpolatedPlotData.map((pair) => pair[1]),
                mode: "lines",
                type: "scattergl",
                name: "Interpolated Data",
            },
        ]);
    }, [interpolatedPlotData]);

    function handleInterpolationMethodChange(value: string) {
        setInterpolationMethod(value as InterpolationMethod);
    }

    return (
        <>
            <Row align="middle">
                <Col span={7}>Interpolation method:</Col>
                <Col span={8}>
                    <Select
                        defaultValue={interpolationMethod}
                        style={{ width: "100%" }}
                        onChange={handleInterpolationMethodChange}
                    >
                        <Option value="linear">linear</Option>
                        <Option value="cubic">cubic</Option>
                        <Option value="akima">akima</Option>
                        <Option value="nearestNeighbor">nearest neighbor</Option>
                        <Option value="loess">loess</Option>
                    </Select>
                </Col>
            </Row>

            <Plot
                style={{ width: "100%", height: "100%" }}
                data={plotData}
                layout={layout}
                config={{
                    displaylogo: false
                }}
            />
        </>
    );
};

export default InterpolationTest;
