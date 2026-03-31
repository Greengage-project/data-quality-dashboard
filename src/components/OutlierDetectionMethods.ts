// Advanced Outlier Detection Methods
// This file contains various statistical methods for outlier detection

export interface OutlierDetectionResult {
    outliers: number[];
    scores: number[];
    method: string;
    parameters: Record<string, any>;
}

/**
 * 1. Z-Score Method
 * Identifies outliers based on how many standard deviations away from the mean
 */
export function zScoreOutlierDetection(values: number[], threshold: number = 3): OutlierDetectionResult {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1));
    
    const scores = values.map(val => Math.abs((val - mean) / std));
    const outliers = scores.map((score, i) => score > threshold ? i : -1).filter(idx => idx !== -1);
    
    return {
        outliers,
        scores,
        method: 'Z-Score',
        parameters: { threshold, mean, std }
    };
}

/**
 * 2. Modified Z-Score (using Median Absolute Deviation)
 * More robust to outliers than standard Z-Score
 */
export function modifiedZScoreOutlierDetection(values: number[], threshold: number = 3.5): OutlierDetectionResult {
    const median = values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const mad = values.map(val => Math.abs(val - median)).sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const modifiedZScore = values.map(val => 0.6745 * (val - median) / mad);
    
    const outliers = modifiedZScore.map((score, i) => Math.abs(score) > threshold ? i : -1).filter(idx => idx !== -1);
    
    return {
        outliers,
        scores: modifiedZScore,
        method: 'Modified Z-Score',
        parameters: { threshold, median, mad }
    };
}

/**
 * 3. Isolation Forest
 * Machine learning approach that isolates outliers
 */
export function isolationForestOutlierDetection(values: number[], contamination: number = 0.1): OutlierDetectionResult {
    // Simplified version - in practice, you'd use a proper ML library
    const scores = values.map((val, i) => {
        // Simplified isolation score based on value uniqueness
        const similarCount = values.filter(v => Math.abs(v - val) < (Math.max(...values) - Math.min(...values)) * 0.1).length;
        return 1 - (similarCount / values.length);
    });
    
    const threshold = scores.slice().sort((a, b) => b - a)[Math.floor(scores.length * contamination)];
    const outliers = scores.map((score, i) => score > threshold ? i : -1).filter(idx => idx !== -1);
    
    return {
        outliers,
        scores,
        method: 'Isolation Forest',
        parameters: { contamination, threshold }
    };
}

/**
 * 4. Local Outlier Factor (LOF)
 * Identifies outliers based on local density
 */
export function localOutlierFactor(values: number[], k: number = 5, threshold: number = 1.5): OutlierDetectionResult {
    const scores: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
        // Calculate k-distance
        const distances = values.map((val, j) => Math.abs(val - values[i])).sort((a, b) => a - b);
        const kDistance = distances[k];
        
        // Calculate reachability distance
        const reachabilityDistances = values.map((val, j) => 
            Math.max(Math.abs(val - values[i]), kDistance)
        );
        
        // Calculate LOF score
        const lrd = k / reachabilityDistances.reduce((sum, dist) => sum + dist, 0);
        scores.push(lrd);
    }
    
    const outliers = scores.map((score, i) => score > threshold ? i : -1).filter(idx => idx !== -1);
    
    return {
        outliers,
        scores,
        method: 'Local Outlier Factor',
        parameters: { k, threshold }
    };
}

/**
 * 5. Seasonal Decomposition Outlier Detection
 * For time series with seasonal patterns
 */
export function seasonalDecompositionOutlierDetection(
    values: number[], 
    period: number = 24, // Assuming hourly data with daily seasonality
    threshold: number = 3
): OutlierDetectionResult {
    // Simple seasonal decomposition
    const seasonal = [];
    const trend = [];
    const residuals = [];
    
    // Calculate seasonal component
    for (let i = 0; i < values.length; i++) {
        const seasonalIndex = i % period;
        const seasonalValues = [];
        for (let j = seasonalIndex; j < values.length; j += period) {
            seasonalValues.push(values[j]);
        }
        seasonal[i] = seasonalValues.reduce((sum, val) => sum + val, 0) / seasonalValues.length;
    }
    
    // Calculate trend (simple moving average)
    const trendWindow = Math.min(period, Math.floor(values.length / 4));
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - Math.floor(trendWindow / 2));
        const end = Math.min(values.length, i + Math.ceil(trendWindow / 2));
        const trendValues = values.slice(start, end);
        trend[i] = trendValues.reduce((sum, val) => sum + val, 0) / trendValues.length;
    }
    
    // Calculate residuals
    for (let i = 0; i < values.length; i++) {
        residuals[i] = values[i] - trend[i] - seasonal[i];
    }
    
    // Find outliers in residuals
    const mean = residuals.reduce((sum, val) => sum + val, 0) / residuals.length;
    const std = Math.sqrt(residuals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (residuals.length - 1));
    
    const scores = residuals.map(val => Math.abs((val - mean) / std));
    const outliers = scores.map((score, i) => score > threshold ? i : -1).filter(idx => idx !== -1);
    
    return {
        outliers,
        scores,
        method: 'Seasonal Decomposition',
        parameters: { period, threshold, mean, std }
    };
}

/**
 * 6. Ensemble Method
 * Combines multiple methods for more robust detection
 */
export function ensembleOutlierDetection(
    values: number[], 
    methods: Array<{name: string, weight: number, threshold: number}> = [
        {name: 'zScore', weight: 0.3, threshold: 3},
        {name: 'modifiedZScore', weight: 0.3, threshold: 3.5},
        {name: 'tukey', weight: 0.4, threshold: 1.5}
    ]
): OutlierDetectionResult {
    const results: number[][] = [];
    
    // Run different methods
    methods.forEach(method => {
        let methodOutliers: number[] = [];
        
        switch (method.name) {
            case 'zScore':
                methodOutliers = zScoreOutlierDetection(values, method.threshold).outliers;
                break;
            case 'modifiedZScore':
                methodOutliers = modifiedZScoreOutlierDetection(values, method.threshold).outliers;
                break;
            case 'tukey':
                // Tukey's method implementation
                const sorted = values.slice().sort((a, b) => a - b);
                const q1 = sorted[Math.floor(sorted.length / 4)];
                const q3 = sorted[Math.floor(3 * sorted.length / 4)];
                const iqr = q3 - q1;
                const lowerBound = q1 - method.threshold * iqr;
                const upperBound = q3 + method.threshold * iqr;
                methodOutliers = values.map((val, i) => 
                    val < lowerBound || val > upperBound ? i : -1
                ).filter(idx => idx !== -1);
                break;
        }
        
        results.push(methodOutliers);
    });
    
    // Weighted voting
    const outlierScores = new Array(values.length).fill(0);
    methods.forEach((method, i) => {
        results[i].forEach(outlierIdx => {
            outlierScores[outlierIdx] += method.weight;
        });
    });
    
    const finalThreshold = 0.5; // At least 50% of methods must agree
    const outliers = outlierScores.map((score, i) => score >= finalThreshold ? i : -1).filter(idx => idx !== -1);
    
    return {
        outliers,
        scores: outlierScores,
        method: 'Ensemble',
        parameters: { methods, finalThreshold }
    };
}

