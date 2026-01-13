/* 
Auto Rect Shape (Follow + Bake) for Adobe After Effects
- Creates a Shape Layer rectangle matching selected layer bounds (sourceRectAtTime)
- Follows size/position changes via expressions (uses comp-space corners => accurate fit)
- Padding & Roundness adjustable in Effect Controls
- Bake: converts to static shape at current time (removes expressions)

Install:
1) Save as: AutoRectShapePanel.jsx
2) Put in:  
   Windows: C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
   macOS:   /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
3) Restart AE, open: Window > AutoRectShapePanel
*/

(function AutoRectShapePanel(thisObj) {

    var SCRIPT_NAME = "AutoRectShapePanel";
    var SCRIPT_VERSION = "1.3.4";
    var TAG_COMMENT = "AUTO_RECT_SHAPE_PANEL";

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

            function ensureEffectSlider(layer, name, defaultValue) {
                var fx = layer.property("ADBE Effect Parade");
                var prop = null;

                // Search existing
                for (var i = 1; i <= fx.numProperties; i++) {
                    if (fx.property(i).name === name) {
                        prop = fx.property(i);
                        break;
                    }
                }
                if (!prop) {
                    prop = fx.addProperty("ADBE Slider Control");
                    prop.name = name;
                    prop.property("ADBE Slider Control-0001").setValue(defaultValue);
                }
                return prop;
            }

            function ensureEffectLayerControl(layer, name) {
                var fx = layer.property("ADBE Effect Parade");
                var prop = null;

                for (var i = 1; i <= fx.numProperties; i++) {
                    if (fx.property(i).name === name) {
                        prop = fx.property(i);
                        break;
                    }
                }
                if (!prop) {
                    prop = fx.addProperty("ADBE Layer Control");
                    prop.name = name;
                }
                return prop;
            }

            function addRectangleStatic(shapeLayer, defaultPadding, defaultRoundness, addFill, addStroke, strokeWidth, size) {
                var contents = shapeLayer.property("ADBE Root Vectors Group");

                // Group
                var grp = contents.addProperty("ADBE Vector Group");
                grp.name = "AutoRect";

                var grpContents = grp.property("ADBE Vectors Group");

                // Rect
                var rect = grpContents.addProperty("ADBE Vector Shape - Rect");
                rect.name = "Rect";

                // Fill / Stroke
                if (addFill) {
                    var fill = grpContents.addProperty("ADBE Vector Graphic - Fill");
                    fill.name = "Fill";
                    // Default white
                    fill.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]);
                }
                if (addStroke) {
                    var stroke = grpContents.addProperty("ADBE Vector Graphic - Stroke");
                    stroke.name = "Stroke";
                    stroke.property("ADBE Vector Stroke Width").setValue(strokeWidth);
                    // Default black
                    stroke.property("ADBE Vector Stroke Color").setValue([0, 0, 0, 1]);
                }

                // Apply static values
                rect.property("ADBE Vector Rect Size").setValue([size.width + defaultPadding * 2, size.height + defaultPadding * 2]);
                rect.property("ADBE Vector Rect Position").setValue([0, 0]);
                rect.property("ADBE Vector Rect Roundness").setValue(defaultRoundness);

                grp.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([0, 0]);

                // Tag in comment so Bake can find it (if used later)
                shapeLayer.comment = TAG_COMMENT;

                return {
                    group: grp,
                    rect: rect
                };
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
                        // Create shape layer
                        var sh = comp.layers.addShape();
                        sh.name = "AutoRect - " + tName;

                        step = "moveAfter";
                        // Put under target (below in stacking order)
                        sh.moveAfter(target);

                        step = "add rectangle";
                        var rectResult = addRectangleStatic(
                            sh,
                            defaultPadding,
                            defaultRoundness,
                            fillChk.value,
                            strokeChk.value,
                            strokeWidth,
                            { width: 1, height: 1 }
                        );

                        step = "get rect props";
                        var rect = rectResult.rect;
                        var grp = rectResult.group;
                        var rectSize = rect.property("ADBE Vector Rect Size");
                        var grpPos = grp.property("ADBE Vector Transform Group").property("ADBE Vector Position");

                        var padVal = defaultPadding;

                        step = "set expressions";
                        var sizeExpr =
                            "var t = thisComp.layer(" + tIndex + ");\n" +
                            "var r = t.sourceRectAtTime(time, false);\n" +
                            "var p = " + padVal + ";\n" +
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
                            "[Math.abs(maxX - minX) + p*2, Math.abs(maxY - minY) + p*2];";

                        var posExpr =
                            "var t = thisComp.layer(" + tIndex + ");\n" +
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
                            "[(minX + maxX) / 2, (minY + maxY) / 2];";

                        rectSize.expression = sizeExpr;
                        grpPos.expression = posExpr;

                        step = "evaluate expressions";
                        var sizeVal = rectSize.valueAtTime(comp.time, false);
                        var posVal = grpPos.valueAtTime(comp.time, false);

                        step = "clear expressions";
                        rectSize.expression = "";
                        grpPos.expression = "";

                        step = "apply values";
                        if (!isFinite(sizeVal[0]) || !isFinite(sizeVal[1])) {
                            throw new Error("サイズ取得に失敗しました。");
                        }

                        rectSize.setValue(sizeVal);
                        grpPos.setValue(posVal);

                        step = "match in/out";
                        // Match target in/out points
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

                    // Identify our generated layers:
                    var isAuto = (ly.comment === TAG_COMMENT) || (ly.name.indexOf("AutoRect - ") === 0);
                    if (!isAuto) continue;

                    try {
                        var contents = ly.property("ADBE Root Vectors Group");
                        if (!contents) continue;

                        // Find "AutoRect" group
                        var grp = null;
                        for (var g = 1; g <= contents.numProperties; g++) {
                            if (contents.property(g).matchName === "ADBE Vector Group" && contents.property(g).name === "AutoRect") {
                                grp = contents.property(g);
                                break;
                            }
                        }
                        if (!grp) continue;

                        var grpContents = grp.property("ADBE Vectors Group");

                        // Find rectangle
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

                        // Evaluate current values (expressions ON)
                        var sizeVal = rectSize.valueAtTime(t, false);
                        var roundVal = rectRound.valueAtTime(t, false);
                        var posVal = grpPos.valueAtTime(t, false);

                        // Remove expressions, set static values
                        rectSize.expression = "";
                        rectSize.setValue(sizeVal);

                        rectRound.expression = "";
                        rectRound.setValue(roundVal);

                        grpPos.expression = "";
                        grpPos.setValue(posVal);

                        // Remove controls for a "normal" shape
                        var fx = ly.property("ADBE Effect Parade");
                        if (fx) {
                            for (var p = fx.numProperties; p >= 1; p--) {
                                var fxName = fx.property(p).name;
                                if (fxName === "Padding" || fxName === "Roundness" || fxName === "Target Layer") {
                                    fx.property(p).remove();
                                }
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
