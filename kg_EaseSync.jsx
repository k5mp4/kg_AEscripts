/*
Mother Ease Controller for Adobe After Effects
- 2つのキーフレーム間にmotherレイヤーのイージングを適用
- キーフレーム選択後、Applyでエクスプレッションを設定
- motherレイヤーのスライダーでイージングを一括制御

Install:
1) Save as: kg_EaseSync.jsx
2) Put in:
   Windows: C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
   macOS:   /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
3) Restart AE, open: Window > kg_EaseSync
*/

(function MotherEasePanel(thisObj) {

    var SCRIPT_NAME = "Mother Ease";
    var SCRIPT_VERSION = "1.2.0";
    var DEBUG = true;

    // デバッグログ
    var debugLog = [];
    function log(msg) {
        if (DEBUG) {
            debugLog.push(msg);
            $.writeln("[MotherEase] " + msg);
        }
    }
    function showLog() {
        if (DEBUG && debugLog.length > 0) {
            $.writeln("=== Debug Log ===");
            for (var i = 0; i < debugLog.length; i++) {
                $.writeln(debugLog[i]);
            }
        }
    }
    function clearLog() {
        debugLog = [];
    }

    // イージングプレビュー用カラー（Ease_1 〜 Ease_10 対応）
    var PREVIEW_COLORS = [
        [1.00, 0.25, 0.25, 1], // 1 Red
        [1.00, 0.60, 0.10, 1], // 2 Orange
        [0.95, 0.90, 0.10, 1], // 3 Yellow
        [0.25, 0.85, 0.25, 1], // 4 Green
        [0.10, 0.85, 0.75, 1], // 5 Teal
        [0.10, 0.55, 1.00, 1], // 6 Blue
        [0.55, 0.10, 1.00, 1], // 7 Purple
        [1.00, 0.10, 0.75, 1], // 8 Pink
        [0.70, 0.70, 0.70, 1], // 9 Gray
        [1.00, 1.00, 1.00, 1]  // 10 White
    ];

    // イージングプリセット定義
    var EASE_PRESETS = [
        { name: "Ease_1", inSpeed: 0, inInfluence: 33.33, outSpeed: 0, outInfluence: 33.33 },
        { name: "Ease_2", inSpeed: 0, inInfluence: 0.1, outSpeed: 0, outInfluence: 75 },
        { name: "Ease_3", inSpeed: 0, inInfluence: 75, outSpeed: 0, outInfluence: 0.1 },
        { name: "Ease_4", inSpeed: 0, inInfluence: 0.1, outSpeed: 0, outInfluence: 0.1 },
        { name: "Ease_5", inSpeed: 0, inInfluence: 80, outSpeed: 0, outInfluence: 80 },
        { name: "Ease_6", inSpeed: 0, inInfluence: 50, outSpeed: 0, outInfluence: 50 },
        { name: "Ease_7", inSpeed: 0, inInfluence: 90, outSpeed: 0, outInfluence: 90 },
        { name: "Ease_8", inSpeed: 0, inInfluence: 0.1, outSpeed: 0, outInfluence: 50 },
        { name: "Ease_9", inSpeed: 0, inInfluence: 50, outSpeed: 0, outInfluence: 0.1 },
        { name: "Ease_10", inSpeed: 0, inInfluence: 66.67, outSpeed: 0, outInfluence: 66.67 }
    ];

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        if (pal !== null) {
            pal.orientation = "column";
            pal.alignChildren = ["fill", "top"];

            // Header
            var header = pal.add("group");
            header.orientation = "row";
            header.add("statictext", undefined, SCRIPT_NAME);
            header.add("statictext", undefined, "v" + SCRIPT_VERSION);

            // Info Panel
            var infoPanel = pal.add("panel", undefined, "How to Use");
            infoPanel.alignChildren = ["left", "top"];
            infoPanel.margins = 10;
            var infoText = infoPanel.add("statictext", undefined,
                "1. Create Mother (motherレイヤー作成)\n" +
                "2. プロパティの2つのキーフレームを選択\n" +
                "3. Apply Ease (エクスプレッション適用)",
                { multiline: true });
            infoText.preferredSize = [220, 60];

            // Mother Layer Panel
            var motherPanel = pal.add("panel", undefined, "Mother Layer");
            motherPanel.orientation = "column";
            motherPanel.alignChildren = ["fill", "top"];

            var nameRow = motherPanel.add("group");
            nameRow.orientation = "row";
            nameRow.add("statictext", undefined, "Layer Name:");
            var motherNameTxt = nameRow.add("edittext", undefined, "mother");
            motherNameTxt.characters = 12;

            var createMotherBtn = motherPanel.add("button", undefined, "Create Mother");

            // Duplicate Panel
            var dupPanel = pal.add("panel", undefined, "Duplicate Mother");
            dupPanel.orientation = "column";
            dupPanel.alignChildren = ["fill", "top"];

            var dupBtn = dupPanel.add("button", undefined, "Duplicate to Other Comps");
            dupBtn.helpTip =
                "現在のコンポジションの motherレイヤーを\n" +
                "選択した他のコンポジションに複製します。\n" +
                "複製先の同名レイヤーはスキップされます。";

            dupBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) { alert("コンポジションをアクティブにしてください。"); return; }

                var motherName = motherNameTxt.text || "mother";
                var motherLayer = findMotherLayer(comp, motherName);
                if (!motherLayer) {
                    alert("\"" + motherName + "\" レイヤーが見つかりません。\n先に「Create Mother」で作成してください。");
                    return;
                }

                var otherComps = getOtherComps(comp);
                if (otherComps.length === 0) {
                    alert("プロジェクトに他のコンポジションがありません。");
                    return;
                }

                app.beginUndoGroup("Duplicate Mother Layer");

                var succeeded = [], skipped = [];
                for (var i = 0; i < otherComps.length; i++) {
                    var result = duplicateMotherToComp(motherLayer, otherComps[i]);
                    if (result) {
                        succeeded.push(otherComps[i].name);
                    } else {
                        skipped.push(otherComps[i].name);
                    }
                }

                app.endUndoGroup();

                var msg = succeeded.length + " 個のコンポジションに複製しました。";
                if (skipped.length > 0) {
                    msg += "\n\nスキップ (同名レイヤーあり):\n" + skipped.join("\n");
                }
                alert(msg);
            };

            // Apply Panel
            var applyPanel = pal.add("panel", undefined, "Apply");
            applyPanel.orientation = "column";
            applyPanel.alignChildren = ["fill", "top"];

            // イージング選択ドロップダウン
            var easeRow = applyPanel.add("group");
            easeRow.orientation = "row";
            easeRow.add("statictext", undefined, "Default Ease:");
            var easeDropdown = easeRow.add("dropdownlist", undefined, [
                "Ease_1", "Ease_2", "Ease_3", "Ease_4", "Ease_5",
                "Ease_6", "Ease_7", "Ease_8", "Ease_9", "Ease_10"
            ]);
            easeDropdown.selection = 0;

            var applyBtn = applyPanel.add("button", undefined, "Apply Ease to Selected Keyframes");

            // Remove Panel
            var removePanel = pal.add("panel", undefined, "Remove");
            removePanel.orientation = "column";
            removePanel.alignChildren = ["fill", "top"];

            var removeBtn = removePanel.add("button", undefined, "Remove Ease Expression");

            // ===== Helper Functions =====

            function getActiveComp() {
                var item = app.project.activeItem;
                if (item && item instanceof CompItem) return item;
                return null;
            }

            function findMotherLayer(comp, motherName) {
                for (var i = 1; i <= comp.numLayers; i++) {
                    if (comp.layer(i).name === motherName) {
                        return comp.layer(i);
                    }
                }
                return null;
            }

            // レイヤーからプロパティを取得するヘルパー
            function getLayerFromProperty(prop) {
                var current = null;
                try {
                    current = prop.propertyGroup(prop.propertyDepth);
                } catch (e) {
                    current = null;
                }

                if (current && typeof current.index === "number" && current.containingComp !== undefined) {
                    return current;
                }

                current = prop;
                while (current) {
                    try {
                        current = current.propertyGroup(1);
                    } catch (e2) {
                        current = null;
                    }

                    if (current && typeof current.index === "number" && current.containingComp !== undefined) {
                        return current;
                    }
                }
                return null;
            }

            // プロパティへのパスを取得（matchNameの配列）
            function getPropertyPath(prop) {
                var path = [];
                var current = prop;
                try {
                    while (current && current.propertyDepth > 0) {
                        path.unshift(current.matchName);
                        current = current.propertyGroup(1);
                    }
                } catch (e) {
                    // エラー処理
                }
                return path;
            }

            // パスからプロパティを再取得
            function findPropertyByPath(layer, path) {
                var current = layer;
                try {
                    for (var i = 0; i < path.length; i++) {
                        current = current.property(path[i]);
                        if (!current) return null;
                    }
                    return current;
                } catch (e) {
                    return null;
                }
            }

            // ===== Duplicate Helpers =====

            /**
             * プロジェクト内の全 CompItem を返す（currentComp を除外）
             */
            function getOtherComps(currentComp) {
                var comps = [];
                for (var i = 1; i <= app.project.numItems; i++) {
                    var item = app.project.item(i);
                    if (item instanceof CompItem && item !== currentComp) {
                        comps.push(item);
                    }
                }
                return comps;
            }

            /**
             * motherLayer を targetComp に複製しレイヤー最上部に配置する。
             * 同名レイヤーが既存の場合は null を返す（スキップ）。
             * スライダー効果のキーフレーム・イージングも完全コピー。
             */
            function duplicateMotherToComp(motherLayer, targetComp) {
                // 同名チェック
                for (var li = 1; li <= targetComp.numLayers; li++) {
                    if (targetComp.layer(li).name === motherLayer.name) return null;
                }

                var newNull = targetComp.layers.addNull(); // index 1 に追加
                newNull.name  = motherLayer.name;
                newNull.label = motherLayer.label;
                newNull.inPoint  = targetComp.displayStartTime;
                newNull.outPoint = targetComp.displayStartTime + targetComp.duration;

                var nullIdx  = newNull.index;
                var sourceFx = motherLayer.property("ADBE Effect Parade");

                for (var ei = 1; ei <= sourceFx.numProperties; ei++) {
                    var srcEffect = sourceFx.property(ei);

                    // エフェクト追加（追加後はインデックスで再取得）
                    targetComp.layer(nullIdx).property("ADBE Effect Parade")
                              .addProperty(srcEffect.matchName).name = srcEffect.name;

                    var tgtFx     = targetComp.layer(nullIdx).property("ADBE Effect Parade");
                    var tgtEffect = tgtFx.property(srcEffect.name);

                    var srcSlider = srcEffect.property("ADBE Slider Control-0001");
                    var tgtSlider = tgtEffect.property("ADBE Slider Control-0001");

                    if (srcSlider.numKeys > 0) {
                        // キーフレーム値をコピー
                        for (var ki = 1; ki <= srcSlider.numKeys; ki++) {
                            tgtSlider.setValueAtTime(
                                srcSlider.keyTime(ki), srcSlider.keyValue(ki)
                            );
                        }
                        // イージング・補間タイプをコピー
                        for (var ki = 1; ki <= tgtSlider.numKeys; ki++) {
                            try {
                                tgtSlider.setInterpolationTypeAtKey(
                                    ki,
                                    srcSlider.keyInInterpolationType(ki),
                                    srcSlider.keyOutInterpolationType(ki)
                                );
                                tgtSlider.setTemporalEaseAtKey(
                                    ki,
                                    srcSlider.keyInTemporalEase(ki),
                                    srcSlider.keyOutTemporalEase(ki)
                                );
                            } catch (e) {}
                        }
                    } else {
                        tgtSlider.setValue(srcSlider.value);
                    }
                }

                targetComp.layer(nullIdx).moveToBeginning();
                return targetComp.layer(1);
            }

            // ===== Create Mother Button =====
            createMotherBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) {
                    alert("コンポジションをアクティブにしてください。");
                    return;
                }

                var motherName = motherNameTxt.text || "mother";

                // 既存のmotherレイヤーをチェック
                var existingMother = findMotherLayer(comp, motherName);
                if (existingMother) {
                    alert("\"" + motherName + "\" レイヤーは既に存在します。");
                    return;
                }

                app.beginUndoGroup("Create Mother Layer");

                try {
                    // ヌルレイヤーを作成
                    var motherLayer = comp.layers.addNull();
                    motherLayer.name = motherName;
                    motherLayer.label = 11; // オレンジ色

                    var fx = motherLayer.property("ADBE Effect Parade");

                    // 10個のイージングスライダーを作成
                    for (var i = 0; i < EASE_PRESETS.length; i++) {
                        var preset = EASE_PRESETS[i];
                        var slider = fx.addProperty("ADBE Slider Control");
                        slider.name = preset.name;

                        // スライダーにキーフレームを設定（0から1へ）
                        var sliderProp = fx.property(preset.name).property("スライダー");
                        sliderProp.setValueAtTime(0, 0);
                        sliderProp.setValueAtTime(1, 1);

                        // 各プリセットのイージングを適用
                        var easeIn = new KeyframeEase(preset.inSpeed, preset.inInfluence);
                        var easeOut = new KeyframeEase(preset.outSpeed, preset.outInfluence);
                        sliderProp.setTemporalEaseAtKey(1, [easeIn], [easeOut]);
                        sliderProp.setTemporalEaseAtKey(2, [easeIn], [easeOut]);
                    }

                    // ===== Ease Preview Shape Layer (単一レイヤー・ガイド) =====
                    // 全 Ease の円を 1 枚のシェイプレイヤーにまとめ、ガイドレイヤーとして生成。
                    // 各グループトランスフォームの Position にエクスプレッションを設定。
                    // レイヤー原点をコンプ左上 [0,0] に固定することでグループ座標 = コンプ座標にする。
                    var numEases = EASE_PRESETS.length;
                    // 1/4 縮小: 使用エリア = コンプ左上 2%〜27% の正方形
                    var radius   = Math.max(3, Math.round(comp.height * 0.25 / (numEases + 1) * 0.4));

                    var prevLayer = comp.layers.addShape();
                    prevLayer.name       = "Ease Preview";
                    prevLayer.label      = 2;
                    prevLayer.inPoint    = comp.displayStartTime;
                    prevLayer.outPoint   = comp.displayStartTime + comp.duration;
                    prevLayer.guideLayer = true;

                    // レイヤー原点をコンプ左上に合わせる（グループ座標 ≒ コンプ座標）
                    prevLayer.transform.anchorPoint.setValue([0, 0]);
                    prevLayer.transform.position.setValue([0, 0]);

                    var prevLayerIdx = prevLayer.index;

                    for (var p = 0; p < numEases; p++) {
                        var pr   = EASE_PRESETS[p];
                        var yPos = comp.height * (0.02 + 0.25 * (p + 1) / (numEases + 1));

                        // 毎回 contents を再取得（addProperty 後の参照失効を防ぐ）
                        var cts = comp.layer(prevLayerIdx).property("ADBE Root Vectors Group");
                        cts.addProperty("ADBE Vector Group").name = pr.name;

                        // グループを名前で再取得
                        var grp2 = comp.layer(prevLayerIdx)
                                       .property("ADBE Root Vectors Group")
                                       .property(pr.name);
                        var gc = grp2.property("ADBE Vectors Group");

                        // Ellipse
                        gc.addProperty("ADBE Vector Shape - Ellipse");
                        var ell = comp.layer(prevLayerIdx)
                                      .property("ADBE Root Vectors Group")
                                      .property(pr.name)
                                      .property("ADBE Vectors Group")
                                      .property(1); // Ellipse は最初に追加したので index 1
                        ell.property("ADBE Vector Ellipse Size").setValue([radius * 2, radius * 2]);

                        // Fill
                        comp.layer(prevLayerIdx)
                            .property("ADBE Root Vectors Group")
                            .property(pr.name)
                            .property("ADBE Vectors Group")
                            .addProperty("ADBE Vector Graphic - Fill")
                            .property("ADBE Vector Fill Color")
                            .setValue(PREVIEW_COLORS[p]);

                        // グループトランスフォームの Position にエクスプレッション
                        var grpPos = comp.layer(prevLayerIdx)
                                        .property("ADBE Root Vectors Group")
                                        .property(pr.name)
                                        .property("ADBE Vector Transform Group")
                                        .property("ADBE Vector Position");
                        grpPos.setValue([comp.width * 0.02, yPos]);
                        grpPos.expression =
                            "var m      = thisComp.layer(\"" + motherName + "\");\n" +
                            "var slider = m.effect(\"" + pr.name + "\")(1);\n" +
                            "var t1     = slider.key(1).time;\n" +
                            "var t2     = slider.key(slider.numKeys).time;\n" +
                            "var dur    = t2 - t1;\n" +
                            "var loopT  = t1 + ((time - t1) % dur);\n" +
                            "var t      = slider.valueAtTime(loopT);\n" +
                            "var l = thisComp.width * 0.02;\n" +
                            "var r = thisComp.width * 0.27;\n" +
                            "var y = thisComp.height * " + (0.02 + 0.25 * (p + 1) / (numEases + 1)) + ";\n" +
                            "[l + (r - l) * t, y];";
                    }

                    // mother を最上部に戻す
                    var refreshedMother = findMotherLayer(comp, motherName);
                    if (refreshedMother) refreshedMother.moveToBeginning();

                    motherLayer.selected = true;

                    log("Mother layer created: " + motherName);

                } catch (e) {
                    alert("エラーが発生しました: " + e.toString());
                }

                app.endUndoGroup();
            };

            // ===== Apply Ease Button =====
            applyBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) {
                    alert("コンポジションをアクティブにしてください。");
                    return;
                }

                var motherName = motherNameTxt.text || "mother";
                var motherLayer = findMotherLayer(comp, motherName);

                if (!motherLayer) {
                    alert("\"" + motherName + "\" レイヤーが見つかりません。\n\n" +
                        "先に「Create Mother」ボタンでmotherレイヤーを作成してください。");
                    return;
                }

                // 選択されたプロパティを取得
                var selectedProps = comp.selectedProperties || [];
                if (selectedProps.length === 0) {
                    alert("プロパティを選択してください。\n\n" +
                        "タイムラインでキーフレームが設定されたプロパティを選択してください。");
                    return;
                }

                app.beginUndoGroup("Apply Mother Ease");

                clearLog();
                log("=== Apply Mother Ease Started ===");

                var appliedCount = 0;
                var errorMessages = [];

                // 選択されたイージング番号を取得（1-5）
                var selectedEaseIndex = easeDropdown.selection ? easeDropdown.selection.index + 1 : 1;
                log("Selected ease index: " + selectedEaseIndex);
                log("Selected properties count: " + selectedProps.length);

                try {
                    // Phase 1: プロパティ情報を収集（DOM操作前）
                    log("--- Phase 1: Collecting property info ---");
                    var propDataList = [];

                    for (var i = 0; i < selectedProps.length; i++) {
                        var prop = selectedProps[i];
                        log("Prop " + i + ": " + prop.name + " (type: " + prop.propertyType + ")");

                        // プロパティかどうかチェック
                        if (prop.propertyType !== PropertyType.PROPERTY) {
                            log("  -> Skipped: not a PROPERTY");
                            continue;
                        }

                        // エクスプレッション設定可能かチェック
                        if (!prop.canSetExpression) {
                            log("  -> Skipped: canSetExpression=false");
                            continue;
                        }

                        // キーフレーム数をチェック
                        log("  numKeys: " + prop.numKeys);
                        if (prop.numKeys < 2) {
                            errorMessages.push(prop.name + ": キーフレームが2つ以上必要です。");
                            log("  -> Skipped: numKeys < 2");
                            continue;
                        }

                        // 選択されているキーフレームを取得
                        var selectedKeys = prop.selectedKeys;
                        log("  selectedKeys: " + (selectedKeys ? selectedKeys.join(",") : "null"));
                        if (!selectedKeys || selectedKeys.length < 2) {
                            // キーフレームが選択されていない場合、最初と最後のキーを使用
                            selectedKeys = [1, prop.numKeys];
                            log("  -> Using default keys: " + selectedKeys.join(","));
                        }

                        // 選択キーが2つ未満の場合はスキップ
                        if (selectedKeys.length < 2) {
                            errorMessages.push(prop.name + ": 2つ以上のキーフレームを選択してください。");
                            log("  -> Skipped: less than 2 keys selected");
                            continue;
                        }

                        // レイヤーを取得
                        var layer = getLayerFromProperty(prop);
                        if (!layer) {
                            errorMessages.push(prop.name + ": レイヤーが取得できません。");
                            log("  -> Skipped: layer not found");
                            continue;
                        }
                        log("  layer: " + layer.name + " (index: " + layer.index + ")");

                        // プロパティパスを保存
                        var propPath = getPropertyPath(prop);
                        log("  propPath: " + propPath.join(" > "));

                        // 連続するキーフレームペアごとにpropDataListに追加
                        for (var ki = 0; ki < selectedKeys.length - 1; ki++) {
                            var keyIndex1 = selectedKeys[ki];
                            var keyIndex2 = selectedKeys[ki + 1];
                            var keyTime1 = prop.keyTime(keyIndex1);
                            var keyTime2 = prop.keyTime(keyIndex2);
                            log("  keyPair: " + keyIndex1 + "-" + keyIndex2 + " (time: " + keyTime1 + "-" + keyTime2 + ")");

                            propDataList.push({
                                layerIndex: layer.index,
                                propPath: propPath,
                                propName: prop.name,
                                keyIndex1: keyIndex1,
                                keyIndex2: keyIndex2,
                                keyTime1: keyTime1,
                                keyTime2: keyTime2
                            });
                            log("  -> Added keyPair to propDataList");
                        }
                    }

                    log("propDataList.length: " + propDataList.length);

                    // Phase 2: 各プロパティにスライダーを追加し、エクスプレッションを適用
                    log("--- Phase 2: Adding sliders and expressions ---");

                    for (var j = 0; j < propDataList.length; j++) {
                        var propData = propDataList[j];
                        var layerIndex = propData.layerIndex;

                        log("Processing: " + propData.propName + " (key " + propData.keyIndex1 + "-" + propData.keyIndex2 + ")");

                        // スライダー名を生成（プロパティ名とキー番号を含む）
                        var sliderName = "ME_" + propData.propName + "_K" + propData.keyIndex1 + "-" + propData.keyIndex2;
                        log("  sliderName: " + sliderName);

                        // レイヤーを取得
                        var layer = comp.layer(layerIndex);
                        var layerFx = layer.property("ADBE Effect Parade");

                        // 同名スライダーがあるかチェック、あれば連番を付ける
                        var finalSliderName = sliderName;
                        var counter = 1;
                        while (layerFx.property(finalSliderName)) {
                            counter++;
                            finalSliderName = sliderName + "_" + counter;
                        }
                        log("  finalSliderName: " + finalSliderName);

                        // スライダーを追加
                        log("  Adding slider...");
                        var slider = layerFx.addProperty("ADBE Slider Control");
                        slider.name = finalSliderName;
                        log("  Slider added");

                        // レイヤーを再取得してスライダーの値を設定
                        layer = comp.layer(layerIndex);
                        layerFx = layer.property("ADBE Effect Parade");
                        var sliderProp = layerFx.property(finalSliderName).property("ADBE Slider Control-0001");
                        sliderProp.setValue(selectedEaseIndex);
                        log("  Slider value set: " + selectedEaseIndex);

                        // スライダー名をpropDataに保存
                        propData.sliderName = finalSliderName;
                    }

                    // Phase 3: プロパティを再取得してエクスプレッションを適用
                    log("--- Phase 3: Applying expressions ---");
                    for (var k = 0; k < propDataList.length; k++) {
                        var propData = propDataList[k];
                        log("Applying to: " + propData.propName);
                        log("  layerIndex: " + propData.layerIndex);
                        log("  propPath: " + propData.propPath.join(" > "));
                        log("  sliderName: " + propData.sliderName);

                        // レイヤーとプロパティを再取得
                        var targetLayer = comp.layer(propData.layerIndex);
                        log("  targetLayer: " + (targetLayer ? targetLayer.name : "null"));

                        var targetProp = findPropertyByPath(targetLayer, propData.propPath);
                        log("  targetProp: " + (targetProp ? targetProp.name : "null"));

                        if (!targetProp) {
                            errorMessages.push(propData.propName + ": プロパティの再取得に失敗しました。");
                            log("  -> ERROR: Could not find property by path");
                            continue;
                        }

                        // 既存のエクスプレッションを取得
                        var existingExpr = "";
                        try {
                            existingExpr = targetProp.expression || "";
                        } catch (e) {
                            existingExpr = "";
                        }
                        log("  existingExpr length: " + existingExpr.length);
                        log("  has Mother Ease: " + (existingExpr.indexOf("// Mother Ease Controller") !== -1));

                        // エクスプレッションを生成（既存エクスプレッションを渡す）
                        var expression = generateEaseExpression(
                            motherName,
                            propData.keyTime1,
                            propData.keyTime2,
                            propData.keyIndex1,
                            propData.keyIndex2,
                            propData.sliderName,
                            existingExpr
                        );
                        log("  Expression generated (length: " + expression.length + ")");

                        // エクスプレッションを適用
                        try {
                            targetProp.expression = expression;
                            appliedCount++;
                            log("  -> Expression applied successfully");
                        } catch (exprError) {
                            log("  -> ERROR applying expression: " + exprError.toString());
                            errorMessages.push(propData.propName + ": " + exprError.toString());
                        }
                    }

                    log("=== Completed: " + appliedCount + " applied ===");

                    if (errorMessages.length > 0) {
                        showLog();
                        alert("エラーが発生しました:\n" + errorMessages.join("\n"));
                    }

                } catch (e) {
                    log("FATAL ERROR: " + e.toString());
                    log("Line: " + (e.line || "unknown"));
                    showLog();
                    alert("エラーが発生しました: " + e.toString());
                }

                app.endUndoGroup();
            };

            // ===== Remove Ease Button =====
            removeBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) {
                    alert("コンポジションをアクティブにしてください。");
                    return;
                }

                // 選択されたプロパティを取得
                var selectedProps = comp.selectedProperties || [];
                if (selectedProps.length === 0) {
                    alert("エクスプレッションを削除するプロパティを選択してください。");
                    return;
                }

                app.beginUndoGroup("Remove Mother Ease");

                var removedCount = 0;

                try {
                    for (var i = 0; i < selectedProps.length; i++) {
                        var prop = selectedProps[i];

                        if (prop.propertyType !== PropertyType.PROPERTY) {
                            continue;
                        }

                        if (!prop.canSetExpression) {
                            continue;
                        }

                        // Mother Easeエクスプレッションかチェック
                        if (prop.expression && prop.expression.indexOf("// Mother Ease Controller") !== -1) {
                            prop.expression = "";
                            removedCount++;
                        }
                    }

                } catch (e) {
                    alert("エラーが発生しました: " + e.toString());
                }

                app.endUndoGroup();
            };

            // ===== Expression Generator =====
            // 既存のエクスプレッションに新しいキーフレームペアを追加
            function generateEaseExpression(motherName, keyTime1, keyTime2, keyIndex1, keyIndex2, sliderName, existingExpr) {
                // 新しいキーフレームペアのブロック
                // Motherのスライダーに2つ以上のキーフレームがあっても対応（バウンス等）
                var newBlock = [
                    "// [" + sliderName + "] Key " + keyIndex1 + "-" + keyIndex2,
                    "if (result === null) {",
                    "    var t1_" + keyIndex1 + "_" + keyIndex2 + " = key(" + keyIndex1 + ").time;",
                    "    var t2_" + keyIndex1 + "_" + keyIndex2 + " = key(" + keyIndex2 + ").time;",
                    "    if (time >= t1_" + keyIndex1 + "_" + keyIndex2 + " && time <= t2_" + keyIndex1 + "_" + keyIndex2 + ") {",
                    "        var easeNum = Math.round(clamp(thisLayer.effect(\"" + sliderName + "\")(1).value, 1, 10));",
                    "        var easeName = \"Ease_\" + easeNum;",
                    "        var slider = motherLayer.effect(easeName)(\"スライダー\");",
                    "        var P1 = key(" + keyIndex1 + ").value;",
                    "        var P2 = key(" + keyIndex2 + ").value;",
                    "        var progress = (time - t1_" + keyIndex1 + "_" + keyIndex2 + ") / (t2_" + keyIndex1 + "_" + keyIndex2 + " - t1_" + keyIndex1 + "_" + keyIndex2 + ");",
                    "        // Motherスライダーの最初と最後のキーを取得（複数キー対応）",
                    "        var mNumKeys = slider.numKeys;",
                    "        var mKey1 = slider.key(1).time;",
                    "        var mKey2 = slider.key(mNumKeys).time;",
                    "        var motherTime = mKey1 + progress * (mKey2 - mKey1);",
                    "        var easeValue = slider.valueAtTime(motherTime);",
                    "        result = P1 + (P2 - P1) * easeValue;",
                    "    }",
                    "}",
                    ""
                ].join("\n");

                if (existingExpr && existingExpr.indexOf("// Mother Ease Controller") !== -1) {
                    // 既存のMother Easeエクスプレッションに追加
                    // "// === END BLOCKS ===" の前に新しいブロックを挿入
                    var endMarker = "// === END BLOCKS ===";
                    var insertPos = existingExpr.indexOf(endMarker);
                    if (insertPos !== -1) {
                        return existingExpr.slice(0, insertPos) + newBlock + existingExpr.slice(insertPos);
                    }
                }

                // 新規エクスプレッション作成
                var expr = [
                    "// Mother Ease Controller",
                    "// Mother: \"" + motherName + "\"",
                    "",
                    "try {",
                    "    var motherLayer = thisComp.layer(\"" + motherName + "\");",
                    "    var result = null;",
                    "",
                    newBlock,
                    "// === END BLOCKS ===",
                    "",
                    "    // 結果を返す（適用されたキーフレーム間か、線形補間）",
                    "    if (result !== null) {",
                    "        result;",
                    "    } else {",
                    "        // Mother Easeが適用されていない区間は線形補間",
                    "        var n = numKeys;",
                    "        if (n < 2 || time <= key(1).time) {",
                    "            key(1).value;",
                    "        } else if (time >= key(n).time) {",
                    "            key(n).value;",
                    "        } else {",
                    "            // 現在時間が含まれるキーフレーム区間を探す",
                    "            var k1 = 1;",
                    "            for (var i = 1; i < n; i++) {",
                    "                if (time >= key(i).time && time <= key(i+1).time) {",
                    "                    k1 = i;",
                    "                    break;",
                    "                }",
                    "            }",
                    "            var k2 = k1 + 1;",
                    "            var kt1 = key(k1).time;",
                    "            var kt2 = key(k2).time;",
                    "            var kv1 = key(k1).value;",
                    "            var kv2 = key(k2).value;",
                    "            var t = (time - kt1) / (kt2 - kt1);",
                    "            kv1 + (kv2 - kv1) * t;",
                    "        }",
                    "    }",
                    "} catch(e) {",
                    "    value;",
                    "}"
                ].join("\n");

                return expr;
            }

            // Resize behavior
            pal.onResizing = pal.onResize = function () { this.layout.resize(); };
        }

        return pal;
    }

    var myPal = buildUI(thisObj);
    if (myPal instanceof Window) {
        myPal.center();
        myPal.show();
    }

})(this);
