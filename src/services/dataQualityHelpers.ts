import Decimal from "decimal.js"
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc);

export function calculateUniquenessScoreFromArray(dataArray: number[] | string[] | Date[] | dayjs.Dayjs[] | undefined) {
    if (dataArray === undefined) {
        return 0;
    }
    const duplicates = new Set();
    const seen = new Set();

    for (const value of dataArray) {
        if (seen.has(value)) {
            duplicates.add(value);
        } else {
            seen.add(value);
        }
    }
    return Math.floor((seen.size / dataArray.length) * 10000) / 100;

}

export function calculateValidityScoreFromArray(epochDataArray: number[], valuesArray: number[], minTime: number, maxTime: number, minValue: number | null | undefined, maxValue: number | null | undefined) {
    // valid count is the count of records that fulfills the following conditions (see WHERE):
    let validCount = 0;
    //check if not equal to undefined and not a number and not a null
    const minValueIsSet = minValue !== undefined && minValue !== null && !isNaN(minValue)
    const maxValueIsSet = maxValue !== undefined && maxValue !== null && !isNaN(maxValue)
    for (let i = 0; i < epochDataArray.length; i++) {
        if (minValueIsSet && maxValueIsSet) {
            if (epochDataArray[i] >= minTime && epochDataArray[i] <= maxTime && valuesArray[i] >= minValue && valuesArray[i] <= maxValue) {
                validCount++;
            }
        } else if (minValueIsSet) {
            if (epochDataArray[i] >= minTime && epochDataArray[i] <= maxTime && valuesArray[i] >= minValue) {
                validCount++;
            }
        } else if (maxValueIsSet) {
            if (epochDataArray[i] >= minTime && epochDataArray[i] <= maxTime && valuesArray[i] <= maxValue) {
                validCount++;
            }
        } else {
            if (epochDataArray[i] >= minTime && epochDataArray[i] <= maxTime) {
                validCount++;
            }

        }
    }
    //return 2f decimal places floored
    //return ((validCount / epochDataArray.length) * 100).toFixed(2) as unknown as number;
    return Math.floor((validCount / epochDataArray.length) * 10000) / 100
}

/**
 * Calculates a timeliness score based on the difference between the latest data timestamp and the current time.
 * 
 * @param latestDataTimestamp - The timestamp of the most recent data point (in milliseconds)
 * @param currentTime - The current time (in milliseconds)
 * @param maxAcceptableDelay - The maximum acceptable delay in milliseconds (default: 24 hours)
 * @returns A timeliness score between 0 and 100
 */
export function calculateTimelinessScore(
  latestDataTimestamp: number,
  currentTime: number,
  maxAcceptableDelay: number = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
): number {
  // Calculate the delay
  const delay = currentTime - latestDataTimestamp;

  // If the delay is negative (future data), return 100
  if (delay < 0) {
    return 100;
  }

  // If the delay is greater than the maximum acceptable delay, return 0
  if (delay > maxAcceptableDelay) {
    return 0;
  }

  // Calculate the score as a percentage of the maximum acceptable delay
  const score = 100 * (1 - delay / maxAcceptableDelay);

  // Round to two decimal places
  return Math.round(score * 100) / 100;
}
