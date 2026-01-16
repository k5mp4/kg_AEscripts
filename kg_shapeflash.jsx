/*
Shape Flash Animation for Adobe After Effects
- Applies a flash-in/out animation to shape layers
- InPoint: 2F stroke only → 2F fill only → nothing
- OutPoint: 4F before fill → 2F before stroke → end
- Effect Controls: Checkbox to override and show fill/stroke

Install:
1) Save to Scripts folder
2) Run: File > Scripts > kg_shapeflash.jsx
   Or run from ExtendScript Toolkit

Usage:
1) Select shape layer(s) with Fill and Stroke
2) Run the script
*/

(function () {

    var SCRIPT_NAME = "Shape Flash Animation";
    var SCRIPT_VERSION = "1.0.0";

    function getActiveComp() {
        var item = app.project.activeItem;
        if (item && item instanceof CompItem) return item;
        return null;
    }

    /**
     * Find ALL Fill properties in shape layer (recursive)
     */
    function findAllFillsInGroup(group, results) {
        if (!results) results = [];
        for (var i = 1; i <= group.numProperties; i++) {
            var prop = group.property(i);
            if (prop.matchName === "ADBE Vector Graphic - Fill") {
                results.push(prop);
            }
            // グループ内を再帰的に検索
            if (prop.matchName === "ADBE Vector Group") {
                var contents = prop.property("ADBE Vectors Group");
                if (contents) {
                    findAllFillsInGroup(contents, results);
                }
            }
        }
        return results;
    }

    /**
     * Find ALL Stroke properties in shape layer (recursive)
     */
    function findAllStrokesInGroup(group, results) {
        if (!results) results = [];
        for (var i = 1; i <= group.numProperties; i++) {
            var prop = group.property(i);
            if (prop.matchName === "ADBE Vector Graphic - Stroke") {
                results.push(prop);
            }
            // グループ内を再帰的に検索
            if (prop.matchName === "ADBE Vector Group") {
                var contents = prop.property("ADBE Vectors Group");
                if (contents) {
                    findAllStrokesInGroup(contents, results);
                }
            }
        }
        return results;
    }

    /**
     * Find ALL shape groups (ADBE Vector Group) in contents (recursive)
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
     * Add stroke to a shape group if it doesn't have one
     */
    function ensureStrokeInGroup(groupContents, fillColor, comp, layerIndex) {
        // グループ内にストロークがあるか確認
        for (var i = 1; i <= groupContents.numProperties; i++) {
            if (groupContents.property(i).matchName === "ADBE Vector Graphic - Stroke") {
                return; // 既にストロークがある
            }
        }
        // ストロークを追加
        if (groupContents.canAddProperty("ADBE Vector Graphic - Stroke")) {
            var newStroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
            // Re-acquire reference
            var layer = comp.layer(layerIndex);
            var contents = layer.property("ADBE Root Vectors Group");
            var strokes = findAllStrokesInGroup(contents);
            if (strokes.length > 0) {
                var lastStroke = strokes[strokes.length - 1];
                lastStroke.property("ADBE Vector Stroke Color").setValue(fillColor);
                lastStroke.property("ADBE Vector Stroke Width").setValue(4);
            }
        }
    }

    /**
     * Add expression-based flash animation to shape layer
     */
    function applyFlashAnimation(layer) {
        var comp = layer.containingComp;
        var layerIndex = layer.index;
        var frameDur = comp.frameDuration;

        // Get shape contents
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) {
            throw new Error("シェイプコンテンツが見つかりません。");
        }

        // Find ALL Fills and Strokes
        var fills = findAllFillsInGroup(contents);
        var strokes = findAllStrokesInGroup(contents);

        if (fills.length === 0) {
            throw new Error("塗りが見つかりません。");
        }

        // 各シェイプグループに線が無い場合は追加する
        var shapeGroups = findAllShapeGroups(contents);
        for (var g = 0; g < shapeGroups.length; g++) {
            var grp = shapeGroups[g];
            var groupContents = grp.property("ADBE Vectors Group");
            if (groupContents) {
                // このグループに塗りがあるか確認
                var hasFill = false;
                var fillColor = [1, 1, 1, 1];
                for (var p = 1; p <= groupContents.numProperties; p++) {
                    var prop = groupContents.property(p);
                    if (prop.matchName === "ADBE Vector Graphic - Fill") {
                        hasFill = true;
                        fillColor = prop.property("ADBE Vector Fill Color").value;
                        break;
                    }
                }
                if (hasFill) {
                    ensureStrokeInGroup(groupContents, fillColor, comp, layerIndex);
                }
            }
        }

        // Re-acquire references after possible stroke additions
        layer = comp.layer(layerIndex);
        contents = layer.property("ADBE Root Vectors Group");
        fills = findAllFillsInGroup(contents);
        strokes = findAllStrokesInGroup(contents);

        if (strokes.length === 0) {
            throw new Error("線を追加できませんでした。");
        }

        // Add Effect Controls
        layer = comp.layer(layerIndex);
        var fx = layer.property("ADBE Effect Parade");

        // Add checkboxes for override
        var showFillChk = fx.addProperty("ADBE Checkbox Control");
        showFillChk.name = "塗りを常に表示";

        layer = comp.layer(layerIndex);
        fx = layer.property("ADBE Effect Parade");
        var showStrokeChk = fx.addProperty("ADBE Checkbox Control");
        showStrokeChk.name = "線を常に表示";

        layer = comp.layer(layerIndex);
        fx = layer.property("ADBE Effect Parade");
        var staggerChk = fx.addProperty("ADBE Checkbox Control");
        staggerChk.name = "ずらしアニメーション";

        layer = comp.layer(layerIndex);
        fx = layer.property("ADBE Effect Parade");
        var staggerReverseChk = fx.addProperty("ADBE Checkbox Control");
        staggerReverseChk.name = "ずらし反転";

        // Re-acquire references
        layer = comp.layer(layerIndex);
        contents = layer.property("ADBE Root Vectors Group");
        fills = findAllFillsInGroup(contents);
        strokes = findAllStrokesInGroup(contents);

        // Total count for reverse calculation
        var totalFills = fills.length;
        var totalStrokes = strokes.length;

        // フレーム時間の変数（エクスプレッション内で使用）
        // デフォルト（Override OFF）:
        //   inPoint: 0-2F 線 → 2-4F 塗り → 中間は非表示
        //   outPoint: 4F前~2F前 塗り → 2F前~end 線
        //
        // 塗りを常に表示（Override）の場合:
        //   inPoint: 0-2F 塗り → 2-4F 線 → 中間は塗り
        //   outPoint: 4F前~2F前 線 → 2F前~end 塗り
        //   これにより IN/OUT 両端でフラッシュアニメーションが見える
        //
        // ずらしアニメーションの場合:
        //   各パスが2Fずつずれてアニメーション開始

        // Fill opacity expression (STAGGER_INDEX and TOTAL_COUNT will be replaced with actual values)
        var fillExprTemplate =
            "var frameDur = thisComp.frameDuration;\n" +
            "var inP = thisLayer.inPoint;\n" +
            "var outP = thisLayer.outPoint;\n" +
            "var showFillOverride = thisLayer.effect(\"塗りを常に表示\")(1).value;\n" +
            "var showStrokeOverride = thisLayer.effect(\"線を常に表示\")(1).value;\n" +
            "var staggerEnabled = thisLayer.effect(\"ずらしアニメーション\")(1).value;\n" +
            "var staggerReverse = thisLayer.effect(\"ずらし反転\")(1).value;\n" +
            "var staggerIndex = STAGGER_INDEX;\n" +
            "var totalCount = TOTAL_COUNT;\n" +
            "\n" +
            "var t = time;\n" +
            "var actualIndex = staggerReverse == 1 ? (totalCount - 1 - staggerIndex) : staggerIndex;\n" +
            "var staggerOffset = staggerEnabled == 1 ? actualIndex * 1 : 0;\n" +
            "var inFrame = Math.floor((t - inP) / frameDur) - staggerOffset;\n" +
            "var outFrame = Math.floor((outP - t) / frameDur);\n" +
            "var result = 0;\n" +
            "\n" +
            "if (showFillOverride == 1) {\n" +
            "    // 塗りを常に表示モード: 塗り→線→塗り(常時)→線→塗り\n" +
            "    // outPoint: 4F前~2F前 線（塗り非表示）、2F前~end 塗り\n" +
            "    if (outFrame < 4 && outFrame >= 2) {\n" +
            "        result = 0; // 線を表示（塗りは非表示）\n" +
            "    } else if (outFrame < 2) {\n" +
            "        result = 100; // 塗り表示\n" +
            "    }\n" +
            "    // inPoint: 0-2F 塗り、2-4F 線（塗り非表示）\n" +
            "    else if (inFrame < 2) {\n" +
            "        result = 100; // 塗り表示\n" +
            "    } else if (inFrame < 4) {\n" +
            "        result = 0; // 線を表示（塗りは非表示）\n" +
            "    }\n" +
            "    // 中間: 塗り常時表示\n" +
            "    else {\n" +
            "        result = 100;\n" +
            "    }\n" +
            "} else if (showStrokeOverride == 1) {\n" +
            "    // 線を常に表示モード: 線→塗り→線(常時)→塗り→線\n" +
            "    // outPoint: 4F前~2F前 塗り（線非表示）、2F前~end 線\n" +
            "    if (outFrame < 4 && outFrame >= 2) {\n" +
            "        result = 100; // 塗り表示\n" +
            "    } else if (outFrame < 2) {\n" +
            "        result = 0; // 線を表示（塗りは非表示）\n" +
            "    }\n" +
            "    // inPoint: 0-2F 線（塗り非表示）、2-4F 塗り\n" +
            "    else if (inFrame < 2) {\n" +
            "        result = 0; // 線を表示（塗りは非表示）\n" +
            "    } else if (inFrame < 4) {\n" +
            "        result = 100; // 塗り表示\n" +
            "    }\n" +
            "    // 中間: 塗り非表示（線のみ）\n" +
            "    else {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "} else {\n" +
            "    // デフォルト: 線→塗り→非表示→塗り→線\n" +
            "    // inFrame < 0 の場合はまだアニメーション開始前なので何も表示しない\n" +
            "    if (inFrame < 0) {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "    // outPoint: 4F前~2F前 塗り、2F前~end 線（塗り非表示）\n" +
            "    else if (outFrame < 4 && outFrame >= 2) {\n" +
            "        result = 100;\n" +
            "    } else if (outFrame < 2) {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "    // inPoint: 0-2F 線（塗り非表示）、2-4F 塗り\n" +
            "    else if (inFrame < 2) {\n" +
            "        result = 0;\n" +
            "    } else if (inFrame < 4) {\n" +
            "        result = 100;\n" +
            "    }\n" +
            "    // 中間: 非表示\n" +
            "    else {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "}\n" +
            "result;";

        // Apply expression to ALL fills with stagger index and total count
        for (var f = 0; f < fills.length; f++) {
            var fillOpacity = fills[f].property("ADBE Vector Fill Opacity");
            if (fillOpacity) {
                var fillExpr = fillExprTemplate.replace("STAGGER_INDEX", String(f)).replace("TOTAL_COUNT", String(totalFills));
                fillOpacity.expression = fillExpr;
            }
        }

        // Stroke opacity expression (STAGGER_INDEX and TOTAL_COUNT will be replaced with actual values)
        var strokeExprTemplate =
            "var frameDur = thisComp.frameDuration;\n" +
            "var inP = thisLayer.inPoint;\n" +
            "var outP = thisLayer.outPoint;\n" +
            "var showFillOverride = thisLayer.effect(\"塗りを常に表示\")(1).value;\n" +
            "var showStrokeOverride = thisLayer.effect(\"線を常に表示\")(1).value;\n" +
            "var staggerEnabled = thisLayer.effect(\"ずらしアニメーション\")(1).value;\n" +
            "var staggerReverse = thisLayer.effect(\"ずらし反転\")(1).value;\n" +
            "var staggerIndex = STAGGER_INDEX;\n" +
            "var totalCount = TOTAL_COUNT;\n" +
            "\n" +
            "var t = time;\n" +
            "var actualIndex = staggerReverse == 1 ? (totalCount - 1 - staggerIndex) : staggerIndex;\n" +
            "var staggerOffset = staggerEnabled == 1 ? actualIndex * 1 : 0;\n" +
            "var inFrame = Math.floor((t - inP) / frameDur) - staggerOffset;\n" +
            "var outFrame = Math.floor((outP - t) / frameDur);\n" +
            "var result = 0;\n" +
            "\n" +
            "if (showFillOverride == 1) {\n" +
            "    // 塗りを常に表示モード: 塗り→線→塗り(常時)→線→塗り\n" +
            "    // outPoint: 4F前~2F前 線表示、2F前~end 塗り（線非表示）\n" +
            "    if (outFrame < 4 && outFrame >= 2) {\n" +
            "        result = 100; // 線表示\n" +
            "    } else if (outFrame < 2) {\n" +
            "        result = 0; // 塗りを表示（線は非表示）\n" +
            "    }\n" +
            "    // inPoint: 0-2F 塗り（線非表示）、2-4F 線表示\n" +
            "    else if (inFrame < 2) {\n" +
            "        result = 0; // 塗りを表示（線は非表示）\n" +
            "    } else if (inFrame < 4) {\n" +
            "        result = 100; // 線表示\n" +
            "    }\n" +
            "    // 中間: 線非表示（塗りのみ）\n" +
            "    else {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "} else if (showStrokeOverride == 1) {\n" +
            "    // 線を常に表示モード: 線→塗り→線(常時)→塗り→線\n" +
            "    // outPoint: 4F前~2F前 塗り（線非表示）、2F前~end 線表示\n" +
            "    if (outFrame < 4 && outFrame >= 2) {\n" +
            "        result = 0; // 塗りを表示（線は非表示）\n" +
            "    } else if (outFrame < 2) {\n" +
            "        result = 100; // 線表示\n" +
            "    }\n" +
            "    // inPoint: 0-2F 線表示、2-4F 塗り（線非表示）\n" +
            "    else if (inFrame < 2) {\n" +
            "        result = 100; // 線表示\n" +
            "    } else if (inFrame < 4) {\n" +
            "        result = 0; // 塗りを表示（線は非表示）\n" +
            "    }\n" +
            "    // 中間: 線常時表示\n" +
            "    else {\n" +
            "        result = 100;\n" +
            "    }\n" +
            "} else {\n" +
            "    // デフォルト: 線→塗り→非表示→塗り→線\n" +
            "    // inFrame < 0 の場合はまだアニメーション開始前なので何も表示しない\n" +
            "    if (inFrame < 0) {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "    // outPoint: 4F前~2F前 塗り（線非表示）、2F前~end 線表示\n" +
            "    else if (outFrame < 4 && outFrame >= 2) {\n" +
            "        result = 0;\n" +
            "    } else if (outFrame < 2) {\n" +
            "        result = 100;\n" +
            "    }\n" +
            "    // inPoint: 0-2F 線表示、2-4F 塗り（線非表示）\n" +
            "    else if (inFrame < 2) {\n" +
            "        result = 100;\n" +
            "    } else if (inFrame < 4) {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "    // 中間: 非表示\n" +
            "    else {\n" +
            "        result = 0;\n" +
            "    }\n" +
            "}\n" +
            "result;";

        // Apply expression to ALL strokes with stagger index and total count
        for (var s = 0; s < strokes.length; s++) {
            var strokeOpacity = strokes[s].property("ADBE Vector Stroke Opacity");
            if (strokeOpacity) {
                var strokeExpr = strokeExprTemplate.replace("STAGGER_INDEX", String(s)).replace("TOTAL_COUNT", String(totalStrokes));
                strokeOpacity.expression = strokeExpr;
            }
        }
    }

    function main() {
        var comp = getActiveComp();
        if (!comp) {
            alert("コンポジションをアクティブにしてください。");
            return;
        }

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            alert("シェイプレイヤーを選択してください。");
            return;
        }

        app.beginUndoGroup("Shape Flash Animation");

        var successCount = 0;
        var errors = [];

        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            if (!(layer instanceof ShapeLayer)) {
                errors.push(layer.name + ": シェイプレイヤーではありません。");
                continue;
            }

            try {
                applyFlashAnimation(layer);
                successCount++;
            } catch (e) {
                errors.push(layer.name + ": " + e.toString());
            }
        }

        app.endUndoGroup();

        // Report results
        var msg = successCount + "個のレイヤーにフラッシュアニメーションを適用しました。";
        if (errors.length > 0) {
            msg += "\n\nエラー:\n" + errors.join("\n");
        }
        alert(msg);
    }

    main();

})();
