/* 
Auto Rect Shape (Follow + Bake) for Adobe After Effects
- Creates a Shape Layer rectangle matching selected layer bounds (sourceRectAtTime)
- Follows size/position changes via expressions (uses comp-space corners => accurate fit)
- Padding & Roundness adjustable in Effect Controls
- Bake: converts to static shape at current time (removes expressions)
- Pre-Compose: converts shape to composition with tracking

Install:
1) Save as: AutoRectShapePanel.jsx
2) Put in:  
   Windows: C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
   macOS:   /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
3) Restart AE, open: Window > AutoRectShapePanel
*/

(function AutoRectShapePanel(thisObj) {

    var SCRIPT_NAME = "AutoRectShapePanel";
    var SCRIPT_VERSION = "1.5.0";
    var TAG_COMMENT = "AUTO_RECT_SHAPE_PANEL";

    // デバッグログ用
    var debugLog = [];
    function log(msg) {
        debugLog.push(msg);
        $.writeln("[DEBUG] " + msg);
    }
    function showDebugLog() {
        if (debugLog.length > 0) {
            alert("=== デバッグログ ===\n" + debugLog.join("\n"));
        }
    }
    function clearLog() {
        debugLog = [];
    }

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ? thisObj : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        if (pal !== null) {
            pal.orientation = "column";
            pal.alignChildren = ["fill", "top"];

            // Header
            var header = pal.add("group");
            header.orientation = "row";
            header.add("statictext", undefined, "Auto Rect Shape (Follow + Bake)");
            header.add("statictext", undefined, "v" + SCRIPT_VERSION);

            // Options panel
            var opt = pal.add("panel", undefined, "Options");
            opt.orientation = "column";
            opt.alignChildren = ["fill", "top"];

            var row1 = opt.add("group");
            row1.orientation = "row";
            row1.alignChildren = ["left", "center"];
            row1.add("statictext", undefined, "Default Padding:");
            var padTxt = row1.add("edittext", undefined, "0");
            padTxt.characters = 6;
            row1.add("statictext", undefined, "px");

            var row2 = opt.add("group");
            row2.orientation = "row";
            row2.alignChildren = ["left", "center"];
            row2.add("statictext", undefined, "Default Roundness:");
            var rndTxt = row2.add("edittext", undefined, "0");
            rndTxt.characters = 6;
            row2.add("statictext", undefined, "px");

            var row3 = opt.add("group");
            row3.orientation = "row";
            row3.alignChildren = ["left", "center"];

            var fillChk = row3.add("checkbox", undefined, "Add Fill");
            fillChk.value = true;

            var strokeChk = row3.add("checkbox", undefined, "Add Stroke");
            strokeChk.value = false;

            row3.add("statictext", undefined, "Stroke:");
            var strokeTxt = row3.add("edittext", undefined, "4");
            strokeTxt.characters = 4;
            row3.add("statictext", undefined, "px");

            // Buttons
            var btns = pal.add("group");
            btns.orientation = "row";
            btns.alignChildren = ["fill", "center"];

            var createBtn = btns.add("button", undefined, "Create (Fit)");
            var bakeBtn = btns.add("button", undefined, "Bake (Static)");
            var preCompBtn = btns.add("button", undefined, "Pre-Compose");

            // Helpers
            function parseNumber(str, fallback) {
                var n = Number(str);
                return (isFinite(n)) ? n : fallback;
            }

            function getActiveComp() {
                var item = app.project.activeItem;
                if (item && item instanceof CompItem) return item;
                return null;
            }

            function getShapeContents(shapeLayer) {
                return shapeLayer.property("ADBE Root Vectors Group");
            }

            function addRectangleStatic(shapeLayer, defaultPadding, defaultRoundness, addFill, addStroke, strokeWidth, size) {
                var step = "start";
                clearLog();
                log("addRectangleStatic called");
                log("shapeLayer: " + (shapeLayer ? shapeLayer.name : "null"));
                log("shapeLayer.index: " + (shapeLayer ? shapeLayer.index : "N/A"));

                // シェイプレイヤーのインデックスを保存（参照再取得用）
                var shapeLayerIndex = shapeLayer.index;
                var comp = shapeLayer.containingComp;

                try {
                    if (!shapeLayer) {
                        throw new Error("シェイプレイヤーの作成に失敗しました。");
                    }

                    step = "get contents";
                    log("Step: " + step);
                    var contents = getShapeContents(shapeLayer);
                    log("contents obtained: " + (contents ? contents.name : "null"));

                    step = "add group";
                    log("Step: " + step);
                    try {
                        log("contents.canAddProperty: " + (typeof contents.canAddProperty));
                        if (contents.canAddProperty && !contents.canAddProperty("ADBE Vector Group")) {
                            throw new Error("Vector Group を追加できません。");
                        }
                        log("Adding ADBE Vector Group...");
                        var grp = contents.addProperty("ADBE Vector Group");
                        log("grp: " + (grp ? grp.name : "null"));
                        if (grp) {
                            grp.name = "AutoRect";
                        }
                    } catch (e) {
                        log("Error in add group: " + e.toString());
                        throw e;
                    }

                    // ★ DOM操作後、参照を再取得してからプロパティにアクセス
                    step = "re-acquire group reference";
                    log("Step: " + step);
                    shapeLayer = comp.layer(shapeLayerIndex);
                    contents = getShapeContents(shapeLayer);
                    var grpRef = contents.property("AutoRect");
                    if (!grpRef) {
                        throw new Error("AutoRect グループが見つかりません");
                    }
                    var container = grpRef.property("ADBE Vectors Group");
                    log("container re-acquired: " + (container ? container.name : "null"));

                    step = "add rect";
                    log("Step: " + step);
                    if (container.canAddProperty && !container.canAddProperty("ADBE Vector Shape - Rect")) {
                        throw new Error("Rect を追加できません。");
                    }
                    log("Adding ADBE Vector Shape - Rect...");
                    container.addProperty("ADBE Vector Shape - Rect");

                    // ★ Rect追加後に参照を再取得
                    step = "re-acquire rect reference";
                    log("Step: " + step);
                    shapeLayer = comp.layer(shapeLayerIndex);
                    contents = getShapeContents(shapeLayer);
                    grpRef = contents.property("AutoRect");
                    container = grpRef.property("ADBE Vectors Group");
                    var rectRef = container.property("ADBE Vector Shape - Rect");
                    if (rectRef) rectRef.name = "Rect";
                    log("rectRef: " + (rectRef ? rectRef.name : "null"));

                    // Fill / Stroke
                    step = "add fill/stroke";
                    log("Step: " + step);
                    if (addFill) {
                        container.addProperty("ADBE Vector Graphic - Fill");
                    }
                    if (addStroke) {
                        container.addProperty("ADBE Vector Graphic - Stroke");
                    }

                    // ★ Fill/Stroke追加後に全参照を再取得
                    step = "re-acquire all references for set values";
                    log("Step: " + step);
                    shapeLayer = comp.layer(shapeLayerIndex);
                    contents = getShapeContents(shapeLayer);
                    grpRef = contents.property("AutoRect");
                    container = grpRef.property("ADBE Vectors Group");
                    rectRef = container.property("Rect");
                    log("Final rectRef: " + (rectRef ? rectRef.name : "null"));

                    // Apply static values
                    step = "set rect values";
                    log("Step: " + step);
                    rectRef.property("ADBE Vector Rect Size").setValue([size.width + defaultPadding * 2, size.height + defaultPadding * 2]);
                    rectRef.property("ADBE Vector Rect Position").setValue([0, 0]);
                    rectRef.property("ADBE Vector Rect Roundness").setValue(defaultRoundness);

                    // Fill/Stroke の値設定
                    step = "set fill/stroke values";
                    log("Step: " + step);
                    if (addFill) {
                        var fillRef = container.property("Fill");
                        if (fillRef) {
                            fillRef.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);
                        }
                    }
                    if (addStroke) {
                        var strokeRef = container.property("Stroke");
                        if (strokeRef) {
                            strokeRef.property("ADBE Vector Stroke Width").setValue(strokeWidth);
                            strokeRef.property("ADBE Vector Stroke Color").setValue([0, 0, 0, 1]);
                        }
                    }

                    step = "set group position";
                    log("Step: " + step);
                    grpRef.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([0, 0]);

                    // Tag in comment
                    shapeLayer.comment = TAG_COMMENT;

                    log("addRectangleStatic completed successfully");
                    return {
                        group: grpRef,
                        rect: rectRef
                    };
                } catch (e) {
                    log("ERROR at step '" + step + "': " + e.toString());
                    showDebugLog();
                    throw new Error("addRectangleStatic/" + step + ": " + e.toString());
                }
            }

            function createFollowShapes() {
                var comp = getActiveComp();
                if (!comp) {
                    alert("コンポジションをアクティブにしてください。");
                    return;
                }
                var sel = comp.selectedLayers;
                if (!sel || sel.length === 0) {
                    alert("追従させたいレイヤーを選択してください。");
                    return;
                }

                var defaultPadding = parseNumber(padTxt.text, 0);
                var defaultRoundness = parseNumber(rndTxt.text, 0);
                var strokeWidth = parseNumber(strokeTxt.text, 4);

                app.beginUndoGroup("Create Auto Rect Shape (Fit)");

                var errors = [];
                for (var i = 0; i < sel.length; i++) {
                    var target = sel[i];
                    var step = "start";
                    try {
                        step = "validate target";
                        if (!target || !target.sourceRectAtTime) {
                            throw new Error("sourceRectAtTime が利用できないレイヤーです。");
                        }

                        var tIndex = target.index;
                        var tName = target.name;

                        step = "create shape layer";
                        var sh = comp.layers.addShape();
                        sh.name = "AutoRect - " + tName;

                        // ★ 重要: DOM操作（moveAfter）を先に実行
                        step = "moveAfter";
                        sh.moveAfter(target);

                        // ★ moveAfter後はshへの参照が無効化されるため、インデックスで再取得
                        var shIndex = target.index + 1;
                        sh = comp.layer(shIndex);

                        step = "add rectangle";
                        addRectangleStatic(
                            sh,
                            defaultPadding,
                            defaultRoundness,
                            fillChk.value,
                            strokeChk.value,
                            strokeWidth,
                            { width: 1, height: 1 }
                        );

                        // ★ addRectangleStatic後に参照を再取得（Object Invalid対策）
                        step = "re-acquire shape layer";
                        sh = comp.layer(shIndex);

                        // ★ Layer Controlエフェクトを追加（レイヤー名変更に対応）
                        step = "add layer control";
                        var fx = sh.property("ADBE Effect Parade");
                        var layerCtrl = fx.addProperty("ADBE Layer Control");
                        layerCtrl.name = "Target Layer";

                        // ★ スライダーエフェクトを追加（幅・高さ・パディング制御用）
                        step = "add sliders";
                        sh = comp.layer(shIndex);
                        fx = sh.property("ADBE Effect Parade");

                        var paddingSlider = fx.addProperty("ADBE Slider Control");
                        paddingSlider.name = "Padding";
                        paddingSlider.property("ADBE Slider Control-0001").setValue(defaultPadding);

                        sh = comp.layer(shIndex);
                        fx = sh.property("ADBE Effect Parade");
                        var widthSlider = fx.addProperty("ADBE Slider Control");
                        widthSlider.name = "Width Offset";
                        widthSlider.property("ADBE Slider Control-0001").setValue(0);

                        sh = comp.layer(shIndex);
                        fx = sh.property("ADBE Effect Parade");
                        var heightSlider = fx.addProperty("ADBE Slider Control");
                        heightSlider.name = "Height Offset";
                        heightSlider.property("ADBE Slider Control-0001").setValue(0);

                        // ★ Layer Controlにターゲットレイヤーを設定
                        step = "set layer control value";
                        sh = comp.layer(shIndex);
                        fx = sh.property("ADBE Effect Parade");
                        layerCtrl = fx.property("Target Layer");
                        layerCtrl.property("ADBE Layer Control-0001").setValue(tIndex);

                        // ★ エフェクト追加後に参照を再取得
                        step = "re-acquire after effects";
                        sh = comp.layer(shIndex);
                        var contents = getShapeContents(sh);
                        var grp = contents.property("AutoRect");
                        var container = grp.property("ADBE Vectors Group");
                        var rect = container.property("Rect");

                        step = "get rect props";
                        var rectSize = rect.property("ADBE Vector Rect Size");
                        var grpPos = grp.property("ADBE Vector Transform Group").property("ADBE Vector Position");

                        step = "set expressions";
                        // ★ エフェクトからパラメータを取得するエクスプレッション
                        var sizeExpr =
                            "var t = thisLayer.effect(\"Target Layer\")(\"レイヤー\");\n" +
                            "if (!t) { value; } else {\n" +
                            "var p = thisLayer.effect(\"Padding\")(\"スライダー\");\n" +
                            "var wOffset = thisLayer.effect(\"Width Offset\")(\"スライダー\");\n" +
                            "var hOffset = thisLayer.effect(\"Height Offset\")(\"スライダー\");\n" +
                            "var r = t.sourceRectAtTime(time, false);\n" +
                            "var tlC = t.toComp([r.left, r.top]);\n" +
                            "var trC = t.toComp([r.left + r.width, r.top]);\n" +
                            "var blC = t.toComp([r.left, r.top + r.height]);\n" +
                            "var brC = t.toComp([r.left + r.width, r.top + r.height]);\n" +
                            "var tl = fromComp(tlC);\n" +
                            "var tr = fromComp(trC);\n" +
                            "var bl = fromComp(blC);\n" +
                            "var br = fromComp(brC);\n" +
                            "var minX = Math.min(tl[0], tr[0], bl[0], br[0]);\n" +
                            "var maxX = Math.max(tl[0], tr[0], bl[0], br[0]);\n" +
                            "var minY = Math.min(tl[1], tr[1], bl[1], br[1]);\n" +
                            "var maxY = Math.max(tl[1], tr[1], bl[1], br[1]);\n" +
                            "[Math.abs(maxX - minX) + p*2 + wOffset, Math.abs(maxY - minY) + p*2 + hOffset];\n" +
                            "}";

                        var posExpr =
                            "var t = thisLayer.effect(\"Target Layer\")(\"レイヤー\");\n" +
                            "if (!t) { value; } else {\n" +
                            "var r = t.sourceRectAtTime(time, false);\n" +
                            "var tlC = t.toComp([r.left, r.top]);\n" +
                            "var trC = t.toComp([r.left + r.width, r.top]);\n" +
                            "var blC = t.toComp([r.left, r.top + r.height]);\n" +
                            "var brC = t.toComp([r.left + r.width, r.top + r.height]);\n" +
                            "var tl = fromComp(tlC);\n" +
                            "var tr = fromComp(trC);\n" +
                            "var bl = fromComp(blC);\n" +
                            "var br = fromComp(brC);\n" +
                            "var minX = Math.min(tl[0], tr[0], bl[0], br[0]);\n" +
                            "var maxX = Math.max(tl[0], tr[0], bl[0], br[0]);\n" +
                            "var minY = Math.min(tl[1], tr[1], bl[1], br[1]);\n" +
                            "var maxY = Math.max(tl[1], tr[1], bl[1], br[1]);\n" +
                            "[(minX + maxX) / 2, (minY + maxY) / 2];\n" +
                            "}";

                        // エクスプレッションを適用
                        step = "apply expressions";
                        rectSize.expression = sizeExpr;
                        grpPos.expression = posExpr;

                        step = "match in/out";
                        // ★ sh参照を再取得
                        sh = comp.layer(shIndex);
                        sh.inPoint = target.inPoint;
                        sh.outPoint = target.outPoint;
                    } catch (e) {
                        var name = target ? target.name : "(unknown)";
                        var idx = target ? target.index : "?";
                        errors.push(name + " (index " + idx + ", step " + step + "): " + e.toString());
                    }
                }
                if (errors.length > 0) {
                    alert("AutoRect 作成中にエラーが発生しました:\n" + errors.join("\n"));
                }

                app.endUndoGroup();
            }

            function bakeSelectedAutoRects() {
                var comp = getActiveComp();
                if (!comp) {
                    alert("コンポジションをアクティブにしてください。");
                    return;
                }

                var sel = comp.selectedLayers;
                if (!sel || sel.length === 0) {
                    alert("ベイクしたいシェイプレイヤー（AutoRect）を選択してください。");
                    return;
                }

                var t = comp.time;

                app.beginUndoGroup("Bake Auto Rect Shape (Static)");

                for (var i = 0; i < sel.length; i++) {
                    var ly = sel[i];
                    if (!(ly instanceof ShapeLayer)) continue;

                    var isAuto = (ly.comment === TAG_COMMENT) || (ly.name.indexOf("AutoRect - ") === 0);
                    if (!isAuto) continue;

                    try {
                        var contents = ly.property("ADBE Root Vectors Group");
                        if (!contents) continue;

                        var grp = null;
                        for (var g = 1; g <= contents.numProperties; g++) {
                            if (contents.property(g).matchName === "ADBE Vector Group" && contents.property(g).name === "AutoRect") {
                                grp = contents.property(g);
                                break;
                            }
                        }
                        if (!grp) continue;

                        var grpContents = grp.property("ADBE Vectors Group");

                        var rect = null;
                        for (var r = 1; r <= grpContents.numProperties; r++) {
                            if (grpContents.property(r).matchName === "ADBE Vector Shape - Rect") {
                                rect = grpContents.property(r);
                                break;
                            }
                        }
                        if (!rect) continue;

                        var rectSize = rect.property("ADBE Vector Rect Size");
                        var rectRound = rect.property("ADBE Vector Rect Roundness");
                        var grpPos = grp.property("ADBE Vector Transform Group").property("ADBE Vector Position");

                        var sizeVal = rectSize.valueAtTime(t, false);
                        var roundVal = rectRound.valueAtTime(t, false);
                        var posVal = grpPos.valueAtTime(t, false);

                        rectSize.expression = "";
                        rectSize.setValue(sizeVal);

                        rectRound.expression = "";
                        rectRound.setValue(roundVal);

                        grpPos.expression = "";
                        grpPos.setValue(posVal);

                        var fx = ly.property("ADBE Effect Parade");
                        if (fx) {
                            for (var p = fx.numProperties; p >= 1; p--) {
                                fx.property(p).remove();
                            }
                        }

                        ly.comment = "";
                        ly.name = ly.name.replace("AutoRect - ", "BakedRect - ");

                    } catch (e) {
                        // Skip layer if something goes wrong
                    }
                }

                app.endUndoGroup();
            }

            // Button handlers
            createBtn.onClick = function () {
                createFollowShapes();
            };
            bakeBtn.onClick = function () {
                bakeSelectedAutoRects();
            };
            preCompBtn.onClick = function () {
                preComposeAutoRects();
            };

            // Pre-Compose: シェイプをコンポジションに変換
            function preComposeAutoRects() {
                var comp = getActiveComp();
                if (!comp) {
                    alert("コンポジションをアクティブにしてください。");
                    return;
                }

                var sel = comp.selectedLayers;
                if (!sel || sel.length === 0) {
                    alert("プリコンポーズしたいAutoRectシェイプレイヤーを選択してください。");
                    return;
                }

                // ★ 選択レイヤーの情報を先に収集（DOM操作で無効化されないように）
                var layersToProcess = [];
                for (var i = 0; i < sel.length; i++) {
                    var ly = sel[i];
                    if (!(ly instanceof ShapeLayer)) continue;
                    var isAuto = (ly.comment === TAG_COMMENT) || (ly.name.indexOf("AutoRect - ") === 0);
                    if (!isAuto) continue;
                    layersToProcess.push(ly.index);
                }

                if (layersToProcess.length === 0) {
                    alert("プリコンポーズ可能なAutoRectレイヤーが見つかりませんでした。");
                    return;
                }

                var t = comp.time;
                app.beginUndoGroup("Pre-Compose AutoRect");

                var preComposed = 0;
                // ★ 逆順で処理（削除時のインデックスずれを防ぐ）
                for (var idx = layersToProcess.length - 1; idx >= 0; idx--) {
                    var lyIndex = layersToProcess[idx];
                    var ly = comp.layer(lyIndex);

                    try {
                        var lyName = ly.name;

                        // Target Layerエフェクトから参照先を取得
                        var fx = ly.property("ADBE Effect Parade");
                        var targetLayerIndex = null;
                        var targetLayerName = null;
                        if (fx) {
                            var targetCtrl = fx.property("Target Layer");
                            if (targetCtrl) {
                                var targetVal = targetCtrl.property("ADBE Layer Control-0001").value;
                                if (targetVal > 0 && targetVal <= comp.numLayers) {
                                    targetLayerIndex = targetVal;
                                    targetLayerName = comp.layer(targetVal).name;
                                }
                            }
                        }

                        // シェイプ情報を取得
                        var contents = ly.property("ADBE Root Vectors Group");
                        if (!contents) continue;

                        var grp = null;
                        for (var g = 1; g <= contents.numProperties; g++) {
                            if (contents.property(g).matchName === "ADBE Vector Group" && contents.property(g).name === "AutoRect") {
                                grp = contents.property(g);
                                break;
                            }
                        }
                        if (!grp) continue;

                        var grpContents = grp.property("ADBE Vectors Group");
                        var rect = null;
                        for (var r = 1; r <= grpContents.numProperties; r++) {
                            if (grpContents.property(r).matchName === "ADBE Vector Shape - Rect") {
                                rect = grpContents.property(r);
                                break;
                            }
                        }
                        if (!rect) continue;

                        var rectSize = rect.property("ADBE Vector Rect Size");
                        var grpPos = grp.property("ADBE Vector Transform Group").property("ADBE Vector Position");

                        // 現在の値を取得
                        var sizeVal = rectSize.valueAtTime(t, false);
                        var posVal = grpPos.valueAtTime(t, false);
                        var layerPos = ly.transform.position.valueAtTime(t, false);
                        var inPt = ly.inPoint;
                        var outPt = ly.outPoint;

                        // エクスプレッションをクリアして値を設定
                        rectSize.expression = "";
                        rectSize.setValue(sizeVal);
                        grpPos.expression = "";
                        grpPos.setValue([0, 0]);

                        // エフェクトを削除
                        ly = comp.layer(lyIndex);
                        fx = ly.property("ADBE Effect Parade");
                        if (fx) {
                            for (var p = fx.numProperties; p >= 1; p--) {
                                fx.property(p).remove();
                            }
                        }

                        // プリコンポーズ用のコンポジションを作成
                        var newCompName = lyName.replace("AutoRect - ", "Comp - ");
                        var newComp = app.project.items.addComp(
                            newCompName,
                            Math.round(sizeVal[0]),
                            Math.round(sizeVal[1]),
                            comp.pixelAspect,
                            comp.duration,
                            comp.frameRate
                        );

                        // シェイプレイヤーを新しいコンプにコピー
                        ly = comp.layer(lyIndex);
                        ly.copyToComp(newComp);

                        // 新しいコンプ内のレイヤーを取得して位置を調整
                        var newLy = newComp.layer(1);
                        newLy.transform.position.setValue([newComp.width / 2, newComp.height / 2]);
                        newLy.transform.anchorPoint.setValue([0, 0]);

                        // 元のコンポジションに新しいコンプを追加
                        ly = comp.layer(lyIndex);
                        var compLayer = comp.layers.add(newComp);
                        compLayer.moveAfter(ly);

                        // ★ 参照を再取得
                        compLayer = comp.layer(lyIndex + 1);

                        // 新しいコンプレイヤーの位置を設定
                        compLayer.transform.anchorPoint.setValue([newComp.width / 2, newComp.height / 2]);

                        // ★ ターゲットレイヤーがあれば、位置・スケール・回転のエクスプレッションを設定
                        if (targetLayerName) {
                            var escapedName = targetLayerName.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
                            var bakedWidth = sizeVal[0];
                            var bakedHeight = sizeVal[1];

                            // 位置エクスプレッション
                            var posExpr =
                                "var t = thisComp.layer(\"" + escapedName + "\");\n" +
                                "if (!t) { value; } else {\n" +
                                "var r = t.sourceRectAtTime(time, false);\n" +
                                "var centerX = r.left + r.width / 2;\n" +
                                "var centerY = r.top + r.height / 2;\n" +
                                "t.toComp([centerX, centerY]);\n" +
                                "}";
                            compLayer.transform.position.expression = posExpr;

                            // ★ 参照を再取得
                            compLayer = comp.layer(lyIndex + 1);

                            // スケールエクスプレッション
                            var scaleExpr =
                                "var t = thisComp.layer(\"" + escapedName + "\");\n" +
                                "if (!t) { value; } else {\n" +
                                "var r = t.sourceRectAtTime(time, false);\n" +
                                "var bakedW = " + bakedWidth + ";\n" +
                                "var bakedH = " + bakedHeight + ";\n" +
                                "var tScale = t.transform.scale.value;\n" +
                                "var scaleX = (r.width / bakedW) * tScale[0];\n" +
                                "var scaleY = (r.height / bakedH) * tScale[1];\n" +
                                "[scaleX, scaleY];\n" +
                                "}";
                            compLayer.transform.scale.expression = scaleExpr;

                            // ★ 参照を再取得
                            compLayer = comp.layer(lyIndex + 1);

                            // 回転エクスプレッション
                            var rotExpr =
                                "var t = thisComp.layer(\"" + escapedName + "\");\n" +
                                "if (!t) { value; } else {\n" +
                                "t.transform.rotation.value;\n" +
                                "}";
                            compLayer.transform.rotation.expression = rotExpr;
                        } else {
                            compLayer.transform.position.setValue([
                                layerPos[0] + posVal[0],
                                layerPos[1] + posVal[1]
                            ]);
                        }

                        // in/outポイントを合わせる
                        compLayer = comp.layer(lyIndex + 1);
                        compLayer.inPoint = inPt;
                        compLayer.outPoint = outPt;

                        // 元のシェイプレイヤーを削除
                        ly = comp.layer(lyIndex);
                        ly.remove();

                        preComposed++;
                    } catch (e) {
                        // Skip layer if something goes wrong
                    }
                }

                if (preComposed > 0) {
                    alert(preComposed + "個のAutoRectをプリコンポーズしました。");
                }

                app.endUndoGroup();
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
