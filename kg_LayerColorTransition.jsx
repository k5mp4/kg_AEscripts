/*
Layer Color Transition for Adobe After Effects
- シェイプレイヤー: Fill 色を HSL ベースで遷移 (A→B→A)
- その他レイヤー:   実行時ダイアログで方式を選択:
    [塗り]       Fill エフェクトで A→B→元の色 を遷移
                 (コンポジットオプション > エフェクトの不透明度で元の色を露出)
    [色被り補正] 色被り補正 (Tint) エフェクト × 2 で遷移
                 Tint A / Tint B の「色合いの量」でフェードイン/アウト制御
- エフェクトコントロール:
    カラー A: 登場/退場色
    カラー B: 通常表示色
    遷移時間: 遷移にかける秒数
    色を反転: A と B を入れ替え
- 登場: inPoint から n秒かけて A→B
- 退場: outPoint の n秒前から B→A (シェイプ) / B→元の色 (その他)
- 単体選択: レイヤー自身にエフェクトを追加
- 複数選択: ヌルレイヤーを生成し一括制御

Install:
1) Save to Scripts folder
2) Run: File > Scripts > kg_LayerColorTransition.jsx

Usage:
1) Select layer(s)
2) Run the script
*/

(function () {

    var SCRIPT_NAME = "Layer Color Transition";

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
            if (prop.matchName === "ADBE Vector Group") {
                var contents = prop.property("ADBE Vectors Group");
                if (contents) {
                    findAllFillsInGroup(contents, results);
                }
            }
        }
        return results;
    }

    // Shared HSL helper functions (embedded in each expression string)
    var HSL_HELPERS =
        "function hue2rgb(p, q, t) {\n" +
        "    if (t < 0) t += 1;\n" +
        "    if (t > 1) t -= 1;\n" +
        "    if (t < 1/6) return p + (q - p) * 6 * t;\n" +
        "    if (t < 0.5) return q;\n" +
        "    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;\n" +
        "    return p;\n" +
        "}\n" +
        "function rgbToHsl(c) {\n" +
        "    var r = c[0], g = c[1], b = c[2];\n" +
        "    var max = Math.max(r, g, b), min = Math.min(r, g, b);\n" +
        "    var l = (max + min) / 2;\n" +
        "    var h = 0, s = 0;\n" +
        "    if (max !== min) {\n" +
        "        var d = max - min;\n" +
        "        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);\n" +
        "        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);\n" +
        "        else if (max === g) h = (b - r) / d + 2;\n" +
        "        else h = (r - g) / d + 4;\n" +
        "        h /= 6;\n" +
        "    }\n" +
        "    return [h, s, l];\n" +
        "}\n" +
        "function hslToRgb(h, s, l) {\n" +
        "    var r, g, b;\n" +
        "    if (s === 0) {\n" +
        "        r = g = b = l;\n" +
        "    } else {\n" +
        "        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;\n" +
        "        var p = 2 * l - q;\n" +
        "        r = hue2rgb(p, q, h + 1/3);\n" +
        "        g = hue2rgb(p, q, h);\n" +
        "        b = hue2rgb(p, q, h - 1/3);\n" +
        "    }\n" +
        "    return [r, g, b];\n" +
        "}\n" +
        "function lerpHsl(cA, cB, t) {\n" +
        "    var hslA = rgbToHsl(cA), hslB = rgbToHsl(cB);\n" +
        "    var dh = hslB[0] - hslA[0];\n" +
        "    if (dh > 0.5) dh -= 1;\n" +
        "    if (dh < -0.5) dh += 1;\n" +
        "    var rgb = hslToRgb(hslA[0] + dh * t, hslA[1] + (hslB[1] - hslA[1]) * t, hslA[2] + (hslB[2] - hslA[2]) * t);\n" +
        "    var alphaA = cA[3] !== undefined ? cA[3] : 1;\n" +
        "    var alphaB = cB[3] !== undefined ? cB[3] : 1;\n" +
        "    return [rgb[0], rgb[1], rgb[2], alphaA + (alphaB - alphaA) * t];\n" +
        "}\n" +
        "function easeOut(t) { return 1 - Math.pow(1 - t, 3); }\n" +
        "function easeIn(t)  { return t * t * t; }\n";

    /**
     * Shape layer: Fill color expression (A→B→A)
     */
    function buildShapeExpression(controlSource) {
        return (
            HSL_HELPERS +
            "var ctrl     = " + controlSource + ";\n" +
            "var colorA   = ctrl.effect(\"カラー A\")(1);\n" +
            "var colorB   = ctrl.effect(\"カラー B\")(1);\n" +
            "var n        = ctrl.effect(\"遷移時間\")(1);\n" +
            "if (ctrl.effect(\"色を反転\")(1) == 1) { var tmp = colorA; colorA = colorB; colorB = tmp; }\n" +
            "var inP      = thisLayer.inPoint;\n" +
            "var outP     = thisLayer.outPoint;\n" +
            "var t        = time;\n" +
            "var inDone   = inP + n;\n" +
            "var outStart = outP - n;\n" +
            "var result;\n" +
            "if (t < inP) {\n" +
            "    result = colorA;\n" +
            "} else if (n > 0 && t < inDone) {\n" +
            "    result = lerpHsl(colorA, colorB, easeOut(Math.min((t - inP) / n, 1)));\n" +
            "} else if (n > 0 && t >= outStart && t < outP) {\n" +
            "    result = lerpHsl(colorB, colorA, easeIn(Math.min((t - outStart) / n, 1)));\n" +
            "} else if (t >= outP) {\n" +
            "    result = colorA;\n" +
            "} else {\n" +
            "    result = colorB;\n" +
            "}\n" +
            "result;"
        );
    }

    /**
     * Non-shape layer [塗り方式]: Fill effect color expression
     * 入場前半 (n/2): A→B  /  退場後半 (n/2): B→A  /  それ以外: B
     */
    function buildFillColorExpression(controlSource) {
        return (
            HSL_HELPERS +
            "var ctrl   = " + controlSource + ";\n" +
            "var colorA = ctrl.effect(\"カラー A\")(1);\n" +
            "var colorB = ctrl.effect(\"カラー B\")(1);\n" +
            "var n      = ctrl.effect(\"遷移時間\")(1);\n" +
            "if (ctrl.effect(\"色を反転\")(1) == 1) { var tmp = colorA; colorA = colorB; colorB = tmp; }\n" +
            "var inP    = thisLayer.inPoint;\n" +
            "var outP   = thisLayer.outPoint;\n" +
            "var t      = time;\n" +
            "var half   = n / 2;\n" +
            "var result;\n" +
            "if (t < inP) {\n" +
            "    result = colorA;\n" +
            "} else if (half > 0 && t < inP + half) {\n" +
            "    result = lerpHsl(colorA, colorB, easeOut(Math.min((t - inP) / half, 1)));\n" +
            "} else if (half > 0 && t >= outP - half && t < outP) {\n" +
            "    result = lerpHsl(colorB, colorA, easeIn(Math.min((t - (outP - half)) / half, 1)));\n" +
            "} else if (t >= outP) {\n" +
            "    result = colorA;\n" +
            "} else {\n" +
            "    result = colorB;\n" +
            "}\n" +
            "result;"
        );
    }

    /**
     * Non-shape layer [塗り方式]: compositing options opacity expression (0→100 range)
     * 入場: 前半100%(A→B), 後半100→0%(B→元の色)
     * 中間: 0%
     * 退場: 前半0→100%(元の色→B), 後半100%(B→A)
     */
    function buildFillOpacityExpression(controlSource) {
        return (
            "function easeIn(t)  { return t * t * t; }\n" +
            "function easeOut(t) { return 1 - Math.pow(1 - t, 3); }\n" +
            "var ctrl   = " + controlSource + ";\n" +
            "var n      = ctrl.effect(\"遷移時間\")(1);\n" +
            "var inP    = thisLayer.inPoint;\n" +
            "var outP   = thisLayer.outPoint;\n" +
            "var t      = time;\n" +
            "var half   = n / 2;\n" +
            "var result;\n" +
            "if (t < inP || t >= outP) {\n" +
            "    result = 1;\n" +
            "} else if (half > 0 && t < inP + half) {\n" +
            "    result = 1;\n" +
            "} else if (half > 0 && t < inP + n) {\n" +
            "    result = 1 - easeIn(Math.min((t - (inP + half)) / half, 1));\n" +
            "} else if (half > 0 && t >= outP - n && t < outP - half) {\n" +
            "    result = easeOut(Math.min((t - (outP - n)) / half, 1));\n" +
            "} else if (half > 0 && t >= outP - half) {\n" +
            "    result = 1;\n" +
            "} else {\n" +
            "    result = 0;\n" +
            "}\n" +
            "result * 100;"
        );
    }

    function findCompOpacity(effect) {
        try {
            var co = effect.property("Compositing Options");
            if (co) {
                var p = co.property("Effect Opacity");
                if (p && typeof p.value === "number") return p;
            }
        } catch (e) {}
        return null;
    }

    function setCompOpacityKeyframes(prop, layer, n) {
        var inP  = layer.inPoint;
        var outP = layer.outPoint;
        n = Math.min(n, (outP - inP) / 2);
        var half = n / 2;

        while (prop.numKeys > 0) prop.removeKey(1);

        var t1 = inP;
        var t2 = inP  + half;
        var t3 = inP  + n;
        var t4 = outP - n;
        var t5 = outP - half;
        var t6 = outP;

        if (t3 >= t4) {
            var mid = (inP + outP) / 2;
            prop.setValueAtTime(t1, 100);
            prop.setValueAtTime(mid, 0);
            prop.setValueAtTime(t6, 100);
        } else {
            prop.setValueAtTime(t1, 100);
            prop.setValueAtTime(t2, 100);
            prop.setValueAtTime(t3, 0);
            prop.setValueAtTime(t4, 0);
            prop.setValueAtTime(t5, 100);
            prop.setValueAtTime(t6, 100);
        }

        var ease = [new KeyframeEase(0, 33.33)];
        for (var k = 1; k <= prop.numKeys; k++) {
            try {
                prop.setInterpolationTypeAtKey(
                    k,
                    KeyframeInterpolationType.BEZIER,
                    KeyframeInterpolationType.BEZIER
                );
                prop.setEaseAtKey(k, ease, ease);
            } catch (e) {}
        }
    }

    /**
     * Non-shape layer [塗り方式]: Fill エフェクトを追加しコンポジットオプションで元の色を露出
     */
    function applyToNonShapeLayerFill(layer, colorExpr, opacityExpr, n) {
        var comp = layer.containingComp;
        var fx = comp.layer(layer.index).property("ADBE Effect Parade");
        var fillEffect = fx.addProperty("ADBE Fill");
        if (!fillEffect) throw new Error("Fill エフェクトの追加に失敗しました。");
        fillEffect.name = "カラートランジション";

        var colorProp = fillEffect.property(3);
        if (!colorProp) throw new Error("Fill エフェクト: カラープロパティが見つかりません。");
        colorProp.expression = colorExpr;

        var compOpacity = findCompOpacity(fillEffect);
        if (!compOpacity) throw new Error("Fill エフェクト: コンポジットオプションの不透明度が見つかりません。");

        if (compOpacity.canSetExpression) {
            compOpacity.expression = opacityExpr;
        } else {
            setCompOpacityKeyframes(compOpacity, layer, n);
        }
    }

    /**
     * Non-shape layer: Tint A の「色合いの量」エクスプレッション (0→100 range)
     * 入場前・退場後: 100%  /  中間: 0%
     * 入場前半 (n/2): A→B クロスフェード中に 100→0%
     * 退場後半 (n/2): B→A クロスフェード中に 0→100%
     */
    function buildTintAmountAExpression(controlSource) {
        return (
            "function easeIn(t)  { return t * t * t; }\n" +
            "function easeOut(t) { return 1 - Math.pow(1 - t, 3); }\n" +
            "var ctrl  = " + controlSource + ";\n" +
            "var inP   = thisLayer.inPoint;\n" +
            "var outP  = thisLayer.outPoint;\n" +
            "var n     = Math.min(ctrl.effect(\"遷移時間\")(1), (outP - inP) / 2);\n" +
            "var t     = time;\n" +
            "var half  = n / 2;\n" +
            "var result;\n" +
            "if (t < inP || t >= outP) {\n" +
            "    result = 100;\n" +
            "} else if (half > 0 && t < inP + half) {\n" +
            "    result = 100 * (1 - easeOut(Math.min((t - inP) / half, 1)));\n" +
            "} else if (half > 0 && t >= outP - half) {\n" +
            "    result = 100 * easeIn(Math.min((t - (outP - half)) / half, 1));\n" +
            "} else {\n" +
            "    result = 0;\n" +
            "}\n" +
            "result;"
        );
    }

    /**
     * Non-shape layer: Tint B の「色合いの量」エクスプレッション (0→100 range)
     * 入場前半: 0→100% (A→B クロスフェード)
     * 入場後半: 100→0% (B→元の色)
     * 中間: 0%
     * 退場前半: 0→100% (元の色→B)
     * 退場後半: 100→0% (B→A クロスフェード)
     * 入場前・退場後: 0%
     */
    function buildTintAmountBExpression(controlSource) {
        return (
            "function easeIn(t)  { return t * t * t; }\n" +
            "function easeOut(t) { return 1 - Math.pow(1 - t, 3); }\n" +
            "var ctrl  = " + controlSource + ";\n" +
            "var inP   = thisLayer.inPoint;\n" +
            "var outP  = thisLayer.outPoint;\n" +
            "var n     = Math.min(ctrl.effect(\"遷移時間\")(1), (outP - inP) / 2);\n" +
            "var t     = time;\n" +
            "var half  = n / 2;\n" +
            "var result;\n" +
            "if (t < inP || t >= outP) {\n" +
            "    result = 0;\n" +
            "} else if (half > 0 && t < inP + half) {\n" +
            "    result = 100 * easeOut(Math.min((t - inP) / half, 1));\n" +
            "} else if (half > 0 && t < inP + n) {\n" +
            "    result = 100 * (1 - easeIn(Math.min((t - (inP + half)) / half, 1)));\n" +
            "} else if (half > 0 && t >= outP - n && t < outP - half) {\n" +
            "    result = 100 * easeOut(Math.min((t - (outP - n)) / half, 1));\n" +
            "} else if (half > 0 && t >= outP - half) {\n" +
            "    result = 100 * (1 - easeIn(Math.min((t - (outP - half)) / half, 1)));\n" +
            "} else {\n" +
            "    result = 0;\n" +
            "}\n" +
            "result;"
        );
    }

    /**
     * Add effect controls (Color A, Color B, 遷移時間, 色を反転) to a layer.
     */
    function addEffectControls(layer) {
        var comp = layer.containingComp;
        var layerIndex = layer.index;

        var fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.addProperty("ADBE Color Control").name = "カラー A";

        fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.addProperty("ADBE Color Control").name = "カラー B";

        fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.addProperty("ADBE Slider Control").name = "遷移時間";

        fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.addProperty("ADBE Checkbox Control").name = "色を反転";

        // Default values
        fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.property("カラー A").property(1).setValue([1, 1, 1, 1]);
        fx.property("カラー B").property(1).setValue([0, 0, 0, 1]);
        fx.property("遷移時間").property(1).setValue(0.5);
        fx.property("色を反転").property(1).setValue(0);
    }

    /**
     * Apply color expression to all fills of a shape layer.
     */
    function applyToShapeLayer(layer, expr) {
        var comp = layer.containingComp;
        var contents = comp.layer(layer.index).property("ADBE Root Vectors Group");
        if (!contents) {
            throw new Error("シェイプコンテンツが見つかりません。");
        }
        var fills = findAllFillsInGroup(contents);
        if (fills.length === 0) {
            throw new Error("塗りが見つかりません。");
        }
        for (var f = 0; f < fills.length; f++) {
            var colorProp = fills[f].property("ADBE Vector Fill Color");
            if (colorProp) {
                colorProp.expression = expr;
            }
        }
    }

    /**
     * Non-shape layer [色被り補正方式]: 色被り補正 (Tint) × 2 を追加する。
     * colors = { aBlack, aWhite, bBlack, bWhite } 各値は 0xRRGGBB 整数
     * Map Black/White To は値で直接設定し、「色合いの量」にエクスプレッションを設定する。
     * property(1) = Map Black To, property(2) = Map White To, property(3) = Amount to Tint
     */
    function applyToNonShapeLayerWithTint(layer, colors, amountAExpr, amountBExpr) {
        var comp = layer.containingComp;
        var idx  = layer.index;

        function toAeColor(hex) {
            return [(hex >> 16 & 0xFF) / 255, (hex >> 8 & 0xFF) / 255, (hex & 0xFF) / 255, 1];
        }

        var tintA = comp.layer(idx).property("ADBE Effect Parade").addProperty("ADBE Tint");
        if (!tintA) throw new Error("色被り補正 A エフェクトの追加に失敗しました。");
        tintA.name = "カラートランジション A";
        tintA.property(1).setValue(toAeColor(colors.aBlack));
        tintA.property(2).setValue(toAeColor(colors.aWhite));
        tintA.property(3).expression = amountAExpr;

        var tintB = comp.layer(idx).property("ADBE Effect Parade").addProperty("ADBE Tint");
        if (!tintB) throw new Error("色被り補正 B エフェクトの追加に失敗しました。");
        tintB.name = "カラートランジション B";
        tintB.property(1).setValue(toAeColor(colors.bBlack));
        tintB.property(2).setValue(toAeColor(colors.bWhite));
        tintB.property(3).expression = amountBExpr;
    }

    /**
     * 色被り補正方式用エフェクトコントロール: 遷移時間のみ追加
     */
    function addTintEffectControls(layer) {
        var comp       = layer.containingComp;
        var layerIndex = layer.index;
        var fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.addProperty("ADBE Slider Control").name = "遷移時間";
        fx = comp.layer(layerIndex).property("ADBE Effect Parade");
        fx.property("遷移時間").property(1).setValue(0.5);
    }

    /**
     * Show effect-type selection dialog for non-shape layers.
     * Returns { type: "fill" }
     *      or { type: "tint", aBlack, aWhite, bBlack, bWhite }  (colors as 0xRRGGBB)
     *      or null (cancelled).
     */
    function showEffectTypeDialog() {
        var dlg = new Window("dialog", SCRIPT_NAME);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 10;
        dlg.margins = 16;

        // --- 方式選択 ---
        var methodPanel = dlg.add("panel", undefined, "エフェクト方式");
        methodPanel.orientation = "column";
        methodPanel.alignChildren = ["left", "center"];
        methodPanel.spacing = 6;
        methodPanel.margins = [10, 15, 10, 10];

        var radioFill = methodPanel.add("radiobutton", undefined, "塗り  (Fill + コンポジットオプション)");
        var radioTint = methodPanel.add("radiobutton", undefined, "色被り補正  (Tint × 2 + 色合いの量)");
        radioFill.value = true;

        // --- 色被り補正カラー設定 ---
        var tintPanel = dlg.add("panel", undefined, "色被り補正 カラー設定");
        tintPanel.orientation = "column";
        tintPanel.alignChildren = ["fill", "top"];
        tintPanel.spacing = 8;
        tintPanel.margins = [10, 15, 10, 10];
        tintPanel.enabled = false;

        // 6桁 hex 文字列を返すヘルパー
        function toHex(n) {
            var h = n.toString(16).toUpperCase();
            while (h.length < 6) h = "0" + h;
            return "#" + h;
        }

        // カラーボタン行を追加し、色の取得関数を返す
        function makeColorRow(parent, label, defaultColor) {
            var row = parent.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            row.spacing = 8;

            var lbl = row.add("statictext", undefined, label + ":");
            lbl.preferredSize.width = 150;

            var btn = row.add("button", undefined, toHex(defaultColor));
            btn.preferredSize = [80, 22];

            var current = defaultColor;
            btn.onClick = function () {
                var picked = $.colorPicker(current);
                if (picked >= 0) {
                    current = picked;
                    btn.text = toHex(current);
                }
            };
            return function () { return current; };
        }

        var pA = tintPanel.add("panel", undefined, "カラートランジション A");
        pA.orientation = "column";
        pA.alignChildren = ["left", "center"];
        pA.spacing = 4;
        pA.margins = [10, 15, 10, 8];
        var getABlack = makeColorRow(pA, "ブラックをマップ", 0x000000);
        var getAWhite = makeColorRow(pA, "ホワイトをマップ", 0xFFFFFF);

        var pB = tintPanel.add("panel", undefined, "カラートランジション B");
        pB.orientation = "column";
        pB.alignChildren = ["left", "center"];
        pB.spacing = 4;
        pB.margins = [10, 15, 10, 8];
        var getBBlack = makeColorRow(pB, "ブラックをマップ", 0x000000);
        var getBWhite = makeColorRow(pB, "ホワイトをマップ", 0xFFFFFF);

        radioFill.onClick = function () { tintPanel.enabled = false; };
        radioTint.onClick = function () { tintPanel.enabled = true;  };

        // --- ボタン ---
        var btnGroup = dlg.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignment = ["right", "center"];
        btnGroup.spacing = 8;

        var btnCancel = btnGroup.add("button", undefined, "キャンセル", { name: "cancel" });
        var btnOk     = btnGroup.add("button", undefined, "OK",         { name: "ok" });

        var result = null;
        btnOk.onClick = function () {
            if (radioTint.value) {
                result = {
                    type:    "tint",
                    aBlack:  getABlack(),
                    aWhite:  getAWhite(),
                    bBlack:  getBBlack(),
                    bWhite:  getBWhite()
                };
            } else {
                result = { type: "fill" };
            }
            dlg.close();
        };
        btnCancel.onClick = function () { dlg.close(); };

        dlg.show();
        return result;
    }

    /**
     * Generate a unique null layer name in the comp.
     */
    function generateUniqueNullName(comp) {
        var baseName = "カラートランジション コントロール";
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

    function main() {
        var comp = getActiveComp();
        if (!comp) {
            alert("コンポジションをアクティブにしてください。");
            return;
        }

        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            alert("レイヤーを選択してください。");
            return;
        }

        // 非シェイプレイヤーが含まれる場合のみダイアログを表示
        var hasNonShape = false;
        for (var i = 0; i < sel.length; i++) {
            if (!(sel[i] instanceof ShapeLayer)) { hasNonShape = true; break; }
        }

        var dlgResult = { type: "fill" }; // デフォルト (シェイプのみの場合は使わない)
        if (hasNonShape) {
            dlgResult = showEffectTypeDialog();
            if (!dlgResult) return; // キャンセル
        }

        app.beginUndoGroup(SCRIPT_NAME);

        var successCount = 0;
        var errors = [];
        var nullName;

        if (sel.length === 1) {
            // --- 単体モード: レイヤー自身にエフェクトを追加 ---
            var layer = sel[0];
            try {
                if (layer instanceof ShapeLayer) {
                    addEffectControls(layer);
                    applyToShapeLayer(layer, buildShapeExpression("thisLayer"));
                } else if (dlgResult.type === "tint") {
                    addTintEffectControls(layer);
                    applyToNonShapeLayerWithTint(
                        layer,
                        dlgResult,
                        buildTintAmountAExpression("thisLayer"),
                        buildTintAmountBExpression("thisLayer")
                    );
                } else {
                    addEffectControls(layer);
                    var n = layer.property("ADBE Effect Parade").property("遷移時間").property(1).value;
                    applyToNonShapeLayerFill(
                        layer,
                        buildFillColorExpression("thisLayer"),
                        buildFillOpacityExpression("thisLayer"),
                        n
                    );
                }
                successCount++;
            } catch (e) {
                errors.push(layer.name + ": " + e.toString());
            }
        } else {
            // --- 複数モード: ヌルレイヤーを生成して一括制御 ---
            // 選択レイヤーの最上位インデックスを事前に取得
            var topIndex = sel[0].index;
            for (var k = 1; k < sel.length; k++) {
                if (sel[k].index < topIndex) topIndex = sel[k].index;
            }

            nullName = generateUniqueNullName(comp);
            var controlNull = comp.layers.addNull(); // 先頭(index 1)に追加される
            controlNull.name = nullName;
            controlNull.label = 14; // パープル

            // ヌル挿入で選択レイヤーが1つ下にずれるため +1 して moveBefore
            controlNull.moveBefore(comp.layer(topIndex + 1));

            // 方式に応じたエフェクトコントロールをヌルに追加
            if (dlgResult.type === "tint") {
                addTintEffectControls(controlNull);
            } else {
                addEffectControls(controlNull);
            }

            // ヌルの表示範囲を選択レイヤー全体に合わせる
            var minIn = sel[0].inPoint, maxOut = sel[0].outPoint;
            for (var k = 1; k < sel.length; k++) {
                if (sel[k].inPoint  < minIn)  minIn  = sel[k].inPoint;
                if (sel[k].outPoint > maxOut) maxOut = sel[k].outPoint;
            }
            controlNull.inPoint  = minIn;
            controlNull.outPoint = maxOut;

            var controlSource = "thisComp.layer(\"" + nullName + "\")";
            var shapeExpr     = buildShapeExpression(controlSource);

            // 非シェイプ用エクスプレッション / 値を方式に応じて準備
            var fillColorExpr, fillOpacityExpr, fillN;
            var tintAmountAExpr, tintAmountBExpr;
            if (dlgResult.type === "tint") {
                tintAmountAExpr = buildTintAmountAExpression(controlSource);
                tintAmountBExpr = buildTintAmountBExpression(controlSource);
            } else {
                fillColorExpr   = buildFillColorExpression(controlSource);
                fillOpacityExpr = buildFillOpacityExpression(controlSource);
                fillN           = controlNull.property("ADBE Effect Parade").property("遷移時間").property(1).value;
            }

            for (var j = 0; j < sel.length; j++) {
                var layer = sel[j];
                try {
                    if (layer instanceof ShapeLayer) {
                        applyToShapeLayer(layer, shapeExpr);
                    } else if (dlgResult.type === "tint") {
                        applyToNonShapeLayerWithTint(layer, dlgResult, tintAmountAExpr, tintAmountBExpr);
                    } else {
                        applyToNonShapeLayerFill(layer, fillColorExpr, fillOpacityExpr, fillN);
                    }
                    successCount++;
                } catch (e) {
                    errors.push(layer.name + ": " + e.toString());
                }
            }
        }

        app.endUndoGroup();

        var msg = successCount + "個のレイヤーにカラートランジションを適用しました。";
        if (sel.length > 1) {
            msg += "\nコントロールヌル: \"" + nullName + "\"";
        }
        if (errors.length > 0) {
            msg += "\n\nエラー:\n" + errors.join("\n");
        }
        alert(msg);
    }

    main();

})();
