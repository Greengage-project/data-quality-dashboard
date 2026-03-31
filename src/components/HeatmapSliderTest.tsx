import React, { useState } from 'react';
import Plot from 'react-plotly.js';

//TODO: check https://stackoverflow.com/questions/75719733/how-to-have-a-faster-rendering-when-moving-a-slider-for-colorscale-range-with

const HeatmapSliderTest = () => {
    const [zmin, setZmin] = useState(0);

    const z = Array.from({ length: 500 }, () => Array.from({ length: 1000 }, () => Math.floor(Math.random() * 500)));

    const handleSliderChange = (e: { target: { value: string; }; }) => {
        const value = parseInt(e.target.value);
        setZmin(value);
    };

    return (
        <div>
            <Plot
                data={[
                    {
                        z: z,
                        type: 'heatmap',
                        colorscale: 'Jet',
                        zsmooth: 'fast'
                    }
                ]}
                layout={{
                    width: 1200,
                    height: 650,
                    margin: {
                        t: 40,
                        b: 110,
                        l: 90,
                        r: 110
                    },
                    sliders: [{
                        pad: {t: 55},
                        currentvalue: {
                            visible: true,
                            prefix: 'Zmin:',
                            xanchor: 'right',
                            font: {size: 20, color: '#666'}
                        },
                        steps: [...Array(6)].map((_, i) => ({
                            method: 'restyle',
                            args: [['zmin'], i * 100],
                            label: `${i * 100}`
                        }))
                    }]
                }}
                config={{
                    displaylogo: false
                }}
            />
            <input
                type="range"
                min="0"
                max="500"
                value={zmin}
                onChange={handleSliderChange}
            />
        </div>
    );
};

export default HeatmapSliderTest;
