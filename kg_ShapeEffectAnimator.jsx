/*
Shape Effect Animator for Adobe After Effects
- Applies automatic in/out animations to shape layer effects
- Supports: Path Offset, Trim Paths, Twist, Pucker & Bloat
- Animation: Start value -> 0 at inPoint, 0 -> Start value at outPoint
- Stagger option for multiple paths

Install:
1) Save to Scripts folder or ScriptUI Panels folder
2) Run: File > Scripts > kg_ShapeEffectAnimator.jsx
   Or: Window > kg_ShapeEffectAnimator.jsx (if in ScriptUI Panels)

Usage:
1) Select shape layer(s)
2) Configure effects and settings in panel
3) Click Apply
*/

(function (thisObj) {

    var SCRIPT_NAME = "Shape Effect Animator";
    var SCRIPT_VERSION = "1.0.0";

    // ============================================================
    // Localized Strings (Japanese)
    // ============================================================
    var L = {
        // Panel titles
        effectPanel: decodeURI("%E9%81%A9%E7%94%A8%E3%82%A8%E3%83%95%E3%82%A7%E3%82%AF%E3%83%88"), // 適用エフェクト
        trimPanel: decodeURI("%E3%83%88%E3%83%AA%E3%83%9F%E3%83%B3%E3%82%B0%E8%A8%AD%E5%AE%9A"), // トリミング設定
        animPanel: decodeURI("%E3%82%A2%E3%83%8B%E3%83%A1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E8%A8%AD%E5%AE%9A"), // アニメーション設定

        // Effect names
        pathOffset: decodeURI("%E3%83%91%E3%82%B9%E3%81%AE%E3%82%AA%E3%83%95%E3%82%BB%E3%83%83%E3%83%88"), // パスのオフセット
        trimPaths: decodeURI("%E3%83%91%E3%82%B9%E3%81%AE%E3%83%88%E3%83%AA%E3%83%9F%E3%83%B3%E3%82%B0"), // パスのトリミング
        twist: decodeURI("%E6%97%8B%E5%9B%9E"), // 旋回
        puckerBloat: decodeURI("%E3%83%91%E3%83%B3%E3%82%AF%E8%86%A8%E5%BC%B5"), // パンク膨張

        // Labels
        amount: decodeURI("%E9%87%8F:"), // 量:
        useStart: decodeURI("%E9%96%8B%E5%A7%8B%E7%82%B9%E3%82%92%E4%BD%BF%E7%94%A8"), // 開始点を使用
        useEnd: decodeURI("%E7%B5%82%E4%BA%86%E7%82%B9%E3%82%92%E4%BD%BF%E7%94%A8"), // 終了点を使用
        startValue: decodeURI("%E9%96%8B%E5%A7%8B%E5%80%A4:"), // 開始値:
        endValue: decodeURI("%E7%B5%82%E4%BA%86%E5%80%A4:"), // 終了値:
        frameCount: decodeURI("%E3%83%95%E3%83%AC%E3%83%BC%E3%83%A0%E6%95%B0:"), // フレーム数:
        stagger: decodeURI("%E3%81%9A%E3%82%89%E3%81%97%E3%82%A2%E3%83%8B%E3%83%A1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3 (1F/%E3%83%91%E3%82%B9)"), // ずらしアニメーション (1F/パス)
        apply: decodeURI("%E9%81%A9%E7%94%A8"), // 適用

        // Effect control names
        animLength: decodeURI("%E3%82%A2%E3%83%8B%E3%83%A1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3%E9%95%B7%E3%81%95"), // アニメーション長さ
        offsetAmount: decodeURI("%E3%82%AA%E3%83%95%E3%82%BB%E3%83%83%E3%83%88%E9%87%8F"), // オフセット量
        trimStartVal: decodeURI("%E3%83%88%E3%83%AA%E3%83%9F%E3%83%B3%E3%82%B0%E9%96%8B%E5%A7%8B%E5%80%A4"), // トリミング開始値
        trimEndVal: decodeURI("%E3%83%88%E3%83%AA%E3%83%9F%E3%83%B3%E3%82%B0%E7%B5%82%E4%BA%86%E5%80%A4"), // トリミング終了値
        twistAmount: decodeURI("%E6%97%8B%E5%9B%9E%E9%87%8F"), // 旋回量
        pbAmount: decodeURI("%E3%83%91%E3%83%B3%E3%82%AF%E8%86%A8%E5%BC%B5%E9%87%8F"), // パンク膨張量
        staggerChk: decodeURI("%E3%81%9A%E3%82%89%E3%81%97%E3%82%A2%E3%83%8B%E3%83%A1%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3"), // ずらしアニメーション
        slider: decodeURI("%E3%82%B9%E3%83%A9%E3%82%A4%E3%83%80%E3%83%BC"), // スライダー

        // Messages
        noComp: decodeURI("%E3%82%B3%E3%83%B3%E3%83%9D%E3%82%B8%E3%82%B7%E3%83%A7%E3%83%B3%E3%82%92%E3%82%A2%E3%82%AF%E3%83%86%E3%82%A3%E3%83%96%E3%81%AB%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82"), // コンポジションをアクティブにしてください。
        noSelection: decodeURI("%E3%82%B7%E3%82%A7%E3%82%A4%E3%83%97%E3%83%AC%E3%82%A4%E3%83%A4%E3%83%BC%E3%82%92%E9%81%B8%E6%8A%9E%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82"), // シェイプレイヤーを選択してください。
        noEffect: decodeURI("%E5%B0%91%E3%81%AA%E3%81%8F%E3%81%A8%E3%82%821%E3%81%A4%E3%81%AE%E3%82%A8%E3%83%95%E3%82%A7%E3%82%AF%E3%83%88%E3%82%92%E9%81%B8%E6%8A%9E%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82"), // 少なくとも1つのエフェクトを選択してください。
        noTrimOption: decodeURI("%E3%83%88%E3%83%AA%E3%83%9F%E3%83%B3%E3%82%B0%E3%82%92%E4%BD%BF%E7%94%A8%E3%81%99%E3%82%8B%E5%A0%B4%E5%90%88%E3%80%81%E9%96%8B%E5%A7%8B%E7%82%B9%E3%81%BE%E3%81%9F%E3%81%AF%E7%B5%82%E4%BA%86%E7%82%B9%E3%82%92%E9%81%B8%E6%8A%9E%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84%E3%80%82"), // トリミングを使用する場合、開始点または終了点を選択してください。
        notShapeLayer: decodeURI(": %E3%82%B7%E3%82%A7%E3%82%A4%E3%83%97%E3%83%AC%E3%82%A4%E3%83%A4%E3%83%BC%E3%81%A7%E3%81%AF%E3%81%82%E3%82%8A%E3%81%BE%E3%81%9B%E3%82%93%E3%80%82"), // : シェイプレイヤーではありません。
        noContents: decodeURI("%E3%82%B7%E3%82%A7%E3%82%A4%E3%83%97%E3%82%B3%E3%83%B3%E3%83%86%E3%83%B3%E3%83%84%E3%81%8C%E8%A6%8B%E3%81%A4%E3%81%8B%E3%82%8A%E3%81%BE%E3%81%9B%E3%82%93%E3%80%82"), // シェイプコンテンツが見つかりません。
        noGroups: decodeURI("%E3%82%B7%E3%82%A7%E3%82%A4%E3%83%97%E3%82%B0%E3%83%AB%E3%83%BC%E3%83%97%E3%81%8C%E8%A6%8B%E3%81%A4%E3%81%8B%E3%82%8A%E3%81%BE%E3%81%9B%E3%82%93%E3%80%82"), // シェイプグループが見つかりません。
        applied: decodeURI("%E5%80%8B%E3%81%AE%E3%83%AC%E3%82%A4%E3%83%A4%E3%83%BC%E3%81%AB%E3%82%A8%E3%83%95%E3%82%A7%E3%82%AF%E3%83%88%E3%82%92%E9%81%A9%E7%94%A8%E3%81%97%E3%81%BE%E3%81%97%E3%81%9F%E3%80%82"), // 個のレイヤーにエフェクトを適用しました。
        errors: decodeURI("%E3%82%A8%E3%83%A9%E3%83%BC:") // エラー:
    };

    // ============================================================
    // Utility Functions
    // ============================================================

    function getActiveComp() {
        var item = app.project.activeItem;
        if (item && item instanceof CompItem) return item;
        return null;
    }

    /**
     * Find all shape groups recursively
     */
    function findAllShapeGroups(contents, results) {
        if (!results) results = [];
        for (var i = 1; i <= contents.numProperties; i++) {
            var prop = contents.property(i);
            if (prop.matchName === "ADBE Vector Group") {
                results.push(prop);
                var groupContents = prop.property("ADBE Vectors Group");
                if (groupContents) {
                    findAllShapeGroups(groupContents, results);
                }
            }
        }
        return results;
    }

    /**
     * Find specific effect in group contents
     */
    function findEffectInGroup(groupContents, matchName) {
        for (var i = 1; i <= groupContents.numProperties; i++) {
            var prop = groupContents.property(i);
            if (prop.matchName === matchName) {
                return prop;
            }
        }
        return null;
    }

    /**
     * Collect all effects of a specific type from all groups
     */
    function collectEffects(layer, matchName) {
        var results = [];
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return results;

        var groups = findAllShapeGroups(contents);
        for (var i = 0; i < groups.length; i++) {
            var grp = groups[i];
            var groupContents = grp.property("ADBE Vectors Group");
            if (groupContents) {
                var effect = findEffectInGroup(groupContents, matchName);
                if (effect) {
                    results.push({
                        effect: effect,
                        groupName: grp.name,
                        index: i
                    });
                }
            }
        }
        return results;
    }

    /**
     * Add effects to all shape groups (top-level only to avoid complexity)
     */
    function addEffectsToAllGroups(layer, matchName) {
        var comp = layer.containingComp;
        var layerIndex = layer.index;
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return [];

        // Count top-level groups first
        var groupCount = 0;
        for (var i = 1; i <= contents.numProperties; i++) {
            if (contents.property(i).matchName === "ADBE Vector Group") {
                groupCount++;
            }
        }

        // Add effect to each top-level group by index
        for (var idx = 1; idx <= groupCount; idx++) {
            layer = comp.layer(layerIndex);
            contents = layer.property("ADBE Root Vectors Group");

            // Find the idx-th group
            var currentGroupNum = 0;
            for (var j = 1; j <= contents.numProperties; j++) {
                var prop = contents.property(j);
                if (prop.matchName === "ADBE Vector Group") {
                    currentGroupNum++;
                    if (currentGroupNum === idx) {
                        var groupContents = prop.property("ADBE Vectors Group");
                        if (groupContents && groupContents.canAddProperty(matchName)) {
                            var existing = findEffectInGroup(groupContents, matchName);
                            if (!existing) {
                                groupContents.addProperty(matchName);
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Re-acquire and return all effects
        layer = comp.layer(layerIndex);
        return collectEffects(layer, matchName);
    }

    // ============================================================
    // Effect Control Functions
    // ============================================================

    /**
     * Add slider effect control to layer
     */
    function addSliderControl(layer, name, defaultValue) {
        var comp = layer.containingComp;
        var layerIndex = layer.index;
        var fx = layer.property("ADBE Effect Parade");

        var slider = fx.addProperty("ADBE Slider Control");
        slider.name = name;
        slider.property("ADBE Slider Control-0001").setValue(defaultValue);

        return comp.layer(layerIndex);
    }

    /**
     * Add checkbox effect control to layer
     */
    function addCheckboxControl(layer, name, defaultValue) {
        var comp = layer.containingComp;
        var layerIndex = layer.index;
        var fx = layer.property("ADBE Effect Parade");

        var checkbox = fx.addProperty("ADBE Checkbox Control");
        checkbox.name = name;
        if (defaultValue) {
            checkbox.property("ADBE Checkbox Control-0001").setValue(1);
        }

        return comp.layer(layerIndex);
    }

    // ============================================================
    // Expression Generators
    // ============================================================

    /**
     * Generate expression for simple value animation (Offset, Twist, Pucker & Bloat)
     */
    function generateValueExpression(controlName, staggerIndex, totalCount) {
        var expr = [
            "var frameDur = thisComp.frameDuration;",
            "var inP = thisLayer.inPoint;",
            "var outP = thisLayer.outPoint;",
            "var animLen = thisLayer.effect(\"" + L.animLength + "\")(\"" + L.slider + "\").value;",
            "var targetValue = thisLayer.effect(\"" + controlName + "\")(\"" + L.slider + "\").value;",
            "var stagger = thisLayer.effect(\"" + L.staggerChk + "\")(1).value;",
            "var staggerIndex = " + staggerIndex + ";",
            "var totalCount = " + totalCount + ";",
            "",
            "var t = time;",
            "// inPoint: stagger delays later items (index 0 starts first)",
            "var inStaggerOffset = stagger == 1 ? staggerIndex * frameDur : 0;",
            "// outPoint: FIFO - index 0 ends first, last index ends at outPoint",
            "// Reverse offset so last item (totalCount-1) has 0 offset and ends exactly at outPoint",
            "var outStaggerOffset = stagger == 1 ? (totalCount - 1 - staggerIndex) * frameDur : 0;",
            "var inFrame = (t - inP - inStaggerOffset) / frameDur;",
            "var outFramesLeft = (outP - t - outStaggerOffset) / frameDur;",
            "",
            "// Strong cubic easing functions",
            "function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }",
            "function easeInCubic(t) { return t * t * t; }",
            "",
            "var result = 0;",
            "if (inFrame < 0) {",
            "    result = targetValue;",
            "} else if (inFrame < animLen) {",
            "    // inPoint: targetValue -> 0 with strong easeOut",
            "    var progress = easeOutCubic(inFrame / animLen);",
            "    result = targetValue * (1 - progress);",
            "} else if (outFramesLeft < animLen) {",
            "    // outPoint: 0 -> targetValue with strong easeIn",
            "    var outProgress = (animLen - outFramesLeft) / animLen;",
            "    result = targetValue * easeInCubic(outProgress);",
            "} else {",
            "    result = 0;",
            "}",
            "result;"
        ].join("\n");
        return expr;
    }

    /**
     * Generate expression for Trim Paths Start
     * inPoint: stays at 0 (no animation)
     * outPoint: 0 -> 100 (path disappears from start)
     */
    function generateTrimStartExpression(staggerIndex, totalCount) {
        var expr = [
            "var frameDur = thisComp.frameDuration;",
            "var inP = thisLayer.inPoint;",
            "var outP = thisLayer.outPoint;",
            "var animLen = thisLayer.effect(\"" + L.animLength + "\")(\"" + L.slider + "\").value;",
            "var stagger = thisLayer.effect(\"" + L.staggerChk + "\")(1).value;",
            "var staggerIndex = " + staggerIndex + ";",
            "var totalCount = " + totalCount + ";",
            "",
            "var t = time;",
            "// outPoint: FIFO - index 0 ends first, last index ends at outPoint",
            "// Reverse offset so last item (totalCount-1) has 0 offset and ends exactly at outPoint",
            "var outStaggerOffset = stagger == 1 ? (totalCount - 1 - staggerIndex) * frameDur : 0;",
            "var outFramesLeft = (outP - t - outStaggerOffset) / frameDur;",
            "",
            "// Strong cubic easing function",
            "function easeInCubic(t) { return t * t * t; }",
            "",
            "var result = 0;",
            "if (outFramesLeft < animLen) {",
            "    // outPoint: 0 -> 100 (path erases from start) with strong easeIn",
            "    var outProgress = (animLen - outFramesLeft) / animLen;",
            "    result = 100 * easeInCubic(outProgress);",
            "}",
            "result;"
        ].join("\n");
        return expr;
    }

    /**
     * Generate expression for Trim Paths End
     * inPoint: 0 -> 100 (path draws in)
     * outPoint: stays at 100 (no animation)
     */
    function generateTrimEndExpression(staggerIndex, totalCount) {
        var expr = [
            "var frameDur = thisComp.frameDuration;",
            "var inP = thisLayer.inPoint;",
            "var outP = thisLayer.outPoint;",
            "var animLen = thisLayer.effect(\"" + L.animLength + "\")(\"" + L.slider + "\").value;",
            "var stagger = thisLayer.effect(\"" + L.staggerChk + "\")(1).value;",
            "var staggerIndex = " + staggerIndex + ";",
            "var totalCount = " + totalCount + ";",
            "",
            "var t = time;",
            "// inPoint: stagger delays later items",
            "var inStaggerOffset = stagger == 1 ? staggerIndex * frameDur : 0;",
            "var inFrame = (t - inP - inStaggerOffset) / frameDur;",
            "",
            "// Strong cubic easing function",
            "function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }",
            "",
            "var result = 100;",
            "if (inFrame < 0) {",
            "    result = 0;",
            "} else if (inFrame < animLen) {",
            "    // inPoint: 0 -> 100 (path draws in) with strong easeOut",
            "    var progress = easeOutCubic(inFrame / animLen);",
            "    result = 100 * progress;",
            "}",
            "result;"
        ].join("\n");
        return expr;
    }

    /**
     * Generate expression for Twist (continuous rotation: -targetValue -> 0 -> targetValue)
     */
    function generateTwistExpression(controlName, staggerIndex, totalCount) {
        var expr = [
            "var frameDur = thisComp.frameDuration;",
            "var inP = thisLayer.inPoint;",
            "var outP = thisLayer.outPoint;",
            "var animLen = thisLayer.effect(\"" + L.animLength + "\")(\"" + L.slider + "\").value;",
            "var targetValue = thisLayer.effect(\"" + controlName + "\")(\"" + L.slider + "\").value;",
            "var stagger = thisLayer.effect(\"" + L.staggerChk + "\")(1).value;",
            "var staggerIndex = " + staggerIndex + ";",
            "var totalCount = " + totalCount + ";",
            "",
            "var t = time;",
            "// inPoint: stagger delays later items (index 0 starts first)",
            "var inStaggerOffset = stagger == 1 ? staggerIndex * frameDur : 0;",
            "// outPoint: FIFO - index 0 ends first, last index ends at outPoint",
            "var outStaggerOffset = stagger == 1 ? (totalCount - 1 - staggerIndex) * frameDur : 0;",
            "var inFrame = (t - inP - inStaggerOffset) / frameDur;",
            "var outFramesLeft = (outP - t - outStaggerOffset) / frameDur;",
            "",
            "// Strong cubic easing functions",
            "function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }",
            "function easeInCubic(t) { return t * t * t; }",
            "",
            "var result = 0;",
            "if (inFrame < 0) {",
            "    // Before animation: starts at -targetValue",
            "    result = -targetValue;",
            "} else if (inFrame < animLen) {",
            "    // inPoint: -targetValue -> 0 with strong easeOut",
            "    var progress = easeOutCubic(inFrame / animLen);",
            "    result = -targetValue * (1 - progress);",
            "} else if (outFramesLeft < animLen) {",
            "    // outPoint: 0 -> targetValue with strong easeIn",
            "    var outProgress = (animLen - outFramesLeft) / animLen;",
            "    result = targetValue * easeInCubic(outProgress);",
            "} else {",
            "    result = 0;",
            "}",
            "result;"
        ].join("\n");
        return expr;
    }

    // ============================================================
    // Main Apply Function
    // ============================================================

    function applyEffects(layer, options) {
        var comp = layer.containingComp;
        var layerIndex = layer.index;

        // Get shape contents
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) {
            throw new Error(L.noContents);
        }

        // Count groups for stagger
        var groups = findAllShapeGroups(contents);
        var totalCount = groups.length;
        if (totalCount === 0) {
            throw new Error(L.noGroups);
        }

        // Add effect controls to layer
        layer = addSliderControl(layer, L.animLength, options.animLength);

        if (options.applyOffset) {
            layer = addSliderControl(layer, L.offsetAmount, options.offsetAmount);
        }
        if (options.applyTwist) {
            layer = addSliderControl(layer, L.twistAmount, options.twistAmount);
        }
        if (options.applyPuckerBloat) {
            layer = addSliderControl(layer, L.pbAmount, options.puckerBloatAmount);
        }

        if (options.stagger) {
            layer = addCheckboxControl(layer, L.staggerChk, true);
        } else {
            layer = addCheckboxControl(layer, L.staggerChk, false);
        }

        // Add and configure each effect type
        if (options.applyOffset) {
            var offsetEffects = addEffectsToAllGroups(layer, "ADBE Vector Filter - Offset");
            layer = comp.layer(layerIndex);
            offsetEffects = collectEffects(layer, "ADBE Vector Filter - Offset");
            for (var oi = 0; oi < offsetEffects.length; oi++) {
                var offsetProp = offsetEffects[oi].effect.property("ADBE Vector Offset Amount");
                if (offsetProp) {
                    offsetProp.expression = generateValueExpression(L.offsetAmount, oi, totalCount);
                }
            }
        }

        if (options.applyTrim) {
            layer = comp.layer(layerIndex);
            var trimEffects = addEffectsToAllGroups(layer, "ADBE Vector Filter - Trim");
            layer = comp.layer(layerIndex);
            trimEffects = collectEffects(layer, "ADBE Vector Filter - Trim");
            for (var ti = 0; ti < trimEffects.length; ti++) {
                // Start: controls outPoint animation (erase)
                var trimStart = trimEffects[ti].effect.property("ADBE Vector Trim Start");
                if (trimStart) {
                    trimStart.expression = generateTrimStartExpression(ti, totalCount);
                }
                // End: controls inPoint animation (draw)
                var trimEnd = trimEffects[ti].effect.property("ADBE Vector Trim End");
                if (trimEnd) {
                    trimEnd.expression = generateTrimEndExpression(ti, totalCount);
                }
            }
        }

        if (options.applyTwist) {
            layer = comp.layer(layerIndex);
            var twistEffects = addEffectsToAllGroups(layer, "ADBE Vector Filter - Twist");
            layer = comp.layer(layerIndex);
            twistEffects = collectEffects(layer, "ADBE Vector Filter - Twist");
            for (var twi = 0; twi < twistEffects.length; twi++) {
                var twistAngle = twistEffects[twi].effect.property("ADBE Vector Twist Angle");
                if (twistAngle) {
                    twistAngle.expression = generateTwistExpression(L.twistAmount, twi, totalCount);
                }
            }
        }

        if (options.applyPuckerBloat) {
            layer = comp.layer(layerIndex);
            var pbEffects = addEffectsToAllGroups(layer, "ADBE Vector Filter - PB");
            layer = comp.layer(layerIndex);
            pbEffects = collectEffects(layer, "ADBE Vector Filter - PB");
            for (var pbi = 0; pbi < pbEffects.length; pbi++) {
                var pbAmount = pbEffects[pbi].effect.property("ADBE Vector PuckerBloat Amount");
                if (pbAmount) {
                    pbAmount.expression = generateValueExpression(L.pbAmount, pbi, totalCount);
                }
            }
        }
    }

    // ============================================================
    // UI Building
    // ============================================================

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME + " v" + SCRIPT_VERSION, undefined, { resizeable: true });

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 10;
        pal.margins = 10;

        // Header
        var headerGrp = pal.add("group");
        headerGrp.alignment = ["fill", "top"];
        headerGrp.add("statictext", undefined, SCRIPT_NAME);
        headerGrp.add("statictext", undefined, "v" + SCRIPT_VERSION);

        // Effect Selection Panel
        var effectPanel = pal.add("panel", undefined, L.effectPanel);
        effectPanel.alignment = ["fill", "top"];
        effectPanel.alignChildren = ["left", "top"];
        effectPanel.margins = 10;

        var offsetChk = effectPanel.add("checkbox", undefined, L.pathOffset);
        offsetChk.value = true;
        var offsetGrp = effectPanel.add("group");
        offsetGrp.add("statictext", undefined, "  " + L.amount);
        var offsetInput = offsetGrp.add("edittext", undefined, "10");
        offsetInput.characters = 6;

        var trimChk = effectPanel.add("checkbox", undefined, L.trimPaths);
        trimChk.value = true;

        var twistChk = effectPanel.add("checkbox", undefined, L.twist);
        twistChk.value = false;
        var twistGrp = effectPanel.add("group");
        twistGrp.add("statictext", undefined, "  " + L.amount);
        var twistInput = twistGrp.add("edittext", undefined, "90");
        twistInput.characters = 6;

        var pbChk = effectPanel.add("checkbox", undefined, L.puckerBloat);
        pbChk.value = false;
        var pbGrp = effectPanel.add("group");
        pbGrp.add("statictext", undefined, "  " + L.amount);
        var pbInput = pbGrp.add("edittext", undefined, "50");
        pbInput.characters = 6;


        // Animation Settings Panel
        var animPanel = pal.add("panel", undefined, L.animPanel);
        animPanel.alignment = ["fill", "top"];
        animPanel.alignChildren = ["left", "top"];
        animPanel.margins = 10;

        var animLenGrp = animPanel.add("group");
        animLenGrp.add("statictext", undefined, L.frameCount);
        var animLenInput = animLenGrp.add("edittext", undefined, "4");
        animLenInput.characters = 4;
        animLenGrp.add("statictext", undefined, "F");

        var staggerChk = animPanel.add("checkbox", undefined, L.stagger);
        staggerChk.value = false;

        // Apply Button
        var btnGrp = pal.add("group");
        btnGrp.alignment = ["fill", "bottom"];
        var applyBtn = btnGrp.add("button", undefined, L.apply);
        applyBtn.alignment = ["fill", "center"];

        // Button Click Handler
        applyBtn.onClick = function () {
            var comp = getActiveComp();
            if (!comp) {
                alert(L.noComp);
                return;
            }

            var sel = comp.selectedLayers;
            if (!sel || sel.length === 0) {
                alert(L.noSelection);
                return;
            }

            // Validate at least one effect is selected
            if (!offsetChk.value && !trimChk.value && !twistChk.value && !pbChk.value) {
                alert(L.noEffect);
                return;
            }

            // Gather options
            var options = {
                applyOffset: offsetChk.value,
                offsetAmount: parseFloat(offsetInput.text) || 10,
                applyTrim: trimChk.value,
                applyTwist: twistChk.value,
                twistAmount: parseFloat(twistInput.text) || 90,
                applyPuckerBloat: pbChk.value,
                puckerBloatAmount: parseFloat(pbInput.text) || 50,
                animLength: parseFloat(animLenInput.text) || 4,
                stagger: staggerChk.value
            };

            app.beginUndoGroup("Shape Effect Animator");

            var successCount = 0;
            var errors = [];

            for (var i = 0; i < sel.length; i++) {
                var layer = sel[i];
                if (!(layer instanceof ShapeLayer)) {
                    errors.push(layer.name + L.notShapeLayer);
                    continue;
                }

                try {
                    applyEffects(layer, options);
                    successCount++;
                } catch (e) {
                    errors.push(layer.name + ": " + e.toString());
                }
            }

            app.endUndoGroup();

            // Report results
            var msg = successCount + L.applied;
            if (errors.length > 0) {
                msg += "\n\n" + L.errors + "\n" + errors.join("\n");
            }
            alert(msg);
        };

        // Window resize handling
        pal.onResizing = pal.onResize = function () {
            this.layout.resize();
        };

        if (pal instanceof Window) {
            pal.center();
            pal.show();
        } else {
            pal.layout.layout(true);
        }

        return pal;
    }

    // Initialize
    buildUI(thisObj);

})(this);
