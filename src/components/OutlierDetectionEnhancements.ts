// Enhancements for the current outlier detection method

export interface EnhancedOutlierDetectionConfig {
    // Smoothing parameters
    smoothingMethod: 'EMA' | 'SMA' | 'WMA' | 'HoltWinters';
    frameSize: number;
    alpha?: number; // For EMA
    beta?: number; // For Holt-Winters
    
    // Detection parameters
    detectionMethod: 'residual' | 'tukey' | 'modifiedZScore' | 'isolationForest';
    threshold: number;
    sensitivity: 'low' | 'medium' | 'high';
    
    // Advanced options
    useSeasonalAdjustment: boolean;
    seasonalPeriod?: number;
    useRobustStatistics: boolean;
    minOutlierDistance?: number; // Minimum distance between outliers
}

/**
 * Enhanced EMA with trend component (Holt's method)
 */
export function calculateHoltWinters(values: number[], alpha: number, beta: number): number[] {
    const level: number[] = [];
    const trend: number[] = [];
    const forecast: number[] = [];
    
    // Initialize
    level[0] = values[0];
    trend[0] = 0;
    
    for (let i = 1; i < values.length; i++) {
        level[i] = alpha * values[i] + (1 - alpha) * (level[i-1] + trend[i-1]);
        trend[i] = beta * (level[i] - level[i-1]) + (1 - beta) * trend[i-1];
        forecast[i] = level[i-1] + trend[i-1];
    }
    
    return forecast;
}

/**
 * Weighted Moving Average (WMA)
 * Gives more weight to recent values
 */
export function calculateWMA(values: number[], frameSize: number): number[] {
    const wma: number[] = [];
    const weights = Array.from({length: frameSize}, (_, i) => i + 1);
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    
    for (let i = 0; i < values.length; i++) {
        if (i < frameSize - 1) {
            wma[i] = values[i];
        } else {
            let weightedSum = 0;
            for (let j = 0; j < frameSize; j++) {
                weightedSum += values[i - j] * weights[j];
            }
            wma[i] = weightedSum / weightSum;
        }
    }
    
    return wma;
}

/**
 * Robust statistics for outlier detection
 * Uses median and MAD instead of mean and standard deviation
 */
export function robustOutlierDetection(values: number[], threshold: number = 3.5): {
    outliers: number[];
    scores: number[];
    median: number;
    mad: number;
} {
    const sorted = values.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Median Absolute Deviation
    const deviations = values.map(val => Math.abs(val - median));
    const mad = deviations.slice().sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
    
    // Modified Z-score
    const scores = values.map(val => 0.6745 * (val - median) / mad);
    const outliers = scores.map((score, i) => Math.abs(score) > threshold ? i : -1).filter(idx => idx !== -1);
    
    return { outliers, scores, median, mad };
}

/**
 * Seasonal adjustment for time series data
 */
export function seasonalAdjustment(values: number[], period: number): number[] {
    const adjusted: number[] = [];
    const seasonalIndices: number[] = [];
    
    // Calculate seasonal indices
    for (let i = 0; i < period; i++) {
        const seasonalValues = [];
        for (let j = i; j < values.length; j += period) {
            seasonalValues.push(values[j]);
        }
        seasonalIndices[i] = seasonalValues.reduce((sum, val) => sum + val, 0) / seasonalValues.length;
    }
    
    // Apply seasonal adjustment
    for (let i = 0; i < values.length; i++) {
        const seasonalIndex = i % period;
        adjusted[i] = values[i] - seasonalIndices[seasonalIndex];
    }
    
    return adjusted;
}

/**
 * Outlier clustering - prevents too many outliers close together
 */
export function clusterOutliers(outliers: number[], minDistance: number = 5): number[] {
    if (outliers.length === 0) return [];
    
    const sortedOutliers = outliers.slice().sort((a, b) => a - b);
    const clustered: number[] = [sortedOutliers[0]];
    
    for (let i = 1; i < sortedOutliers.length; i++) {
        const lastOutlier = clustered[clustered.length - 1];
        if (sortedOutliers[i] - lastOutlier >= minDistance) {
            clustered.push(sortedOutliers[i]);
        }
    }
    
    return clustered;
}

/**
 * Adaptive threshold based on data characteristics
 */
export function calculateAdaptiveThreshold(
    residuals: number[], 
    sensitivity: 'low' | 'medium' | 'high'
): number {
    const sensitivityMultipliers = { low: 2.5, medium: 3.0, high: 3.5 };
    const multiplier = sensitivityMultipliers[sensitivity];
    
    // Use robust statistics
    const sorted = residuals.slice().sort((a, b) => Math.abs(a) - Math.abs(b));
    const median = sorted[Math.floor(sorted.length / 2)];
    const mad = sorted.slice(0, Math.floor(sorted.length / 2))
        .map(val => Math.abs(val - median))
        .sort((a, b) => a - b)[Math.floor(sorted.length / 4)];
    
    return multiplier * mad;
}

/**
 * Performance metrics for outlier detection
 */
export function calculateDetectionMetrics(
    originalValues: number[],
    detectedOutliers: number[],
    trueOutliers?: number[]
): {
    precision: number;
    recall: number;
    f1Score: number;
    falsePositiveRate: number;
} {
    if (!trueOutliers) {
        // If no ground truth, return basic metrics
        return {
            precision: detectedOutliers.length / originalValues.length,
            recall: 0,
            f1Score: 0,
            falsePositiveRate: 0
        };
    }
    
    const truePositives = detectedOutliers.filter(idx => trueOutliers.includes(idx)).length;
    const falsePositives = detectedOutliers.filter(idx => !trueOutliers.includes(idx)).length;
    const falseNegatives = trueOutliers.filter(idx => !detectedOutliers.includes(idx)).length;
    
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const falsePositiveRate = falsePositives / (falsePositives + trueOutliers.length - truePositives) || 0;
    
    return { precision, recall, f1Score, falsePositiveRate };
}

