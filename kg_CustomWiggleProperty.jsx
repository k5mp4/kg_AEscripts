// CustomWiggleProperty.jsx
// 選択したプロパティに特別なwiggleまたは累積エクスプレッションを適用
// レイヤーごとにシード変更、始点/終点で大きく中間で微細、posterizeTime制御付き
// 任意のプロパティに対応、エフェクトコントロールから調整可能 

(function () {
    var VERSION = "1.1.2";
    var DEBUG = true;

    function debugLog(message) {
        if (DEBUG) {
            $.writeln("[CustomWiggle v" + VERSION + "] " + message);
        }
    }

    debugLog("Script started");

    app.beginUndoGroup("Apply Custom Wiggle to Properties");

    var comp = app.project.activeItem;

    if (!comp || !(comp instanceof CompItem)) {
        alert("アクティブなコンポジションを開いてください。");
        debugLog("Error: No active composition found");
        app.endUndoGroup();
        return;
    }
    debugLog("Active composition found: " + comp.name);

    // 選択されたプロパティを直接収集
    var selectedProps = [];
    var selectedItems = comp.selectedProperties || [];

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

        // デバッグログ：レイヤーが見つからなかった場合の情報
        if (DEBUG) {
            try {
                debugLog("Failed to find layer for property: " + prop.name + " (Depth: " + prop.propertyDepth + ")");
                var parent = prop.propertyGroup(1);
                if (parent) debugLog("Parent: " + parent.name + " (Type: " + typeof parent + ", Index: " + parent.index + ")");
            } catch (e) { }
        }

        return null;
    }

    // プロパティへのパスを取得（matchNameの配列）
    function getPropertyPath(prop) {
        var path = [];
        var current = prop;
        try {
            // プロパティからレイヤーまでのパスを記録
            while (current && current.propertyDepth > 0) {
                // matchNameを使用（言語依存しない）
                path.unshift(current.matchName);
                current = current.propertyGroup(1);
            }
        } catch (e) {
            debugLog("Error getting property path: " + e.toString());
        }
        return path;
    }

    // パスからプロパティを再取得
    function findPropertyByPath(layer, path) {
        var current = layer;
        try {
            for (var i = 0; i < path.length; i++) {
                current = current.property(path[i]);
                if (!current) {
                    debugLog("  Path segment not found: " + path[i]);
                    return null;
                }
            }
            return current;
        } catch (e) {
            debugLog("Error finding property by path: " + e.toString());
            return null;
        }
    }

    debugLog("Selected items count from comp.selectedProperties: " + selectedItems.length);

    for (var i = 0; i < selectedItems.length; i++) {
        var prop = selectedItems[i];
        debugLog("--- Checking item " + i + " ---");
        debugLog("  Name: " + prop.name);
        debugLog("  propertyType: " + prop.propertyType + " (PROPERTY=" + PropertyType.PROPERTY + ")");
        debugLog("  canSetExpression: " + prop.canSetExpression);

        // プロパティグループではなく、エクスプレッション設定可能なプロパティのみ
        if (prop.propertyType === PropertyType.PROPERTY && prop.canSetExpression) {
            debugLog("  -> Passed filter, finding layer...");
            var layer = getLayerFromProperty(prop);
            if (!layer) {
                debugLog("  -> Layer NOT found, skipping.");
                continue;
            }
            debugLog("  -> Layer found: " + layer.name + " (index: " + layer.index + ")");

            // プロパティパスを取得（オブジェクト自体ではなくパスを保存）
            var propertyPath = getPropertyPath(prop);
            debugLog("  -> Property path: " + propertyPath.join(" > "));

            selectedProps.push({
                layer: layer,
                layerIndex: layer.index,
                layerName: layer.name,
                propertyPath: propertyPath,
                propertyName: prop.name
            });
        } else {
            debugLog("  -> Filtered out (not a settable property)");
        }
    }

    if (selectedProps.length === 0) {
        alert("エクスプレッションを適用できるプロパティを選択してください。\n\n" +
            "ヒント: タイムラインでプロパティ（位置、スケール、回転、不透明度など）を\n" +
            "選択した状態でスクリプトを実行してください。");
        debugLog("Error: No valid properties selected");
        app.endUndoGroup();
        return;
    }
    debugLog("Selected properties count: " + selectedProps.length);

    // プロパティ選択確認ダイアログ
    var dialog = new Window("dialog", "Custom Animation - プロパティ確認 (v" + VERSION + ")");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];

    var infoPanel = dialog.add("panel", undefined, "選択されたプロパティ");
    infoPanel.alignChildren = ["left", "top"];
    infoPanel.margins = 15;

    // 選択プロパティのリスト表示
    var propListStr = "";
    for (var k = 0; k < selectedProps.length; k++) {
        propListStr += (k + 1) + ". " + selectedProps[k].layerName + " - " + selectedProps[k].propertyName + "\n";
    }
    var propList = infoPanel.add("statictext", undefined, propListStr, { multiline: true });
    propList.preferredSize = [350, Math.min(selectedProps.length * 20 + 10, 100)];

    // モード選択パネル
    var modePanel = dialog.add("panel", undefined, "アニメーションモード");
    modePanel.alignChildren = ["left", "top"];
    modePanel.margins = 15;

    var modeWiggle = modePanel.add("radiobutton", undefined, "Wiggle（ランダムな揺れ）");
    var modeAccumulate = modePanel.add("radiobutton", undefined, "累積（連続的に増加・回転/展開向け）");
    modeWiggle.value = true;

    // コントロール方式選択パネル
    var controlPanel = dialog.add("panel", undefined, "コントロール方式");
    controlPanel.alignChildren = ["left", "top"];
    controlPanel.margins = 15;

    var ctrlNull = controlPanel.add("radiobutton", undefined, "ヌルオブジェクトで制御（複数レイヤー一括調整向け）");
    var ctrlLayer = controlPanel.add("radiobutton", undefined, "レイヤー本体で制御（個別調整向け）");
    ctrlNull.value = true;

    // デフォルト値パネル
    var defaultPanel = dialog.add("panel", undefined, "デフォルト設定");
    defaultPanel.alignChildren = ["left", "top"];
    defaultPanel.margins = 15;

    // 端の振幅/速度
    var ampGroup = defaultPanel.add("group");
    var ampLabel = ampGroup.add("statictext", undefined, "端の振幅:");
    ampLabel.preferredSize = [120, -1];
    var ampInput = ampGroup.add("edittext", undefined, "50");
    ampInput.characters = 8;

    // 中央の振幅/速度
    var minAmpGroup = defaultPanel.add("group");
    var minAmpLabel = minAmpGroup.add("statictext", undefined, "中央の振幅:");
    minAmpLabel.preferredSize = [120, -1];
    var minAmpInput = minAmpGroup.add("edittext", undefined, "5");
    minAmpInput.characters = 8;

    // 端の範囲
    var edgeGroup = defaultPanel.add("group");
    var edgeLabel = edgeGroup.add("statictext", undefined, "端の範囲 (%):");
    edgeLabel.preferredSize = [120, -1];
    var edgeInput = edgeGroup.add("edittext", undefined, "5");
    edgeInput.characters = 8;

    // モード切り替え時のラベル更新
    modeWiggle.onClick = function () {
        ampLabel.text = "端の振幅:";
        minAmpLabel.text = "中央の振幅:";
        ampInput.text = "50";
        minAmpInput.text = "5";
    };

    modeAccumulate.onClick = function () {
        ampLabel.text = "端の速度 (度/秒):";
        minAmpLabel.text = "中央の速度 (度/秒):";
        ampInput.text = "360";
        minAmpInput.text = "30";
    };

    // ボタン
    var btnGroup = dialog.add("group");
    btnGroup.alignment = ["center", "top"];
    var okBtn = btnGroup.add("button", undefined, "OK", { name: "ok" });
    var cancelBtn = btnGroup.add("button", undefined, "キャンセル", { name: "cancel" });

    if (dialog.show() !== 1) {
        debugLog("Dialog cancelled by user");
        app.endUndoGroup();
        return;
    }
    debugLog("Dialog confirmed by user");

    var isWiggleMode = modeWiggle.value;
    var useNullControl = ctrlNull.value;
    var maxAmpDefault = parseFloat(ampInput.text) || (isWiggleMode ? 50 : 360);
    var minAmpDefault = parseFloat(minAmpInput.text) || (isWiggleMode ? 5 : 30);
    var edgePercentDefault = parseFloat(edgeInput.text) || 5;

    // ユニークなヌル名を生成
    function generateUniqueNullName() {
        var baseName = isWiggleMode ? "Wiggle Control" : "Accumulate Control";
        var uniqueName = baseName;
        var counter = 1;

        var nameExists = true;
        while (nameExists) {
            nameExists = false;
            for (var n = 1; n <= comp.numLayers; n++) {
                if (comp.layer(n).name === uniqueName) {
                    nameExists = true;
                    counter++;
                    uniqueName = baseName + " " + counter;
                    break;
                }
            }
        }
        return uniqueName;
    }

    // レイヤーにエフェクトを追加する関数（サフィックス対応）
    function addEffectsToLayer(layer, isWiggle, minAmp, maxAmp, edgePercent, suffix) {
        var effectsGroup = layer.property("ADBE Effect Parade");
        if (!effectsGroup) return; // エフェクトグループがない場合は中断（通常ありえないが念のため）

        // エフェクト名生成ヘルパー
        function getUniqueName(baseName) {
            return baseName + suffix;
        }

        var posterizeEffect = effectsGroup.addProperty("ADBE Slider Control");
        posterizeEffect.name = getUniqueName("Posterize Time");
        posterizeEffect.property("スライダー").setValue(24);

        var edgePercentEffect = effectsGroup.addProperty("ADBE Slider Control");
        edgePercentEffect.name = getUniqueName("端の範囲 (%)");
        edgePercentEffect.property("スライダー").setValue(edgePercent);

        if (isWiggle) {
            var minFreqEffect = effectsGroup.addProperty("ADBE Slider Control");
            minFreqEffect.name = getUniqueName("中央の周波数");
            minFreqEffect.property("スライダー").setValue(0.5);

            var maxFreqEffect = effectsGroup.addProperty("ADBE Slider Control");
            maxFreqEffect.name = getUniqueName("端の周波数");
            maxFreqEffect.property("スライダー").setValue(3);

            var minAmpEffect = effectsGroup.addProperty("ADBE Slider Control");
            minAmpEffect.name = getUniqueName("中央の振幅");
            minAmpEffect.property("スライダー").setValue(minAmp);

            var maxAmpEffect = effectsGroup.addProperty("ADBE Slider Control");
            maxAmpEffect.name = getUniqueName("端の振幅");
            maxAmpEffect.property("スライダー").setValue(maxAmp);
        } else {
            var minSpeedEffect = effectsGroup.addProperty("ADBE Slider Control");
            minSpeedEffect.name = getUniqueName("中央の速度");
            minSpeedEffect.property("スライダー").setValue(minAmp);

            var maxSpeedEffect = effectsGroup.addProperty("ADBE Slider Control");
            maxSpeedEffect.name = getUniqueName("端の速度");
            maxSpeedEffect.property("スライダー").setValue(maxAmp);
        }
    }

    // ヌルオブジェクトを作成（コントロール用）- ヌル方式の場合のみ
    var nullLayerName = "";
    var controlNull = null;
    var processedLayers = {}; // layerIndex -> suffix map (両モードで使用)

    if (useNullControl) {
        nullLayerName = generateUniqueNullName();
        controlNull = comp.layers.addNull();
        controlNull.name = nullLayerName;
        controlNull.label = isWiggleMode ? 5 : 9; // Wiggle: 黄色, 累積: 緑

        // 共通エフェクトを追加
        var nullPosterizeEffect = controlNull.Effects.addProperty("ADBE Slider Control");
        nullPosterizeEffect.name = "Posterize Time";
        nullPosterizeEffect.property("スライダー").setValue(24);

        var nullEdgePercentEffect = controlNull.Effects.addProperty("ADBE Slider Control");
        nullEdgePercentEffect.name = "端の範囲 (%)";
        nullEdgePercentEffect.property("スライダー").setValue(edgePercentDefault);

        if (isWiggleMode) {
            // Wiggleモード用エフェクト
            var nullMinFreqEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullMinFreqEffect.name = "中央の周波数";
            nullMinFreqEffect.property("スライダー").setValue(0.5);

            var nullMaxFreqEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullMaxFreqEffect.name = "端の周波数";
            nullMaxFreqEffect.property("スライダー").setValue(3);

            var nullMinAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullMinAmpEffect.name = "中央の振幅";
            nullMinAmpEffect.property("スライダー").setValue(minAmpDefault);

            var nullMaxAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullMaxAmpEffect.name = "端の振幅";
            nullMaxAmpEffect.property("スライダー").setValue(maxAmpDefault);
        } else {
            // 累積モード用エフェクト
            var nullMinSpeedEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullMinSpeedEffect.name = "中央の速度";
            nullMinSpeedEffect.property("スライダー").setValue(minAmpDefault);

            var nullMaxSpeedEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullMaxSpeedEffect.name = "端の速度";
            nullMaxSpeedEffect.property("スライダー").setValue(maxAmpDefault);
        }
    } else {
        // レイヤー本体制御の場合、各レイヤーにエフェクトを追加
        // 同じレイヤーに複数回追加しないようにトラッキング

        // 全レイヤーについてサフィックスを決定
        for (var k = 0; k < selectedProps.length; k++) {
            var layer = selectedProps[k].layer;
            var layerIndex = selectedProps[k].layerIndex;

            if (processedLayers[layerIndex] === undefined) {
                // このレイヤーに対するユニークなサフィックスを決定
                var effectsGroup = layer.property("ADBE Effect Parade");
                var suffix = "";
                var counter = 1;
                var baseTestName = "Posterize Time"; // 代表的なエフェクトでチェック

                // 既存のエフェクトと名前が被らないかチェック
                if (effectsGroup) {
                    while (effectsGroup.property(baseTestName + suffix) !== null) {
                        counter++;
                        suffix = " " + counter;
                    }
                }

                // サフィックスを使ってエフェクトを追加
                addEffectsToLayer(layer, isWiggleMode, minAmpDefault, maxAmpDefault, edgePercentDefault, suffix);

                // 決定したサフィックスを保存（エクスプレッション生成で使用）
                processedLayers[layerIndex] = suffix;
            }
        }
    }

    // Wiggleモード用エクスプレッション
    function createWiggleExpression(seedValue, nullName, useNull, effectSuffix) {
        var controlSource = useNull ? 'thisComp.layer("' + nullName + '")' : 'thisLayer';
        var s = useNull ? "" : (effectSuffix || ""); // ヌル制御の時はサフィックスなし（ヌルは新規作成されるため）

        return [
            '// コントロールレイヤーからパラメータを取得',
            'var ctrl = ' + controlSource + ';',
            'var posterizeVal = ctrl.effect("Posterize Time' + s + '")("スライダー");',
            'posterizeTime(posterizeVal);',
            '',
            '// シード値',
            'seedRandom(' + seedValue + ', true);',
            '',
            '// レイヤーのinPointとoutPointを基準に計算',
            'var layerDuration = outPoint - inPoint;',
            'var layerTime = time - inPoint;',
            'var normalizedTime = layerTime / layerDuration;',
            '',
            '// 端の定義: スライダーから取得（0-50%）',
            'var edgePercentRaw = ctrl.effect("端の範囲 (%)' + s + '")("スライダー");',
            'var edgePercent = clamp(edgePercentRaw, 0, 50) / 100;',
            '',
            '// イージング関数',
            'function easeOut(t) {',
            '    return 1 - (1 - t) * (1 - t);',
            '}',
            '',
            'function easeIn(t) {',
            '    return t * t;',
            '}',
            '',
            '// 始点と終点で大きく、中間で微細になる変化量を計算（イージング補間）',
            'var intensity = 0;',
            '',
            'if (normalizedTime < edgePercent) {',
            '    var t = normalizedTime / edgePercent;',
            '    intensity = 1 - easeOut(t);',
            '} else if (normalizedTime > 1 - edgePercent) {',
            '    var t = (normalizedTime - (1 - edgePercent)) / edgePercent;',
            '    intensity = easeIn(t);',
            '} else {',
            '    intensity = 0;',
            '}',
            '',
            '// エフェクトコントロールからパラメータを取得',
            'var minFreq = ctrl.effect("中央の周波数' + s + '")("スライダー");',
            'var maxFreq = ctrl.effect("端の周波数' + s + '")("スライダー");',
            'var minAmp = ctrl.effect("中央の振幅' + s + '")("スライダー");',
            'var maxAmp = ctrl.effect("端の振幅' + s + '")("スライダー");',
            '',
            'var currentFreq = minFreq + (maxFreq - minFreq) * intensity;',
            'var currentAmp = minAmp + (maxAmp - minAmp) * intensity;',
            '',
            '// wiggleを適用',
            'wiggle(currentFreq, currentAmp);'
        ].join('\n');
    }

    // 累積モード用エクスプレッション
    function createAccumulateExpression(seedValue, nullName, useNull, effectSuffix) {
        var controlSource = useNull ? 'thisComp.layer("' + nullName + '")' : 'thisLayer';
        var s = useNull ? "" : (effectSuffix || "");

        return [
            '// コントロールレイヤーからパラメータを取得',
            'var ctrl = ' + controlSource + ';',
            'var posterizeVal = ctrl.effect("Posterize Time' + s + '")("スライダー");',
            'var frameTime = 1 / posterizeVal;',
            '',
            '// シード値（方向のランダム化）',
            'seedRandom(' + seedValue + ', true);',
            'var direction = random() > 0.5 ? 1 : -1;',
            '',
            '// レイヤーのinPointとoutPointを基準に計算',
            'var layerDuration = outPoint - inPoint;',
            'var layerTime = time - inPoint;',
            'var normalizedTime = layerTime / layerDuration;',
            '',
            '// 端の定義: スライダーから取得（0-50%）',
            'var edgePercentRaw = ctrl.effect("端の範囲 (%)' + s + '")("スライダー");',
            'var edgePercent = clamp(edgePercentRaw, 0, 50) / 100;',
            '',
            '// イージング関数',
            'function easeOut(t) {',
            '    return 1 - (1 - t) * (1 - t);',
            '}',
            '',
            'function easeIn(t) {',
            '    return t * t;',
            '}',
            '',
            '// 速度パラメータを取得',
            'var minSpeed = ctrl.effect("中央の速度' + s + '")("スライダー");',
            'var maxSpeed = ctrl.effect("端の速度' + s + '")("スライダー");',
            '',
            '// 累積値を計算（各フレームの速度を積分）',
            'var accumulatedValue = 0;',
            'var startTime = inPoint;',
            'var currentTime = Math.floor((time - startTime) / frameTime) * frameTime + startTime;',
            '',
            'for (var t = startTime; t < currentTime; t += frameTime) {',
            '    var nt = (t - startTime) / layerDuration;',
            '    var intensity = 0;',
            '',
            '    if (nt < edgePercent) {',
            '        var p = nt / edgePercent;',
            '        intensity = 1 - easeOut(p);',
            '    } else if (nt > 1 - edgePercent) {',
            '        var p = (nt - (1 - edgePercent)) / edgePercent;',
            '        intensity = easeIn(p);',
            '    } else {',
            '        intensity = 0;',
            '    }',
            '',
            '    var currentSpeed = minSpeed + (maxSpeed - minSpeed) * intensity;',
            '    accumulatedValue += currentSpeed * frameTime * direction;',
            '}',
            '',
            '// 元の値に累積値を加算',
            'value + accumulatedValue;'
        ].join('\n');
    }

    // ユニークなシード生成用のベース値（現在時刻ベース）
    var seedBase = Math.floor(new Date().getTime() / 1000) % 100000;
    var appliedCount = 0;

    // 各プロパティに適用
    for (var p = 0; p < selectedProps.length; p++) {
        var propData = selectedProps[p];

        // プロパティをパスから再取得（エフェクト追加後も有効な参照を得る）
        var targetLayer = comp.layer(propData.layerIndex);
        var prop = findPropertyByPath(targetLayer, propData.propertyPath);

        if (!prop) {
            debugLog("Failed to re-find property: " + propData.propertyName + " on " + propData.layerName);
            continue;
        }

        // シード値を生成
        var seedValue = seedBase + (propData.layerIndex * 10000) + (p * 100);

        try {
            var effectSuffix = processedLayers[propData.layerIndex] || "";
            if (isWiggleMode) {
                prop.expression = createWiggleExpression(seedValue, nullLayerName, useNullControl, effectSuffix);
            } else {
                prop.expression = createAccumulateExpression(seedValue, nullLayerName, useNullControl, effectSuffix);
            }
            appliedCount++;
            debugLog("Applied expression to: " + propData.layerName + " - " + propData.propertyName + " (Suffix: '" + effectSuffix + "')");
        } catch (e) {
            // エクスプレッション適用に失敗した場合はスキップ
            debugLog("Failed to apply expression to: " + propData.layerName + " - " + propData.propertyName + ". Error: " + e.toString());
        }
    }

    debugLog("Total applied count: " + appliedCount);

    var message = appliedCount + "個のプロパティに";
    if (isWiggleMode) {
        message += "Wiggleを適用しました。\n\n" +
            "「" + nullLayerName + "」のエフェクトコントロールで調整できます:\n" +
            "・Posterize Time: フレームレート\n" +
            "・端の範囲 (%): 端の補間範囲（0-50%）\n" +
            "・中央/端の周波数: wiggleの速さ\n" +
            "・中央/端の振幅: wiggleの大きさ";
    } else {
        message += "累積アニメーションを適用しました。\n\n" +
            "「" + nullLayerName + "」のエフェクトコントロールで調整できます:\n" +
            "・Posterize Time: フレームレート\n" +
            "・端の範囲 (%): 端の補間範囲（0-50%）\n" +
            "・中央/端の速度: 変化速度（度/秒など）";
    }

    alert(message);

    app.endUndoGroup();
})();
