// CustomWiggleTransform.jsx
// 選択レイヤーのトランスフォームプロパティに特別なwiggleエクスプレッションを適用
// レイヤーごとにシード変更、始点/終点で大きく中間で微細、posterizeTime制御付き
// 位置・スケール・回転に対応

(function () {
    app.beginUndoGroup("Apply Custom Wiggle to Transform");

    var comp = app.project.activeItem;

    if (!comp || !(comp instanceof CompItem)) {
        alert("アクティブなコンポジションを開いてください。");
        app.endUndoGroup();
        return;
    }

    var selectedLayers = comp.selectedLayers;

    if (selectedLayers.length === 0) {
        alert("レイヤーを選択してください。");
        app.endUndoGroup();
        return;
    }

    // プロパティ選択ダイアログ
    var dialog = new Window("dialog", "Custom Wiggle - プロパティ選択");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];

    var propPanel = dialog.add("panel", undefined, "適用するプロパティ");
    propPanel.alignChildren = ["left", "top"];
    propPanel.margins = 15;

    var chkPosition = propPanel.add("checkbox", undefined, "位置");
    var chkScale = propPanel.add("checkbox", undefined, "スケール");
    var chkRotation = propPanel.add("checkbox", undefined, "回転");

    chkPosition.value = true;

    // デフォルト値パネル
    var defaultPanel = dialog.add("panel", undefined, "デフォルト値");
    defaultPanel.alignChildren = ["left", "top"];
    defaultPanel.margins = 15;

    // 位置
    var posGroup = defaultPanel.add("group");
    posGroup.add("statictext", undefined, "位置 - 端の振幅:");
    var posAmpInput = posGroup.add("edittext", undefined, "50");
    posAmpInput.characters = 6;

    // スケール
    var scaleGroup = defaultPanel.add("group");
    scaleGroup.add("statictext", undefined, "スケール - 端の振幅:");
    var scaleAmpInput = scaleGroup.add("edittext", undefined, "10");
    scaleAmpInput.characters = 6;

    // 回転
    var rotGroup = defaultPanel.add("group");
    rotGroup.add("statictext", undefined, "回転 - 端の振幅:");
    var rotAmpInput = rotGroup.add("edittext", undefined, "15");
    rotAmpInput.characters = 6;

    // ボタン
    var btnGroup = dialog.add("group");
    btnGroup.alignment = ["center", "top"];
    var okBtn = btnGroup.add("button", undefined, "OK", { name: "ok" });
    var cancelBtn = btnGroup.add("button", undefined, "キャンセル", { name: "cancel" });

    if (dialog.show() !== 1) {
        app.endUndoGroup();
        return;
    }

    var applyPosition = chkPosition.value;
    var applyScale = chkScale.value;
    var applyRotation = chkRotation.value;

    if (!applyPosition && !applyScale && !applyRotation) {
        alert("少なくとも1つのプロパティを選択してください。");
        app.endUndoGroup();
        return;
    }

    var posAmpDefault = parseFloat(posAmpInput.text) || 50;
    var scaleAmpDefault = parseFloat(scaleAmpInput.text) || 10;
    var rotAmpDefault = parseFloat(rotAmpInput.text) || 15;

    var controlNull = null;
    var useNullControl = selectedLayers.length > 1;

    // ユニークなヌル名を生成（同期問題対策）
    function generateUniqueNullName() {
        var baseName = "Wiggle Control";
        var uniqueName = baseName;
        var counter = 1;

        // 既存のレイヤー名をチェック
        var nameExists = true;
        while (nameExists) {
            nameExists = false;
            for (var j = 1; j <= comp.numLayers; j++) {
                if (comp.layer(j).name === uniqueName) {
                    nameExists = true;
                    counter++;
                    uniqueName = baseName + " " + counter;
                    break;
                }
            }
        }
        return uniqueName;
    }

    // 複数レイヤーの場合、ヌルオブジェクトを作成
    var nullLayerName = "";
    if (useNullControl) {
        nullLayerName = generateUniqueNullName();
        controlNull = comp.layers.addNull();
        controlNull.name = nullLayerName;
        controlNull.label = 5; // 黄色

        // ヌルのデュレーションを選択レイヤーに合わせる
        var minInPoint = Infinity;
        var maxOutPoint = -Infinity;
        for (var m = 0; m < selectedLayers.length; m++) {
            if (selectedLayers[m].inPoint < minInPoint) minInPoint = selectedLayers[m].inPoint;
            if (selectedLayers[m].outPoint > maxOutPoint) maxOutPoint = selectedLayers[m].outPoint;
        }
        controlNull.inPoint = minInPoint;
        controlNull.outPoint = maxOutPoint;

        // 共通エフェクト
        var nullPosterizeEffect = controlNull.Effects.addProperty("ADBE Slider Control");
        nullPosterizeEffect.name = "Posterize Time Control";
        nullPosterizeEffect.property("スライダー").setValue(24);

        var nullMinFreqEffect = controlNull.Effects.addProperty("ADBE Slider Control");
        nullMinFreqEffect.name = "中央の周波数";
        nullMinFreqEffect.property("スライダー").setValue(0.5);

        var nullMaxFreqEffect = controlNull.Effects.addProperty("ADBE Slider Control");
        nullMaxFreqEffect.name = "端の周波数";
        nullMaxFreqEffect.property("スライダー").setValue(3);

        var nullEdgePercentEffect = controlNull.Effects.addProperty("ADBE Slider Control");
        nullEdgePercentEffect.name = "端の範囲 (%)";
        nullEdgePercentEffect.property("スライダー").setValue(5);

        // 位置用
        if (applyPosition) {
            var nullPosMinAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullPosMinAmpEffect.name = "位置 - 中央の振幅";
            nullPosMinAmpEffect.property("スライダー").setValue(5);

            var nullPosMaxAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullPosMaxAmpEffect.name = "位置 - 端の振幅";
            nullPosMaxAmpEffect.property("スライダー").setValue(posAmpDefault);
        }

        // スケール用
        if (applyScale) {
            var nullScaleMinAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullScaleMinAmpEffect.name = "スケール - 中央の振幅";
            nullScaleMinAmpEffect.property("スライダー").setValue(1);

            var nullScaleMaxAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullScaleMaxAmpEffect.name = "スケール - 端の振幅";
            nullScaleMaxAmpEffect.property("スライダー").setValue(scaleAmpDefault);
        }

        // 回転用
        if (applyRotation) {
            var nullRotMinAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullRotMinAmpEffect.name = "回転 - 中央の振幅";
            nullRotMinAmpEffect.property("スライダー").setValue(1);

            var nullRotMaxAmpEffect = controlNull.Effects.addProperty("ADBE Slider Control");
            nullRotMaxAmpEffect.name = "回転 - 端の振幅";
            nullRotMaxAmpEffect.property("スライダー").setValue(rotAmpDefault);
        }
    }

    // エクスプレッション文字列を作成（レイヤー名で参照）
    function createWiggleExpression(seedValue, useNull, nullName, propType, minAmpDefault, maxAmpDefault) {
        var controlSource = useNull
            ? 'thisComp.layer("' + nullName + '")'
            : 'thisLayer';

        var minAmpName, maxAmpName;
        if (propType === "position") {
            minAmpName = "位置 - 中央の振幅";
            maxAmpName = "位置 - 端の振幅";
        } else if (propType === "scale") {
            minAmpName = "スケール - 中央の振幅";
            maxAmpName = "スケール - 端の振幅";
        } else if (propType === "rotation") {
            minAmpName = "回転 - 中央の振幅";
            maxAmpName = "回転 - 端の振幅";
        }

        return [
            '// PosterizeTime制御用スライダー',
            'var posterizeControl = ' + controlSource + '.effect("Posterize Time Control")("スライダー");',
            'posterizeTime(posterizeControl);',
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
            'var edgePercentRaw = ' + controlSource + '.effect("端の範囲 (%)")("スライダー");',
            'var edgePercent = clamp(edgePercentRaw, 0, 50) / 100;',
            '',
            '// イージング関数',
            'function easeOut(t) {',
            '    // 最初に素早く動き、後に遅くなる（1 - (1-t)^2）',
            '    return 1 - (1 - t) * (1 - t);',
            '}',
            '',
            'function easeIn(t) {',
            '    // 最初遅く、後に素早くなる（t^2）',
            '    return t * t;',
            '}',
            '',
            '// 始点と終点で大きく、中間で微細になる変化量を計算（イージング補間）',
            'var wiggleIntensity = 0;',
            '',
            'if (normalizedTime < edgePercent) {',
            '    // 最初の5%: 1から0へeaseOut補間',
            '    var t = normalizedTime / edgePercent;',
            '    wiggleIntensity = 1 - easeOut(t);',
            '} else if (normalizedTime > 1 - edgePercent) {',
            '    // 最後の5%: 0から1へeaseIn補間',
            '    var t = (normalizedTime - (1 - edgePercent)) / edgePercent;',
            '    wiggleIntensity = easeIn(t);',
            '} else {',
            '    // 中央90%: 0（微細なwiggle）',
            '    wiggleIntensity = 0;',
            '}',
            '',
            '// エフェクトコントロールからパラメータを取得',
            'var minFreq = ' + controlSource + '.effect("中央の周波数")("スライダー");',
            'var maxFreq = ' + controlSource + '.effect("端の周波数")("スライダー");',
            'var minAmp = ' + controlSource + '.effect("' + minAmpName + '")("スライダー");',
            'var maxAmp = ' + controlSource + '.effect("' + maxAmpName + '")("スライダー");',
            '',
            'var currentFreq = minFreq + (maxFreq - minFreq) * wiggleIntensity;',
            'var currentAmp = minAmp + (maxAmp - minAmp) * wiggleIntensity;',
            '',
            '// wiggleを適用',
            'wiggle(currentFreq, currentAmp);'
        ].join('\n');
    }

    // エフェクトを追加する関数（単一レイヤー用）
    function addEffectsToLayer(layer, applyPos, applyScl, applyRot, posAmp, sclAmp, rotAmp) {
        var posterizeEffect = layer.Effects.addProperty("ADBE Slider Control");
        posterizeEffect.name = "Posterize Time Control";
        posterizeEffect.property("スライダー").setValue(24);

        var minFreqEffect = layer.Effects.addProperty("ADBE Slider Control");
        minFreqEffect.name = "中央の周波数";
        minFreqEffect.property("スライダー").setValue(0.5);

        var maxFreqEffect = layer.Effects.addProperty("ADBE Slider Control");
        maxFreqEffect.name = "端の周波数";
        maxFreqEffect.property("スライダー").setValue(3);

        var edgePercentEffect = layer.Effects.addProperty("ADBE Slider Control");
        edgePercentEffect.name = "端の範囲 (%)";
        edgePercentEffect.property("スライダー").setValue(5);

        if (applyPos) {
            var posMinAmpEffect = layer.Effects.addProperty("ADBE Slider Control");
            posMinAmpEffect.name = "位置 - 中央の振幅";
            posMinAmpEffect.property("スライダー").setValue(5);

            var posMaxAmpEffect = layer.Effects.addProperty("ADBE Slider Control");
            posMaxAmpEffect.name = "位置 - 端の振幅";
            posMaxAmpEffect.property("スライダー").setValue(posAmp);
        }

        if (applyScl) {
            var scaleMinAmpEffect = layer.Effects.addProperty("ADBE Slider Control");
            scaleMinAmpEffect.name = "スケール - 中央の振幅";
            scaleMinAmpEffect.property("スライダー").setValue(1);

            var scaleMaxAmpEffect = layer.Effects.addProperty("ADBE Slider Control");
            scaleMaxAmpEffect.name = "スケール - 端の振幅";
            scaleMaxAmpEffect.property("スライダー").setValue(sclAmp);
        }

        if (applyRot) {
            var rotMinAmpEffect = layer.Effects.addProperty("ADBE Slider Control");
            rotMinAmpEffect.name = "回転 - 中央の振幅";
            rotMinAmpEffect.property("スライダー").setValue(1);

            var rotMaxAmpEffect = layer.Effects.addProperty("ADBE Slider Control");
            rotMaxAmpEffect.name = "回転 - 端の振幅";
            rotMaxAmpEffect.property("スライダー").setValue(rotAmp);
        }
    }

    // ユニークなシード生成用のベース値（現在時刻ベース）
    var seedBase = Math.floor(new Date().getTime() / 1000) % 100000;

    // 各レイヤーに適用
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];
        // レイヤーごと・プロパティごとに十分に異なるシード値を生成
        var layerSeedBase = seedBase + (i + 1) * 10000;

        var transform = layer.property("ADBE Transform Group");

        // 単一レイヤーの場合のみエフェクトを追加
        if (!useNullControl) {
            addEffectsToLayer(layer, applyPosition, applyScale, applyRotation, posAmpDefault, scaleAmpDefault, rotAmpDefault);
        }

        // 位置
        if (applyPosition) {
            var positionProp = transform.property("ADBE Position");
            if (positionProp && positionProp.canSetExpression) {
                positionProp.expression = createWiggleExpression(
                    layerSeedBase + 100,
                    useNullControl,
                    nullLayerName,
                    "position",
                    5,
                    posAmpDefault
                );
            }
        }

        // スケール
        if (applyScale) {
            var scaleProp = transform.property("ADBE Scale");
            if (scaleProp && scaleProp.canSetExpression) {
                scaleProp.expression = createWiggleExpression(
                    layerSeedBase + 200,
                    useNullControl,
                    nullLayerName,
                    "scale",
                    1,
                    scaleAmpDefault
                );
            }
        }

        // 回転
        if (applyRotation) {
            var rotationProp = transform.property("ADBE Rotate Z");
            if (rotationProp && rotationProp.canSetExpression) {
                rotationProp.expression = createWiggleExpression(
                    layerSeedBase + 300,
                    useNullControl,
                    nullLayerName,
                    "rotation",
                    1,
                    rotAmpDefault
                );
            }
        }
    }

    // 適用したプロパティのリストを作成
    var appliedProps = [];
    if (applyPosition) appliedProps.push("位置");
    if (applyScale) appliedProps.push("スケール");
    if (applyRotation) appliedProps.push("回転");

    var message = selectedLayers.length + "個のレイヤーに「" + appliedProps.join("・") + "」のカスタムWiggleを適用しました。\n\n";

    if (useNullControl) {
        message += "「Wiggle Control」ヌルオブジェクトのエフェクトコントロールで\n全レイヤーを一括調整できます:\n";
    } else {
        message += "エフェクトコントロールで調整可能:\n";
    }

    message += "・Posterize Time Control: フレームレート\n" +
        "・中央/端の周波数: wiggleの速さ\n" +
        "・端の範囲 (%): 端の補間範囲（0-50%）\n" +
        "・各プロパティの中央/端の振幅: wiggleの大きさ";

    alert(message);

    app.endUndoGroup();
})();
