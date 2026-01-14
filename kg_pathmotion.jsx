/*
Mask Path Motion for Adobe After Effects
- マスクパスに沿ってレイヤーを移動させる
- パスの終点がレイヤーの現在位置になる
- Path Rotation: 終点を中心に始点方向を回転可能
- Auto-Orient: パスの接線方向にレイヤーを向ける
- 進行度スライダーで制御（キーフレーム2つのみ）

Install: 
1) Save as: kg_pathmotion.jsx
2) Put in:
   Windows: C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
   macOS:   /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
3) Restart AE, open: Window > kg_pathmotion
*/

(function MaskPathMotionPanel(thisObj) {

    var SCRIPT_NAME = "Mask Path Motion";
    var SCRIPT_VERSION = "2.1.0";

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

            // Mask Panel
            var maskPanel = pal.add("panel", undefined, "Mask");
            maskPanel.orientation = "column";
            maskPanel.alignChildren = ["fill", "top"];

            var maskRow = maskPanel.add("group");
            maskRow.orientation = "row";
            maskRow.add("statictext", undefined, "Mask Index:");
            var maskIndexTxt = maskRow.add("edittext", undefined, "1");
            maskIndexTxt.characters = 4;

            // Mask Utility Buttons
            var maskBtns = maskPanel.add("group");
            maskBtns.orientation = "row";
            maskBtns.alignChildren = ["fill", "center"];
            var openPathBtn = maskBtns.add("button", undefined, "Open Path");
            var selectMaskBtn = maskBtns.add("button", undefined, "Select Mask");

            // Timing Panel
            var timePanel = pal.add("panel", undefined, "Timing");
            timePanel.orientation = "column";
            timePanel.alignChildren = ["fill", "top"];

            var frameRow1 = timePanel.add("group");
            frameRow1.orientation = "row";
            frameRow1.add("statictext", undefined, "Duration (frames):");
            var durationFrameTxt = frameRow1.add("edittext", undefined, "60");
            durationFrameTxt.characters = 6;

            // Options Panel
            var optPanel = pal.add("panel", undefined, "Options");
            optPanel.orientation = "column";
            optPanel.alignChildren = ["fill", "top"];

            var rotRow = optPanel.add("group");
            rotRow.orientation = "row";
            rotRow.add("statictext", undefined, "Path Rotation:");
            var pathRotTxt = rotRow.add("edittext", undefined, "0");
            pathRotTxt.characters = 6;
            rotRow.add("statictext", undefined, "degrees");

            var autoOrientChk = optPanel.add("checkbox", undefined, "Auto-Orient (\u63a5\u7dda\u65b9\u5411\u306b\u56de\u8ee2)");
            autoOrientChk.value = false;

            // Multi-Layer Options
            var multiPanel = pal.add("panel", undefined, "Multi-Layer Mode");
            multiPanel.orientation = "column";
            multiPanel.alignChildren = ["fill", "top"];

            var rotModeRow = multiPanel.add("group");
            rotModeRow.orientation = "row";
            rotModeRow.add("statictext", undefined, "Rotation:");
            var rotModeDropdown = rotModeRow.add("dropdownlist", undefined, ["Fixed", "Random", "Distribute (360/n)"]);
            rotModeDropdown.selection = 0;

            var delayRow = multiPanel.add("group");
            delayRow.orientation = "row";
            delayRow.add("statictext", undefined, "Delay (frames):");
            var delayFrameTxt = delayRow.add("edittext", undefined, "0");
            delayFrameTxt.characters = 5;
            delayRow.add("statictext", undefined, "per layer");

            // Buttons
            var btns = pal.add("group");
            btns.orientation = "row";
            btns.alignChildren = ["fill", "center"];

            var createNullBtn = btns.add("button", undefined, "Create Path Null");
            var applyBtn = btns.add("button", undefined, "Apply Motion");

            // ===== Helper Functions =====

            function parseNumber(str, fallback) {
                var n = Number(str);
                return (isFinite(n)) ? n : fallback;
            }

            function getActiveComp() {
                var item = app.project.activeItem;
                if (item && item instanceof CompItem) return item;
                return null;
            }

            // 点を中心点を基準に回転
            function rotatePoint(point, center, angleDeg) {
                var rad = angleDeg * Math.PI / 180;
                var cos = Math.cos(rad);
                var sin = Math.sin(rad);
                var dx = point[0] - center[0];
                var dy = point[1] - center[1];
                return [
                    center[0] + dx * cos - dy * sin,
                    center[1] + dx * sin + dy * cos
                ];
            }

            // ===== Main Apply Function =====

            function applyMotion() {
                // デバッグログ
                var debugLog = [];
                function log(msg) {
                    debugLog.push(msg);
                    $.writeln("[PathMotion] " + msg);
                }
                function showLog() {
                    if (debugLog.length > 0) {
                        alert("=== PathMotion Debug Log ===\n" + debugLog.join("\n"));
                    }
                }

                log("applyMotion started");

                var comp = getActiveComp();
                if (!comp) {
                    alert("\u30b3\u30f3\u30dd\u30b8\u30b7\u30e7\u30f3\u3092\u30a2\u30af\u30c6\u30a3\u30d6\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }
                log("comp: " + comp.name);

                var sel = comp.selectedLayers;
                if (!sel || sel.length === 0) {
                    alert("\u30e2\u30fc\u30b7\u30e7\u30f3\u3092\u9069\u7528\u3059\u308b\u30ec\u30a4\u30e4\u30fc\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }
                log("selected layers: " + sel.length);

                // パラメータ取得
                var maskIndex = parseNumber(maskIndexTxt.text, 1);
                var durationFrames = parseNumber(durationFrameTxt.text, 60);
                var delayFrames = parseNumber(delayFrameTxt.text, 0);
                var basePathRotation = parseNumber(pathRotTxt.text, 0);
                var autoOrient = autoOrientChk.value;
                var rotMode = rotModeDropdown.selection ? rotModeDropdown.selection.index : 0;
                log("params - maskIndex:" + maskIndex + " durationFrames:" + durationFrames + " delayFrames:" + delayFrames + " rotMode:" + rotMode);

                var frameRate = comp.frameRate;
                var duration = durationFrames / frameRate;
                var delayPerLayer = delayFrames / frameRate;

                if (duration <= 0) {
                    alert("Duration \u306f0\u3088\u308a\u5927\u304d\u304f\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                app.beginUndoGroup("Apply Mask Path Motion");

                try {
                    var isMultiLayer = sel.length > 1;
                    var nullLayer = null;
                    var nullLayerIndex = null;
                    var sourceLayer = null;
                    var targetLayers = [];
                    log("isMultiLayer: " + isMultiLayer);

                    // PathMotion_Nullを検出する関数（外部スクリプトで名前が変更されても対応）
                    function isPathMotionNull(layerName) {
                        // 以下のパターンを検出:
                        // - "PathMotion_Null"で始まる
                        // - "PathMotion"を含む
                        // - "Path Layer"を含む（shapeRig等の外部スクリプト対応）
                        return layerName.indexOf("PathMotion_Null") === 0 ||
                               layerName.indexOf("PathMotion") !== -1 ||
                               layerName.indexOf("Path Layer") !== -1;
                    }

                    if (isMultiLayer) {
                        log("Multi-layer mode");
                        // 複数レイヤーモード：PathMotion_Nullを探す（名前変更対応）
                        for (var s = 0; s < sel.length; s++) {
                            if (isPathMotionNull(sel[s].name)) {
                                sourceLayer = sel[s];
                                log("Found PathMotion Null: " + sel[s].name + " at index: " + sourceLayer.index);
                                break;
                            }
                        }

                        if (!sourceLayer) {
                            alert("PathMotion_Null\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002\n\n\u5148\u306b\u300cCreate Path Null\u300d\u30dc\u30bf\u30f3\u3067\u30cc\u30eb\u3092\u4f5c\u6210\u3057\u3001\n\u305d\u306e\u30cc\u30eb\u3068\u52d5\u304b\u3057\u305f\u3044\u30ec\u30a4\u30e4\u30fc\u3092\u4e00\u7dd2\u306b\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                            app.endUndoGroup();
                            return;
                        }

                        // マスクの確認
                        var nullMasks = sourceLayer.property("ADBE Mask Parade");
                        if (!nullMasks || nullMasks.numProperties < maskIndex) {
                            alert("\u30de\u30b9\u30af " + maskIndex + " \u304c\u3042\u308a\u307e\u305b\u3093\u3002\uFF08\u30ec\u30a4\u30e4\u30fc: " + sourceLayer.name + "\uFF09");
                            app.endUndoGroup();
                            return;
                        }

                        nullLayer = sourceLayer;
                        nullLayerIndex = sourceLayer.index;
                        var nullLayerName = sourceLayer.name; // レイヤー名を保存（順序変更対応）

                        // PathMotion_Null以外のレイヤーをターゲットとして収集
                        log("Collecting target layers...");
                        for (var t = 0; t < sel.length; t++) {
                            if (!isPathMotionNull(sel[t].name)) {
                                log("Adding target: " + sel[t].name);
                                targetLayers.push({
                                    index: sel[t].index,
                                    name: sel[t].name,
                                    position: sel[t].transform.position.valueAtTime(comp.time, false),
                                    rotation: sel[t].transform.rotation.valueAtTime(comp.time, false)
                                });
                            }
                        }
                        log("Target layers count: " + targetLayers.length);

                        if (targetLayers.length === 0) {
                            alert("PathMotion Null\u4ee5\u5916\u306e\u30ec\u30a4\u30e4\u30fc\u3082\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                            app.endUndoGroup();
                            return;
                        }

                    } else {
                        // 単一レイヤーモード
                        var layer = sel[0];
                        var masks = layer.property("ADBE Mask Parade");
                        if (!masks || masks.numProperties < maskIndex) {
                            alert("\u9078\u629e\u30ec\u30a4\u30e4\u30fc\u306b\u30de\u30b9\u30af " + maskIndex + " \u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002");
                            app.endUndoGroup();
                            return;
                        }
                        targetLayers.push({
                            index: layer.index,
                            name: layer.name,
                            position: layer.transform.position.valueAtTime(comp.time, false),
                            rotation: layer.transform.rotation.valueAtTime(comp.time, false)
                        });
                    }

                    // マスクソースの決定（共通）
                    // レイヤー順序が変わっても対応できるようにレイヤー名で参照
                    var maskSourceExpr;
                    if (isMultiLayer) {
                        maskSourceExpr = "comp(\"" + comp.name.replace(/"/g, "\\\"") + "\").layer(\"" + nullLayerName.replace(/"/g, "\\\"") + "\").mask(1).maskPath";
                    } else {
                        maskSourceExpr = "mask(" + maskIndex + ").maskPath";
                    }

                    // 複数レイヤーモードの場合、PathMotion_Nullにエフェクトコントロールを追加
                    if (isMultiLayer) {
                        nullLayer = comp.layer(nullLayerIndex);
                        var nullFx = nullLayer.property("ADBE Effect Parade");

                        // PathMotion_Nullのインポイントを基準にキーフレームを設定
                        var nullInPoint = nullLayer.inPoint;

                        // Path Rotationスライダーを追加
                        nullLayer = comp.layer(nullLayerIndex);
                        nullFx = nullLayer.property("ADBE Effect Parade");
                        var rotSlider = nullFx.addProperty("ADBE Slider Control");
                        rotSlider.name = "Path Rotation";

                        nullLayer = comp.layer(nullLayerIndex);
                        nullFx = nullLayer.property("ADBE Effect Parade");
                        nullFx.property("Path Rotation").property("ADBE Slider Control-0001").setValue(basePathRotation);

                        // Auto-Orientチェックボックスを追加
                        nullLayer = comp.layer(nullLayerIndex);
                        nullFx = nullLayer.property("ADBE Effect Parade");
                        var autoOrientChkCtrl = nullFx.addProperty("ADBE Checkbox Control");
                        autoOrientChkCtrl.name = "Auto-Orient";

                        nullLayer = comp.layer(nullLayerIndex);
                        nullFx = nullLayer.property("ADBE Effect Parade");
                        nullFx.property("Auto-Orient").property("ADBE Checkbox Control-0001").setValue(autoOrient ? 1 : 0);

                        // 各レイヤー用のコントロールを追加
                        // レイヤーインデックス（comp内での番号）で管理（同名レイヤー対策）
                        for (var p = 0; p < targetLayers.length; p++) {
                            var tInfo = targetLayers[p];
                            var layerDelayTime = p * delayPerLayer;

                            // Progress_Lx スライダーを追加（各レイヤー個別の進行度、キーフレーム付き）
                            nullLayer = comp.layer(nullLayerIndex);
                            nullFx = nullLayer.property("ADBE Effect Parade");
                            var layerProgressSlider = nullFx.addProperty("ADBE Slider Control");
                            layerProgressSlider.name = "Progress_L" + tInfo.index;

                            nullLayer = comp.layer(nullLayerIndex);
                            nullFx = nullLayer.property("ADBE Effect Parade");
                            var layerSliderProp = nullFx.property("Progress_L" + tInfo.index).property("ADBE Slider Control-0001");
                            // ディレイを考慮したキーフレーム設定
                            layerSliderProp.setValueAtTime(nullInPoint + layerDelayTime, 0);
                            layerSliderProp.setValueAtTime(nullInPoint + layerDelayTime + duration, 100);

                            // EndPos_Lx Point Controlを追加（終点位置）
                            nullLayer = comp.layer(nullLayerIndex);
                            nullFx = nullLayer.property("ADBE Effect Parade");
                            var pointCtrl = nullFx.addProperty("ADBE Point Control");
                            pointCtrl.name = "EndPos_L" + tInfo.index;

                            nullLayer = comp.layer(nullLayerIndex);
                            nullFx = nullLayer.property("ADBE Effect Parade");
                            nullFx.property("EndPos_L" + tInfo.index).property("ADBE Point Control-0001").setValue([tInfo.position[0], tInfo.position[1]]);

                            log("Created controls for layer: " + tInfo.name + " (L" + tInfo.index + ") delay: " + layerDelayTime + "s");
                        }

                        log("Added effect controls to PathMotion_Null");
                    }

                    // エフェクト参照先の決定
                    // レイヤー順序が変わっても対応できるようにレイヤー名で参照
                    var effectSourceExpr;
                    if (isMultiLayer) {
                        effectSourceExpr = "comp(\"" + comp.name.replace(/"/g, "\\\"") + "\").layer(\"" + nullLayerName.replace(/"/g, "\\\"") + "\")";
                    } else {
                        effectSourceExpr = "thisLayer";
                    }

                    // 各ターゲットレイヤーにモーションを適用
                    var numTargets = targetLayers.length;
                    for (var i = 0; i < numTargets; i++) {
                        var targetInfo = targetLayers[i];
                        var targetLayer = comp.layer(targetInfo.index);
                        var targetLayerIndex = targetInfo.index;
                        var layerPos = targetInfo.position;
                        var layerName = targetInfo.name;

                        // Path Rotationを計算（単一レイヤーモードまたはレイヤー個別のオフセット用）
                        var pathRotation;
                        if (rotMode === 0) {
                            // Fixed
                            pathRotation = basePathRotation;
                        } else if (rotMode === 1) {
                            // Random
                            pathRotation = Math.random() * 360;
                        } else {
                            // Distribute (360/n)
                            pathRotation = basePathRotation + (360 / numTargets) * i;
                        }

                        // レイヤー個別の回転オフセット（Distribute/Randomモード用）
                        var layerRotOffset = pathRotation - basePathRotation;

                        // パスの終点を取得（頂点数チェック用）
                        var vertices;
                        if (isMultiLayer) {
                            nullLayer = comp.layer(nullLayerIndex);
                            var nullMaskPath = nullLayer.property("ADBE Mask Parade").property(1).property("ADBE Mask Shape");
                            vertices = nullMaskPath.valueAtTime(comp.time, false).vertices;
                        } else {
                            var masks = targetLayer.property("ADBE Mask Parade");
                            var maskPath = masks.property(maskIndex).property("ADBE Mask Shape");
                            vertices = maskPath.valueAtTime(comp.time, false).vertices;
                        }

                        if (vertices.length < 2) {
                            continue;
                        }

                        // 元のレイヤー位置と回転を保存
                        var origPosX = layerPos[0];
                        var origPosY = layerPos[1];
                        var origRotation = targetInfo.rotation;

                        // 単一レイヤーモードの場合のみ、ターゲットレイヤーにエフェクトを追加
                        if (!isMultiLayer) {
                            // レイヤーのインポイントを基準にキーフレームを設定
                            var layerInPoint = targetLayer.inPoint;

                            // Progressスライダーを追加
                            targetLayer = comp.layer(targetLayerIndex);
                            var fx = targetLayer.property("ADBE Effect Parade");
                            var progressSlider = fx.addProperty("ADBE Slider Control");
                            progressSlider.name = "Path Progress";

                            targetLayer = comp.layer(targetLayerIndex);
                            fx = targetLayer.property("ADBE Effect Parade");
                            var sliderProp = fx.property("Path Progress").property("ADBE Slider Control-0001");
                            sliderProp.setValueAtTime(layerInPoint, 0);
                            sliderProp.setValueAtTime(layerInPoint + duration, 100);

                            // Path Rotationスライダーを追加
                            targetLayer = comp.layer(targetLayerIndex);
                            fx = targetLayer.property("ADBE Effect Parade");
                            var rotSlider = fx.addProperty("ADBE Slider Control");
                            rotSlider.name = "Path Rotation";

                            targetLayer = comp.layer(targetLayerIndex);
                            fx = targetLayer.property("ADBE Effect Parade");
                            fx.property("Path Rotation").property("ADBE Slider Control-0001").setValue(pathRotation);

                            // Auto-Orientチェックボックスを追加
                            targetLayer = comp.layer(targetLayerIndex);
                            var fx2 = targetLayer.property("ADBE Effect Parade");
                            var autoOrientChkCtrl = fx2.addProperty("ADBE Checkbox Control");
                            autoOrientChkCtrl.name = "Auto-Orient";

                            targetLayer = comp.layer(targetLayerIndex);
                            fx2 = targetLayer.property("ADBE Effect Parade");
                            fx2.property("Auto-Orient").property("ADBE Checkbox Control-0001").setValue(autoOrient ? 1 : 0);

                            // 単一レイヤーモード用のPoint Controlを追加
                            targetLayer = comp.layer(targetLayerIndex);
                            var fx3 = targetLayer.property("ADBE Effect Parade");
                            var pointCtrl = fx3.addProperty("ADBE Point Control");
                            pointCtrl.name = "End Position";

                            targetLayer = comp.layer(targetLayerIndex);
                            fx3 = targetLayer.property("ADBE Effect Parade");
                            fx3.property("End Position").property("ADBE Point Control-0001").setValue([origPosX, origPosY]);
                        }

                        // Positionエクスプレッションを設定
                        targetLayer = comp.layer(targetLayerIndex);
                        var positionProp = targetLayer.transform.position;

                        // Point Control参照のエクスプレッション（終点位置を動的に取得）
                        var endPosExpr;
                        var progressExpr;
                        if (isMultiLayer) {
                            // 複数レイヤーモード: PathMotion_Nullのコントロールを参照
                            endPosExpr = "ctrl.effect(\"EndPos_L" + targetLayerIndex + "\")(1).value";
                            progressExpr = "ctrl.effect(\"Progress_L" + targetLayerIndex + "\")(1).value / 100";
                            log("Layer " + layerName + " (index:" + targetLayerIndex + ") -> Progress_L" + targetLayerIndex + ", EndPos_L" + targetLayerIndex);
                        } else {
                            // 単一レイヤーモード: 自身のコントロールを参照
                            endPosExpr = "effect(\"End Position\")(1).value";
                            progressExpr = "effect(\"Path Progress\")(1).value / 100";
                        }

                        // ヌルトランスフォーム参照のエクスプレッション
                        // レイヤー順序が変わっても対応できるようにレイヤー名で参照
                        var nullTransformExpr;
                        if (isMultiLayer) {
                            nullTransformExpr =
                                "var nullLayer = comp(\"" + comp.name.replace(/"/g, "\\\"") + "\").layer(\"" + nullLayerName.replace(/"/g, "\\\"") + "\");\n" +
                                "var nullPos = nullLayer.transform.position.value;\n" +
                                "var nullScale = nullLayer.transform.scale.value;\n" +
                                "var nullRot = nullLayer.transform.rotation.value * Math.PI / 180;\n" +
                                "var nullAnchor = nullLayer.transform.anchorPoint.value;\n";
                        } else {
                            nullTransformExpr =
                                "var nullPos = transform.position.value;\n" +
                                "var nullScale = transform.scale.value;\n" +
                                "var nullRot = transform.rotation.value * Math.PI / 180;\n" +
                                "var nullAnchor = transform.anchorPoint.value;\n";
                        }

                        var posExprBase =
                            "// Mask Path Motion\n" +
                            "var ctrl = " + effectSourceExpr + ";\n" +
                            "// \u5404\u30ec\u30a4\u30e4\u30fc\u500b\u5225\u306eProgress\uff08\u30b0\u30e9\u30d5\u30a8\u30c7\u30a3\u30bf\u3067\u30a4\u30fc\u30b8\u30f3\u30b0\u7de8\u96c6\u53ef\u80fd\uff09\n" +
                            "var progress = Math.max(0, Math.min(1, " + progressExpr + "));\n" +
                            "var pathRot = (ctrl.effect(\"Path Rotation\")(1).value + " + layerRotOffset + ") * Math.PI / 180;\n" +
                            "var maskShape = " + maskSourceExpr + ";\n" +
                            "var verts = maskShape.points();\n" +
                            "var inT = maskShape.inTangents();\n" +
                            "var outT = maskShape.outTangents();\n" +
                            "var numVerts = verts.length;\n" +
                            "\n" +
                            "// \u30cc\u30eb\u306e\u30c8\u30e9\u30f3\u30b9\u30d5\u30a9\u30fc\u30e0\u3092\u53d6\u5f97\uff08\u5916\u90e8\u30b9\u30af\u30ea\u30d7\u30c8\u5bfe\u5fdc\uff09\n" +
                            nullTransformExpr +
                            "\n" +
                            "// \u30ed\u30fc\u30ab\u30eb\u5ea7\u6a19\u3092\u30ef\u30fc\u30eb\u30c9\u5ea7\u6a19\u306b\u5909\u63db\u3059\u308b\u95a2\u6570\n" +
                            "function localToWorld(pt) {\n" +
                            "    // \u30a2\u30f3\u30ab\u30fc\u30dd\u30a4\u30f3\u30c8\u304b\u3089\u306e\u30aa\u30d5\u30bb\u30c3\u30c8\n" +
                            "    var dx = pt[0] - nullAnchor[0];\n" +
                            "    var dy = pt[1] - nullAnchor[1];\n" +
                            "    // \u30b9\u30b1\u30fc\u30eb\u9069\u7528\n" +
                            "    dx *= nullScale[0] / 100;\n" +
                            "    dy *= nullScale[1] / 100;\n" +
                            "    // \u56de\u8ee2\u9069\u7528\n" +
                            "    var cos = Math.cos(nullRot);\n" +
                            "    var sin = Math.sin(nullRot);\n" +
                            "    var rx = dx * cos - dy * sin;\n" +
                            "    var ry = dx * sin + dy * cos;\n" +
                            "    // \u4f4d\u7f6e\u30aa\u30d5\u30bb\u30c3\u30c8\n" +
                            "    return [nullPos[0] + rx, nullPos[1] + ry];\n" +
                            "}\n" +
                            "\n" +
                            "var endPt = localToWorld(verts[numVerts - 1]);\n" +
                            "// \u7d42\u70b9\u4f4d\u7f6e\u3092Point Control\u304b\u3089\u53d6\u5f97\n" +
                            "var endPos = " + endPosExpr + ";\n" +
                            "// \u30aa\u30d5\u30bb\u30c3\u30c8\u3092\u52d5\u7684\u306b\u8a08\u7b97\uff08\u7d42\u70b9\u4f4d\u7f6e\u3068\u30d1\u30b9\u7d42\u70b9\u306e\u5dee\u5206\uff09\n" +
                            "var offsetX = endPos[0] - endPt[0];\n" +
                            "var offsetY = endPos[1] - endPt[1];\n" +
                            "\n" +
                            "function bezier(p0, c0, c1, p1, t) {\n" +
                            "    var u = 1 - t;\n" +
                            "    return [\n" +
                            "        u*u*u*p0[0] + 3*u*u*t*c0[0] + 3*u*t*t*c1[0] + t*t*t*p1[0],\n" +
                            "        u*u*u*p0[1] + 3*u*u*t*c0[1] + 3*u*t*t*c1[1] + t*t*t*p1[1]\n" +
                            "    ];\n" +
                            "}\n" +
                            "\n" +
                            "function rotPt(pt, center, rad) {\n" +
                            "    var c = Math.cos(rad);\n" +
                            "    var s = Math.sin(rad);\n" +
                            "    var dx = pt[0] - center[0];\n" +
                            "    var dy = pt[1] - center[1];\n" +
                            "    return [center[0] + dx*c - dy*s, center[1] + dx*s + dy*c];\n" +
                            "}\n" +
                            "\n" +
                            "var numSegs = numVerts - 1;\n" +
                            "var totalT = progress * numSegs;\n" +
                            "var segIdx = Math.floor(totalT);\n" +
                            "if (segIdx >= numSegs) segIdx = numSegs - 1;\n" +
                            "if (segIdx < 0) segIdx = 0;\n" +
                            "var localT = totalT - segIdx;\n" +
                            "\n" +
                            "var p0 = verts[segIdx];\n" +
                            "var p1 = verts[segIdx + 1];\n" +
                            "var c0 = [p0[0] + outT[segIdx][0], p0[1] + outT[segIdx][1]];\n" +
                            "var c1 = [p1[0] + inT[segIdx + 1][0], p1[1] + inT[segIdx + 1][1]];\n" +
                            "\n" +
                            "var pt = bezier(p0, c0, c1, p1, localT);\n" +
                            "// \u30d9\u30b8\u30a7\u8a08\u7b97\u7d50\u679c\u3092\u30ef\u30fc\u30eb\u30c9\u5ea7\u6a19\u306b\u5909\u63db\n" +
                            "var worldPt = localToWorld(pt);\n" +
                            "\n" +
                            "var finalPt = [worldPt[0] + offsetX, worldPt[1] + offsetY];\n" +
                            "var center = endPos;\n" +
                            "if (pathRot != 0) {\n" +
                            "    finalPt = rotPt(finalPt, center, pathRot);\n" +
                            "}\n" +
                            "";

                        var posExpr =
                            posExprBase +
                            "// \u30ec\u30a4\u30e4\u30fc\u4f4d\u7f6e\u306e\u7de8\u96c6\u3092\u53cd\u6620\uff08value - endPos \u3067\u8ffd\u52a0\u30aa\u30d5\u30bb\u30c3\u30c8\u3092\u8a08\u7b97\uff09\n" +
                            "var posOffset = [value[0] - endPos[0], value[1] - endPos[1]];\n" +
                            "[finalPt[0] + posOffset[0], finalPt[1] + posOffset[1]];";

                        if (positionProp.dimensionsSeparated) {
                            var transformGroup = targetLayer.property("ADBE Transform Group");
                            var posXProp = transformGroup.property("ADBE Position_0");
                            var posYProp = transformGroup.property("ADBE Position_1");
                            if (posXProp && posYProp) {
                                var posXExpr =
                                    posExprBase +
                                    "// Separate Dimensions (X)\n" +
                                    "var posOffset = value - endPos[0];\n" +
                                    "finalPt[0] + posOffset;";
                                var posYExpr =
                                    posExprBase +
                                    "// Separate Dimensions (Y)\n" +
                                    "var posOffset = value - endPos[1];\n" +
                                    "finalPt[1] + posOffset;";
                                posXProp.expression = posXExpr;
                                posYProp.expression = posYExpr;
                            }
                            if (targetLayer.threeDLayer) {
                                var posZProp = transformGroup.property("ADBE Position_2");
                                if (posZProp) {
                                    posZProp.expression = "value;";
                                }
                            }
                        } else {
                            positionProp.expression = posExpr;
                        }

                        // Rotationエクスプレッション設定
                        targetLayer = comp.layer(targetLayerIndex);
                        var rotationProp = targetLayer.transform.rotation;

                        // Rotation用のヌルトランスフォーム参照
                        // レイヤー順序が変わっても対応できるようにレイヤー名で参照
                        var nullRotTransformExpr;
                        if (isMultiLayer) {
                            nullRotTransformExpr =
                                "var nullLayer = comp(\"" + comp.name.replace(/"/g, "\\\"") + "\").layer(\"" + nullLayerName.replace(/"/g, "\\\"") + "\");\n" +
                                "var nullScale = nullLayer.transform.scale.value;\n" +
                                "var nullRot = nullLayer.transform.rotation.value;\n";
                        } else {
                            nullRotTransformExpr =
                                "var nullScale = transform.scale.value;\n" +
                                "var nullRot = transform.rotation.value;\n";
                        }

                        var rotExpr =
                            "// Mask Path Motion - Auto Orient\n" +
                            "var ctrl = " + effectSourceExpr + ";\n" +
                            "var autoOrientEnabled = ctrl.effect(\"Auto-Orient\")(1).value;\n" +
                            "if (autoOrientEnabled == 0) {\n" +
                            "    value;\n" +
                            "} else {\n" +
                            "// \u5404\u30ec\u30a4\u30e4\u30fc\u500b\u5225\u306eProgress\n" +
                            "var progress = Math.max(0, Math.min(1, " + progressExpr + "));\n" +
                            "var pathRot = ctrl.effect(\"Path Rotation\")(1).value + " + layerRotOffset + ";\n" +
                            "var origRot = " + origRotation + "; // \u5143\u306e\u56de\u8ee2\u5024\n" +
                            "var maskShape = " + maskSourceExpr + ";\n" +
                            "var verts = maskShape.points();\n" +
                            "var inT = maskShape.inTangents();\n" +
                            "var outT = maskShape.outTangents();\n" +
                            "var numVerts = verts.length;\n" +
                            "\n" +
                            "// \u30cc\u30eb\u306e\u30c8\u30e9\u30f3\u30b9\u30d5\u30a9\u30fc\u30e0\u3092\u53d6\u5f97\uff08\u5916\u90e8\u30b9\u30af\u30ea\u30d7\u30c8\u5bfe\u5fdc\uff09\n" +
                            nullRotTransformExpr +
                            "\n" +
                            "function bezierTan(p0, c0, c1, p1, t) {\n" +
                            "    var u = 1 - t;\n" +
                            "    return [\n" +
                            "        3*u*u*(c0[0]-p0[0]) + 6*u*t*(c1[0]-c0[0]) + 3*t*t*(p1[0]-c1[0]),\n" +
                            "        3*u*u*(c0[1]-p0[1]) + 6*u*t*(c1[1]-c0[1]) + 3*t*t*(p1[1]-c1[1])\n" +
                            "    ];\n" +
                            "}\n" +
                            "\n" +
                            "// \u30b9\u30e0\u30fc\u30ba\u30b9\u30c6\u30c3\u30d7\u95a2\u6570\uff08\u6ed1\u3089\u304b\u306a\u30d6\u30ec\u30f3\u30c9\uff09\n" +
                            "function smoothstep(t) {\n" +
                            "    return t * t * (3 - 2 * t);\n" +
                            "}\n" +
                            "\n" +
                            "var numSegs = numVerts - 1;\n" +
                            "var totalT = progress * numSegs;\n" +
                            "var segIdx = Math.floor(totalT);\n" +
                            "if (segIdx >= numSegs) segIdx = numSegs - 1;\n" +
                            "if (segIdx < 0) segIdx = 0;\n" +
                            "var localT = totalT - segIdx;\n" +
                            "\n" +
                            "var p0 = verts[segIdx];\n" +
                            "var p1 = verts[segIdx + 1];\n" +
                            "var c0 = [p0[0] + outT[segIdx][0], p0[1] + outT[segIdx][1]];\n" +
                            "var c1 = [p1[0] + inT[segIdx + 1][0], p1[1] + inT[segIdx + 1][1]];\n" +
                            "\n" +
                            "var tan = bezierTan(p0, c0, c1, p1, localT);\n" +
                            "// \u30b9\u30b1\u30fc\u30eb\u3092\u8003\u616e\u3057\u3066\u63a5\u7dda\u3092\u5909\u63db\uff08X\u3068Y\u3067\u7570\u306a\u308b\u30b9\u30b1\u30fc\u30eb\u306e\u5834\u5408\uff09\n" +
                            "tan = [tan[0] * nullScale[0] / 100, tan[1] * nullScale[1] / 100];\n" +
                            "var tangentAngle = Math.atan2(tan[1], tan[0]) * 180 / Math.PI + pathRot + nullRot;\n" +
                            "\n" +
                            "// \u7d42\u70b9\u4ed8\u8fd1\uff08progress > 0.7\uff09\u3067\u5143\u306e\u56de\u8ee2\u5024\u306b\u30d6\u30ec\u30f3\u30c9\n" +
                            "var blendStart = 0.7;\n" +
                            "if (progress > blendStart) {\n" +
                            "    var blendT = (progress - blendStart) / (1 - blendStart);\n" +
                            "    blendT = smoothstep(blendT);\n" +
                            "    // \u89d2\u5ea6\u306e\u6700\u77ed\u8ddd\u96e2\u3067\u30d6\u30ec\u30f3\u30c9\n" +
                            "    var diff = origRot - tangentAngle;\n" +
                            "    while (diff > 180) diff -= 360;\n" +
                            "    while (diff < -180) diff += 360;\n" +
                            "    tangentAngle + diff * blendT;\n" +
                            "} else {\n" +
                            "    tangentAngle;\n" +
                            "}\n" +
                            "}";

                        rotationProp.expression = rotExpr;
                    }

                    var resultMsg = "\u30e2\u30fc\u30b7\u30e7\u30f3\u3092\u9069\u7528\u3057\u307e\u3057\u305f\u3002\n\n";
                    resultMsg += "\u30fbPath Progress: \u9032\u884c\u5ea6\u30b9\u30e9\u30a4\u30c0\u30fc\uff080-100%\uff09\n";
                    resultMsg += "\u30fbPath Rotation: \u30d1\u30b9\u306e\u56de\u8ee2\u89d2\u5ea6\n";
                    resultMsg += "\u30fbAuto-Orient: \u63a5\u7dda\u65b9\u5411\u306b\u56de\u8ee2\n";
                    if (isMultiLayer) {
                        resultMsg += "\n\u9069\u7528\u30ec\u30a4\u30e4\u30fc\u6570: " + numTargets;
                    }

                    alert(resultMsg);

                } catch (e) {
                    log("ERROR: " + e.toString());
                    showLog();
                    alert("\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f: " + e.toString() + "\n\n\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0\u3092\u30b3\u30f3\u30bd\u30fc\u30eb\u306b\u51fa\u529b\u3057\u307e\u3057\u305f\u3002");
                }

                app.endUndoGroup();
            }

            // Create Path Null Button - マスクパス付きヌルを作成
            createNullBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) {
                    alert("\u30b3\u30f3\u30dd\u30b8\u30b7\u30e7\u30f3\u3092\u30a2\u30af\u30c6\u30a3\u30d6\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                app.beginUndoGroup("Create PathMotion Null");

                try {
                    // ヌルレイヤーを作成
                    var nullLayer = comp.layers.addNull();
                    nullLayer.name = "PathMotion_Null";
                    var nullLayerIndex = nullLayer.index;

                    // ヌルレイヤーを画面中央に配置
                    var cx = comp.width / 2;
                    var cy = comp.height / 2;
                    nullLayer.transform.position.setValue([cx, cy]);

                    // デフォルトのS字カーブを作成（ヌル位置からの相対座標）
                    var defaultPath = new Shape();
                    defaultPath.vertices = [
                        [-300, -150],
                        [0, 0],
                        [300, 150]
                    ];
                    defaultPath.inTangents = [
                        [0, 0],
                        [-150, -120],
                        [0, 0]
                    ];
                    defaultPath.outTangents = [
                        [150, 120],
                        [150, 120],
                        [0, 0]
                    ];
                    defaultPath.closed = false;

                    // ヌルにマスクを追加
                    nullLayer = comp.layer(nullLayerIndex);
                    var nullMasks = nullLayer.property("ADBE Mask Parade");
                    var newMask = nullMasks.addProperty("ADBE Mask Atom");
                    newMask.property("ADBE Mask Shape").setValue(defaultPath);
                    newMask.property("ADBE Mask Mode").setValue(MaskMode.NONE);

                    // ヌルを選択
                    nullLayer = comp.layer(nullLayerIndex);
                    nullLayer.selected = true;

                    alert("PathMotion_Null\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f\u3002\n\n" +
                        "1. \u30de\u30b9\u30af\u30d1\u30b9\u3092\u7de8\u96c6\u3057\u3066\u30d1\u30b9\u306e\u5f62\u72b6\u3092\u8abf\u6574\n" +
                        "2. PathMotion_Null\u3068\u52d5\u304b\u3057\u305f\u3044\u30ec\u30a4\u30e4\u30fc\u3092\u9078\u629e\n" +
                        "3. Apply Motion\u3092\u5b9f\u884c");

                } catch (e) {
                    alert("\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f: " + e.toString());
                }

                app.endUndoGroup();
            };

            // Button handler
            applyBtn.onClick = function () {
                applyMotion();
            };

            // Open Path Button - マスクパスをオープンパスにする
            openPathBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) {
                    alert("\u30b3\u30f3\u30dd\u30b8\u30b7\u30e7\u30f3\u3092\u30a2\u30af\u30c6\u30a3\u30d6\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                var sel = comp.selectedLayers;
                if (!sel || sel.length === 0) {
                    alert("\u30ec\u30a4\u30e4\u30fc\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                var maskIndex = parseNumber(maskIndexTxt.text, 1);

                app.beginUndoGroup("Open Mask Path");

                for (var i = 0; i < sel.length; i++) {
                    var layer = sel[i];
                    var masks = layer.property("ADBE Mask Parade");
                    if (masks && masks.numProperties >= maskIndex) {
                        var mask = masks.property(maskIndex);
                        var maskPath = mask.property("ADBE Mask Shape");
                        var pathValue = maskPath.valueAtTime(comp.time, false);

                        // オープンパスに変更
                        var newPath = new Shape();
                        newPath.vertices = pathValue.vertices;
                        newPath.inTangents = pathValue.inTangents;
                        newPath.outTangents = pathValue.outTangents;
                        newPath.closed = false;

                        maskPath.setValueAtTime(comp.time, newPath);
                    }
                }

                app.endUndoGroup();
                alert("\u30de\u30b9\u30af\u30d1\u30b9\u3092\u30aa\u30fc\u30d7\u30f3\u30d1\u30b9\u306b\u3057\u307e\u3057\u305f\u3002");
            };

            // Select Mask Button - マスクパスを選択状態にする
            selectMaskBtn.onClick = function () {
                var comp = getActiveComp();
                if (!comp) {
                    alert("\u30b3\u30f3\u30dd\u30b8\u30b7\u30e7\u30f3\u3092\u30a2\u30af\u30c6\u30a3\u30d6\u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                var sel = comp.selectedLayers;
                if (!sel || sel.length !== 1) {
                    alert("\u5358\u4e00\u30ec\u30a4\u30e4\u30fc\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
                    return;
                }

                var layer = sel[0];
                var maskIndex = parseNumber(maskIndexTxt.text, 1);
                var masks = layer.property("ADBE Mask Parade");

                if (!masks || masks.numProperties < maskIndex) {
                    alert("\u30de\u30b9\u30af " + maskIndex + " \u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002");
                    return;
                }

                var mask = masks.property(maskIndex);
                var maskPath = mask.property("ADBE Mask Shape");

                // マスクパスを選択
                maskPath.selected = true;

                alert("\u30de\u30b9\u30af " + maskIndex + " \u306e\u30d1\u30b9\u3092\u9078\u629e\u3057\u307e\u3057\u305f\u3002");
            };

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
