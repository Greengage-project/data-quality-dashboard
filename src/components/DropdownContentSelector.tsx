import React from 'react';
import {Select} from 'antd';

const { Option } = Select;

interface ContentSelectorProps {
    onContentChange: (content: string) => void;
    disableFields?: boolean;
}

const DropdownContentSelector: React.FC<ContentSelectorProps> = ({ onContentChange, disableFields }) => {
    const handleContentChange = (value: string) => {
        onContentChange(value);
    };

    return (
        <Select
            defaultValue="dataImporter"
            style={{ minWidth: '100%' }}
            onChange={handleContentChange}
            options={[
                { value: 'dataImporter', label: 'Data Import' },
                { value: 'dataTable', label: 'Data Table', disabled: disableFields  },
                { value: 'descriptiveStats', label: 'Descriptive Statistics', disabled: disableFields  },
                { value: 'dataQualityMetrics', label: 'Data Quality Metrics', disabled: disableFields },
                { value: 'outlierDetection', label: '[beta] Outlier Detection', disabled: disableFields },
                 /*{ value: 'interpolation', label: '[tech test] Interpolation', disabled: disableFields },
                 { value: 'dataExport', label: '[tech test] Export Data', disabled: disableFields },*/
            ]}
        >
        </Select>
    );
};

export default DropdownContentSelector;
