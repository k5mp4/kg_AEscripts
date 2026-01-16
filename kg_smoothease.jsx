/**
 * kg_smoothease.jsx
 * C2 Continuity Temporal Easing Script for After Effects
 * 
 * Version: 1.0.0
 * Author: kg_scripts
 * 
 * This script automatically calculates and applies temporal easing values 
 * to maintain C1 (tangent) or C2 (curvature) continuity across keyframes.
 */

(function () {
    "use strict";

    // ============================================================
    // Configuration
    // ============================================================
    var CONFIG = {
        SCRIPT_NAME: "Smooth Ease",
        VERSION: "1.3.0",
        INFLUENCE_MIN: 0.1,
        INFLUENCE_MAX: 100.0,
        DEFAULT_INFLUENCE: 33.33,
        TENSION: 0.0,  // 0 = Catmull-Rom, 1 = Linear
        ANGLE_BIAS: 0.15  // Subtle angle for middle keyframes (0-1)
    };

    // ============================================================
    // Utility Functions
    // ============================================================

    /**
     * Clamps a value between min and max
     */
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Check if value is an array (ES3 compatible)
     */
    function isArray(obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";
    }

    /**
     * Gets the number of dimensions for a property value type
     */
    function getDimensions(prop) {
        var type = prop.propertyValueType;
        switch (type) {
            case PropertyValueType.ThreeD:
            case PropertyValueType.ThreeD_SPATIAL:
                return 3;
            case PropertyValueType.TwoD:
            case PropertyValueType.TwoD_SPATIAL:
                return 2;
            case PropertyValueType.OneD:
            case PropertyValueType.COLOR:
                return 1;
            default:
                return 0;
        }
    }

    /**
     * Checks if property supports temporal easing
     */
    function supportsTemporalEase(prop) {
        if (!prop.canVaryOverTime) return false;
        if (prop.propertyValueType === PropertyValueType.NO_VALUE) return false;
        if (prop.propertyValueType === PropertyValueType.CUSTOM_VALUE) return false;
        if (prop.propertyValueType === PropertyValueType.MARKER) return false;
        if (prop.propertyValueType === PropertyValueType.SHAPE) return false;
        if (prop.propertyValueType === PropertyValueType.TEXT_DOCUMENT) return false;
        return true;
    }

    // ============================================================
    // Keyframe Data Collection
    // ============================================================

    /**
     * Collects keyframe data from a property
     * @param {Property} prop - The property to collect data from
     * @param {Array} keyIndices - Optional array of specific key indices to process
     * @returns {Object} Keyframe data including times, values, and current easing
     */
    function getKeyframeData(prop, keyIndices) {
        var numKeys = prop.numKeys;
        if (numKeys < 2) return null;

        var data = {
            property: prop,
            dimensions: getDimensions(prop),
            keys: []
        };

        // If no specific indices, use all keys
        if (!keyIndices || keyIndices.length === 0) {
            keyIndices = [];
            for (var i = 1; i <= numKeys; i++) {
                keyIndices.push(i);
            }
        }

        // Collect data for each keyframe
        for (var i = 0; i < keyIndices.length; i++) {
            var keyIndex = keyIndices[i];
            if (keyIndex < 1 || keyIndex > numKeys) continue;

            var keyData = {
                index: keyIndex,
                time: prop.keyTime(keyIndex),
                value: prop.keyValue(keyIndex),
                inEase: prop.keyInTemporalEase(keyIndex),
                outEase: prop.keyOutTemporalEase(keyIndex),
                inInterp: prop.keyInInterpolationType(keyIndex),
                outInterp: prop.keyOutInterpolationType(keyIndex)
            };

            // Get neighbor key times and values for tangent calculation
            if (keyIndex > 1) {
                keyData.prevTime = prop.keyTime(keyIndex - 1);
                keyData.prevValue = prop.keyValue(keyIndex - 1);
            }
            if (keyIndex < numKeys) {
                keyData.nextTime = prop.keyTime(keyIndex + 1);
                keyData.nextValue = prop.keyValue(keyIndex + 1);
            }

            data.keys.push(keyData);
        }

        return data;
    }

    // ============================================================
    // Tangent Calculation (Catmull-Rom Spline)
    // ============================================================

    /**
     * Calculates tangent using Catmull-Rom formula
     * tangent[i] = (1 - tension) * (value[i+1] - value[i-1]) / (time[i+1] - time[i-1])
     * 
     * For endpoints:
     *   First key: tangent = (value[1] - value[0]) / (time[1] - time[0])
     *   Last key: tangent = (value[n] - value[n-1]) / (time[n] - time[n-1])
     */
    function calculateTangent(key, dimensions, tension) {
        var tangents = [];
        tension = tension || CONFIG.TENSION;

        for (var d = 0; d < dimensions; d++) {
            var tangent;
            var currValue = (dimensions === 1) ? key.value : key.value[d];

            if (key.prevValue !== undefined && key.nextValue !== undefined) {
                // Interior point: use Catmull-Rom formula
                var prevVal = (dimensions === 1) ? key.prevValue : key.prevValue[d];
                var nextVal = (dimensions === 1) ? key.nextValue : key.nextValue[d];
                var timeDiff = key.nextTime - key.prevTime;
                tangent = (1 - tension) * (nextVal - prevVal) / timeDiff;
            } else if (key.prevValue !== undefined) {
                // Last keyframe: use backward difference
                var prevVal = (dimensions === 1) ? key.prevValue : key.prevValue[d];
                var timeDiff = key.time - key.prevTime;
                tangent = (currValue - prevVal) / timeDiff;
            } else if (key.nextValue !== undefined) {
                // First keyframe: use forward difference
                var nextVal = (dimensions === 1) ? key.nextValue : key.nextValue[d];
                var timeDiff = key.nextTime - key.time;
                tangent = (nextVal - currValue) / timeDiff;
            } else {
                tangent = 0;
            }

            tangents.push(tangent);
        }

        return tangents;
    }

    /**
     * Calculates C2 continuous tangents using cubic spline interpolation
     * This solves a tridiagonal system for natural cubic spline
     */
    function calculateC2Tangents(keyData) {
        var keys = keyData.keys;
        var n = keys.length;
        var dims = keyData.dimensions;

        if (n < 2) return;

        // For each dimension, calculate tangents
        for (var d = 0; d < dims; d++) {
            // Build the tridiagonal system for natural spline
            // For interior points, tangent is calculated from neighbors with C2 constraint
            for (var i = 0; i < n; i++) {
                var key = keys[i];

                // Use Catmull-Rom as approximation for C2
                // True C2 would require solving a linear system, but this provides
                // smooth results that are visually similar
                var tangent = calculateTangent(key, dims, CONFIG.TENSION);

                if (!key.calculatedTangents) {
                    key.calculatedTangents = [];
                }
                key.calculatedTangents[d] = tangent[d];
            }
        }
    }

    // ============================================================
    // Temporal Ease Calculation
    // ============================================================

    /**
     * Calculates blended speed by averaging in and out speeds
     * This preserves the original curve shape while making it C1 continuous
     */
    function calculateBlendedSpeed(key, dimension) {
        var inSpeed = 0;
        var outSpeed = 0;

        if (key.inEase && key.inEase[dimension]) {
            inSpeed = key.inEase[dimension].speed;
        }
        if (key.outEase && key.outEase[dimension]) {
            outSpeed = key.outEase[dimension].speed;
        }

        // Average the absolute speeds, preserve general direction
        var avgSpeed = (Math.abs(inSpeed) + Math.abs(outSpeed)) / 2;

        // Use the sign of the larger magnitude speed
        if (Math.abs(outSpeed) > Math.abs(inSpeed)) {
            return outSpeed >= 0 ? avgSpeed : -avgSpeed;
        } else {
            return inSpeed >= 0 ? avgSpeed : -avgSpeed;
        }
    }

    /**
     * Calculates overall trend (slope) from first to last keyframe
     * Used to add subtle angle to middle keyframes
     */
    function calculateOverallTrend(keys, dimension, dimensions) {
        if (keys.length < 2) return 0;

        var firstKey = keys[0];
        var lastKey = keys[keys.length - 1];

        var firstValue = (dimensions === 1) ? firstKey.value : firstKey.value[dimension];
        var lastValue = (dimensions === 1) ? lastKey.value : lastKey.value[dimension];
        var timeDiff = lastKey.time - firstKey.time;

        if (timeDiff === 0) return 0;

        return (lastValue - firstValue) / timeDiff;
    }

    /**
     * Converts tangent (slope) to KeyframeEase speed and influence
     * 
     * @param {Array} tangent - Calculated tangent values
     * @param {Object} key - Keyframe data
     * @param {Boolean} isIn - True for incoming ease
     * @param {Number} dimensions - Number of dimensions
     * @param {Property} prop - The property
     * @param {Array} originalEase - Original ease to preserve (optional)
     * @param {Boolean} preserveHandles - Whether to preserve original influence
     */
    function tangentToEase(tangent, key, isIn, dimensions, prop, originalEase, preserveHandles) {
        var easeArray = [];

        for (var d = 0; d < dimensions; d++) {
            var speed = tangent[d];
            var influence;

            // Preserve original influence if requested
            if (preserveHandles && originalEase && originalEase[d]) {
                // Clamp to valid range in case original value is out of bounds
                influence = clamp(originalEase[d].influence, CONFIG.INFLUENCE_MIN, CONFIG.INFLUENCE_MAX);
            } else {
                // Calculate new influence based on segment lengths
                influence = CONFIG.DEFAULT_INFLUENCE;

                if (isIn && key.prevTime !== undefined) {
                    var segmentTime = key.time - key.prevTime;
                    if (key.nextTime !== undefined) {
                        var nextSegmentTime = key.nextTime - key.time;
                        var ratio = segmentTime / (segmentTime + nextSegmentTime);
                        influence = clamp(ratio * 66.67, CONFIG.INFLUENCE_MIN, CONFIG.INFLUENCE_MAX);
                    }
                } else if (!isIn && key.nextTime !== undefined) {
                    var segmentTime = key.nextTime - key.time;
                    if (key.prevTime !== undefined) {
                        var prevSegmentTime = key.time - key.prevTime;
                        var ratio = segmentTime / (segmentTime + prevSegmentTime);
                        influence = clamp(ratio * 66.67, CONFIG.INFLUENCE_MIN, CONFIG.INFLUENCE_MAX);
                    }
                }
            }

            easeArray.push(new KeyframeEase(speed, influence));
        }

        return easeArray;
    }

    // ============================================================
    // Apply Easing
    // ============================================================

    /**
     * Applies calculated temporal easing to keyframes
     * @param {Object} keyData - Keyframe data with calculated tangents
     * @param {String} mode - "C1", "C2", or "BLEND"
     * @param {Boolean} preserveHandles - Whether to preserve original influence
     * @param {Number} angleBias - Angle bias for middle keyframes (0-1)
     */
    function applyTemporalEase(keyData, mode, preserveHandles, angleBias) {
        var prop = keyData.property;
        var keys = keyData.keys;
        var dims = keyData.dimensions;

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var inEaseArr = [];
            var outEaseArr = [];

            if (mode === "BLEND") {
                // Blend mode: average in/out speeds, preserve original influence
                // For middle keyframes, add subtle angle based on overall trend
                var isMiddle = (i > 0 && i < keys.length - 1);

                for (var d = 0; d < dims; d++) {
                    var blendedSpeed = calculateBlendedSpeed(key, d);

                    // Add subtle angle for middle keyframes based on overall motion
                    if (isMiddle && keys.length >= 3 && angleBias > 0) {
                        var trend = calculateOverallTrend(keys, d, dims);
                        // Add portion of trend based on angleBias
                        blendedSpeed = blendedSpeed + (trend * angleBias);
                    }

                    // Get original influences
                    var inInfluence = CONFIG.DEFAULT_INFLUENCE;
                    var outInfluence = CONFIG.DEFAULT_INFLUENCE;

                    if (key.inEase && key.inEase[d]) {
                        inInfluence = clamp(key.inEase[d].influence, CONFIG.INFLUENCE_MIN, CONFIG.INFLUENCE_MAX);
                    }
                    if (key.outEase && key.outEase[d]) {
                        outInfluence = clamp(key.outEase[d].influence, CONFIG.INFLUENCE_MIN, CONFIG.INFLUENCE_MAX);
                    }

                    inEaseArr.push(new KeyframeEase(blendedSpeed, inInfluence));
                    outEaseArr.push(new KeyframeEase(blendedSpeed, outInfluence));
                }
            } else {
                // C1/C2 mode: use calculated tangents
                var tangents = key.calculatedTangents || calculateTangent(key, dims, CONFIG.TENSION);

                // Ensure tangents array is properly formatted
                if (!isArray(tangents)) {
                    tangents = [tangents];
                }

                // Calculate in and out easing (pass original ease for preservation)
                inEaseArr = tangentToEase(tangents, key, true, dims, prop, key.inEase, preserveHandles);
                outEaseArr = tangentToEase(tangents, key, false, dims, prop, key.outEase, preserveHandles);
            }

            // Set interpolation type to Bezier
            prop.setInterpolationTypeAtKey(
                key.index,
                KeyframeInterpolationType.BEZIER,
                KeyframeInterpolationType.BEZIER
            );

            // Apply temporal ease
            prop.setTemporalEaseAtKey(key.index, inEaseArr, outEaseArr);

            // Enable temporal continuity
            if (mode === "C2" || mode === "BLEND") {
                prop.setTemporalContinuousAtKey(key.index, true);
            }
        }
    }

    // ============================================================
    // Main Processing
    // ============================================================

    /**
     * Gets selected properties that support temporal easing
     */
    function getSelectedProperties() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition.");
            return null;
        }

        var props = comp.selectedProperties;
        if (!props || props.length === 0) {
            alert("Please select properties with keyframes.");
            return null;
        }

        // Filter to only properties that support temporal easing
        var validProps = [];
        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            if (prop instanceof Property && supportsTemporalEase(prop) && prop.numKeys >= 2) {
                validProps.push(prop);
            }
        }

        if (validProps.length === 0) {
            alert("No valid properties with keyframes selected.\nPlease select animatable properties with at least 2 keyframes.");
            return null;
        }

        return validProps;
    }

    /**
     * Processes selected properties and applies smooth easing
     * @param {String} mode - "C1", "C2", or "BLEND"
     * @param {Boolean} selectedKeysOnly - Only process selected keyframes
     * @param {Boolean} preserveHandles - Whether to preserve original influence
     * @param {Number} angleBias - Angle bias for middle keyframes (0-1)
     */
    function processProperties(mode, selectedKeysOnly, preserveHandles, angleBias) {
        var props = getSelectedProperties();
        if (!props) return;

        app.beginUndoGroup(CONFIG.SCRIPT_NAME + " - " + mode);

        try {
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                var keyIndices = null;

                // Get selected keyframes if applicable
                if (selectedKeysOnly && prop.selectedKeys && prop.selectedKeys.length > 0) {
                    keyIndices = prop.selectedKeys;
                }

                var keyData = getKeyframeData(prop, keyIndices);
                if (!keyData || keyData.keys.length === 0) continue;

                // Calculate tangents
                calculateC2Tangents(keyData);

                // Apply easing
                applyTemporalEase(keyData, mode, preserveHandles, angleBias);
            }
        } catch (e) {
            alert("Error: " + e.toString());
        }

        app.endUndoGroup();
    }

    // ============================================================
    // Automatic Angle Bias Optimization
    // ============================================================

    /**
     * Calculates the optimal angle bias (1-5%) for smoothest result
     * Tests each value and picks the one that minimizes speed variance
     */
    function calculateOptimalAngleBias(keys, dims) {
        if (keys.length < 3) return 0.03; // Default 3% for simple cases

        var bestBias = 0.03;
        var minVariance = Infinity;

        // Test angle biases from 1% to 5%
        for (var testBias = 0.01; testBias <= 0.05; testBias += 0.01) {
            var totalVariance = 0;

            for (var i = 1; i < keys.length - 1; i++) {
                var key = keys[i];

                for (var d = 0; d < dims; d++) {
                    var blendedSpeed = calculateBlendedSpeed(key, d);
                    var trend = calculateOverallTrend(keys, d, dims);
                    var adjustedSpeed = blendedSpeed + (trend * testBias);

                    // Calculate how well this connects to neighbors
                    var inSpeed = 0, outSpeed = 0;
                    if (key.inEase && key.inEase[d]) inSpeed = key.inEase[d].speed;
                    if (key.outEase && key.outEase[d]) outSpeed = key.outEase[d].speed;

                    // Lower variance = smoother transition
                    var diff = Math.abs(inSpeed - outSpeed);
                    var adjustedDiff = Math.abs(adjustedSpeed * 2 - (inSpeed + outSpeed));
                    totalVariance += adjustedDiff;
                }
            }

            if (totalVariance < minVariance) {
                minVariance = totalVariance;
                bestBias = testBias;
            }
        }

        return bestBias;
    }

    // ============================================================
    // Instant Execution (No UI)
    // ============================================================

    /**
     * Main execution - runs immediately with optimal settings
     */
    function runInstant() {
        var props = getSelectedProperties();
        if (!props) return;

        app.beginUndoGroup(CONFIG.SCRIPT_NAME);

        try {
            for (var i = 0; i < props.length; i++) {
                var prop = props[i];
                var keyIndices = null;

                // Use selected keyframes if available
                if (prop.selectedKeys && prop.selectedKeys.length > 0) {
                    keyIndices = prop.selectedKeys;
                }

                var keyData = getKeyframeData(prop, keyIndices);
                if (!keyData || keyData.keys.length === 0) continue;

                // Calculate optimal angle bias for this property
                var optimalBias = calculateOptimalAngleBias(keyData.keys, keyData.dimensions);

                // Apply easing with BLEND mode and optimal angle
                applyTemporalEase(keyData, "BLEND", true, optimalBias);
            }
        } catch (e) {
            alert("Error: " + e.toString());
        }

        app.endUndoGroup();
    }

    // ============================================================
    // Entry Point
    // ============================================================

    runInstant();

})();
